---
name: sme-web-service
description: >
  소상공인·로컬 매장 맞춤형 예약·문의 웹사이트 템플릿(sme-web-service)을
  업종(미용실, 네일샵, 병원/한의원, 학원/공방, 카페, 식당, 스튜디오 등)에 맞게
  커스터마이징하고 Google Sheets + Google Calendar + Gmail + Google Apps Script 또는
  Microsoft 365(SharePoint + Power Automate) 백엔드로 연결·배포하는 에이전트 스킬.
  사용자가 '소상공인 홈페이지', '예약 사이트 제작', '우리 가게 웹사이트', 'sme-web-service 커스터마이징',
  '구글 시트 예약 연동' 등을 요청할 때 이 스킬을 사용한다.
license: SEE LICENSE IN ./LICENSE
metadata:
  author: parandurume-labs
  version: "2.0.0"
  license: GM-Social-v2.0
---

# SME Web Service — AI 에이전트용 커스터마이징 & 배포 스킬

이 저장소(`https://github.com/parandurume-labs/sme-web-service`)는 **서버·호스팅·DB 비용 0원**으로 소상공인 매장의 소개 페이지, 가격표, 온라인 예약(좌석/리소스 충돌 방지), 문의 폼, 관리자 대시보드를 구축하는 템플릿입니다.

비개발자인 소상공인 사장님이 ChatGPT, Claude, Gemini, Grok, GitHub Copilot 등 AI에게 이 저장소를 주고 **"우리 가게에 맞게 고쳐줘"**라고 요청했을 때, 에이전트는 아래 절차와 규칙을 따라 **코드 누락이나 동기화 오류 없이** 완벽하게 맞춤형 파일들을 생성·수정해야 합니다.

---

## 1. 아키텍처 및 파일 구조 핵심 요약

```
sme-web-service/
├── index.html              # 고객용 메인 웹사이트 (소개, 서비스, 예약, 지도, 문의)
├── admin.html              # 사장님용 관리자 대시보드 (예약 완료/취소/복구, 문의 조회, 개인정보 마스킹)
├── css/styles.css          # 컬러 테마 및 반응형 스타일 (`:root` CSS 변수 기반)
├── js/main.js              # 프론트엔드 로직 (설정 로드, 슬롯 조회, 폼 제출)
├── data/
│   ├── config.json         # 프론트엔드 업체 기본 정보, 영업시간 표기, 리소스 단위, API URL
│   └── services.json       # 프론트엔드 서비스/메뉴 카드 및 예약 선택 항목
├── google-apps-script.js   # Google Apps Script 백엔드 (시트 저장, 캘린더 동기화, 알림 메일, 보안 검증)
├── docs/setup-guide.html   # 비개발자 사장님을 위한 시각적 배포 가이드
├── SKILL.md                # AI 에이전트용 커스터마이징 명세서 (현재 파일)
└── AGENTS.md               # 저장소 작업 에이전트 절대 규칙
```

---

## 2. 에이전트 필수 수행 단계 (Step-by-Step Workflow)

### Step 1: 사장님께 매장 정보 물어보기 (인터뷰)

사장님이 정보를 모두 주지 않았다면, 아래 항목을 친절하고 쉬운 말로 먼저 질문하세요 (전문 용어 사용 금지):

1. **가게 이름 / 짧은 이름**: (예: `봄날 네일 광명점` / `봄날 네일`)
2. **업종 및 한 줄 소개**: (예: `네일샵` / `손끝에 봄을 담아드리는 1:1 맞춤 네일케어`)
3. **주소 및 전화번호**: (예: `경기도 광명시 철산동 123 2층` / `02-123-4567`)
4. **요일별 영업시간 및 휴무일**: (예: `평일 10:00~20:00, 토요일 10:00~18:00, 일요일 휴무`)
5. **동시에 예약 받을 수 있는 수(리소스 수)와 단위 이름**:
   - 미용실/네일샵: `3` / `좌석` 또는 `디자이너`
   - 병원/한의원/상담소: `2` / `진료실` 또는 `상담실`
   - 스튜디오/파티룸/회의실: `1` / `룸`
   - 식당/카페: `5` / `테이블`
   - 공방/원데이클래스: `8` / `명(정원)`
