import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { MdmModule } from './modules/mdm/mdm.module';
import { MasterModule } from './modules/master/master.module';
import { TenantInterceptor } from './common/interceptors/tenant.interceptor';
import { SequenceModule } from './common/sequence/sequence.module';
import { InventoryTxModule } from './modules/inventory-tx/inventory-tx.module';
import { PmModule } from './modules/pm/pm.module';
import { WorkOrderModule } from './modules/work-order/work-order.module';
import { WorkPermitModule } from './modules/work-permit/work-permit.module';
import { FileModule } from './modules/file/file.module';
import { ApprovalModule } from './modules/approval/approval.module';
import { BoardModule } from './modules/board/board.module';
import { ProcurementModule } from './modules/procurement/procurement.module';
import { SystemModule } from './modules/system/system.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
    }),
    DatabaseModule,
    AuthModule,
    MdmModule,
    MasterModule,
    SequenceModule,
    InventoryTxModule,
    PmModule,
    WorkOrderModule,
    WorkPermitModule,
    FileModule,
    ApprovalModule,
    BoardModule,
    ProcurementModule,
    SystemModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantInterceptor,
    },
  ],
})
export class AppModule {}
