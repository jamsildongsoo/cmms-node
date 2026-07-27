import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PowerGeneration } from '../../entities/power-generation.entity';
import { getTenantContext } from '../../common/context/tenant.context';
import { KpxMeterClient } from './kpx-meter.client';

@Injectable()
export class PowerGenerationService {
  constructor(
    @InjectRepository(PowerGeneration)
    private readonly repository: Repository<PowerGeneration>,
    private readonly kpxClient: KpxMeterClient,
  ) {}

  async importDay(yyyymmdd: string) {
    const tradingDay = this.parseDay(yyyymmdd);
    const { companyId, userId } = getTenantContext();
    const measurements = await this.kpxClient.fetchDay(tradingDay);

    await this.repository.upsert(
      measurements.map((item) => ({
        companyId,
        generatorId: item.generatorId,
        generatorName: item.generatorName,
        tradingDay,
        hourNo: item.hourNo,
        intervalEndAt: item.intervalEndAt,
        measurementType: item.measurementType,
        rawValueWh: item.rawValueWh.toFixed(3),
        generationMwh: (item.rawValueWh / 1_000_000).toFixed(6),
        createdBy: userId,
        updatedBy: userId,
      })),
      ['companyId', 'generatorId', 'tradingDay', 'hourNo', 'measurementType'],
    );

    return {
      tradingDay,
      importedCount: measurements.length,
      totalMwh: this.round(measurements.reduce((sum, row) => sum + row.rawValueWh, 0) / 1_000_000),
    };
  }

  async getMonthlySummary(yyyymm: string) {
    if (!/^\d{6}$/.test(yyyymm)) {
      throw new BadRequestException('month는 YYYYMM 6자리여야 합니다.');
    }
    const year = Number(yyyymm.slice(0, 4));
    const month = Number(yyyymm.slice(4, 6));
    if (month < 1 || month > 12 || year < 2000 || year > 2100) {
      throw new BadRequestException('유효한 조회 월이 아닙니다.');
    }
    const { companyId } = getTenantContext();
    const monthText = `${yyyymm.slice(0, 4)}-${yyyymm.slice(4, 6)}`;
    const rows: Array<{ tradingDay: string; totalMwh: string; hourCount: string }> =
      await this.repository
        .createQueryBuilder('generation')
        .select("TO_CHAR(generation.tradingDay, 'YYYY-MM-DD')", 'tradingDay')
        .addSelect('SUM(generation.generationMwh)', 'totalMwh')
        .addSelect('COUNT(*)', 'hourCount')
        .where('generation.companyId = :companyId', { companyId })
        .andWhere("TO_CHAR(generation.tradingDay, 'YYYY-MM') = :monthText", { monthText })
        .groupBy('generation.tradingDay')
        .orderBy('generation.tradingDay', 'ASC')
        .getRawMany();

    const daily = rows.map((row) => ({
      tradingDay: row.tradingDay,
      totalMwh: this.round(Number(row.totalMwh)),
      hourCount: Number(row.hourCount),
    }));
    return {
      month: yyyymm,
      monthlyTotalMwh: this.round(daily.reduce((sum, row) => sum + row.totalMwh, 0)),
      dayCount: daily.length,
      daily,
    };
  }

  async getHourly(yyyymmdd: string) {
    const tradingDay = this.parseDay(yyyymmdd);
    const { companyId } = getTenantContext();
    const rows = await this.repository.find({
      where: { companyId, tradingDay },
      order: { generatorId: 'ASC', hourNo: 'ASC' },
    });
    return rows.map((row) => ({
      generatorId: row.generatorId,
      generatorName: row.generatorName,
      tradingDay: row.tradingDay,
      hourNo: row.hourNo,
      intervalLabel: `${String(row.hourNo - 1).padStart(2, '0')}:00~${String(row.hourNo).padStart(2, '0')}:00`,
      generationMwh: this.round(Number(row.generationMwh)),
    }));
  }

  private parseDay(yyyymmdd: string): string {
    if (!/^\d{8}$/.test(yyyymmdd)) {
      throw new BadRequestException('거래일자는 YYYYMMDD 8자리여야 합니다.');
    }
    const year = Number(yyyymmdd.slice(0, 4));
    const month = Number(yyyymmdd.slice(4, 6));
    const day = Number(yyyymmdd.slice(6, 8));
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() !== month - 1 ||
      parsed.getUTCDate() !== day
    ) {
      throw new BadRequestException('유효한 거래일자가 아닙니다.');
    }
    const todayKst = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const formatted = `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
    if (formatted > todayKst) {
      throw new BadRequestException('미래 거래일자는 가져올 수 없습니다.');
    }
    return formatted;
  }

  private round(value: number): number {
    return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
  }
}
