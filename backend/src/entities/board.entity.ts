import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { BoardComment } from './board-comment.entity';
import { User } from './users.entity';

@Entity('board')
export class Board extends BaseEntity {
  @PrimaryColumn({ name: 'company_id', length: 50 })
  companyId!: string;

  @PrimaryGeneratedColumn({ name: 'id', type: 'bigint' })
  id!: string | number;

  @Column({ name: 'board_type_code', length: 50 })
  boardTypeCode!: string;

  @Column({ name: 'title', length: 200 })
  title!: string;

  @Column({ name: 'content', type: 'jsonb' })
  content!: Record<string, unknown>;

  @Column({ name: 'notice_yn', length: 1, default: 'N' })
  noticeYn!: string;

  @Column({ name: 'file_group_id', type: 'bigint', nullable: true })
  fileGroupId!: string | number | null;

  @Column({ type: 'varchar',  name: 'ref_no', length: 50, nullable: true })
  refNo!: string | null;

  @Column({ type: 'varchar',  name: 'ref_module', length: 50, nullable: true })
  refModule!: string | null;

  @ManyToOne(() => User, { createForeignKeyConstraints: false })
  @JoinColumn([
    { name: 'company_id', referencedColumnName: 'companyId' },
    { name: 'created_by', referencedColumnName: 'id' },
  ])
  creator?: User;

  @OneToMany(() => BoardComment, (comment) => comment.board)
  comments?: BoardComment[];
}
