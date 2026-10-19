/**
 * 구글 드라이브 백업에 쓰는 OAuth 클라이언트 ID (Google Cloud 콘솔 → 클라이언트 → 웹 애플리케이션).
 * 클라이언트 ID는 비밀 값이 아니라서 코드에 그대로 둔다. 비어 있으면 백업 화면에 "설정 필요"로 나온다.
 */
export const GOOGLE_CLIENT_ID = ''

/** 개인정보처리방침 (public/privacy/index.html) */
export const PRIVACY_URL = `${import.meta.env.BASE_URL}privacy/index.html`
