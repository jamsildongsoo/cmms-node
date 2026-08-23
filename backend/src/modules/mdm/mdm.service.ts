import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, DataSource } from 'typeorm';
import { Plant } from '../../entities/plant.entity';
import { Department } from '../../entities/department.entity';
import { Role } from '../../entities/role.entity';
import { User } from '../../entities/users.entity';
import { Warehouse } from '../../entities/warehouse.entity';
import { CodeGroup } from '../../entities/code-group.entity';
import { CodeItem } from '../../entities/code-item.entity';
import { Company } from '../../entities/company.entity';
import { RoleDetail } from '../../entities/role-detail.entity';
import {
  CreateCompanyDto,
  CreateCompanyResponseDto,
} from './dto/create-company.dto';
import { CodeUtil } from '../../common/utils/code.util';
import { AppModule } from '../../common/sequence/sequence.service';
import { PERM_ACTIONS } from '../../common/constants/permission.constants';
import * as bcrypt from 'bcryptjs';

const DEFAULT_CODE_GROUPS = [
  {
    id: 'EQ_TYPE',
    name: '설비 유형',
    items: [
      ['PUMP', '펌프'],
      ['MOTOR', '모터'],
      ['BOILER', '보일러'],
      ['VALVE', '밸브'],
      ['COMPRESSOR', '압축기'],
      ['PANEL', '전기판넬'],
      ['ETC', '기타 설비'],
    ],
  },
  {
    id: 'INV_TYPE',
    name: '자재 유형',
    items: [
      ['INV_TYPE_01', '예비부품'],
      ['INV_TYPE_02', '소모성 공구'],
      ['INV_TYPE_03', '부자재'],
    ],
  },
  {
    id: 'PM_TYPE',
    name: '예방점검 유형',
    items: [
      ['INSPECT', '예방점검'],
      ['PATROL', '순회점검'],
      ['REPLACE', '소모품교체'],
      ['LEGAL', '정기법정검사'],
    ],
  },
  {
    id: 'WO_TYPE',
    name: '작업지시 유형',
    items: [
      ['BM', '고장정비'],
      ['PM', '예방보전'],
      ['CM', '개조/개선'],
      ['ETC', '기타 작업'],
    ],
  },
  {
    id: 'WP_TYPE',
    name: '작업허가 유형',
    items: [
      ['GENERAL', '일반위험작업'],
      ['FIRE', '화기작업'],
      ['CONFINED', '밀폐공간출입'],
      ['ELECTRIC', '정전작업'],
      ['HIGH_PLACE', '고소작업'],
      ['EXCAVATION', '굴착작업'],
      ['HEAVY_LOAD', '중량물취급'],
    ],
  },
  {
    id: 'BOARD_TYPE',
    name: '게시판 유형',
    items: [
      ['FREE', '자유게시판'],
      ['NOTICE', '공지사항'],
      ['WORK', '업무게시판'],
    ],
  },
  {
    id: 'PR_TYPE',
    name: '구매요청 유형',
    items: [
      ['MATERIAL', '자재 구매'],
      ['SPARE', '예비품 구매'],
      ['SERVICE', '외주/서비스'],
      ['ETC', '기타 구매'],
    ],
  },
] as const;

export type MdmUserInput = Partial<Omit<User, 'homePlantId'>> & {
  homePlantId?: string | null;
};

export type MdmUserResponse = Omit<User, 'passwordHash' | 'homePlantId'> & {
  homePlantId: string | null;
  initialPassword?: string;
};

