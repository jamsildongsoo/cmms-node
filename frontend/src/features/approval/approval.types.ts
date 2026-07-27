import type {
  ApprovalResult,
  ApprovalStepType,
} from '../../constants/approval';
import type { LinkableModule } from '../../constants/module';
import type { DocStatus } from '../../constants/status';
import type { RichTextDocument } from '../../types/richText';

export type ApprovalInbox = 'pending' | 'sent' | 'referenced' | 'processed';

export interface ApprovalDocument {
  id: string;
  title: string;
  content: RichTextDocument | null;
  drafterId: string;
  fileGroupId: number | null;
  status: DocStatus;
  refModule: LinkableModule | null;
  refNo: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalStep {
  stepNo: number;
  approverId: string;
  approvalType: ApprovalStepType;
  approvalResult: ApprovalResult | null;
  actionAt: string | null;
  comments: string | null;
}

export interface ApprovalDetail {
  approval: ApprovalDocument;
  steps: ApprovalStep[];
}

export interface ApprovalUser {
  id: string;
  name: string;
  title?: string | null;
  position?: string | null;
  departmentName?: string | null;
  departmentId?: string | null;
  useYn?: string;
}

export interface ApprovalLine {
  approverId: string;
  approvalType: Exclude<ApprovalStepType, 'D'>;
}

export interface ApprovalSubmitRequest {
  approval: {
    title: string;
    content?: RichTextDocument | null;
    fileGroupId?: number | null;
    status?: DocStatus;
  };
  steps?: ApprovalLine[];
  refNo?: string | null;
  refModule?: LinkableModule | null;
}
