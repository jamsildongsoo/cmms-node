import { Entity, PrimaryColumn, Column } from 'typeorm';

/**
 * 예방점검 점검 항목 템플릿 — 점검유형(check_type_code)별 기본 항목 정의.
 * 계획(PM record) 생성 시 이 템플릿에서 항목을 불러와 pm_record_item에 복사한다.
 */
@Entity('pm_check_template')
export class PmCheckTemplate {
  @PrimaryColumn({ name: 'company_id', length: 50 })
  companyId!: string;

  @PrimaryColumn({ name: 'plant_id', length: 50 })
  plantId!: string;

  @PrimaryColumn({ name: 'check_type_code', length: 50 })
  checkTypeCode!: string;

  @PrimaryColumn({ name: 'item_no', type: 'integer' })
  itemNo!: number;

  @Column({ name: 'check_name', length: 150 })
  checkName!: string;

  @Column({ type: 'varchar', name: 'check_method', length: 250, nullable: true })
  checkMethod!: string | null;

  @Column({ name: 'min_value', type: 'numeric', precision: 15, scale: 4, nullable: true })
  minValue!: string | null;

  @Column({ name: 'max_value', type: 'numeric', precision: 15, scale: 4, nullable: true })
  maxValue!: string | null;

  @Column({ name: 'base_value', type: 'numeric', precision: 15, scale: 4, nullable: true })
  baseValue!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  unit!: string | null;
}
