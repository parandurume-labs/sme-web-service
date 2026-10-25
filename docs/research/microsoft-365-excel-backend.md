# 연구 리포트: Microsoft 365(Excel Online)를 백엔드로 쓰는 방안

- 작성일: 2026-10-25
- 상태: **보류** — 현재 템플릿은 Google(Apps Script + Sheets)만 제공합니다.
- 범위: 이 템플릿의 예약·문의 기능을 Google 대신 Microsoft 서비스(Excel Online, OneDrive/SharePoint, Outlook)로 운영할 수 있는지 검토

## 1. 요약

Excel Online을 데이터베이스로 쓰는 것 자체는 가능합니다. 문제는 웹사이트 요청을 받아 엑셀에 쓰는 **서버 역할**입니다. Google은 Apps Script가 이 역할을 무료로 해 주지만, Microsoft에는 무료 개인 계정에서 같은 일을 하는 공식 수단이 없습니다.

| 결론 | 내용 |
|---|---|
| 무료 개인 계정 | 공식 서버 수단이 없습니다. 별도 서버(예: Cloudflare Workers)를 두고 .xlsx 파일을 통째로 내려받아 수정한 뒤 다시 올리는 방식만 가능합니다. 사장님이 파일을 열어 둔 채 편집하면 충돌이 날 수 있습니다. |
| Microsoft 365 Business 계정 | 별도 서버 + Graph Excel API(행 단위 추가)로 안정적으로 구현할 수 있습니다. |
| 서버 없이 구현 | Power Automate Premium(HTTP 트리거)과 Office Scripts를 함께 쓰면 됩니다. 다만 유료 라이선스가 두 가지 필요합니다. |

보류한 이유는 다음과 같습니다.

1. 이 템플릿의 대상인 "추가 비용 0원" 소상공인에게는 Google 경로가 설정이 더 쉽고 무료입니다.
2. Microsoft 경로는 모두 외부 서버나 유료 라이선스가 필요해 운영 부담이 늘어납니다.
3. 별도 서버가 사장님 계정 토큰을 보관해야 하므로 보안 관리 대상이 하나 더 생깁니다.

## 2. 요구사항

현재 Google 백엔드(`google-apps-script.js`)가 하는 일을 기준으로 삼았습니다.

| 기능 | 설명 |
|---|---|
| 문의 접수 | 공개 웹사이트 폼 → 저장 → 사장님께 메일 알림 |
| 예약 접수 | 서비스·날짜·시간 → 좌석 충돌 검사 → 저장 → 메일·캘린더 등록 |
| 빈 시간 조회 | 날짜·서비스별 남은 좌석 계산 |
| 관리자 조회 | 관리자 키로 예약·문의 목록 조회 |
| 보안 | reCAPTCHA 검증, 입력 검증, 수식 주입 차단, 요청 횟수 제한, 동시 예약 잠금, 관리자 잠금, 보유기간 경과 데이터 자동 파기 |

핵심 조건은 **익명 고객이 보낸 요청을 받아 사장님 엑셀에 쓰는 주체**가 있어야 한다는 점입니다.

## 3. 조사 결과

### 3.1 Office.js (Excel 추가 기능)

- Excel 안에서 실행되는 JavaScript/TypeScript 추가 기능입니다.
- 엑셀 파일을 브라우저나 앱으로 **열어 둔 동안에만** 동작하는 클라이언트입니다. 외부 요청을 받는 서버가 될 수 없습니다.
- 쓸 만한 곳: 사장님이 엑셀 안에서 예약 확정·취소 버튼을 누르는 "관리 화면" 용도.

### 3.2 Office Scripts + Power Automate

