import { DataSource } from 'typeorm';
import { AppModule } from '../constants/module.constants';
import { SequenceService } from './sequence.service';

describe('SequenceService', () => {
  it('표시 접두사와 내부 모듈 코드를 분리해 채번한다', async () => {
    const query = jest.fn().mockResolvedValue([{ last_seq: 12 }]);
    const service = new SequenceService({ query } as unknown as DataSource);

    const documentNo = await service.generateNextNo(
      'GRE',
      AppModule.APR,
      'MTN',
      'GRE',
    );

    expect(documentNo).toMatch(/^GRE-MTN-\d{6}-0012$/);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO sequence_generator'),
      ['GRE', 'APR', 'MTN', expect.stringMatching(/^\d{6}$/)],
    );
  });

  it('표시 접두사를 생략하면 기존 모듈 접두사를 사용한다', async () => {
    const query = jest.fn().mockResolvedValue([{ last_seq: 1 }]);
    const service = new SequenceService({ query } as unknown as DataSource);

    const documentNo = await service.generateNextNo(
      'GRE',
      AppModule.WO,
      null,
    );

    expect(documentNo).toMatch(/^WO-DEPT_ROOT-\d{6}-0001$/);
  });
});
