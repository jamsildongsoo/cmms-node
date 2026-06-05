import { Module } from '@nestjs/common';
import { InventoryTxController } from './inventory-tx.controller';
import { InventoryTxService } from './inventory-tx.service';

@Module({
  controllers: [InventoryTxController],
  providers: [InventoryTxService],
  exports: [InventoryTxService],
})
export class InventoryTxModule {}
