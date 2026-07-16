import { Entity, PrimaryColumn, Column } from 'typeorm';

/** 첨부파일 상세 — file-storage 서비스가 raw SQL로 사용 (감사 컬럼 없음) */
@Entity('file_attachment_item')
export class FileAttachmentItem {
  @PrimaryColumn({ name: 'company_id', length: 50 })
  companyId!: string;

  @PrimaryColumn({ name: 'group_no', type: 'bigint' })
  groupNo!: string;

  @PrimaryColumn({ name: 'item_no', type: 'int' })
  itemNo!: number;

  @Column({ name: 'original_file_name', length: 255 })
  originalFileName!: string;

  @Column({ name: 'stored_file_name', length: 255 })
  storedFileName!: string;

  @Column({ name: 'file_extension', type: 'varchar', length: 10, nullable: true })
  fileExtension!: string | null;

  @Column({ name: 'mime_type', type: 'varchar', length: 100, nullable: true })
  mimeType!: string | null;

  @Column({ name: 'file_size', type: 'bigint' })
  fileSize!: string;

  @Column({ name: 'checksum_sha256', type: 'char', length: 64 })
  checksumSha256!: string;

  @Column({ name: 'storage_path', length: 500 })
  storagePath!: string;
}
