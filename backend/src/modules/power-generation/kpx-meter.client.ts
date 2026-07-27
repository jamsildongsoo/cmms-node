import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { constants, createPublicKey, publicEncrypt } from 'crypto';
import { readFileSync } from 'fs';

interface KpxHourlyValue {
  generatorId: string;
  generatorName: string | null;
  measurementType: string;
  hourNo: number;
  intervalEndAt: Date | null;
  rawValueWh: number;
}

const XML_NS =
  'xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" ' +
  'xmlns:msg="http://iec.ch/TC57/2011/schema/message" ' +
  'xmlns:mtr="http://www.kpx.or.kr/2014/schema/meterforsettlement#" ' +
  'xmlns:comm="http://www.kpx.or.kr/2014/schema/common#" ' +
  'xmlns:gen="http://www.kpx.or.kr/2014/schema/gen#"';

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function blocks(xml: string, tag: string): string[] {
  const expression = new RegExp(
    `<(?:[\\w.-]+:)?${tag}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${tag}>`,
    'gi',
  );
  return [...xml.matchAll(expression)].map((match) => match[1]);
}

function value(xml: string, tag: string): string | null {
  const found = blocks(xml, tag)[0];
  if (found === undefined) return null;
  return found.replace(/<[^>]+>/g, '').trim() || null;
}

@Injectable()
export class KpxMeterClient {
  constructor(private readonly config: ConfigService) {}

  async fetchDay(tradingDay: string): Promise<KpxHourlyValue[]> {
    const userId = this.required('KPX_USER_ID');
    const password = this.required('KPX_PASSWORD');
    const orgCode = this.config.get<string>('KPX_ORG_CODE', '8687');
    const generatorId = this.config.get<string>('KPX_GENERATOR_ID', 'DC37');
    const endpoint = this.config.get<string>(
      'KPX_METER_ENDPOINT',
      'http://services.kmos.kr/meter',
    );
    const encryptedPassword = this.encryptPassword(password);
    const envelope = this.buildEnvelope(
      tradingDay,
      userId,
      encryptedPassword,
      orgCode,
      generatorId,
    );

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          SOAPAction: '"http://www.kpx.or.kr/2014/service/meterforsettlement"',
        },
        body: envelope,
        signal: AbortSignal.timeout(30_000),
      });
    } catch (error) {
      throw new BadGatewayException(
        `KPX 계량 서비스 연결 실패: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const xml = await response.text();
    if (!response.ok) {
      throw new BadGatewayException(`KPX 계량 서비스가 HTTP ${response.status}를 반환했습니다.`);
    }
    const fault = value(xml, 'faultstring');
    const result = value(xml, 'Result');
    if (fault || (result && result !== 'OK' && result !== 'PARTIAL')) {
      const reason = value(xml, 'reason');
      throw new BadGatewayException(
        `KPX 계량 조회 실패: ${fault || reason || result || '알 수 없는 응답'}`,
      );
    }

    const parsed = this.parseResponse(xml, generatorId);
    if (parsed.length === 0) {
      throw new BadGatewayException('KPX 응답에 해당 발전기의 시간별 계량값이 없습니다.');
    }
    return parsed;
  }

  private required(name: string): string {
    const configured = this.config.get<string>(name)?.trim();
    if (!configured) {
      throw new InternalServerErrorException(`${name} 환경변수가 설정되지 않았습니다.`);
    }
    return configured;
  }

  private encryptPassword(password: string): string {
    const path = this.required('KPX_PUBKEY_PATH');
    try {
      const keyData = readFileSync(path);
      let publicKey;
      try {
        publicKey = createPublicKey({ key: keyData, format: 'der', type: 'spki' });
      } catch {
        publicKey = createPublicKey(keyData);
      }
      return publicEncrypt(
        { key: publicKey, padding: constants.RSA_PKCS1_PADDING },
        Buffer.from(password, 'utf8'),
      ).toString('base64');
    } catch (error) {
      throw new InternalServerErrorException(
        `KPX 공개키를 읽거나 암호화하지 못했습니다: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private buildEnvelope(
    tradingDay: string,
    userId: string,
    encryptedPassword: string,
    orgCode: string,
    generatorId: string,
  ): string {
    const timestamp = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date()).replace(' ', 'T');

    return `<?xml version="1.0" encoding="UTF-8"?>` +
      `<soapenv:Envelope ${XML_NS}><soapenv:Header/><soapenv:Body>` +
      `<mtr:GetRequestMeterForSettlements><mtr:Header>` +
      `<msg:Verb>get</msg:Verb><msg:Noun>MeterForSettlement</msg:Noun>` +
      `<msg:Timestamp>${timestamp}.000+09:00</msg:Timestamp><msg:User>` +
      `<msg:UserID>${escapeXml(userId)}</msg:UserID>` +
      `<msg:Password>${encryptedPassword}</msg:Password>` +
      `<msg:Organization>${escapeXml(orgCode)}</msg:Organization>` +
      `</msg:User></mtr:Header><mtr:Request><mtr:MeterForSettlementGetProfile>` +
      `<mtr:Market><comm:tradingDay>${tradingDay}</comm:tradingDay>` +
      `<comm:submitDay>${tradingDay}</comm:submitDay></mtr:Market>` +
      `<mtr:RegisteredGenerator><gen:rtoID>${escapeXml(generatorId)}</gen:rtoID>` +
      `</mtr:RegisteredGenerator></mtr:MeterForSettlementGetProfile></mtr:Request>` +
      `</mtr:GetRequestMeterForSettlements></soapenv:Body></soapenv:Envelope>`;
  }

  private parseResponse(xml: string, requestedGeneratorId: string): KpxHourlyValue[] {
    const output: KpxHourlyValue[] = [];
    for (const generator of blocks(xml, 'RegisteredGenerator')) {
      const generatorId = value(generator, 'rtoID') || requestedGeneratorId;
      if (generatorId !== requestedGeneratorId) continue;
      const generatorName = value(generator, 'name');
      for (const measurement of blocks(generator, 'Measurements')) {
        const measurementType = value(measurement, 'measurementType') || '10';
        // type 10이 발전량이다. 다른 계측값은 저장 대상에서 제외한다.
        if (measurementType !== '10') continue;
        for (const analog of blocks(measurement, 'AnalogValues')) {
          const hourNo = Number(value(analog, 'sequenceNumber'));
          const rawValueWh = Number(value(analog, 'value'));
          const timestamp = value(analog, 'timeStamp');
          if (!Number.isInteger(hourNo) || hourNo < 1 || hourNo > 24 || !Number.isFinite(rawValueWh)) {
            continue;
          }
          output.push({
            generatorId,
            generatorName,
            measurementType,
            hourNo,
            intervalEndAt: timestamp && !Number.isNaN(Date.parse(timestamp))
              ? new Date(timestamp)
              : null,
            rawValueWh,
          });
        }
      }
    }
    return output;
  }
}
