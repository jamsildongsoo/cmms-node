/* PostgreSQL 공통 DataSource 모듈 */
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
