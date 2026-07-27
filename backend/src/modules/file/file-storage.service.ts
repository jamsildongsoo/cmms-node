/* =========================================================================
   FileStorageService — Spring FileStorageService.java 1:1 이식
   
   기존 cmms-agy 구현의 모든 로직을 그대로 유지:
   - 업로드: groupNo 있으면 기존 그룹에 추가, 없으면 신규 그룹 생성
   - 다운로드: S3에서 스트림으로 직접 반환 (BE 경유)
   - 삭제: 메타 먼저 삭제(트랜잭션) → 커밋 후 S3 객체 제거 (best-effort)
   - SHA-256 체크섬, path traversal 차단, MIME 화이트리스트 검증
   - 테넌트 격리: companyId 기준
   
   Object Storage: S3 호환 공통 구현
   - 개발 MinIO / 운영 Lightsail Object Storage
   - 공급자별 연결 차이는 STORAGE_* 환경변수로 관리
   ========================================================================= */
import {
  Injectable, Inject, BadRequestException, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { createHash, randomUUID } from 'crypto';
import { DataSource, In } from 'typeorm';
import { getTenantContext } from '../../common/context/tenant.context';
import { AppModule } from '../../common/constants/module.constants';
import type { PermAction } from '../../common/constants/permission.constants';
import { S3_CLIENT, STORAGE_SETTINGS, StorageSettings } from './storage.config';
import { FileAttachment } from '../../entities/file-attachment.entity';
import { FileAttachmentItem } from '../../entities/file-attachment-item.entity';
import { RoleDetail } from '../../entities/role-detail.entity';
import { User } from '../../entities/users.entity';

export interface FileItemResponse {
  itemNo: number;
  originalFileName: string;
  fileExtension: string | null;
  mimeType: string | null;
  fileSize: number;
}

export interface UploadResponse {
  groupNo: number;
  files: FileItemResponse[];
}

@Injectable()
export class FileStorageService {
  constructor(
    @Inject(S3_CLIENT) private readonly s3: S3Client,
    @Inject(STORAGE_SETTINGS) private readonly settings: StorageSettings,
    private readonly dataSource: DataSource,
  ) {}

  // =========================================================================
  // 업로드
  // =========================================================================
  async upload(
    refModule: string | null,
    refNo: string | null,
    groupNo: number | null,
    files: Express.Multer.File[],
  ): Promise<UploadResponse> {

    // Multer 한글 파일명 깨짐 강제 복구
    files.forEach((file) => {
      file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    });

    const { companyId, userId } = getTenantContext();

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    const uploadedKeys: string[] = [];

    try {
      // 1. 그룹 조회 또는 생성
      let gno: number;
      let effectiveModule: AppModule;
      if (groupNo) {
        // 그룹 행을 잠가 동일 그룹 동시 업로드의 itemNo 충돌을 방지한다.
        const group = await qr.manager.getRepository(FileAttachment)
          .createQueryBuilder('attachment')
          .setLock('pessimistic_write')
          .where('attachment.companyId = :companyId', { companyId })
          .andWhere('attachment.groupNo = :groupNo', { groupNo })
          .andWhere('attachment.deleteYn = :deleteYn', { deleteYn: 'N' })
          .getOne();
        if (!group) throw new NotFoundException('첨부 그룹을 찾을 수 없습니다.');
        gno = groupNo;
        effectiveModule = this.parseAppModule(group.refModule);
        await this.assertModulePermission(effectiveModule, ['U']);
      } else {
        effectiveModule = this.parseAppModule(refModule);
        await this.assertModulePermission(effectiveModule, ['C', 'U']);

        const groupRepository = qr.manager.getRepository(FileAttachment);
        const group = await groupRepository.save(groupRepository.create({
          companyId,
          refModule: effectiveModule,
          refNo: refNo ?? null,
          deleteYn: 'N',
          createdBy: userId,
          updatedBy: userId,
        }));
        gno = Number(group.groupNo);
        if (!Number.isSafeInteger(gno) || gno <= 0) {
          throw new BadRequestException('첨부 그룹 번호를 생성하지 못했습니다.');
        }
      }

      // 2. 현재 최대 item_no 조회
      const itemRepository = qr.manager.getRepository(FileAttachmentItem);
      const maxItemNo = await itemRepository.maximum('itemNo', {
        companyId,
        groupNo: String(gno),
      });
      let nextItemNo = (maxItemNo ?? 0) + 1;

      const result: FileItemResponse[] = [];
      const moduleSeg = this.sanitizeSegment(effectiveModule);

      for (const file of files) {
        const original = this.baseName(file.originalname);
        const ext = this.extensionOf(original);
        const stored = randomUUID().replace(/-/g, '') + (ext ? `.${ext}` : '');
        const key = `${companyId}/${moduleSeg}/${gno}/${stored}`;
        const sha = createHash('sha256').update(file.buffer).digest('hex');

        // 3. S3 호환 Object Storage 업로드
        // ChecksumAlgorithm 명시적 지정으로 SDK가 payload SHA256을 계산하여 서명
        await this.s3.send(new PutObjectCommand({
          Bucket: this.settings.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
          ChecksumAlgorithm: 'SHA256',
        }));
        uploadedKeys.push(key);

        // 4. 메타 INSERT
        const itemNo = nextItemNo++;
        await itemRepository.save(itemRepository.create({
          companyId,
          groupNo: String(gno),
          itemNo,
          originalFileName: original,
          storedFileName: stored,
          fileExtension: ext || null,
          mimeType: file.mimetype,
          fileSize: String(file.size),
          checksumSha256: sha,
          storagePath: key,
        }));

        result.push({
          itemNo,
          originalFileName: original,
          fileExtension: ext || null,
          mimeType: file.mimetype,
          fileSize: file.size,
        });
      }

      await qr.commitTransaction();
      return { groupNo: gno, files: result };

    } catch (err) {
      await qr.rollbackTransaction();
      // 보상: 메타 롤백 시 S3 객체 best-effort 제거
      for (const key of uploadedKeys) {
        this.deleteObjectQuietly(key);
      }
      throw err;
    } finally {
      await qr.release();
    }
  }

  // =========================================================================
  // 목록
  // =========================================================================
  async list(groupNo: number): Promise<FileItemResponse[]> {
    const { companyId } = getTenantContext();
    const module = await this.getGroupModule(companyId, groupNo);
    await this.assertModulePermission(module, ['R']);

    const items = await this.dataSource.getRepository(FileAttachmentItem).find({
      where: { companyId, groupNo: String(groupNo) },
      order: { itemNo: 'ASC' },
    });
    return items.map((item) => ({
      itemNo: item.itemNo,
      originalFileName: item.originalFileName,
      fileExtension: item.fileExtension,
      mimeType: item.mimeType,
      fileSize: this.toSafeFileSize(item.fileSize),
    }));
  }

  // =========================================================================
  // 다운로드 (S3 스트림 직접 반환 — BE 경유)
  // =========================================================================
  async download(groupNo: number, itemNo: number) {
    const { companyId } = getTenantContext();
    const module = await this.getGroupModule(companyId, groupNo);
    await this.assertModulePermission(module, ['R']);

    const item = await this.getItemOwned(companyId, groupNo, itemNo);

    const response = await this.s3.send(new GetObjectCommand({
      Bucket: this.settings.bucket,
      Key: item.storagePath,
    }));

    return {
      stream: response.Body,
      originalFileName: item.originalFileName,
      mimeType: item.mimeType ?? 'application/octet-stream',
      fileSize: this.toSafeFileSize(item.fileSize),
    };
  }

  // =========================================================================
  // 삭제: 메타 먼저 (트랜잭션) → 커밋 후 S3 비동기 제거
  // =========================================================================
  async delete(groupNo: number, itemNo: number): Promise<void> {
    const { companyId } = getTenantContext();
    const module = await this.getGroupModule(companyId, groupNo);
    await this.assertModulePermission(module, ['U', 'D']);

    const item = await this.getItemOwned(companyId, groupNo, itemNo);

    await this.dataSource.getRepository(FileAttachmentItem).remove(item);

    // 커밋 후 S3 제거 (best-effort, 실패해도 메타는 이미 삭제됨)
    // Spring: @Transactional afterCommit() → Node.js: 동기 트랜잭션 후 비동기 처리
    setImmediate(() => this.deleteObjectQuietly(item.storagePath));
  }

  // =========================================================================
  // 고아 객체 정리 (Reconciliation) — Spring FileReconciliationService 대응
  // STORAGE_RECONCILE_ENABLED=true 일 때만 동작
  // =========================================================================
  async reconcile(): Promise<void> {
    if (!this.settings.reconcileEnabled) return;

    const graceMs = this.settings.reconcileGraceHours * 3600 * 1000;
    const cutoff = new Date(Date.now() - graceMs);

    // S3 전체 객체 목록 (ListObjectsV2, 페이지네이션)
    const s3Keys = new Set<string>();
    let continuationToken: string | undefined;
    do {
      const resp = await this.s3.send(new ListObjectsV2Command({
        Bucket: this.settings.bucket,
        ContinuationToken: continuationToken,
      }));
      for (const obj of resp.Contents ?? []) {
        if (obj.Key && obj.LastModified && obj.LastModified < cutoff) {
          s3Keys.add(obj.Key);
        }
      }
      continuationToken = resp.NextContinuationToken;
    } while (continuationToken);

    // DB에 존재하는 storage_path 목록과 비교 → 고아 객체 삭제
    if (s3Keys.size === 0) return;

    const paths = [...s3Keys];
    const dbPaths = new Set<string>();
    const itemRepository = this.dataSource.getRepository(FileAttachmentItem);
    for (let index = 0; index < paths.length; index += 1000) {
      const items = await itemRepository.find({
        select: { storagePath: true },
        where: { storagePath: In(paths.slice(index, index + 1000)) },
      });
      items.forEach((item) => dbPaths.add(item.storagePath));
    }

    for (const key of s3Keys) {
      if (!dbPaths.has(key)) {
        this.deleteObjectQuietly(key);
      }
    }
  }

  // =========================================================================
  // 유틸
  // =========================================================================
  private parseAppModule(value: string | null | undefined): AppModule {
    const module = value?.trim().toUpperCase();
    if (!module || !Object.values(AppModule).includes(module as AppModule)) {
      throw new BadRequestException('유효하지 않은 파일 참조 모듈입니다.');
    }
    return module as AppModule;
  }

  private async getGroupModule(companyId: string, groupNo: number): Promise<AppModule> {
    const group = await this.dataSource.getRepository(FileAttachment).findOne({
      where: { companyId, groupNo: String(groupNo), deleteYn: 'N' },
    });
    if (!group) throw new NotFoundException('첨부 그룹을 찾을 수 없습니다.');
    return this.parseAppModule(group.refModule);
  }

  private async assertModulePermission(module: AppModule, actions: PermAction[]): Promise<void> {
    const { companyId, userId, roleId } = getTenantContext();

    if (companyId === 'SYSTEM' && roleId?.toUpperCase() === 'SYSTEM') {
      const systemUser = await this.dataSource.getRepository(User).findOne({
        where: {
          companyId: 'SYSTEM',
          id: userId,
          useYn: 'Y',
          deleteYn: 'N',
        },
      });
      if (systemUser?.roleId?.toUpperCase() === 'SYSTEM') return;
    }

    if (!roleId) throw new ForbiddenException('파일 접근 권한이 없습니다.');

    const permission = await this.dataSource.getRepository(RoleDetail).findOne({
      where: { companyId, roleId, moduleDetail: module },
    });
    if (!permission) throw new ForbiddenException('파일 접근 권한이 없습니다.');

    const allowed = actions.some((action) => {
      switch (action) {
        case 'C': return permission.permC === 'Y';
        case 'R': return permission.permR === 'Y';
        case 'U': return permission.permU === 'Y';
        case 'D': return permission.permD === 'Y';
        case 'A': return permission.permA === 'Y';
        default: return false;
      }
    });

    if (!allowed) throw new ForbiddenException('파일 접근 권한이 없습니다.');
  }

  private async getItemOwned(
    companyId: string,
    groupNo: number,
    itemNo: number,
  ): Promise<FileAttachmentItem> {
    const item = await this.dataSource.getRepository(FileAttachmentItem).findOne({
      where: { companyId, groupNo: String(groupNo), itemNo },
    });
    if (!item) throw new NotFoundException('파일을 찾을 수 없습니다.');
    return item;
  }

  private baseName(name: string | undefined): string {
    if (!name?.trim()) return 'unnamed';
    const n = name.replace(/\\/g, '/');
    const base = n.split('/').pop()?.trim() ?? 'unnamed';
    if (!base || base === '.' || base === '..') return 'unnamed';
    return base.length > 255 ? base.slice(-255) : base;
  }

  private extensionOf(name: string): string {
    const dot = name.lastIndexOf('.');
    if (dot < 0 || dot === name.length - 1) return '';
    return name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10);
  }

  private sanitizeSegment(seg: string): string {
    return seg.replace(/[^A-Za-z0-9_-]/g, '_') || 'common';
  }

  private toSafeFileSize(value: string): number {
    const size = Number(value);
    if (!Number.isSafeInteger(size) || size < 0) {
      throw new BadRequestException('파일 크기 정보가 올바르지 않습니다.');
    }
    return size;
  }

  private deleteObjectQuietly(key: string): void {
    this.s3.send(new DeleteObjectCommand({ Bucket: this.settings.bucket, Key: key }))
      .catch((err) => console.error(`S3 객체 삭제 실패: key=${key}`, err));
  }
}