- Office Scripts는 Excel 안에서 도는 TypeScript 스크립트입니다. Apps Script와 구조가 가장 비슷합니다.
- **라이선스:** 회사·학교용 Microsoft 365 라이선스가 필요합니다(Business Standard 이상으로 안내됨). 개인 계정과 Business Basic은 대상이 아니라는 자료가 많습니다.
- **Power Automate에서 실행하면 외부 API 호출(`fetch`)이 실패합니다.** reCAPTCHA 검증은 Flow의 HTTP 동작으로 따로 처리해야 합니다.
- 웹사이트 요청을 받는 "HTTP 요청을 받은 경우(When an HTTP request is received)" 트리거는 **프리미엄 커넥터**입니다. Power Automate Premium 라이선스가 따로 필요합니다.
- 이 트리거에는 "누가 흐름을 트리거할 수 있나요?" 설정이 있습니다. 익명 웹 폼에 쓰려면 "누구나(Anyone)"를 골라야 하고, 이 경우 URL을 아는 사람은 누구나 호출할 수 있습니다.
- 스크립트 반환값은 `outputs('Run_script')?['body/result']`로 읽는다는 커뮤니티 답변이 있습니다(공식 문서는 아님).
- 동시 예약은 트리거 동시성 제어를 1로 두면 순차 처리되어 막을 수 있습니다.

### 3.3 Microsoft Graph Excel API (셀·표 단위 읽기·쓰기)

- 공식 문서에 *"OneDrive Consumer 플랫폼에 저장된 통합 문서는 아직 지원하지 않는다"*고 명시돼 있습니다. 비즈니스용 OneDrive, SharePoint, 그룹 드라이브만 됩니다.
- 표에 행 추가(`POST .../tables/{id}/rows`) 권한:
  - 회사·학교 계정의 위임 권한(`Files.ReadWrite`)만 지원
  - 개인 Microsoft 계정과 애플리케이션 권한(앱 단독)은 **미지원**
- 따라서 서버는 사장님(또는 예약 전용 계정)이 한 번 로그인해 얻은 **위임 토큰(refresh token)** 을 보관해야 합니다.
- 세션(`workbook-session-id`)을 쓰면 성능이 좋아집니다. 지속 세션은 약 5분 동안 쓰지 않으면 만료됩니다.

### 3.4 Microsoft Graph Drive API (파일 단위)

- OneDrive 파일 자체를 내려받고 올리는 API입니다. 개인 계정의 OneDrive에서도 쓸 수 있습니다.
- 서버가 .xlsx를 내려받아 SheetJS 같은 라이브러리로 수정한 뒤 다시 올리는 방식이 됩니다.
- 올릴 때 파일 버전값(eTag, `If-Match`)으로 동시 수정 충돌을 감지할 수 있습니다.
- 한계:
  - 매 요청마다 파일 전체를 읽고 씁니다.
  - 사장님이 Excel Online에서 같은 파일을 편집 중이면 충돌·재시도가 생깁니다.
  - 서식이나 일부 기능이 바뀔 수 있습니다.

### 3.5 코드 없이 쓰는 대안

| 서비스 | 용도 | 비고 |
|---|---|---|
| Microsoft Bookings | 온라인 예약 | Microsoft 365 Business Basic·Standard·Premium에 포함. 단독 판매 없음, 자체 결제 기능 없음 |
| Microsoft Forms | 문의 접수 | 응답을 Excel로 볼 수 있음. 좌석 충돌 검사 같은 로직은 불가 |

웹사이트의 예약 버튼을 Bookings 페이지로 연결하는 것이 가장 간단한 Microsoft 경로입니다.

## 4. 방안 비교