6. **서비스(메뉴) 목록**: 각 메뉴의 **이름, 가격, 소요시간(분), 한 줄 설명**
7. **예약/문의 알림을 받을 사장님 이메일 주소** (Gmail 권장)

---

### Step 2: 프론트엔드와 백엔드의 '동기화 규칙' 지키기 (가장 중요!)

> ⚠️ **CRITICAL RULE (절대 규칙)**
> 이 프로젝트는 정적 웹페이지(`data/*.json`)와 Google Apps Script(`google-apps-script.js`)가 분리되어 있습니다.
> 에이전트가 `data/config.json`이나 `data/services.json`만 고치고 `google-apps-script.js`를 안 고치면 **예약 시 "유효하지 않은 서비스입니다" 오류가 나거나 영업시간/좌석 수가 어긋납니다.**
> **반드시 아래 4곳을 동시에 일치시켜 수정하세요.**

#### 동기화 체크리스트

| 항목 | 프론트엔드 파일 | 백엔드 파일 (`google-apps-script.js`) | 일치시켜야 할 값 |
|---|---|---|---|
| **가게 이름** | `data/config.json` → `business.name` | `CONFIG.shopName` | 동일한 상호명 |
| **사장님 알림 이메일** | - | `CONFIG.notificationEmail` | 알림 받을 이메일 주소 |
| **동시 예약 리소스 수** | `data/config.json` → `booking.totalSeats` | `CONFIG.totalSeats` | 동일한 정수 (예: `3`) |
| **영업시간 (분 단위 변환)** | `data/config.json` → `business.hours` | `CONFIG.hours` (`open`, `close`) | 시각을 **자정 기준 분(minute)**으로 변환 (`10:00` → `600`, `20:00` → `1200`, 휴무 → `null`) |
| **서비스/메뉴 목록** | `data/services.json` → `services[]` | `SERVICES` 객체 | 모든 `id`, `name`, `duration`(분), `price`가 **100% 동일**해야 함 |
| **HTML 기본 메타데이터** | `index.html` (`<title>`, `<meta name="description">`, 개인정보 동의서 내 서비스 목적 문구) | - | 업종에 맞는 타이틀과 개인정보 수집 목적 문구 |

#### 영업시간 분(Minute) 변환 공식 (`google-apps-script.js`의 `CONFIG.hours`)
- `시(Hour) × 60 + 분(Minute)`
  - `09:00` = `540`, `09:30` = `570`, `10:00` = `600`, `11:00` = `660`
  - `17:00` = `1020`, `18:00` = `1080`, `19:00` = `1140`, `20:00` = `1200`, `21:00` = `1260`, `22:00` = `1320`
- 휴무일인 경우 `null`로 설정합니다 (예: `sunday: null`).
-もし 평일 중 특정 요일(예: 월요일이나 화요일)이 정기 휴무라면, `getHoursForDate(dateStr)` 함수에서 `day === 1`(월요일) 또는 `day === 2`(화요일)일 때 `null`을 반환하도록 함께 수정해 주세요.

---

### Step 3: 업종별 디자인 컬러 테마 추천 및 변경 (`css/styles.css`)

사장님의 업종 분위기에 맞춰 `css/styles.css` 최상단의 `:root` 색상 변수를 조정하면 사이트 인상이 완전히 달라집니다.

```css
:root {
  --color-primary: #5a4a3a;       /* 메인 브랜드 컬러 */
  --color-primary-light: #7a6a5a; /* 버튼 호버 등 밝은 메인 컬러 */
  --color-accent: #c9a96e;        /* 포인트/강조 컬러 */
  --color-bg: #faf7f2;            /* 기본 배경색 */
  --color-bg-alt: #f3ede4;        /* 교차 섹션 배경색 */
}
```

