import { Global, Module } from '@nestjs/common';
import { PermissionPolicyService } from './permission-policy.service';

@Global()
@Module({
  providers: [PermissionPolicyService],
  exports: [PermissionPolicyService],
})
export class PermissionPolicyModule {}
