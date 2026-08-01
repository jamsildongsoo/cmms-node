import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Approval } from '../../entities/approval.entity';
import { Board } from '../../entities/board.entity';
import { FileAttachment } from '../../entities/file-attachment.entity';
import { PmRecord } from '../../entities/pm-record.entity';
import { PurchaseRequest } from '../../entities/purchase-request.entity';
import { RoleDetail } from '../../entities/role-detail.entity';
import { User } from '../../entities/users.entity';
import { WorkOrder } from '../../entities/work-order.entity';
import { WorkPermit } from '../../entities/work-permit.entity';
import { AppModule } from '../constants/module.constants';
import type { PermAction } from '../constants/permission.constants';
import { DocStatus } from '../constants/status.constants';

interface ModulePermissionParams {
  companyId: string;
  roleId: string;
  module: AppModule;
  action: PermAction;
}

interface AssertModulePermissionParams extends ModulePermissionParams {
  resourceLabel?: string;
}

interface AnyModulePermissionParams {
  companyId: string;
  roleId: string;
  module: AppModule;
  actions: PermAction[];
  message?: string;
}

interface SystemAdminParams {
  companyId: string;
  roleId: string | null | undefined;
  userId: string;
}

interface BoardMutationParams {
  companyId: string;
  roleId: string;
  action: 'U' | 'D';
  ownerId: string;
  operatorId: string;
}

interface ApprovalReadParams {
  approval: {
    drafterId: string;
    status: string | null | undefined;
    steps?: Array<{ approverId: string }>;
  };
  userId: string;
}

interface OwnTempOrPermissionParams {
  companyId: string;
  roleId: string;
  module: AppModule;
  status: string | null | undefined;
  ownerId: string | null | undefined;
  operatorId: string;
  resourceLabel: string;
}

interface AttachmentPermissionParams {
  companyId: string;
  roleId: string;
  userId: string;
  group: FileAttachment;
}

interface AttachmentMutationParams extends AttachmentPermissionParams {
  action: 'U' | 'D';
}

interface AttachmentDocumentAccess {
  kind: 'draft' | 'document';
  module: AppModule;
  ownerId: string;
  editable: boolean;
}

const ACTION_LABEL: Record<PermAction, string> = {
  C: '등록',
  R: '조회',
  U: '수정',
  D: '삭제',
  A: '승인',
};

@Injectable()
export class PermissionPolicyService {
  constructor(private readonly dataSource: DataSource) {}

  async hasModulePermission(params: ModulePermissionParams): Promise<boolean> {
    // 일반 모듈 권한은 role-detail 매트릭스의 C/R/U/D/A 플래그로만 판정한다.
    const permission = await this.dataSource.getRepository(RoleDetail).findOne({
      where: {
        companyId: params.companyId,
        roleId: params.roleId,
        moduleDetail: params.module,
      },
    });
    if (!permission) return false;

    const actionProperty: Record<PermAction, keyof RoleDetail> = {
      C: 'permC',
      R: 'permR',
      U: 'permU',
      D: 'permD',
      A: 'permA',
    };
    return permission[actionProperty[params.action]] === 'Y';
  }

  async assertModulePermission(params: AssertModulePermissionParams): Promise<void> {
    // SYSTEM 사용자는 모듈 매트릭스를 우회하되, 별도 SYSTEM 재검증 규칙을 따른다.
    if (await this.isSystemAdmin(params)) return;

    // 일반 사용자는 요청한 모듈/행위의 단일 권한 보유 여부로 판정한다.
    const allowed = await this.hasModulePermission(params);
    if (!allowed) {
      if (!params.resourceLabel) {
        throw new ForbiddenException('권한이 없습니다.');
      }
      throw new ForbiddenException(
        `${params.resourceLabel} ${ACTION_LABEL[params.action]} 권한이 없습니다.`,
      );
    }
  }

  async assertAnyModulePermission(params: AnyModulePermissionParams): Promise<void> {
    // 여러 행위 중 하나라도 허용되면 통과시키는 any-of 규칙이다.
    if (await this.isSystemAdmin(params)) return;

    const allowed = await Promise.all(
      params.actions.map((action) => this.hasModulePermission({
        companyId: params.companyId,
        roleId: params.roleId,
        module: params.module,
        action,
      })),
    );
    if (!allowed.some(Boolean)) {
      throw new ForbiddenException(params.message ?? '권한이 없습니다.');
    }
  }

