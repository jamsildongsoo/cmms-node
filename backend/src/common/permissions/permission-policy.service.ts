import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Approval } from '../../entities/approval.entity';
import { Board } from '../../entities/board.entity';
import { FileAttachment } from '../../entities/file-attachment.entity';
import { PmRecord } from '../../entities/pm-record.entity';
import { PurchaseRequest } from '../../entities/purchase-request.entity';
import { User } from '../../entities/users.entity';
import { WorkOrder } from '../../entities/work-order.entity';
import { WorkPermit } from '../../entities/work-permit.entity';
import { AppModule } from '../constants/module.constants';
import type { PermAction } from '../constants/permission.constants';
import { DocStatus } from '../constants/status.constants';
import { UserAccessService } from './user-access.service';

interface ModulePermissionParams {
  companyId: string;
  roleId: string;
  userId?: string;
  module: AppModule;
  action: PermAction;
}

interface AssertModulePermissionParams extends ModulePermissionParams {
  resourceLabel?: string;
}

interface AnyModulePermissionParams {
  companyId: string;
  roleId: string;
  userId?: string;
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
  userId?: string;
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
  constructor(
    private readonly dataSource: DataSource,
    private readonly userAccessService: UserAccessService,
  ) {}

  async hasActionPermission(params: ModulePermissionParams): Promise<boolean> {
    // userId로 실제 사용자의 role_detail 권한과 데이터 범위를 확인한다.
    if (!params.userId) return false;
    return this.userAccessService.hasAction(
      params.companyId,
      params.userId,
      params.module,
      params.action,
    );
  }

  async assertActionPermission(params: AssertModulePermissionParams): Promise<void> {
    // 일반 모듈 CRUD 권한을 확인한다. 문서 상태와 소유권은 업무 Service가 판단한다.
    const allowed = await this.hasActionPermission(params);
    if (!allowed) {
      if (!params.resourceLabel) {
        throw new ForbiddenException('권한이 없습니다.');
      }
      throw new ForbiddenException(
        `${params.resourceLabel} ${ACTION_LABEL[params.action]} 권한이 없습니다.`,
      );
    }
  }

  async assertAnyActionPermission(params: AnyModulePermissionParams): Promise<void> {
    // 전달된 행위 중 하나라도 허용되면 통과시키는 OR 정책이다.
    const allowed = await Promise.all(
      params.actions.map((action) => this.hasActionPermission({
        companyId: params.companyId,
        roleId: params.roleId,
        userId: params.userId,
        module: params.module,
        action,
      })),
    );
    if (!allowed.some(Boolean)) {
      throw new ForbiddenException(params.message ?? '권한이 없습니다.');
    }
  }

  async assertSystemAdmin(params: SystemAdminParams): Promise<void> {
    // JWT의 roleId만 신뢰하지 않고 SYSTEM 사용자 여부를 DB에서 재확인한다.
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
    // BRD U/D 권한 확인 후에도 게시글 작성자 본인만 수정·삭제할 수 있다.
    if (params.ownerId === params.operatorId) return;
    throw new ForbiddenException('본인이 작성한 게시글만 수정·삭제할 수 있습니다.');
  }

  assertCanReadApproval(params: ApprovalReadParams): void {
    const { approval, userId } = params;
    // 결재 상세는 기안자 또는 결재선 참여자만 조회하며 T 문서는 존재를 노출하지 않는다.
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
    // 모듈 U 권한은 Guard에서 확인하고, Service에서는 본인 T 문서 여부를 확인한다.
    return this.assertCanMutateOwnTempOrPermission({ ...params, action: 'U' });
  }

  async assertCanDeleteOwnTempOrPermission(
    params: OwnTempOrPermissionParams,
  ): Promise<boolean> {
    // 모듈 D 권한은 Guard에서 확인하고, Service에서는 본인 T 문서 여부를 확인한다.
    return this.assertCanMutateOwnTempOrPermission({ ...params, action: 'D' });
  }

  async assertCanReadAttachmentGroup(params: AttachmentPermissionParams): Promise<void> {
    // 첨부파일 권한은 파일이 아니라 연결된 원문서의 상태·소유권·R 권한으로 판단한다.
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
    await this.assertAnyActionPermission({
      companyId: params.companyId,
      roleId: params.roleId,
      userId: params.userId,
      module: access.module,
      actions: ['R'],
      message: '첨부파일 조회 권한이 없습니다.',
    });
  }

  async assertCanMutateAttachmentGroup(params: AttachmentMutationParams): Promise<void> {
    // 원문서가 편집 가능할 때만 첨부파일을 변경할 수 있다.
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
    await this.assertAnyActionPermission({
      companyId: params.companyId,
      roleId: params.roleId,
      userId: params.userId,
      module: access.module,
      actions: [params.action],
      message: '첨부파일 수정 권한이 없습니다.',
    });
  }

  private async assertCanMutateOwnTempOrPermission(
    params: OwnTempOrPermissionParams & { action: 'U' | 'D' },
  ): Promise<boolean> {
    // 모듈 U/D는 Guard에서 확인한다. R 문서는 원본을 수정하지 않고 신규 T 문서로 편집한다.
    if (params.status === DocStatus.TEMP && params.ownerId === params.operatorId) return true;
    throw new ForbiddenException('본인이 작성한 임시저장 문서만 수정·삭제할 수 있습니다.');
  }

  private async resolveAttachmentDocumentAccess(
    group: FileAttachment,
  ): Promise<AttachmentDocumentAccess> {
    // 참조 모듈별 원문서의 작성자와 편집 가능 상태를 공통 형식으로 변환한다.
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
    // 원문서 직접 수정이 가능한 공통 상태는 T와 R이다. R 편집은 신규 문서 생성으로 처리한다.
    return [DocStatus.TEMP, DocStatus.REJECTED].includes(status as DocStatus);
  }

  private parseModule(value: string | null | undefined): AppModule {
    // 등록된 AppModule만 참조 모듈로 허용한다.
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