@Injectable()
export class MdmService {
  constructor(
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
    @InjectRepository(Plant) private readonly plantRepo: Repository<Plant>,
    @InjectRepository(Department) private readonly departmentRepo: Repository<Department>,
    @InjectRepository(Role) private readonly roleRepo: Repository<Role>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Warehouse) private readonly warehouseRepo: Repository<Warehouse>,
    @InjectRepository(CodeGroup) private readonly codeGroupRepo: Repository<CodeGroup>,
    @InjectRepository(CodeItem) private readonly codeItemRepo: Repository<CodeItem>,
    @InjectRepository(Company) private readonly companyRepo: Repository<Company>,
    @InjectRepository(RoleDetail)
    private readonly roleDetailRepo: Repository<RoleDetail>,
  ) {}

  // =========================================================================
  // 2. 플랜트 (Plant)
  // =========================================================================
  async getPlantsByCompany(companyId: string, userId?: string): Promise<Plant[]> {
    // [M3 버그 차단] findAll 풀스캔 대신 반드시 companyId 조건 명시
    if (userId) return this.getPlantsForUse(companyId, userId);
    return this.plantRepo.find({ where: { companyId, deleteYn: 'N' } });
  }

  async getPlantsForUse(
    companyId: string,
    userId: string,
    requestedPlantId?: string,
  ): Promise<Plant[]> {
    const [plants, user] = await Promise.all([
      this.getPlantsByCompany(companyId),
      this.userRepo.findOne({ where: { companyId, id: userId, deleteYn: 'N' } }),
    ]);
    if (!user) return [];
    let allowedPlants = plants;
    if (user.scope !== 'COMPANY') {
      allowedPlants = plants.filter((plant) => plant.id === user.homePlantId);
    }
    return requestedPlantId
      ? allowedPlants.filter((plant) => plant.id === requestedPlantId)
      : allowedPlants;
  }

  async savePlant(companyId: string, plantDto: Partial<Plant>, operator: string): Promise<Plant> {
    const id = CodeUtil.normalize(plantDto.id);
    if (!id) throw new BadRequestException('플랜트 ID는 필수입니다.');

    const exists = await this.plantRepo.findOne({ where: { companyId, id } });
    if (exists) {
      if (exists.deleteYn === 'N') {
        throw new BadRequestException('이미 존재하는 플랜트 아이디입니다.');
      } else {
        // 이미 삭제된 레코드가 존재하면 덮어쓰기 복구 처리
        exists.name = plantDto.name || id;
        exists.deleteYn = 'N';
        exists.updatedBy = operator;
        return this.plantRepo.save(exists);
      }
    }

    const plant = this.plantRepo.create({
      ...plantDto,
      companyId,
      id,
      createdBy: operator,
      updatedBy: operator,
    });
    return this.plantRepo.save(plant);
  }

  async updatePlant(companyId: string, id: string, plantDto: Partial<Plant>, operator: string): Promise<Plant> {
    const plant = await this.plantRepo.findOne({ where: { companyId, id, deleteYn: 'N' } });
    if (!plant) throw new BadRequestException('플랜트를 찾을 수 없습니다.');

    plant.name = plantDto.name || plant.name;
    plant.updatedBy = operator;
    return this.plantRepo.save(plant);
  }

  async deletePlant(companyId: string, id: string, operator: string): Promise<void> {
    const plant = await this.plantRepo.findOne({ where: { companyId, id, deleteYn: 'N' } });
    if (!plant) throw new BadRequestException('플랜트를 찾을 수 없습니다.');

    plant.deleteYn = 'Y';
    plant.updatedBy = operator;
    await this.plantRepo.save(plant);
  }

  // =========================================================================
  // 3. 부서 (Department)
  // =========================================================================
  async getDepartmentsByCompany(companyId: string): Promise<Department[]> {
    // [M3 버그 차단] companyId 필터링 준수
    return this.departmentRepo.find({ where: { companyId, deleteYn: 'N' } });
  }

  async getDepartmentOptions(
    companyId: string,
    keyword?: string,
    limit = '30',
  ): Promise<Department[]> {
    const normalized = keyword?.trim().toLowerCase();
    const take = this.parseLookupLimit(limit);
    const departments = await this.getDepartmentsByCompany(companyId);
    return departments
      .filter((department) => !normalized
        || department.id.toLowerCase().includes(normalized)
        || department.name.toLowerCase().includes(normalized))
      .slice(0, take);
  }

  async saveDepartment(companyId: string, deptDto: Partial<Department>, operator: string): Promise<Department> {
    const id = CodeUtil.normalize(deptDto.id);
    if (!id) throw new BadRequestException('부서 ID는 필수입니다.');

    const parentId = CodeUtil.normalizeOrNull(deptDto.parentId);

    const exists = await this.departmentRepo.findOne({ where: { companyId, id } });
    if (exists) {
      if (exists.deleteYn === 'N') {
        throw new BadRequestException('이미 존재하는 부서 아이디입니다.');
      } else {
        exists.name = deptDto.name || id;
        exists.parentId = parentId;
        exists.deleteYn = 'N';
        exists.updatedBy = operator;
        return this.departmentRepo.save(exists);
      }
    }

    const dept = this.departmentRepo.create({
      ...deptDto,
      companyId,
      id,
      parentId,
      createdBy: operator,
      updatedBy: operator,
    });
    return this.departmentRepo.save(dept);
  }

  async updateDepartment(companyId: string, id: string, deptDto: Partial<Department>, operator: string): Promise<Department> {
    const dept = await this.departmentRepo.findOne({ where: { companyId, id, deleteYn: 'N' } });
    if (!dept) throw new BadRequestException('부서를 찾을 수 없습니다.');

    dept.name = deptDto.name || dept.name;
    dept.parentId = CodeUtil.normalizeOrNull(deptDto.parentId);
    dept.updatedBy = operator;
    return this.departmentRepo.save(dept);
  }

  async deleteDepartment(companyId: string, id: string, operator: string): Promise<void> {
    const dept = await this.departmentRepo.findOne({ where: { companyId, id, deleteYn: 'N' } });
    if (!dept) throw new BadRequestException('부서를 찾을 수 없습니다.');

    dept.deleteYn = 'Y';
    dept.updatedBy = operator;
    await this.departmentRepo.save(dept);
  }

  // =========================================================================
  // 4. 권한 그룹 (호환용 Role 목록)
  // =========================================================================
  async getRolesByCompany(companyId: string): Promise<Role[]> {
    return this.roleRepo.find({ where: { companyId, deleteYn: 'N' } });
  }

  async getRoleDetails(companyId: string, roleId: string): Promise<RoleDetail[]> {
    const role = await this.roleRepo.findOne({ where: { companyId, id: roleId, deleteYn: 'N' } });
    if (!role) throw new BadRequestException('Role을 찾을 수 없습니다.');
    const existing = await this.roleDetailRepo.find({ where: { companyId, roleId } });
    const byModule = new Map(existing.map((detail) => [detail.moduleDetail, detail]));
    return Object.values(AppModule).map((moduleDetail) => byModule.get(moduleDetail) ?? this.roleDetailRepo.create({
      companyId,
      roleId,
      moduleDetail,
      permC: 'N',
      permR: 'N',
      permU: 'N',
      permD: 'N',
      permA: 'N',
    }));
  }

  async saveRoleDetails(
    companyId: string,
    roleId: string,
    details: Partial<RoleDetail>[],
    operator: string,
  ): Promise<void> {
    const role = await this.roleRepo.findOne({ where: { companyId, id: roleId, deleteYn: 'N' } });
    if (!role) throw new BadRequestException('Role을 찾을 수 없습니다.');
    const validModules = new Set(Object.values(AppModule));
    const normalized = details.map((input) => {
      if (!input.moduleDetail || !validModules.has(input.moduleDetail as AppModule)) {
        throw new BadRequestException(`유효하지 않은 모듈 코드입니다: ${input.moduleDetail}`);
      }
      const result: Partial<RoleDetail> = { moduleDetail: input.moduleDetail };
      for (const action of PERM_ACTIONS) {
        const property = `perm${action}` as keyof RoleDetail;
        const value = input[property] as string | undefined;
        if (value !== 'Y' && value !== 'N') throw new BadRequestException('권한 값은 Y 또는 N이어야 합니다.');
        result[property] = value as never;
      }
      return result;
    });
    if (new Set(normalized.map((item) => item.moduleDetail)).size !== normalized.length) {
      throw new BadRequestException('같은 Role·모듈 권한을 중복 지정할 수 없습니다.');
    }
    await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(RoleDetail);
      const existing = await repository.find({ where: { companyId, roleId } });
      const byModule = new Map(existing.map((detail) => [detail.moduleDetail, detail]));
      const entities = normalized.map((input) => {
        const entity = byModule.get(input.moduleDetail!) ?? repository.create({ companyId, roleId, moduleDetail: input.moduleDetail!, createdBy: operator });
        Object.assign(entity, input, { updatedBy: operator });
        return entity;
      });
      await repository.save(entities);
    });
  }

  async saveRole(companyId: string, roleDto: Partial<Role>, operator: string): Promise<Role> {
    const id = CodeUtil.normalize(roleDto.id);
    if (!id) throw new BadRequestException('권한 그룹 ID는 필수입니다.');

    // [C5] SYSTEM 역할 배정 및 생성 차단
    if (id.toUpperCase() === 'SYSTEM') {
      throw new BadRequestException('SYSTEM 역할은 플랫폼 전용이므로 생성할 수 없습니다.');
    }

    const exists = await this.roleRepo.findOne({ where: { companyId, id } });
    if (exists) {
      if (exists.deleteYn === 'N') {
        throw new BadRequestException('이미 존재하는 권한 그룹 아이디입니다.');
      } else {
        exists.roleName = roleDto.roleName || id;
        exists.deleteYn = 'N';
        exists.updatedBy = operator;
        return this.roleRepo.save(exists);
      }
    }

    const role = this.roleRepo.create({
      ...roleDto,
      companyId,
      id,
      createdBy: operator,
      updatedBy: operator,
    });
    const savedRole = await this.roleRepo.save(role);

    return savedRole;
  }

  async updateRole(
    companyId: string,
    id: string,
    roleDto: Partial<Role>,
    operator: string,
  ): Promise<Role> {
    const role = await this.roleRepo.findOne({
      where: { companyId, id, deleteYn: 'N' },
    });
    if (!role) throw new BadRequestException('권한 그룹을 찾을 수 없습니다.');

    role.roleName = roleDto.roleName || role.roleName;
    role.updatedBy = operator;
    return this.roleRepo.save(role);
  }

  async deleteRole(companyId: string, id: string, operator: string): Promise<void> {
    const role = await this.roleRepo.findOne({ where: { companyId, id, deleteYn: 'N' } });
    if (!role) throw new BadRequestException('권한 그룹을 찾을 수 없습니다.');

    role.deleteYn = 'Y';
    role.updatedBy = operator;
    await this.roleRepo.save(role);
  }

  // =========================================================================
  // 5. 사용자 (User)
  // =========================================================================
  async getUsersByCompany(companyId: string): Promise<MdmUserResponse[]> {
    const users = await this.userRepo.find({
      where: { companyId, deleteYn: 'N' },
      order: { id: 'ASC' },
      relations: { department: true },
      select: {
        id: true,
        name: true,
        title: true,
        position: true,
        departmentId: true,
        roleId: true,
        scope: true,
        email: true,
        phone: true,
        homePlantId: true,
        useYn: true,
        department: {
          name: true
        }
      }
    });

    return users.map(({ homePlantId, ...u }) => ({
      ...u,
      homePlantId: homePlantId ?? null,
      departmentName: u.department?.name ?? null,
    })) as MdmUserResponse[];
  }

  async getUsersForUse(companyId: string): Promise<Partial<User>[]> {
    const users = await this.userRepo.find({
      select: {
        id: true,
        name: true,
        departmentId: true,
        position: true,
        title: true,
        department: {
          name: true,
        },
      },
      relations: { department: true },
      where: { companyId, useYn: 'Y', deleteYn: 'N' },
      order: { id: 'ASC' },
    });

    return users.map((user) => ({
      id: user.id,
      name: user.name,
      departmentId: user.departmentId,
      departmentName: user.department?.name ?? null,
      position: user.position,
      title: user.title,
    })) as Partial<User>[];
  }

  async getUserOptions(
    companyId: string,
    keyword?: string,
    limit = '30',
  ): Promise<Partial<User>[]> {
    const normalized = keyword?.trim().toLowerCase();
    const take = this.parseLookupLimit(limit);
    const users = await this.getUsersForUse(companyId);
    return users
      .filter((user) => !normalized
        || user.id?.toLowerCase().includes(normalized)
        || user.name?.toLowerCase().includes(normalized))
      .slice(0, take);
  }

  private parseLookupLimit(value?: string): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return 30;
    return Math.min(Math.floor(parsed), 100);
  }

  async saveUser(companyId: string, userDto: MdmUserInput, operator: string): Promise<MdmUserResponse> {
    const initialPassword = this.config.get<string>('INITIAL_USER_PASSWORD', 'init1234');
    if (initialPassword.length < 8) {
      throw new Error('INITIAL_USER_PASSWORD must be at least 8 characters long.');
    }
    const id = userDto.id?.trim();
    if (!id) throw new BadRequestException('사용자 ID는 필수입니다.');

    // [C5] SYSTEM 역할 배정 차단
    const requestedRoleId = CodeUtil.normalizeOrNull(userDto.roleId);
    const departmentId = CodeUtil.normalizeOrNull(userDto.departmentId);
    const roleId = requestedRoleId || 'USER';
    const scope = userDto.scope || 'PLANT';
    if (roleId && roleId.toUpperCase() === 'SYSTEM') {
      throw new BadRequestException('사용자에게 SYSTEM 역할을 할당할 수 없습니다.');
    }
    if (scope !== 'COMPANY' && scope !== 'PLANT') {
      throw new BadRequestException('Scope는 COMPANY 또는 PLANT이어야 합니다.');
    }
    const homePlantId = await this.validateHomePlant(companyId, scope, userDto.homePlantId);

    const exists = await this.userRepo.findOne({ where: { companyId, id } });
    if (exists) {
      if (exists.deleteYn === 'N') {
        throw new BadRequestException('이미 존재하는 사용자 아이디입니다.');
      } else {
        // 이미 삭제된 레코드가 존재하면 덮어쓰기 복구 처리
        exists.name = userDto.name || id;
        exists.roleId = roleId;
        exists.scope = scope;
        exists.departmentId = departmentId;
        exists.email = userDto.email || null;
        exists.phone = userDto.phone || null;
        exists.position = userDto.position || null;
        exists.title = userDto.title || null;
        exists.homePlantId = homePlantId;
        exists.passwordHash = await bcrypt.hash(initialPassword, 12);
        exists.useYn = 'Y';
        exists.deleteYn = 'N';
        exists.updatedBy = operator;
        const saved = await this.userRepo.save(exists);
        const { passwordHash: _passwordHash, homePlantId: savedHomePlantId, ...safeUser } = saved;
        return { ...safeUser, homePlantId: savedHomePlantId ?? null, initialPassword };
      }
    }

    const hash = await bcrypt.hash(initialPassword, 12);
    const user = this.userRepo.create({
      companyId,
      id,
      name: userDto.name || id,
      roleId,
      scope,
      departmentId,
      email: userDto.email || null,
      phone: userDto.phone || null,
      position: userDto.position || null,
      title: userDto.title || null,
      homePlantId,
      passwordHash: hash,
      useYn: 'Y',
      mustChangePassword: 'Y',
      createdBy: operator,
      updatedBy: operator,
    });
    const saved = await this.userRepo.save(user);
    const { passwordHash: _passwordHash, homePlantId: savedHomePlantId, ...safeUser } = saved;
    return { ...safeUser, homePlantId: savedHomePlantId ?? null, initialPassword };
  }

  async updateUser(companyId: string, id: string, userDto: MdmUserInput, operator: string): Promise<MdmUserResponse> {
    const user = await this.userRepo.findOne({ where: { companyId, id, deleteYn: 'N' } });
    if (!user) throw new BadRequestException('사용자를 찾을 수 없습니다.');

    const targetRoleId = CodeUtil.normalizeOrNull(userDto.roleId);
    const targetScope = userDto.scope || user.scope;
    const targetUseYn = userDto.useYn;

    // [C5] SYSTEM 역할 배정 차단
    if (targetRoleId && targetRoleId.toUpperCase() === 'SYSTEM') {
      throw new BadRequestException('사용자에게 SYSTEM 역할을 할당할 수 없습니다.');
    }

    // [C1-sub] 자가 승격 및 자가 활성 제어 변경 차단
    // operator(현재 로그인 유저)가 id(대상 유저)와 동일한데 역할(roleId)이나 사용여부(useYn)를 변경하려고 하면 차단
    if (id === operator) {
      if (targetRoleId !== undefined && targetRoleId !== user.roleId) {
        throw new BadRequestException('본인의 권한 그룹을 직접 수정할 수 없습니다.');
      }
      if (targetUseYn !== undefined && targetUseYn !== user.useYn) {
        throw new BadRequestException('본인의 활성 상태를 직접 수정할 수 없습니다.');
      }
    }

    user.name = userDto.name || user.name;
    user.departmentId = CodeUtil.normalizeOrNull(userDto.departmentId);
    user.roleId = targetRoleId || user.roleId;
    if (targetScope !== 'COMPANY' && targetScope !== 'PLANT') {
      throw new BadRequestException('Scope는 COMPANY 또는 PLANT이어야 합니다.');
    }
    const homePlantId = await this.validateHomePlant(
      companyId,
      targetScope,
      userDto.homePlantId !== undefined ? userDto.homePlantId : user.homePlantId,
    );
    user.scope = targetScope;
    user.email = userDto.email || null;
    user.phone = userDto.phone || null;
    user.position = userDto.position || null;
    user.title = userDto.title || null;
    user.useYn = targetUseYn || user.useYn;
    user.homePlantId = homePlantId;
    user.updatedBy = operator;

    const saved = await this.userRepo.save(user);
    const { passwordHash: _passwordHash, homePlantId: savedHomePlantId, ...safeUser } = saved;
    return { ...safeUser, homePlantId: savedHomePlantId ?? null };
  }

  private async validateHomePlant(
    companyId: string,
    scope: 'COMPANY' | 'PLANT',
    requestedHomePlantId?: string | null,
  ): Promise<string | null> {
    const homePlantId = CodeUtil.normalizeOrNull(requestedHomePlantId);
    if (scope === 'PLANT' && !homePlantId) {
      throw new BadRequestException('PLANT 범위 사용자는 Home Plant가 필수입니다.');
    }
    if (!homePlantId) return null;
    const plant = await this.plantRepo.findOne({
      select: { id: true },
      where: { companyId, id: homePlantId, deleteYn: 'N' },
    });
    if (!plant) throw new BadRequestException('유효하지 않은 Home Plant입니다.');
    return homePlantId;
  }

  async deleteUser(companyId: string, id: string, operator: string): Promise<void> {
    if (id === operator) {
      throw new BadRequestException('자기 자신을 삭제할 수 없습니다.');
    }

    const user = await this.userRepo.findOne({ where: { companyId, id, deleteYn: 'N' } });
    if (!user) throw new BadRequestException('사용자를 찾을 수 없습니다.');

    user.deleteYn = 'Y';
    user.updatedBy = operator;
    await this.userRepo.save(user);
  }

  // =========================================================================
  // 6. 저장소 (Warehouse)
  // =========================================================================
  async getWarehousesByCompany(companyId: string): Promise<Warehouse[]> {
    return this.warehouseRepo.find({ where: { companyId, deleteYn: 'N' } });
  }

  async getWarehousesForUse(
    companyId: string,
    userId: string,
    requestedPlantId?: string,
  ): Promise<Warehouse[]> {
    const [warehouses, plants] = await Promise.all([
      this.getWarehousesByCompany(companyId),
      this.getPlantsForUse(companyId, userId, requestedPlantId),
    ]);
    const plantIds = new Set(plants.map((plant) => plant.id));
    return warehouses.filter(
      (warehouse) => warehouse.plantId === null || plantIds.has(warehouse.plantId),
    );
  }

  async saveWarehouse(companyId: string, whDto: Partial<Warehouse>, operator: string): Promise<Warehouse> {
    const id = CodeUtil.normalize(whDto.id);
    if (!id) throw new BadRequestException('저장소 ID는 필수입니다.');

    const exists = await this.warehouseRepo.findOne({ where: { companyId, id } });
    if (exists) {
      if (exists.deleteYn === 'N') {
        throw new BadRequestException('이미 존재하는 저장소 아이디입니다.');
      } else {
        exists.name = whDto.name || id;
        exists.plantId = CodeUtil.normalizeOrNull(whDto.plantId);
        exists.deleteYn = 'N';
        exists.updatedBy = operator;
        const restored = await this.warehouseRepo.save(exists);
        return restored;
      }
    }

    const warehouse = this.warehouseRepo.create({
      ...whDto,
      companyId,
      id,
      plantId: CodeUtil.normalizeOrNull(whDto.plantId),
      createdBy: operator,
      updatedBy: operator,
    });
    const saved = await this.warehouseRepo.save(warehouse);
    return saved;
  }

  async updateWarehouse(companyId: string, id: string, whDto: Partial<Warehouse>, operator: string): Promise<Warehouse> {
    const warehouse = await this.warehouseRepo.findOne({ where: { companyId, id, deleteYn: 'N' } });
    if (!warehouse) throw new BadRequestException('저장소를 찾을 수 없습니다.');

    warehouse.name = whDto.name || warehouse.name;
    warehouse.plantId = CodeUtil.normalizeOrNull(whDto.plantId);
    warehouse.updatedBy = operator;
    return this.warehouseRepo.save(warehouse);
  }

  async deleteWarehouse(companyId: string, id: string, operator: string): Promise<void> {
    const warehouse = await this.warehouseRepo.findOne({ where: { companyId, id, deleteYn: 'N' } });
    if (!warehouse) throw new BadRequestException('저장소를 찾을 수 없습니다.');

    warehouse.deleteYn = 'Y';
    warehouse.updatedBy = operator;
    await this.warehouseRepo.save(warehouse);
  }

  // =========================================================================
  // 7. 공통코드 그룹 & 아이템 (CodeGroup & CodeItem)
  // =========================================================================
  async getCodeGroupsByCompany(companyId: string): Promise<CodeGroup[]> {
    return this.codeGroupRepo.find({ where: { companyId, deleteYn: 'N' } });
  }

  async saveCodeGroup(companyId: string, groupDto: Partial<CodeGroup>, operator: string): Promise<CodeGroup> {
    const id = CodeUtil.normalize(groupDto.id);
    if (!id) throw new BadRequestException('코드그룹 ID는 필수입니다.');

    const exists = await this.codeGroupRepo.findOne({ where: { companyId, id } });
    if (exists) {
      if (exists.deleteYn === 'N') {
        throw new BadRequestException('이미 존재하는 코드그룹 아이디입니다.');
      } else {
        exists.name = groupDto.name || id;
        exists.deleteYn = 'N';
        exists.updatedBy = operator;
        return this.codeGroupRepo.save(exists);
      }
    }

    const group = this.codeGroupRepo.create({
      ...groupDto,
      companyId,
      id,
      createdBy: operator,
      updatedBy: operator,
    });
    return this.codeGroupRepo.save(group);
  }

  async updateCodeGroup(companyId: string, id: string, groupDto: Partial<CodeGroup>, operator: string): Promise<CodeGroup> {
    const group = await this.codeGroupRepo.findOne({ where: { companyId, id, deleteYn: 'N' } });
    if (!group) throw new BadRequestException('코드그룹을 찾을 수 없습니다.');

    group.name = groupDto.name || group.name;
    group.updatedBy = operator;
    return this.codeGroupRepo.save(group);
  }

  async deleteCodeGroup(companyId: string, id: string, operator: string): Promise<void> {
    const group = await this.codeGroupRepo.findOne({ where: { companyId, id, deleteYn: 'N' } });
    if (!group) throw new BadRequestException('코드그룹을 찾을 수 없습니다.');

    if (group.systemUseYn === 'Y') {
      throw new BadRequestException('시스템 예약 공통코드는 삭제할 수 없습니다.');
    }

    group.deleteYn = 'Y';
    group.updatedBy = operator;
    await this.codeGroupRepo.save(group);
  }

  async getCodeItems(companyId: string, groupId: string): Promise<CodeItem[]> {
    const cleanGroupId = CodeUtil.normalize(groupId);
    await this.assertActiveCodeGroup(companyId, cleanGroupId);

    return this.codeItemRepo.find({
      where: { companyId, groupId: cleanGroupId },
      order: { sortOrder: 'ASC' },
    });
  }

  async saveCodeItem(companyId: string, groupId: string, itemDto: Partial<CodeItem>): Promise<CodeItem> {
    const cleanGroupId = CodeUtil.normalize(groupId);
    await this.assertActiveCodeGroup(companyId, cleanGroupId);

    const id = CodeUtil.normalize(itemDto.id);
    if (!id) throw new BadRequestException('코드아이템 ID는 필수입니다.');

    const exists = await this.codeItemRepo.findOne({
      where: { companyId, groupId: cleanGroupId, id },
    });
    if (exists) {
      throw new BadRequestException('이미 존재하는 코드아이템 아이디입니다.');
    }

    const item = this.codeItemRepo.create({
      ...itemDto,
      companyId,
      groupId: cleanGroupId,
      id,
    });
    return this.codeItemRepo.save(item);
  }

  async updateCodeItem(companyId: string, groupId: string, id: string, itemDto: Partial<CodeItem>): Promise<CodeItem> {
    const cleanGroupId = CodeUtil.normalize(groupId);
    await this.assertActiveCodeGroup(companyId, cleanGroupId);

    const item = await this.codeItemRepo.findOne({
      where: { companyId, groupId: cleanGroupId, id },
    });
    if (!item) throw new BadRequestException('코드아이템을 찾을 수 없습니다.');

    item.name = itemDto.name || item.name;
    item.legalInspectYn = itemDto.legalInspectYn || 'N';
    item.sortOrder = itemDto.sortOrder !== undefined ? itemDto.sortOrder : item.sortOrder;

    return this.codeItemRepo.save(item);
  }

  async deleteCodeItem(companyId: string, groupId: string, id: string): Promise<void> {
    const cleanGroupId = CodeUtil.normalize(groupId);
    await this.assertActiveCodeGroup(companyId, cleanGroupId);

    const item = await this.codeItemRepo.findOne({
      where: { companyId, groupId: cleanGroupId, id },
    });
    if (!item) throw new BadRequestException('코드아이템을 찾을 수 없습니다.');

    // 코드 항목은 이력 보존 대상이 아닌 관리 데이터이므로 정책상 물리 삭제한다.
    await this.codeItemRepo.remove(item);
  }

  private async assertActiveCodeGroup(companyId: string, groupId: string): Promise<void> {
    const group = await this.codeGroupRepo.findOne({
      where: { companyId, id: groupId, deleteYn: 'N' },
    });
    if (!group) throw new BadRequestException('코드그룹을 찾을 수 없습니다.');
  }

  async getCompanies(): Promise<Company[]> {
    return this.companyRepo.find({
      where: { deleteYn: 'N' },
      order: { id: 'ASC' },
    });
  }

  async validateSystemAdminUser(userId: string): Promise<boolean> {
    const user = await this.userRepo.findOne({
      where: {
        companyId: 'SYSTEM',
        id: userId,
        useYn: 'Y',
        deleteYn: 'N',
      },
    });
    return user?.roleId?.toUpperCase() === 'SYSTEM';
  }

  async createCompany(
    body: CreateCompanyDto,
    operator: string,
  ): Promise<CreateCompanyResponseDto> {
    const { id, name, businessNumber, email, adminId, adminName, adminPassword } = body;
    if (!id || !name || !adminId || !adminName || !adminPassword) {
      throw new BadRequestException('필수 입력 항목이 누락되었습니다.');
    }

    const coId = id.trim().toUpperCase();
    const admId = adminId.trim();

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const manager = qr.manager;
      const companyRepository = manager.getRepository(Company);
      const existingCompany = await companyRepository.findOne({
        where: { id: coId },
      });
      if (existingCompany) {
        throw new BadRequestException('이미 존재하는 회사 코드입니다.');
      }

      await companyRepository.save(
        companyRepository.create({
          id: coId,
          name: name.trim(),
          businessNumber: businessNumber?.trim() || null,
          email: email?.trim() || null,
          useYn: 'Y',
          createdBy: operator,
          updatedBy: operator,
          deleteYn: 'N',
        }),
      );

      // 신규 회사의 ADMIN이 즉시 전체 모듈을 사용할 수 있도록
      // ADMIN Role과 전체 CRUD 권한을 회사 생성 트랜잭션 안에서 함께 만든다.
      const rolesToSeed = [
        { id: 'ADMIN', name: '관리자' },
        { id: 'MANAGER', name: '현장관리자' },
        { id: 'USER', name: '현장사용자' },
        { id: 'PURCHASER', name: '본사 구매담당자' },
      ];

      const roleRepository = manager.getRepository(Role);
      await roleRepository.save(
        rolesToSeed.map((role) =>
          roleRepository.create({
            companyId: coId,
            id: role.id,
            roleName: role.name,
            createdBy: operator,
            updatedBy: operator,
            deleteYn: 'N',
          }),
        ),
      );

      const roleDetailRepository = manager.getRepository(RoleDetail);
      const documentCrud = new Set([
        AppModule.PM,
        AppModule.WO,
        AppModule.WP,
        AppModule.PUR,
        AppModule.APR,
        AppModule.BRD,
      ]);
      const roleCrud: Record<string, Set<AppModule>> = {
        MANAGER: new Set([AppModule.EQP, ...documentCrud]),
        USER: new Set(documentCrud),
        PURCHASER: new Set([
          AppModule.INV,
          AppModule.STK,
          AppModule.POR,
          ...documentCrud,
        ]),
      };
      const roleRead: Record<string, Set<AppModule>> = {
        MANAGER: new Set([AppModule.MDM, AppModule.INV, AppModule.STK, AppModule.POR]),
        USER: new Set([AppModule.MDM, AppModule.EQP, AppModule.INV, AppModule.STK, AppModule.POR]),
        PURCHASER: new Set([AppModule.MDM, AppModule.EQP]),
      };
      await roleDetailRepository.save(
        rolesToSeed.flatMap((role) => Object.values(AppModule).map((moduleDetail) => {
          const isAdmin = role.id === 'ADMIN';
          const isCrud = roleCrud[role.id]?.has(moduleDetail) ?? false;
          const isRead = roleRead[role.id]?.has(moduleDetail) ?? false;
          return roleDetailRepository.create({
            companyId: coId,
            roleId: role.id,
            moduleDetail,
            permC: isAdmin || isCrud ? 'Y' : 'N',
            permR: isAdmin || isCrud || isRead ? 'Y' : 'N',
            permU: isAdmin || isCrud ? 'Y' : 'N',
            permD: isAdmin || isCrud ? 'Y' : 'N',
            permA: isAdmin && moduleDetail === AppModule.POR ? 'Y' : 'N',
            createdBy: operator,
            updatedBy: operator,
          });
        })),
      );

      const codeGroupRepository = manager.getRepository(CodeGroup);
      await codeGroupRepository.save(
        DEFAULT_CODE_GROUPS.map((group) =>
          codeGroupRepository.create({
            companyId: coId,
            id: group.id,
            name: group.name,
            systemUseYn: 'Y',
            createdBy: operator,
            updatedBy: operator,
            deleteYn: 'N',
          }),
        ),
      );

      const codeItemRepository = manager.getRepository(CodeItem);
      await codeItemRepository.save(
        DEFAULT_CODE_GROUPS.flatMap((group) =>
          group.items.map((item, index) =>
            codeItemRepository.create({
              companyId: coId,
              groupId: group.id,
              id: item[0],
              name: item[1],
              legalInspectYn: item[0] === 'LEGAL' ? 'Y' : 'N',
              sortOrder: index + 1,
            }),
          ),
        ),
      );

      const hash = await bcrypt.hash(adminPassword, 12);
      const userRepository = manager.getRepository(User);
      await userRepository.save(
        userRepository.create({
          companyId: coId,
          id: admId,
          name: adminName.trim(),
          passwordHash: hash,
          useYn: 'Y',
          roleId: 'ADMIN',
          scope: 'COMPANY',
          departmentId: null,
          mustChangePassword: 'Y',
          failedLoginCount: 0,
          createdBy: operator,
          updatedBy: operator,
          deleteYn: 'N',
        }),
      );

      await qr.commitTransaction();
      return { success: true, companyId: coId, adminId: admId };
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }
}
