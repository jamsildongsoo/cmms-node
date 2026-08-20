import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryTxController } from './inventory-tx.controller';
import { InventoryTxService } from './inventory-tx.service';
import { InventoryStatus } from '../../entities/inventory-status.entity';
import { InventoryHistory } from '../../entities/inventory-history.entity';
import { InventoryMonthlyClosing } from '../../entities/inventory-monthly-closing.entity';
import { InventoryClosing } from '../../entities/inventory-closing.entity';
import { User } from '../../entities/users.entity';
import { InventoryDocument } from '../../entities/inventory-document.entity';
import { InventoryDocumentItem } from '../../entities/inventory-document-item.entity';

@Module({
  imports: [TypeOrmModule.forFeature([
      InventoryStatus,
      InventoryHistory,
      InventoryMonthlyClosing,
      InventoryClosing,
      User,
      InventoryDocument,
      InventoryDocumentItem,
    ])],
  controllers: [InventoryTxController],
  providers: [InventoryTxService],
  exports: [InventoryTxService],
})
export class InventoryTxModule {}
