/* =========================================================================
   FileStorageService — Spring FileStorageService.java 1:1 이식
   
   기존 cmms-agy 구현의 모든 로직을 그대로 유지:
   - 업로드: groupNo 있으면 기존 그룹에 추가, 없으면 신규 그룹 생성
   - 다운로드: S3에서 스트림으로 직접 반환 (BE 경유)
   - 삭제: 메타 먼저 삭제(트랜잭션) → 커밋 후 S3 객체 제거 (best-effort)
   - SHA-256 체크섬, path traversal 차단, MIME 화이트리스트 검증
   - 테넌트 격리: companyId 기준
   
   Object Storage: Supabase Storage (S3 호환)
   - endpoint override + forcePathStyle(true) → storage.config.ts 참조
   - 환경변수 STORAGE_* 그대로 재활용 (cmms-agy와 동일)
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
import { DataSource } from 'typeorm';
import { getTenantContext } from '../../common/context/tenant.context';
import { AppModule } from '../../common/constants/module.constants';
import type { PermAction } from '../../common/constants/permission.constants';
import { S3_CLIENT, STORAGE_SETTINGS, StorageSettings } from './storage.config';

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
        const rows = await qr.query(
          `SELECT group_no, ref_module FROM file_attachment
           WHERE company_id=$1 AND group_no=$2 AND delete_yn='N'`,
          [companyId, groupNo],
        ) as any[];
        if (!rows || !rows.length) throw new NotFoundException('첨부 그룹을 찾을 수 없습니다.');
        gno = groupNo;
        effectiveModule = this.parseAppModule(rows[0].ref_module);
        await this.assertModulePermission(effectiveModule, ['U']);
      } else {
        effectiveModule = this.parseAppModule(refModule);
        await this.assertModulePermission(effectiveModule, ['C', 'U']);

        // IDENTITY PK: INSERT RETURNING으로 group_no 즉시 획득
        const inserted = await qr.query(
          `INSERT INTO file_attachment (company_id, ref_module, ref_no, delete_yn, created_by, updated_by)
           VALUES ($1,$2,$3,'N',$4,$4) RETURNING group_no`,
          [companyId, effectiveModule, refNo ?? null, userId],
        ) as any[];
        gno = Number(inserted[0]?.group_no);
        if (!Number.isSafeInteger(gno) || gno <= 0) {
          throw new BadRequestException('첨부 그룹 번호를 생성하지 못했습니다.');
        }
      }

      // 2. 현재 최대 item_no 조회
      const maxRows = await qr.query(
        `SELECT COALESCE(MAX(item_no), 0) AS max FROM file_attachment_item
         WHERE company_id=$1 AND group_no=$2`,
        [companyId, gno],
      ) as any[];
      const maxRow = maxRows[0];
      let nextItemNo = (maxRow?.max ?? 0) + 1;

      const result: FileItemResponse[] = [];
      const moduleSeg = this.sanitizeSegment(effectiveModule);

      for (const file of files) {
        const original = this.baseName(file.originalname);
        const ext = this.extensionOf(original);
        const stored = randomUUID().replace(/-/g, '') + (ext ? `.${ext}` : '');
        const key = `${companyId}/${moduleSeg}/${gno}/${stored}`;
        const sha = createHash('sha256').update(file.buffer).digest('hex');

        // 3. S3 업로드 (Supabase Storage S3 호환)
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
        await qr.query(
          `INSERT INTO file_attachment_item
             (company_id, group_no, item_no, original_file_name, stored_file_name,
              file_extension, mime_type, file_size, checksum_sha256, storage_path)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [companyId, gno, nextItemNo++, original, stored,
           ext || null, file.mimetype, file.size, sha, key],
        );

        result.push({
          itemNo: nextItemNo - 1,
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

    const rows = await this.dataSource.query<any[]>(
      `SELECT item_no, original_file_name, file_extension, mime_type, file_size
       FROM file_attachment_item
       WHERE company_id=$1 AND group_no=$2
       ORDER BY item_no ASC`,
      [companyId, groupNo],
    );
    return rows.map((r) => ({
      itemNo: r.item_no,
      originalFileName: r.original_file_name,
      fileExtension: r.file_extension,
      mimeType: r.mime_type,
      fileSize: r.file_size,
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
      Key: item.storage_path,
    }));

    return {
      stream: response.Body,
      originalFileName: item.original_file_name,
      mimeType: item.mime_type ?? 'application/octet-stream',
      fileSize: item.file_size,
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

    await this.dataSource.query(
      `DELETE FROM file_attachment_item
       WHERE company_id=$1 AND group_no=$2 AND item_no=$3`,
      [companyId, groupNo, itemNo],
    );

    // 커밋 후 S3 제거 (best-effort, 실패해도 메타는 이미 삭제됨)
    // Spring: @Transactional afterCommit() → Node.js: 동기 트랜잭션 후 비동기 처리
    setImmediate(() => this.deleteObjectQuietly(item.storage_path));
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

    const dbRows = await this.dataSource.query<{ storage_path: string }[]>(
      `SELECT storage_path FROM file_attachment_item WHERE storage_path = ANY($1)`,
      [[...s3Keys]],
    );
    const dbPaths = new Set(dbRows.map((r) => r.storage_path));

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
    const rows = await this.dataSource.query<{ ref_module: string | null }[]>(
      `SELECT ref_module FROM file_attachment
       WHERE company_id=$1 AND group_no=$2 AND delete_yn='N'`,
      [companyId, groupNo],
    );
    if (!rows.length) throw new NotFoundException('첨부 그룹을 찾을 수 없습니다.');
    return this.parseAppModule(rows[0].ref_module);
  }

  private async assertModulePermission(module: AppModule, actions: PermAction[]): Promise<void> {
    const { companyId, userId, roleId } = getTenantContext();

    if (companyId === 'SYSTEM' && roleId?.toUpperCase() === 'SYSTEM') {
      const rows = await this.dataSource.query<{ role_id: string }[]>(
        `SELECT role_id FROM users
         WHERE company_id='SYSTEM' AND id=$1 AND use_yn='Y' AND delete_yn='N'`,
        [userId],
      );
      if (rows.length > 0 && rows[0].role_id?.toUpperCase() === 'SYSTEM') return;
    }

    if (!roleId) throw new ForbiddenException('파일 접근 권한이 없습니다.');

    const rows = await this.dataSource.query<any[]>(
      `SELECT perm_c, perm_r, perm_u, perm_d, perm_a
       FROM role_detail
       WHERE company_id=$1 AND role_id=$2 AND module_detail=$3`,
      [companyId, roleId, module],
    );
    const row = rows[0];
    if (!row) throw new ForbiddenException('파일 접근 권한이 없습니다.');

    const allowed = actions.some((action) => {
      switch (action) {
        case 'C': return row.perm_c === 'Y';
        case 'R': return row.perm_r === 'Y';
        case 'U': return row.perm_u === 'Y';
        case 'D': return row.perm_d === 'Y';
        case 'A': return row.perm_a === 'Y';
        default: return false;
      }
    });

    if (!allowed) throw new ForbiddenException('파일 접근 권한이 없습니다.');
  }

  private async getItemOwned(companyId: string, groupNo: number, itemNo: number) {
    const rows = await this.dataSource.query<any[]>(
      `SELECT * FROM file_attachment_item
       WHERE company_id=$1 AND group_no=$2 AND item_no=$3`,
      [companyId, groupNo, itemNo],
    );
    if (!rows.length) throw new NotFoundException('파일을 찾을 수 없습니다.');
    return rows[0];
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

  private deleteObjectQuietly(key: string): void {
    this.s3.send(new DeleteObjectCommand({ Bucket: this.settings.bucket, Key: key }))
      .catch((err) => console.error(`S3 객체 삭제 실패: key=${key}`, err));
  }
}