| 방안 | 필요한 계정·라이선스 | 서버 | 엑셀 쓰기 방식 | 안정성 | 주요 보안 위험 |
|---|---|---|---|---|---|
| A. Worker + Drive API | 개인 계정 가능 | Cloudflare Workers 등 | 파일 통째로 교체 | 중간 (편집 충돌) | 서버가 OneDrive 전체 접근 토큰 보관 |
| B. Worker + Graph Excel API | Microsoft 365 Business (OneDrive for Business) | Cloudflare Workers 등 | 표에 행 추가 | 높음 | 서버가 위임 토큰 보관 |
| C. Power Automate + Office Scripts | Business Standard 이상 + Power Automate Premium | 없음 (Microsoft 안에서 처리) | 스크립트로 행 추가 | 높음 | 익명 호출 가능한 Flow URL 노출 |
| D. Bookings + Forms | Business Basic 이상 | 없음 | — | 높음 | 낮음 (Microsoft 관리) |

방안 A·B에서 Cloudflare Workers를 서버로 두면 Apps Script보다 나은 점이 있습니다.

- 요청 출처(Origin)를 내 웹사이트로 제한할 수 있습니다(Apps Script는 불가).
- 비밀 값을 Worker Secrets에 보관할 수 있습니다.
- 요청 횟수 제한을 IP 단위로 걸 수 있습니다.

## 5. 다시 검토한다면: 후보 구조 (방안 A/B 공통)

```
[웹사이트] --POST text/plain JSON--> [Cloudflare Worker]
                                        ├─ reCAPTCHA 검증 (fetch)
                                        ├─ 입력 검증·수식 주입 차단·요청 제한
                                        ├─ 저장소 어댑터
                                        │    ├─ 개인 계정: Drive API로 .xlsx 내려받기 → SheetJS 수정 → If-Match 업로드
                                        │    └─ 비즈니스: Graph Excel API로 표 행 추가 (세션 사용)
                                        └─ 알림: Graph 메일 보내기 (Mail.Send) 또는 외부 메일 서비스
```

인증 흐름:

1. Microsoft Entra에 앱을 등록합니다(개인 계정까지 허용하려면 "모든 조직 디렉터리 + 개인 Microsoft 계정").
2. 사장님이 한 번 로그인합니다(디바이스 코드 흐름 등). 이때 `offline_access` 범위로 refresh token을 받습니다.
3. refresh token을 Worker Secret이나 KV에 보관하고, 요청마다 access token으로 바꿔 씁니다.
4. refresh token은 갱신 시 새 토큰으로 교체해 저장합니다. 오래 쓰지 않으면 만료되므로(기본 90일 안팎) 재로그인 안내가 필요합니다.

보안 설계 메모:

- `Files.ReadWrite`는 그 계정의 OneDrive 전체에 대한 권한입니다. **예약 전용 계정**을 따로 만들고 그 계정의 OneDrive에는 이 통합 문서만 두는 것을 권장합니다.
- 엑셀은 `=`로 시작하는 값을 수식으로 저장할 수 있습니다. Google 버전과 같은 수식 주입 차단(`'` 접두)과 열 서식 "텍스트(@)" 지정이 필요합니다.
- 서버(Power Automate·Worker)의 실행 기록에도 개인정보가 남습니다. Power Automate는 동작마다 "보안 입력/출력"을 켜야 합니다.
- 파란두루미가 Worker를 중앙에서 운영해 여러 매장의 데이터를 처리하면 개인정보 **처리 수탁자**가 됩니다. 이 경우 위탁 계약과 처리방침 고지가 필요합니다. 매장별로 각자 Worker를 배포하면 이 문제를 피할 수 있습니다.

## 6. 이미 준비된 부분

다시 시작할 때 웹사이트 쪽은 거의 바꿀 필요가 없도록, 현재 프런트엔드는 백엔드와 다음 계약으로만 통신합니다.

- 모든 요청: `POST`, `Content-Type: text/plain;charset=utf-8`, 본문은 JSON 문자열 (브라우저 사전 요청이 생기지 않음)
- 응답: `{ "status": "ok" | "error", "message"?: string, ... }`