- **미용실 / 바버샵 / 공방 (기본값)**: 따뜻한 우드 & 골드 (`#5a4a3a` / `#c9a96e` / `#faf7f2`)
- **네일샵 / 에스테틱 / 피부관리**: 로즈 브라운 & 소프트 핑크 (`#6d4c5b` / `#d48c9e` / `#fdf8f9`)
- **병원 / 한의원 / 치과 / 심리상담**: 차분한 딥 그린 & 세이지 (`#2c5e4f` / `#68a691` / `#f4f9f7`) 또는 신뢰감 있는 네이비 (`#1e3a5f` / `#4a90d9` / `#f5f8fc`)
- **카페 / 베이커리 / 레스토랑**: 에스프레소 & 테라코타 (`#4a3525` / `#c86d51` / `#fbf7f4`)
- **사진관 / 스튜디오 / 학원**: 모던 차콜 & 웜 그레이 (`#2b2b2b` / `#8c7a6b` / `#f7f7f7`)

---

### Step 4: 보안 설정 및 불변 규칙 (절대 훼손 금지)

에이전트가 코드를 수정할 때 다음 보안 장치는 **절대 제거하거나 약화시키지 마세요**:

1. **시트 수식 인젝션 방어 (`safeCell`, `safeRow`)**: `=`, `+`, `-`, `@` 등으로 시작하는 고객 입력이 Google Sheets 수식으로 실행되지 않도록 막습니다.
2. **동시 예약 충돌 방지 (`LockService.getScriptLock()`)**: `handleBooking`, `handleUpdateBookingStatus`, `handleAdmin`, `isRateLimited`의 잠금(Lock) 로직을 유지하세요.
3. **관리자 키 헤더/본문 전송 및 잠금**: `adminKey`는 절대 URL 쿼리스트링(`GET`)으로 보내지 않고 `POST` 본문으로만 전송하며, 5회 실패 시 15분간 잠깁니다.
4. **CSP(Content-Security-Policy) 유지**: `index.html`과 `admin.html` 상단의 CSP 메타 태그를 유지하세요. 외부 이미지나 별도 백엔드 도메인을 추가할 때만 해당 도메인을 CSP에 명시적으로 추가합니다.
5. **한국 표준시(`Asia/Seoul`) 기준 날짜 파싱**: 프론트엔드(`parseLocalDate`)와 백엔드 모두 `+09:00` 기준 날짜 계산을 유지하여 타임존으로 인해 요일이 밀리는 현상을 방지하세요.

---

### Step 5: 사장님께 비개발자 눈높이로 배포 안내하기

코드 수정이 끝나면 사장님께 수정된 파일 내용을 전달하면서, 아래 **5단계 따라하기**를 아주 쉽게 안내해 주세요:

1. **Google 스프레드시트 새로 만들기**:
   - 상단 메뉴 **[확장 프로그램] → [Apps Script]**를 열고, 에이전트가 만들어 준 `google-apps-script.js` 코드를 붙여넣고 저장합니다.
2. **스크립트 속성 2가지 넣기** (왼쪽 톱니바퀴 **[프로젝트 설정] → [스크립트 속성]**):
   - `ADMIN_KEY`: 관리자 페이지에서 쓸 비밀번호 (12자리 이상, 예: `MyShop2026!@#`)
   - `RECAPTCHA_SECRET_KEY`: 구글 reCAPTCHA v2에서 발급받은 비밀 키 (테스트 중 잠시 건너뛰려면 코드의 `allowInsecureNoRecaptcha: true`로 설정 가능하나, 실제 오픈 전에는 반드시 `false`와 비밀 키 설정 권장)
3. **자동 파기 트리거 1회 실행 (선택 권장)**:
   - Apps Script 상단 함수 선택에서 `setupSecurityTriggers`를 고르고 **[실행]** 버튼 클릭 → 권한 승인 (1년 지난 개인정보를 매일 새벽 자동으로 파기해 줍니다).
4. **웹 앱으로 배포**:
   - 오른쪽 위 **[배포] → [새 배포]** → 유형: **웹 앱**, 실행 주체: **나**, 액세스 권한: **모든 사용자** → 배포 후 나온 **`https://script.google.com/macros/s/.../exec`** 주소를 복사합니다.
5. **`data/config.json`에 주소 넣기**:
   - 복사한 주소를 `data/config.json`의 `"googleAppsScriptUrl"` 칸에 붙여넣으면 모든 연동이 완료됩니다!
   - 사장님은 이제 스마트폰 **Google 캘린더 앱**에 `[휴무]` 또는 종일 일정을 등록하기만 해도 웹사이트에서 해당 시간 예약이 자동으로 막힙니다.
