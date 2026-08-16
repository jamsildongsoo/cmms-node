import { Global, Module } from '@nestjs/common';
import { PermissionPolicyService } from './permission-policy.service';
import { DepartmentAccessService } from './department-access.service';

@Global()
@Module({
  providers: [PermissionPolicyService, DepartmentAccessService],
  exports: [PermissionPolicyService, DepartmentAccessService],
})
export class PermissionPolicyModule {}
