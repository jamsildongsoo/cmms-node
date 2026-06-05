/**
 * 공통 코드 및 식별자 정규화 유틸리티
 */
export class CodeUtil {
  /**
   * 코드를 대문자로 변환하고 양쪽 공백을 제거합니다.
   * @param code 입력 코드 문자열
   */
  static normalize(code: string | null | undefined): string {
    if (!code) return '';
    return code.trim().toUpperCase();
  }

  /**
   * 여러 개의 회사, 사용자 ID 등을 동일하게 정규화 처리합니다.
   */
  static normalizeOrNull(code: string | null | undefined): string | null {
    if (!code || code.trim() === '') return null;
    return code.trim().toUpperCase();
  }
}
