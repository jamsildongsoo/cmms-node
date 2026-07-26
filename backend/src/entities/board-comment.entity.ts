import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Board } from './board.entity';

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

  @ManyToOne(() => Board, (board) => board.comments, {
    createForeignKeyConstraints: false,
  })
  @JoinColumn([
    { name: 'company_id', referencedColumnName: 'companyId' },
    { name: 'board_id', referencedColumnName: 'id' },
  ])
  board?: Board;
}
