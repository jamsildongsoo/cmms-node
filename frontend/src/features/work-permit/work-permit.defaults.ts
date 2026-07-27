import type { WorkPermitCheckItem } from './work-permit.types';

export const INITIAL_GENERAL: WorkPermitCheckItem[] = [
  { question: '안전모, 안전화, 안전장갑 등 작업자 보호구 착용이 완료되었는가?', checked: false, remarks: '' },
  { question: '작업 구역 주변 안전 표지판 및 바리케이드를 설치하였는가?', checked: false, remarks: '' },
  { question: '작업 전 위험성 평가 및 현장 TBM(Tool Box Meeting)을 통해 안전 교육을 실시하였는가?', checked: false, remarks: '' },
];

export const INITIAL_FIRE: WorkPermitCheckItem[] = [
  { question: '작업 장소 반경 11m 이내 가연성/인화성 물질을 제거 또는 방화막으로 격리하였는가?', checked: false, remarks: '' },
  { question: '현장 내 소화기를 적정 수량 비치하고 즉시 사용 가능 상태인가?', checked: false, remarks: '' },
  { question: '작업 중 불꽃 비산 방지포 설치 및 화재감시자를 별도 지정 배치하였는가?', checked: false, remarks: '' },
];

export const INITIAL_CONFINED: WorkPermitCheckItem[] = [
  { question: '진입 전 밀폐공간 내 산소 및 유해가스 농도를 측정 완료하였는가?', checked: false, remarks: '' },
  { question: '작업 중 공기 배출 및 급기를 위해 송풍기를 지속 운전 중인가?', checked: false, remarks: '' },
  { question: '외부 감시인을 배치하고 비상 통신 장비 및 인명 구조용 장비를 갖추었는가?', checked: false, remarks: '' },
];

export const INITIAL_ELECTRIC: WorkPermitCheckItem[] = [
  { question: '해당 선로의 전원 차단 후 LOTO(Lock-Out, Tag-Out) 잠금장치 및 꼬리표를 부착했는가?', checked: false, remarks: '' },
  { question: '검전기를 사용하여 무전압 상태임을 확인하였는가?', checked: false, remarks: '' },
  { question: '절연 보호구 및 절연 공구류를 점검 후 사용 중인가?', checked: false, remarks: '' },
];

export const INITIAL_HIGH_PLACE: WorkPermitCheckItem[] = [
  { question: '높이 2m 이상 고소 작업으로 안전대 부착 설비에 안전줄을 견고히 체결했는가?', checked: false, remarks: '' },
  { question: '비계, 사다리, 고소작업대 등 발판의 안전성(아웃트리거 고정 등)을 점검했는가?', checked: false, remarks: '' },
  { question: '하부 낙하물 방지망 설치 또는 안전 통제 구역을 설정하여 신호수를 배치했는가?', checked: false, remarks: '' },
];

export const INITIAL_EXCAVATION: WorkPermitCheckItem[] = [
  { question: '굴착 지역 내 지하 매설물(가스관, 전기선, 배관 등) 여부를 현장 조사 및 확인했는가?', checked: false, remarks: '' },
  { question: '굴착 사면의 붕괴 방지를 위해 흙막이 지보공을 설치하고 안전 구배를 준수하는가?', checked: false, remarks: '' },
  { question: '굴착 주변에 장비 진입 차단 펜스 및 안내 표지를 배치했는가?', checked: false, remarks: '' },
];

export const INITIAL_HEAVY_LOAD: WorkPermitCheckItem[] = [
  { question: '크레인/이동식 크레인 등 양중 장비의 정격 하중 및 안전 장치 정상 여부를 확인했는가?', checked: false, remarks: '' },
  { question: '인양용 줄걸이 와이어 로프, 슬링 벨트의 소선 단선 또는 균열이 없는지 점검했는가?', checked: false, remarks: '' },
  { question: '양중 작업 반경 내 일반인의 진입을 철저히 차단하고 신호수를 배치했는가?', checked: false, remarks: '' },
];

export const parseCheckItems = (
  value: string | WorkPermitCheckItem[] | null | undefined,
  fallback: WorkPermitCheckItem[],
): WorkPermitCheckItem[] => {
  if (Array.isArray(value)) return value;
  if (!value) return fallback;
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed as WorkPermitCheckItem[] : fallback;
  } catch {
    return fallback;
  }
};
