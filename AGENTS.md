# AGENTS.md — 에이전트 작업 규칙 (sme-web-service)

이 저장소를 읽거나 수정하는 모든 AI 에이전트(Claude, ChatGPT, Gemini, Grok, GitHub Copilot 등)는 작업 전 이 파일과 [SKILL.md](./SKILL.md)를 먼저 읽고 준수합니다.

## 1. 이 프로젝트의 목적

- 코딩 경험이 없는 소상공인(미용실, 네일샵, 병원, 공방, 식당, 스튜디오 등)이 **서버/호스팅 비용 0원**으로 온라인 예약·문의·관리자 페이지를 운영할 수 있게 돕는 템플릿입니다.
- 사용자(소상공인 사장님)가 대화를 통해 가게 정보와 메뉴만 알려주면, 에이전트가 이 저장소의 파일들을 맞춤형으로 수정하고 배포 방법까지 친절하게 안내해야 합니다.

## 2. 파일 수정 시 절대 규칙 (Critical Invariants)

1. **프론트엔드(`data/*.json`)와 백엔드(`google-apps-script.js`) 동시 수정**:
   - `data/services.json`의 서비스 목록(`id`, `name`, `duration`, `price`)을 바꿀 때는 **반드시** `google-apps-script.js` 상단의 `SERVICES` 객체도 동일하게 수정합니다.
   - `data/config.json`의 상호명(`business.name`), 좌석/리소스 수(`booking.totalSeats`), 영업시간(`business.hours`)을 바꿀 때는 **반드시** `google-apps-script.js` 상단의 `CONFIG.shopName`, `CONFIG.totalSeats`, `CONFIG.hours`(분 단위: `시 * 60 + 분`)도 동일하게 수정합니다.
2. **특정 요일 정기 휴무 처리**:
   - 일요일이 아닌 다른 요일(예: 월요일, 화요일)이 휴무이거나 요일별 영업시간이 다르면 `google-apps-script.js`의 `getHoursForDate(dateStr)`와 `js/main.js`의 휴무일 체크 로직을 함께 맞춰 줍니다.
3. **보안 기능 유지**:
   - `google-apps-script.js`의 `LockService` 잠금, `safeCell`/`safeRow`(시트 수식 주입 방지), `safeEqual`(상수 시간 관리자 키 비교), `verifyRecaptcha`, `purgeExpiredData`(보유기간 경과 개인정보 및 캘린더 일정 파기)를 삭제하거나 우회하지 않습니다.
   - `index.html`과 `admin.html`의 `Content-Security-Policy` 메타 태그와 `escapeHtml`/`esc` 함수를 유지합니다.
   - 실제 매장 배포용 `googleAppsScriptUrl`이나 비밀 키, 관리자 비밀번호를 소스 코드에 하드코딩하여 공개 저장소에 커밋하지 않습니다.
4. **비개발자 친화적 안내**:
   - 사용자가 소상공인·비개발자인 경우, 터미널 명령어나 복잡한 개발 용어 대신 웹 브라우저(GitHub 웹 편집기, Google Sheets 확장 프로그램 메뉴)에서 클릭만으로 따라할 수 있는 순서로 설명합니다.

## 3. 상세 커스터마이징 가이드

업종별 설정 변환 표, 영업시간 분(minute) 계산표, 컬러 테마 프리셋, 배포 안내는 [SKILL.md](./SKILL.md)를 참고하세요.
