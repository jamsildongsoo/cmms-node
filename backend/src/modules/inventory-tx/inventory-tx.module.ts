import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryTxController } from './inventory-tx.controller';
import { InventoryTxService } from './inventory-tx.service';
import { InventoryStatus } from '../../entities/inventory-status.entity';
import { InventoryHistory } from '../../entities/inventory-history.entity';
import { InventoryMonthlyClosing } from '../../entities/inventory-monthly-closing.entity';
import { User } from '../../entities/users.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InventoryStatus,
      InventoryHistory,
      InventoryMonthlyClosing,
      User,
    ]),
  ],
  controllers: [InventoryTxController],
  providers: [InventoryTxService],
  exports: [InventoryTxService],
})
export class InventoryTxModule {}
