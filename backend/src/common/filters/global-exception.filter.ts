import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    // HTTP 요청 컨텍스트로 전환해 응답 객체와 요청 정보를 가져온다.
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // NestJS HTTP 예외는 원래 상태 코드를 유지하고, 그 외 예외는 500으로 처리한다.
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // 클라이언트에 전달할 메시지를 추출하되, 알 수 없는 예외에는 기본 메시지를 사용한다.
    const message =
      exception instanceof HttpException
        ? exception.message
        : (exception as Error)?.message || 'Internal server error';

    // 500 에러 등의 예외 상황에만 상세 에러 로깅 수행
    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `[${request.method}] ${request.url} - Error: ${message}`,
        (exception as Error)?.stack,
      );
    } else {
      this.logger.warn(`[${request.method}] ${request.url} - Warn: ${message}`);
    }

    // 모든 예외 응답의 형식을 통일해 상태 코드, 발생 시각, 요청 경로, 메시지를 반환한다.
    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: message,
    };

    response.status(status).json(errorResponse);
  }
}
