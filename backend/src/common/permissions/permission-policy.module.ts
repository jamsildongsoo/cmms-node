import { Global, Module } from '@nestjs/common';
import { PermissionPolicyService } from './permission-policy.service';
import { UserAccessService } from './user-access.service';

@Global()
@Module({
  providers: [PermissionPolicyService, UserAccessService],
  exports: [PermissionPolicyService, UserAccessService],
})
export class PermissionPolicyModule {}
