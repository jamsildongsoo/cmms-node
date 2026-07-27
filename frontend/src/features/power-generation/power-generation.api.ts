import api from '../../api/axios';
import type {
  PowerGenerationHourly,
  PowerGenerationImportResult,
  PowerGenerationMonthly,
} from './power-generation.types';

export const powerGenerationApi = {
  async importDay(tradingDay: string): Promise<PowerGenerationImportResult> {
    const response = await api.post('/power-generation/import', { tradingDay });
    return response.data;
  },

  async getMonthly(month: string): Promise<PowerGenerationMonthly> {
    const response = await api.get('/power-generation/monthly', { params: { month } });
    return response.data;
  },

  async getHourly(day: string): Promise<PowerGenerationHourly[]> {
    const response = await api.get('/power-generation/hourly', { params: { day } });
    return response.data;
  },
};
