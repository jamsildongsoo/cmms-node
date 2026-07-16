import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('board_comment')
export class BoardComment {
  @PrimaryColumn({ name: 'company_id', length: 50 })
  companyId!: string;

  @PrimaryColumn({ name: 'board_id', type: 'bigint' })
  boardId!: string | number;

  @PrimaryColumn({ name: 'comment_no', type: 'bigint' })
  commentNo!: string | number;

  @Column({ name: 'author_id', length: 50 })
  authorId!: string;

  @Column({ name: 'author_name', length: 100 })
  authorName!: string;

  @Column({ name: 'content', type: 'text' })
  content!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