  async assertSystemAdmin(params: SystemAdminParams): Promise<void> {
    // SYSTEM 예외는 roleId 문자열만 보지 않고, SYSTEM 회사 소속 실사용자인지 DB로 재확인한다.
    if (params.companyId !== 'SYSTEM' || params.roleId?.toUpperCase() !== 'SYSTEM') {
      throw new ForbiddenException('SYSTEM 권한이 필요합니다.');
    }

    const systemUser = await this.dataSource.getRepository(User).findOne({
      where: {
        companyId: 'SYSTEM',
        id: params.userId,
        deleteYn: 'N',
      },
    });
    if (systemUser?.roleId?.toUpperCase() !== 'SYSTEM') {
      throw new ForbiddenException('유효하지 않은 SYSTEM 사용자입니다.');
    }
  }

  async assertCanMutateBoard(params: BoardMutationParams): Promise<void> {
    // 게시판은 본인 글/댓글이면 허용하고, 타인 글/댓글이면 BRD U/D 권한으로 판정한다.
    if (params.ownerId === params.operatorId) return;

    const hasPermission = await this.hasModulePermission({
      companyId: params.companyId,
      roleId: params.roleId,
      module: AppModule.BRD,
      action: params.action,
    });
    if (!hasPermission) {
      const actionLabel = params.action === 'U' ? '수정' : '삭제';
      throw new ForbiddenException(
        `본인 게시글이 아니거나 게시판 ${actionLabel} 권한이 없습니다.`,
      );
    }
  }

  assertCanReadApproval(params: ApprovalReadParams): void {
    const { approval, userId } = params;
    // 결재 상세는 기안자 또는 결재선 참여자만 조회할 수 있고, 임시저장 문서는 비공개다.
    if (approval.drafterId === userId) return;
    if (approval.status === DocStatus.TEMP) {
      throw new NotFoundException('결재 문서를 찾을 수 없습니다.');
    }
    const isParticipant = (approval.steps || []).some((step) => step.approverId === userId);
    if (!isParticipant) {
      throw new NotFoundException('결재 문서를 찾을 수 없습니다.');
    }
  }

  async assertCanUpdateOwnTempOrPermission(
    params: OwnTempOrPermissionParams,
  ): Promise<boolean> {
    return this.assertCanMutateOwnTempOrPermission({ ...params, action: 'U' });
  }

  async assertCanDeleteOwnTempOrPermission(
    params: OwnTempOrPermissionParams,
  ): Promise<boolean> {
    return this.assertCanMutateOwnTempOrPermission({ ...params, action: 'D' });
  }

  async assertCanReadAttachmentGroup(params: AttachmentPermissionParams): Promise<void> {
    const access = await this.resolveAttachmentDocumentAccess(params.group);

    // refNo 없는 임시 첨부는 생성자 본인만 접근할 수 있다.
    if (access.kind === 'draft') {
      if (access.ownerId !== params.userId) {
        throw new ForbiddenException('첨부파일 조회 권한이 없습니다.');
      }
      return;
    }

    // 수정 가능한 문서의 첨부는 작성자 본인이 우선 조회할 수 있다.
    if (access.editable && access.ownerId === params.userId) {
      return;
    }

    // 그 외 조회는 원문서 모듈의 R 권한을 따른다.
    await this.assertAnyModulePermission({
      companyId: params.companyId,
      roleId: params.roleId,
      module: access.module,
      actions: ['R'],
      message: '첨부파일 조회 권한이 없습니다.',
    });
  }

  async assertCanMutateAttachmentGroup(params: AttachmentMutationParams): Promise<void> {
    const access = await this.resolveAttachmentDocumentAccess(params.group);

    // 임시 첨부는 생성자 본인만 수정/삭제할 수 있다.
    if (access.kind === 'draft') {
      if (access.ownerId !== params.userId) {
        throw new ForbiddenException('임시 첨부는 생성자 본인만 수정할 수 있습니다.');
      }
      return;
    }

    // 원문서가 수정 불가 상태면 첨부도 함께 잠긴다.
    if (!access.editable) {
      throw new ForbiddenException('현재 상태의 문서는 첨부를 수정할 수 없습니다.');
    }

    // 수정 가능한 문서의 첨부는 작성자 본인이 우선 수정/삭제할 수 있다.
    if (access.ownerId === params.userId) {
      return;
    }

    // 타인 문서 첨부 수정/삭제는 원문서 모듈의 U/D 권한을 따른다.
    await this.assertAnyModulePermission({
      companyId: params.companyId,
      roleId: params.roleId,
      module: access.module,
      actions: [params.action],
      message: '첨부파일 수정 권한이 없습니다.',
    });
  }

