import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, DataSource } from 'typeorm';
import { Plant } from '../../entities/plant.entity';
import { Department } from '../../entities/department.entity';
import { Role } from '../../entities/role.entity';
import { RoleDetail } from '../../entities/role-detail.entity';
import { User } from '../../entities/users.entity';
import { Warehouse } from '../../entities/warehouse.entity';
import { CodeGroup } from '../../entities/code-group.entity';
import { CodeItem } from '../../entities/code-item.entity';
import { CodeUtil } from '../../common/utils/code.util';
import { AppModule } from '../../common/sequence/sequence.service';
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
    id: 'WO_STAGE',
    name: '작업지시 단계',
    items: [
      ['P', '작업 계획/지시'],
      ['R', '작업 실적/완료'],
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
  {
    id: 'CYCLE_UNIT',
    name: '점검주기 단위',
    items: [
      ['D', '일'],
      ['W', '주'],
      ['M', '월'],
      ['Y', '년'],
    ],
  },
] as const;

@Injectable()
export class MdmService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Plant) private readonly plantRepo: Repository<Plant>,
    @InjectRepository(Department) private readonly departmentRepo: Repository<Department>,
    @InjectRepository(Role) private readonly roleRepo: Repository<Role>,
    @InjectRepository(RoleDetail) private readonly roleDetailRepo: Repository<RoleDetail>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Warehouse) private readonly warehouseRepo: Repository<Warehouse>,
    @InjectRepository(CodeGroup) private readonly codeGroupRepo: Repository<CodeGroup>,
    @InjectRepository(CodeItem) private readonly codeItemRepo: Repository<CodeItem>,
  ) {}

  // =========================================================================
  // 2. 플랜트 (Plant)
  // =========================================================================
  async getPlantsByCompany(companyId: string): Promise<Plant[]> {
    // [M3 버그 차단] findAll 풀스캔 대신 반드시 companyId 조건 명시
    return this.plantRepo.find({ where: { companyId, deleteYn: 'N' } });
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
  // 4. 권한 그룹 (Role & RoleDetail)
  // =========================================================================
  async getRolesByCompany(companyId: string): Promise<Role[]> {
    return this.roleRepo.find({ where: { companyId, deleteYn: 'N' } });
  }

  async getRoleDetails(companyId: string, roleId: string): Promise<RoleDetail[]> {
    const existing = await this.roleDetailRepo.find({ where: { companyId, roleId } });
    const byModule = new Map(existing.map((detail) => [detail.moduleDetail, detail]));
    const missing: RoleDetail[] = [];

    for (const moduleDetail of Object.values(AppModule)) {
      if (byModule.has(moduleDetail)) continue;
      missing.push(this.roleDetailRepo.create({
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

    if (missing.length > 0) {
      const saved = await this.roleDetailRepo.save(missing);
      existing.push(...saved);
    }

    const moduleOrder = new Map(Object.values(AppModule).map((moduleDetail, idx) => [moduleDetail, idx]));
    return existing
      .filter((detail) => moduleOrder.has(detail.moduleDetail as AppModule))
      .sort((a, b) => moduleOrder.get(a.moduleDetail as AppModule)! - moduleOrder.get(b.moduleDetail as AppModule)!);
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
        exists.multiPlant = roleDto.multiPlant || 'N';
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

    // 기본 권한 셋업 (AppModule values 기준)
    const details: RoleDetail[] = [];
    for (const m of Object.values(AppModule)) {
      const detail = this.roleDetailRepo.create({
        companyId,
        roleId: savedRole.id,
        moduleDetail: m,
        permC: 'N',
        permR: 'N',
        permU: 'N',
        permD: 'N',
        permA: 'N',
      });
      details.push(detail);
    }
    await this.roleDetailRepo.save(details);

    return savedRole;
  }

  async saveRoleDetails(companyId: string, roleId: string, details: Partial<RoleDetail>[]): Promise<void> {
    const validModules = new Set<string>(Object.values(AppModule));
    const normalizePerm = (value?: string) => {
      const normalized = value === 'Y' ? 'Y' : 'N';
      return normalized;
    };

    for (const detail of details) {
      const moduleDetail = detail.moduleDetail;
      if (!moduleDetail) continue;
      if (!validModules.has(moduleDetail)) {
        throw new BadRequestException(`유효하지 않은 모듈 코드입니다: ${moduleDetail}`);
      }

      const existing = await this.roleDetailRepo.findOne({
        where: { companyId, roleId, moduleDetail },
      });

      if (existing) {
        existing.permC = normalizePerm(detail.permC);
        existing.permR = normalizePerm(detail.permR);
        existing.permU = normalizePerm(detail.permU);
        existing.permD = normalizePerm(detail.permD);
        existing.permA = normalizePerm(detail.permA);
        await this.roleDetailRepo.save(existing);
      } else {
        const newDetail = this.roleDetailRepo.create({
          companyId,
          roleId,
          moduleDetail,
          permC: normalizePerm(detail.permC),
          permR: normalizePerm(detail.permR),
          permU: normalizePerm(detail.permU),
          permD: normalizePerm(detail.permD),
          permA: normalizePerm(detail.permA),
        });
        await this.roleDetailRepo.save(newDetail);
      }
    }
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
  async getUsersByCompany(companyId: string): Promise<User[]> {
    return this.userRepo.find({ where: { companyId, deleteYn: 'N' } });
  }

  async saveUser(companyId: string, userDto: Partial<User>, operator: string): Promise<User> {
    const id = userDto.id?.trim();
    if (!id) throw new BadRequestException('사용자 ID는 필수입니다.');

    // [C5] SYSTEM 역할 배정 차단
    const roleId = CodeUtil.normalizeOrNull(userDto.roleId);
    if (roleId && roleId.toUpperCase() === 'SYSTEM') {
      throw new BadRequestException('사용자에게 SYSTEM 역할을 할당할 수 없습니다.');
    }

    const exists = await this.userRepo.findOne({ where: { companyId, id } });
    if (exists) {
      if (exists.deleteYn === 'N') {
        throw new BadRequestException('이미 존재하는 사용자 아이디입니다.');
      } else {
        // 이미 삭제된 레코드가 존재하면 덮어쓰기 복구 처리
        exists.name = userDto.name || id;
        exists.roleId = roleId;
        exists.departmentId = CodeUtil.normalizeOrNull(userDto.departmentId);
        exists.passwordHash = await bcrypt.hash('1234', 12); // 복구 시에도 임시 비번 리셋
        exists.useYn = 'Y';
        exists.deleteYn = 'N';
        exists.updatedBy = operator;
        return this.userRepo.save(exists);
      }
    }

    const hash = await bcrypt.hash('1234', 12);
    const user = this.userRepo.create({
      ...userDto,
      companyId,
      id,
      roleId,
      departmentId: CodeUtil.normalizeOrNull(userDto.departmentId),
      passwordHash: hash,
      useYn: 'Y',
      mustChangePassword: 'Y',
      createdBy: operator,
      updatedBy: operator,
    });
    return this.userRepo.save(user);
  }

  async updateUser(companyId: string, id: string, userDto: Partial<User>, operator: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { companyId, id, deleteYn: 'N' } });
    if (!user) throw new BadRequestException('사용자를 찾을 수 없습니다.');

    const targetRoleId = CodeUtil.normalizeOrNull(userDto.roleId);
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
    user.roleId = targetRoleId;
    user.email = userDto.email || null;
    user.phone = userDto.phone || null;
    user.position = userDto.position || null;
    user.title = userDto.title || null;
    user.useYn = targetUseYn || user.useYn;
    user.lastLoginPlantId = userDto.lastLoginPlantId || null;
    user.updatedBy = operator;

    return this.userRepo.save(user);
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
        return this.warehouseRepo.save(exists);
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
    return this.warehouseRepo.save(warehouse);
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

    await this.codeItemRepo.remove(item);
  }

  private async assertActiveCodeGroup(companyId: string, groupId: string): Promise<void> {
    const group = await this.codeGroupRepo.findOne({
      where: { companyId, id: groupId, deleteYn: 'N' },
    });
    if (!group) throw new BadRequestException('코드그룹을 찾을 수 없습니다.');
  }

  async getCompanies(): Promise<any[]> {
    return this.dataSource.query(
      `SELECT * FROM company WHERE delete_yn = 'N' ORDER BY id ASC`
    );
  }

  async validateSystemAdminUser(userId: string): Promise<boolean> {
    const rows = await this.dataSource.query(
      `SELECT role_id FROM users
       WHERE company_id = 'SYSTEM' AND id = $1 AND use_yn = 'Y' AND delete_yn = 'N'`,
      [userId],
    );
    return rows.length > 0 && rows[0].role_id?.toUpperCase() === 'SYSTEM';
  }

  async createCompany(body: any, operator: string): Promise<any> {
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
      const existingCompany = await qr.query(
        `SELECT * FROM company WHERE id = $1`,
        [coId]
      );
      if (existingCompany.length > 0) {
        throw new BadRequestException('이미 존재하는 회사 코드입니다.');
      }

      await qr.query(
        `INSERT INTO company (id, name, business_number, email, use_yn, created_by, updated_by, delete_yn)
         VALUES ($1, $2, $3, $4, 'Y', $5, $5, 'N')`,
        [coId, name.trim(), businessNumber?.trim() || null, email?.trim() || null, operator]
      );

      const rolesToSeed = [
        { id: 'ADMIN', name: '관리자', multiPlant: 'Y' },
        { id: 'MANAGER', name: '현장관리자', multiPlant: 'N' },
        { id: 'PURCHASER', name: '구매·자재담당', multiPlant: 'Y' },
        { id: 'USER', name: '정비원', multiPlant: 'N' },
      ];

      for (const r of rolesToSeed) {
        await qr.query(
          `INSERT INTO role (company_id, id, role_name, multi_plant, created_by, updated_by, delete_yn)
           VALUES ($1, $2, $3, $4, $5, $5, 'N')`,
          [coId, r.id, r.name, r.multiPlant, operator]
        );

        const appModules = Object.values(AppModule);
        for (const m of appModules) {
          // 신규 회사 기본 Role은 초기 운영 편의를 위해 전 권한 Y로 생성하고,
          // 회사 담당자가 권한관리 화면에서 역할별 정책에 맞게 보정한다.
          await qr.query(
            `INSERT INTO role_detail (company_id, role_id, module_detail, perm_c, perm_r, perm_u, perm_d, perm_a)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [coId, r.id, m, 'Y', 'Y', 'Y', 'Y', 'Y']
          );
        }
      }

      for (const group of DEFAULT_CODE_GROUPS) {
        await qr.query(
          `INSERT INTO code_group (company_id, id, name, system_use_yn, created_by, updated_by, delete_yn)
           VALUES ($1, $2, $3, 'Y', $4, $4, 'N')`,
          [coId, group.id, group.name, operator]
        );

        for (const [idx, item] of group.items.entries()) {
          await qr.query(
            `INSERT INTO code_item (company_id, group_id, id, name, legal_inspect_yn, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [coId, group.id, item[0], item[1], item[0] === 'LEGAL' ? 'Y' : 'N', idx + 1]
          );
        }
      }

      const hash = await bcrypt.hash(adminPassword, 12);
      await qr.query(
        `INSERT INTO users (
           company_id, id, name, password_hash, use_yn, role_id, 
           must_change_password, failed_login_count, created_by, updated_by, delete_yn
         ) VALUES ($1, $2, $3, $4, 'Y', 'ADMIN', 'Y', 0, $5, $5, 'N')`,
        [coId, admId, adminName.trim(), hash, operator]
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
