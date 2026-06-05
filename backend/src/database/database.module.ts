/* =========================================================================
   DatabaseModule — Supabase 세션 풀러 단일 DataSource
   세션 풀러(port 5432): FOR UPDATE + SET LOCAL 모두 정상 동작
   DataSource 이중화 불필요
   ========================================================================= */
import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { getDataSourceOptions } from './data-source.config';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => getDataSourceOptions(config),
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}