  private async assertCanMutateOwnTempOrPermission(
    params: OwnTempOrPermissionParams & { action: 'U' | 'D' },
  ): Promise<boolean> {
    // 본인 임시저장 문서는 모듈 U/D 없이도 수정/삭제를 허용한다.
    const isOwnTemp = params.status === DocStatus.TEMP && params.ownerId === params.operatorId;
    if (isOwnTemp) return true;

    // 그 외 경우에는 일반 모듈 권한 규칙을 그대로 적용한다.
    await this.assertModulePermission({
      companyId: params.companyId,
      roleId: params.roleId,
      module: params.module,
      action: params.action,
      resourceLabel: params.resourceLabel,
    });
    return false;
  }

  private async resolveAttachmentDocumentAccess(
    group: FileAttachment,
  ): Promise<AttachmentDocumentAccess> {
    const module = this.parseModule(group.refModule);
    const refNo = group.refNo?.trim();
    if (!refNo) {
      return {
        kind: 'draft',
        module,
        ownerId: group.createdBy,
        editable: true,
      };
    }

    // 첨부 권한은 파일 자체가 아니라 연결된 원문서의 작성자/상태/모듈 권한을 기준으로 해석한다.
    switch (module) {
      case AppModule.APR: {
        const approval = await this.dataSource.getRepository(Approval).findOne({
          where: { companyId: group.companyId, id: refNo, deleteYn: 'N' },
        });
        if (!approval) throw new NotFoundException('연결된 전자결재 문서를 찾을 수 없습니다.');
        return {
          kind: 'document',
          module,
          ownerId: approval.drafterId,
          editable: this.isEditableStatus(approval.status),
        };
      }
      case AppModule.WO: {
        const workOrder = await this.dataSource.getRepository(WorkOrder).findOne({
          where: { companyId: group.companyId, id: refNo, deleteYn: 'N' },
        });
        if (!workOrder) throw new NotFoundException('연결된 작업지시 문서를 찾을 수 없습니다.');
        return {
          kind: 'document',
          module,
          ownerId: workOrder.createdBy,
          editable: this.isEditableStatus(workOrder.status),
        };
      }
      case AppModule.WP: {
        const workPermit = await this.dataSource.getRepository(WorkPermit).findOne({
          where: { companyId: group.companyId, id: refNo, deleteYn: 'N' },
        });
        if (!workPermit) throw new NotFoundException('연결된 작업허가 문서를 찾을 수 없습니다.');
        return {
          kind: 'document',
          module,
          ownerId: workPermit.createdBy,
          editable: this.isEditableStatus(workPermit.status),
        };
      }
      case AppModule.PM: {
        const pmRecord = await this.dataSource.getRepository(PmRecord).findOne({
          where: { companyId: group.companyId, id: refNo, deleteYn: 'N' },
        });
        if (!pmRecord) throw new NotFoundException('연결된 예방점검 문서를 찾을 수 없습니다.');
        return {
          kind: 'document',
          module,
          ownerId: pmRecord.createdBy,
          editable: this.isEditableStatus(pmRecord.status),
        };
      }
      case AppModule.PUR: {
        const request = await this.dataSource.getRepository(PurchaseRequest).findOne({
          where: { companyId: group.companyId, id: refNo, deleteYn: 'N' },
        });
        if (!request) throw new NotFoundException('연결된 구매 문서를 찾을 수 없습니다.');
        return {
          kind: 'document',
          module,
          ownerId: request.requesterId,
          editable: this.isEditableStatus(request.status),
        };
      }
      case AppModule.BRD: {
        const boardId = Number(refNo);
        if (!Number.isSafeInteger(boardId) || boardId <= 0) {
          throw new BadRequestException('연결된 게시글 번호가 올바르지 않습니다.');
        }
        const board = await this.dataSource.getRepository(Board).findOne({
          where: { companyId: group.companyId, id: boardId, deleteYn: 'N' },
        });
        if (!board) throw new NotFoundException('연결된 게시글을 찾을 수 없습니다.');
        return {
          kind: 'document',
          module,
          ownerId: board.createdBy,
          editable: true,
        };
      }
      default:
        throw new ForbiddenException('지원하지 않는 첨부 참조 모듈입니다.');
    }
  }

  private isEditableStatus(status: string | null | undefined): boolean {
    return [DocStatus.TEMP, DocStatus.REJECTED].includes(status as DocStatus);
  }

  private parseModule(value: string | null | undefined): AppModule {
    const module = value?.trim().toUpperCase();
    if (!module || !Object.values(AppModule).includes(module as AppModule)) {
      throw new BadRequestException('유효하지 않은 파일 참조 모듈입니다.');
    }
    return module as AppModule;
  }

  private async isSystemAdmin(params: {
    companyId: string;
    roleId: string | null | undefined;
  }): Promise<boolean> {
    return params.companyId === 'SYSTEM' && params.roleId?.toUpperCase() === 'SYSTEM';
  }
}
