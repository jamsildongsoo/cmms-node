export class ApprovalResponseDto {
  id!: string;
  title!: string;
  content!: Record<string, unknown> | null;
  drafterId!: string;
  fileGroupId!: number | null;
  status!: string;
  refModule!: string | null;
  refNo!: string | null;
  createdAt!: string;
  updatedAt!: string;
}

export class ApprovalStepResponseDto {
  stepNo!: number;
  approverId!: string;
  approvalType!: string;
  approvalResult!: string | null;
  actionAt!: string | null;
  comments!: string | null;
}

export class ApprovalDetailResponseDto {
  approval!: ApprovalResponseDto;
  steps!: ApprovalStepResponseDto[];
}
