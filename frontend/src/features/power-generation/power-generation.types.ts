export interface PowerGenerationDaily {
  tradingDay: string;
  totalMwh: number;
  hourCount: number;
}

export interface PowerGenerationMonthly {
  month: string;
  monthlyTotalMwh: number;
  dayCount: number;
  daily: PowerGenerationDaily[];
}

export interface PowerGenerationHourly {
  generatorId: string;
  generatorName: string | null;
  tradingDay: string;
  hourNo: number;
  intervalLabel: string;
  generationMwh: number;
}

export interface PowerGenerationImportResult {
  tradingDay: string;
  importedCount: number;
  totalMwh: number;
}
