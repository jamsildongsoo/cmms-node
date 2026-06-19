import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MdmController, MetaController } from './mdm.controller';
import { MdmService } from './mdm.service';
import { Plant } from '../../entities/plant.entity';
import { Department } from '../../entities/department.entity';
import { Role } from '../../entities/role.entity';
import { RoleDetail } from '../../entities/role-detail.entity';
import { User } from '../../entities/users.entity';
import { Warehouse } from '../../entities/warehouse.entity';
import { CodeGroup } from '../../entities/code-group.entity';
import { CodeItem } from '../../entities/code-item.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Plant,
      Department,
      Role,
      RoleDetail,
      User,
      Warehouse,
      CodeGroup,
      CodeItem,
    ]),
  ],
  controllers: [MdmController, MetaController],
  providers: [MdmService],
  exports: [MdmService, TypeOrmModule], // 다른 모듈에서 User 레포지토리 등 참조 가능하도록 export
})
export class MdmModule {}
