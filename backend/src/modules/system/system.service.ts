import { Injectable, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class SystemService {
  constructor(private readonly dataSource: DataSource) {}

  async getUsers(companyId?: string): Promise<any[]> {
    let query = `
      SELECT 
        company_id as "companyId", 
        id, 
        name, 
        use_yn as "useYn", 
        role_id as "roleId", 
        email, 
        phone, 
        position, 
        title 
      FROM users
    `;
    const params: any[] = [];

    if (companyId && companyId.trim() !== '') {
      query += ` WHERE company_id = $1`;
      params.push(companyId.trim().toUpperCase());
    }

    query += ` ORDER BY company_id ASC, id ASC`;
    return this.dataSource.query(query, params);
  }

  async getLoginHistory(companyId?: string, userId?: string): Promise<any[]> {
    let query = `
      SELECT 
        company_id as "companyId", 
        user_id as "userId", 
        login_ip as "loginIp", 
        login_result as "loginResult", 
        login_at as "loginAt" 
      FROM login_history
    `;
    const conditions: string[] = [];
    const params: any[] = [];

    if (companyId && companyId.trim() !== '') {
      params.push(companyId.trim().toUpperCase());
      conditions.push(`company_id = $${params.length}`);
    }

    if (userId && userId.trim() !== '') {
      params.push(userId.trim());
      conditions.push(`user_id = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ` + conditions.join(' AND ');
    }

    query += ` ORDER BY login_at DESC LIMIT 500`; // Limit to avoid large payloads
    return this.dataSource.query(query, params);
  }

  async updateUserUseYn(companyId: string, id: string, useYn: string, operator: string): Promise<void> {
    const cleanCoId = companyId.trim().toUpperCase();
    const cleanId = id.trim();
    const cleanUseYn = useYn.trim().toUpperCase();

    if (cleanUseYn !== 'Y' && cleanUseYn !== 'N') {
      throw new BadRequestException('사용 여부는 Y 또는 N 이어야 합니다.');
    }

    // SYSTEM 회사의 SYSTEM 사용자는 사용 여부 수정 제한
    if (cleanCoId === 'SYSTEM' && cleanId === 'SYSTEM') {
      throw new BadRequestException('SYSTEM 계정은 비활성화할 수 없습니다.');
    }

    const rows = await this.dataSource.query(
      `UPDATE users 
       SET use_yn = $3, updated_by = $4
       WHERE company_id = $1 AND id = $2`,
      [cleanCoId, cleanId, cleanUseYn, operator]
    );
  }

  async validateSystemAdminUser(userId: string): Promise<boolean> {
    const rows = await this.dataSource.query(
      `SELECT role_id FROM users 
       WHERE company_id = 'SYSTEM' AND id = $1 AND use_yn = 'Y' AND delete_yn = 'N'`,
      [userId]
    );
    return rows.length > 0 && rows[0].role_id?.toUpperCase() === 'SYSTEM';
  }
}
