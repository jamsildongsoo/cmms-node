import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('power_generation')
@Index(
  'uq_power_generation_company_generator_day_hour_type',
  ['companyId', 'generatorId', 'tradingDay', 'hourNo', 'measurementType'],
  { unique: true },
)
export class PowerGeneration {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'company_id', length: 50 })
  companyId!: string;

  @Column({ name: 'generator_id', length: 20 })
  generatorId!: string;

  @Column({ name: 'generator_name', type: 'varchar', length: 100, nullable: true })
  generatorName!: string | null;

  @Column({ name: 'trading_day', type: 'date' })
  tradingDay!: string;

  /** KPX sequenceNumber. 1은 00:00~01:00 구간, 24는 23:00~24:00 구간이다. */
  @Column({ name: 'hour_no', type: 'smallint' })
  hourNo!: number;

  @Column({ name: 'interval_end_at', type: 'timestamptz', nullable: true })
  intervalEndAt!: Date | null;

  @Column({ name: 'measurement_type', length: 20, default: '10' })
  measurementType!: string;

  @Column({ name: 'raw_value_wh', type: 'numeric', precision: 20, scale: 3 })
  rawValueWh!: string;

  @Column({ name: 'generation_mwh', type: 'numeric', precision: 16, scale: 6 })
  generationMwh!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'created_by', length: 50 })
  createdBy!: string;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'updated_by', length: 50 })
  updatedBy!: string;
}
