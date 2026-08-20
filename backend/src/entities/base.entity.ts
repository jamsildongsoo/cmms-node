import { Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export abstract class BaseEntity {
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'created_by', length: 50 })
  createdBy!: string;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'updated_by', length: 50 })
  updatedBy!: string;

  /** 논리삭제 데이터는 일반 조회와 업무 처리에서 제외한다. */
  @Column({ name: 'delete_yn', length: 1, default: 'N' })
  deleteYn!: string;
}