| 요청 | 본문 | 성공 응답 |
|---|---|---|
| 빈 시간 조회 | `{ action: "getSlots", date: "YYYY-MM-DD", service }` | `{ status, slots: [{ time, available, seats[] }], totalSeats }` |
| 문의 | `{ type: "contact", name, phone, email, message, privacyConsent, recaptchaToken, website }` | `{ status, message }` |
| 예약 | `{ type: "booking", service, date, time, seat, name, phone, email, memo, privacyConsent, recaptchaToken, website }` | `{ status, message, seat }` |
| 관리자 조회 | `{ action: "getData", sheet: "all", adminKey }` | `{ status, contacts[], bookings[] }` |

`website`는 봇 차단용 허니팟 칸입니다. 값이 있으면 저장하지 말고 성공처럼 응답합니다.

새 백엔드를 붙일 때 프런트엔드에서 바꿀 곳:

- `js/main.js`의 `getApiUrl()`
- `admin.html`의 API 주소
- `index.html`의 Content-Security-Policy `connect-src`에 새 서버 주소 추가

## 7. 확인하지 못한 사항

다시 검토할 때 먼저 확인해야 할 항목입니다.

- [ ] Power Automate HTTP 트리거에 `text/plain`으로 보낸 본문을 `triggerBody()`가 문자열로 주는지
- [ ] 위 트리거의 Response 동작에 `Access-Control-Allow-Origin` 헤더를 넣으면 브라우저에서 응답을 읽을 수 있는지
- [ ] 개인 계정만 가진 사용자가 Entra 앱을 등록할 수 있는 조건(테넌트 필요 여부)
- [ ] Office Scripts 대상 라이선스 목록(자료마다 Business Basic 포함 여부가 다름)
- [ ] Drive API 파일 교체 방식에서 사장님이 Excel Online으로 파일을 열어 두었을 때의 실제 충돌 빈도
- [ ] Power Automate Premium, Microsoft 365 Business 각 요금제의 현재 국내 가격

## 8. 다시 검토할 시점

- Graph Excel API가 개인 OneDrive를 지원하기 시작할 때
- Microsoft 365 Business를 이미 쓰는 매장의 요청이 생길 때 (방안 B 또는 D)
- 매장 여러 곳을 한 번에 운영하는 관리형 서비스로 확장할 때

## 참고 자료

- [Working with Excel in Microsoft Graph](https://learn.microsoft.com/en-us/graph/api/resources/excel?view=graph-rest-1.0) — OneDrive Consumer 미지원 명시
- [Create TableRow 권한표](https://learn.microsoft.com/en-us/graph/api/table-post-rows?view=graph-rest-1.0) — 위임(회사·학교)만 지원
- [Office Scripts in Excel](https://learn.microsoft.com/en-us/office/dev/scripts/overview/excel)
- [Office Scripts 외부 호출](https://learn.microsoft.com/ko-kr/office/dev/scripts/develop/external-calls) — Power Automate 실행 시 외부 API 호출 불가
- [Office Scripts platform limits](https://learn.microsoft.com/it-ch/office/dev/scripts/testing/platform-limits)
- [Sharing Office Scripts in Excel](https://support.microsoft.com/en-us/topic/226eddbc-3a44-4540-acfe-fccda3d1122b) — 라이선스 요건
- [Use JSON to pass data to and from Office Scripts](https://learn.microsoft.com/en-au/office/dev/scripts/develop/use-json)
- [When an HTTP request is received Trigger](https://manueltgomes.com/reference/power-automate-trigger-reference/when-an-http-request-is-received-trigger/) — 프리미엄 트리거
- [Deeper control over HTTP invocation of flows](https://www.microsoft.com/en-us/power-platform/blog/power-automate/deeper-control-over-http-invocation-of-flows/) — "누가 트리거할 수 있나요" 설정
- [Microsoft Bookings Cost 2026](https://zeeg.me/en/blog/post/microsoft-bookings-cost) — 경쟁사 자료이므로 가격은 Microsoft 공식 페이지에서 재확인 필요
