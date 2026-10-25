# SME Web Service - 소상공인 맞춤형 예약·문의 웹사이트 템플릿

우리 동네 소상공인을 위한 **서버·호스팅·월 유지비 0원** 웹사이트 & 예약 관리 템플릿입니다.  
구글 기본 서비스(**Google Sheets + Google Calendar + Gmail + Google Apps Script**)와 **GitHub Pages**만 활용하여 미용실, 네일샵, 병원/한의원, 공방, 학원, 식당, 사진관 등 어떤 업종에도 맞게 변형할 수 있습니다.

> 💡 **개발 경험이 전혀 없으신 사장님이신가요?**  
> 직접 코드를 건드릴 필요가 없습니다! 아래 **[🤖 AI(ChatGPT·Claude·Gemini·Grok)에게 맡겨서 우리 가게 사이트 만들기](#-ai에게-맡겨서-우리-가게-사이트-만들기-비개발자-사장님용)** 안내에 있는 문구를 복사해서 AI에게 붙여넣기만 하세요. AI가 이 저장소의 에이전트 가이드([`SKILL.md`](SKILL.md), [`AGENTS.md`](AGENTS.md))를 읽고 우리 가게에 꼭 맞게 고쳐서 배포 방법까지 하나씩 친절하게 알려줍니다.

## 주요 기능

- **업체 소개 및 서비스/가격표**: 설정 파일만 바꾸면 메뉴·가격·소요시간 즉시 반영
- **온라인 예약 시스템**: 동시 예약 가능 수(좌석·디자이너·룸·테이블) 관리 및 시간 충돌 자동 방지
- **Google Calendar 양방향 연동**: 예약 접수 시 구글 캘린더에 자동 등록되며, 사장님이 스마트폰 구글 캘린더 앱에 `[휴무]`나 종일 일정을 넣으면 해당 시간대 예약이 자동으로 마감됨
- **관리자 대시보드 (`admin.html`)**: 예약 완료/취소/복구 상태 변경(취소 시 캘린더 일정 자동 삭제), 문의 내역 확인, 매장 내 개인정보 가리기(마스킹) 지원
- **문의 폼 & 이메일 알림**: 예약이나 문의가 들어오면 사장님 이메일(Gmail)로 즉시 알림 발송
- **Google Maps 지도 연동**: 오시는 길 및 영업시간 안내
- **소상공인 눈높이의 보안 기능**: reCAPTCHA 스팸 방지, 봇 차단 허니팟, 시트 수식 주입 차단, 동시 예약 잠금, 관리자 로그인 실패 잠금, 보유기간(1년) 경과 개인정보 및 캘린더 일정 매일 자동 파기

---

## 🤖 AI에게 맡겨서 우리 가게 사이트 만들기 (비개발자 사장님용)

코딩을 전혀 몰라도 괜찮습니다. 평소 쓰시는 **ChatGPT, Claude(클로드), Gemini(제미나이), Grok(그록)** 중 아무 곳이나 열어서 아래 순서대로 따라 해보세요.

### 1단계: 아래 프롬프트를 복사해서 AI 채팅창에 붙여넣기

괄호 `[ ]` 안의 내용만 우리 가게 정보로 바꿔서 AI에게 보내세요.

```text
안녕! 나는 개발 경험이 없는 소상공인이야.
아래 공개된 GitHub 저장소 템플릿을 활용해서 우리 가게에 맞는 홈페이지와 온라인 예약 시스템을 만들고 싶어.

저장소 주소: https://github.com/parandurume-labs/sme-web-service
에이전트 가이드 문서:
- https://raw.githubusercontent.com/parandurume-labs/sme-web-service/main/SKILL.md
- https://raw.githubusercontent.com/parandurume-labs/sme-web-service/main/AGENTS.md

먼저 위 저장소의 SKILL.md와 AGENTS.md, 그리고 data/config.json, data/services.json, google-apps-script.js, css/styles.css 파일을 확인해 줘.
그 다음 우리 가게 정보에 맞게 수정된 파일 내용(config.json, services.json, google-apps-script.js, styles.css)을 만들어 주고, 내가 컴퓨터 화면에서 어디를 클릭해서 구글 시트와 GitHub Pages에 올리면 되는지 초보자 눈높이로 하나씩 알려줘.

[우리 가게 정보]
1. 가게 이름 / 짧은 이름: [예: 봄날 네일 광명점 / 봄날 네일]
2. 업종 및 한 줄 소개: [예: 네일샵 / 손끝에 봄을 담아드리는 1:1 맞춤 케어]
3. 주소 및 전화번호: [예: 경기도 광명시 철산동 123 2층 / 02-123-4567]
4. 영업시간 및 휴무일: [예: 평일 10:00~20:00, 토요일 10:00~18:00, 일요일 휴무]
5. 동시에 예약 받을 수 있는 수와 단위: [예: 동시에 2명 가능, 단위는 '좌석']
6. 서비스 메뉴 (이름 / 가격 / 소요시간 / 설명):
   - [예: 기본 케어 / 20,000원 / 30분 / 깔끔한 큐티클 정리와 영양 케어]
   - [예: 원컬러 젤네일 / 45,000원 / 60분 / 원하는 컬러로 꼼꼼한 젤 시술]
   - [예: 이달의 아트 / 65,000원~ / 90분 / 트렌디한 시즌 디자인]
7. 예약·문의 알림 받을 이메일: [예: myshop@gmail.com]
8. 원하는 홈페이지 분위기/색상: [예: 따뜻하고 밝은 핑크·베이지 톤]
```

### 2단계: AI 도구별 팁 (어떻게 쓰면 가장 편한가요?)

| 사용하시는 AI | 가장 편하게 작업하는 방법 |
|---|---|
| **ChatGPT / Gemini / Grok (웹 채팅)** | 위 프롬프트를 그대로 붙여넣으세요. 만약 AI가 저장소 링크를 직접 읽지 못하면, 이 페이지에서 [`SKILL.md`](SKILL.md) 파일을 눌러 내용을 복사해 함께 붙여넣어 주면 완벽하게 코드를 만들어 줍니다. |
| **Claude Code / GitHub Copilot / Cursor (코딩 에이전트)** | 이 저장소를 복제(Fork/Clone)한 뒤 채팅창에 **"이 폴더의 `SKILL.md`를 읽고 우리 가게 정보에 맞게 수정한 뒤 배포까지 도와줘"**라고 한 줄만 입력하면 에이전트가 파일 수정부터 배포 준비까지 알아서 처리합니다. |

### 3단계: 운영 중 메뉴나 영업시간이 바뀌었을 때 AI에게 요청하는 법

사이트를 오픈한 뒤에 가격이나 메뉴, 휴무일을 바꾸고 싶을 때도 AI에게 이렇게 말하면 됩니다:

- *"우리 가게 메뉴에서 '원컬러 젤네일' 가격을 50,000원으로 올리고, '속눈썹 펌(40,000원, 60분)' 메뉴를 새로 추가해 줘. `services.json`이랑 `google-apps-script.js` 둘 다 맞춰서 수정해 줘."*
- *"이번 주 수요일은 임시 휴무야. 어떻게 예약을 막으면 돼?"* → **(팁: 코드를 고칠 필요 없이 사장님 스마트폰의 Google 캘린더 앱에서 해당 날짜에 `[휴무]`라고 일정을 등록하면 자동으로 예약이 막힙니다!)**

---

## 🛠️ AI 에이전트용 가이드 (`SKILL.md` & `AGENTS.md`)

이 저장소는 AI 에이전트가 다른 소상공인 환경에 맞게 즉시 변형·배포할 수 있도록 표준화된 에이전트 지침을 포함하고 있습니다.

- **[`SKILL.md`](SKILL.md)**: 업종별 리소스 단위 매핑, 영업시간 분(minute) 변환 공식, 프론트엔드(`data/*.json`) ↔ 백엔드(`google-apps-script.js`) 필수 동기화 체크리스트, 업종별 컬러 팔레트 프리셋, 비개발자 안내 절차 수록
- **[`AGENTS.md`](AGENTS.md)**: 저장소를 수정하는 에이전트가 반드시 지켜야 할 데이터 정합성 및 보안 불변 규칙

---

## 개발자 / 직접 설정하는 분을 위한 빠른 시작

### 1단계: 프로젝트 복사

```bash
git clone https://github.com/parandurume-labs/sme-web-service.git
cd sme-web-service
```

### 2단계: 내 업체 정보 및 메뉴 입력 (`data/*.json` + `google-apps-script.js`)

1. `data/config.json`: 업체명, 주소, 전화, 영업시간 표기, `totalSeats`, `seatLabel`, `googleAppsScriptUrl`, `recaptcha.siteKey` 수정
2. `data/services.json`: 서비스 목록 (`id`, `name`, `price`, `duration`, `description`, `icon`) 수정
3. `google-apps-script.js`: 상단의 `CONFIG`(`shopName`, `notificationEmail`, `totalSeats`, `hours`)와 `SERVICES` 객체를 `data/*.json`과 동일하게 맞춤

### 3단계: 로컬에서 확인

```bash
npx serve .
```

브라우저에서 `http://localhost:3000` 접속 (`admin.html`은 `http://localhost:3000/admin.html`)

### 4단계: Google Apps Script 백엔드 배포

상세한 시각적 가이드는 [`docs/setup-guide.html`](docs/setup-guide.html) 또는 [`SETUP-GUIDE.md`](SETUP-GUIDE.md)를 참고하세요.

1. 새 Google 스프레드시트 생성 → **확장 프로그램 → Apps Script** 열기 → `google-apps-script.js` 붙여넣기
2. **프로젝트 설정 → 스크립트 속성**에 다음 추가:
   - `ADMIN_KEY`: 관리자 페이지 비밀번호 (12자 이상)
   - `RECAPTCHA_SECRET_KEY`: Google reCAPTCHA v2 비밀 키
   - `CALENDAR_ID` (선택): 예약을 등록할 캘린더 ID (생략 시 기본 캘린더 `primary`)
3. 편집기 상단에서 `setupSecurityTriggers` 함수 선택 후 1회 **실행** (매일 새벽 보유기간 경과 데이터 자동 파기 등록)
4. **배포 → 새 배포 → 웹 앱** (실행 주체: *나*, 액세스 권한: *모든 사용자*) 배포 후 생성된 웹 앱 URL을 `data/config.json`의 `api.googleAppsScriptUrl`에 입력

## 파일 구조

```
sme-web-service/
├── index.html              # 고객용 메인 웹페이지
├── admin.html              # 사장님용 관리자 대시보드 (예약 상태 변경·문의 확인)
├── css/styles.css          # 스타일시트 (:root 컬러 테마 변수)
├── js/main.js              # 프론트엔드 로직
├── data/
│   ├── config.json         # 업체 정보 + API 설정
│   └── services.json       # 서비스 메뉴 목록
├── google-apps-script.js   # Google Apps Script 백엔드 코드
├── SKILL.md                # AI 에이전트용 커스터마이징·배포 스킬 가이드
├── AGENTS.md               # AI 에이전트 작업 규칙
├── SETUP-GUIDE.md          # 마크다운 설정 가이드
└── docs/
    ├── setup-guide.html    # 비개발자용 시각적 설정 가이드 (브라우저/PDF 인쇄용)
    └── research/           # 검토 리포트 (Microsoft 365 백엔드 등)
```

## 보안 기능

| 기능 | 내용 |
|---|---|
| 스팸 방지 | reCAPTCHA v2 서버 필수 검증(Fail-closed) + 봇 차단용 숨은 입력칸(허니팟) |
| 입력 검증 | 길이·전화번호·이메일 형식, 영업시간·예약 가능 날짜 서버 검증 (`Asia/Seoul` 기준) |
| 시트 보호 | `=`·`+`·`-`·`@`로 시작하는 입력이 수식으로 실행되지 않도록 차단 (`safeCell`) |
| 남용 방지 | `LockService` 기반 요청 횟수 제한 및 동시 예약 좌석 충돌 원천 방지 |
| 관리자 보호 | 관리자 키 POST 본문 전송, `LockService` 기반 5회 연속 실패 시 15분 잠금 + 보안 알림 메일, 개인정보 마스킹, 30분 무동작 자동 로그아웃 |
| 개인정보 | 보유기간(기본 365일) 경과 시 시트 행 및 연동된 Google Calendar 일정 매일 자동 파기 |
| 웹페이지 | `index.html` 및 `admin.html` 모두 Content-Security-Policy(CSP)로 외부 스크립트·연결 제한 |

사장님이 직접 해야 할 계정 보안 체크리스트는 `docs/setup-guide.html`의 "7단계: 계정·고객 정보 지키기"에 있습니다.

## 기술 스택

| 영역 | 기술 | 비용 |
|---|---|---|
| 웹페이지 | HTML + CSS + JavaScript | 무료 |
| 호스팅 | GitHub Pages | 무료 |
| 백엔드 | Google Apps Script | 무료 |
| 데이터 저장 | Google Sheets | 무료 |
| 예약 캘린더 | Google Calendar | 무료 |
| 이메일 알림 | Gmail | 무료 |
| 스팸 방지 | reCAPTCHA v2 | 무료 |
| 지도 | Google Maps Embed | 무료 |

**총 비용: 무료**

> Microsoft 365(Excel Online)를 백엔드로 쓰는 방안은 검토 후 보류했습니다. 조사 내용은 [docs/research/microsoft-365-excel-backend.md](docs/research/microsoft-365-excel-backend.md)에 있습니다.

## 문의

contact@paranduru.me

## 라이선스

[GM-Social 라이선스 v2.0](LICENSE)을 따릅니다. 라이선스는 한국어와 영어로 되어 있고, 두 글의 내용이 다르면 한국어 원문이 우선합니다.

- 상업적 용도를 포함해 자유롭게 쓰고, 고치고, 나눌 수 있습니다.
- 복사하거나 고쳐 쓸 때는 라이선스 파일과 저작권 표시를 그대로 두고, 원저작자(이인희 / 파란두루미)와 출처를 밝혀 주세요.
- 파생 저작물을 배포하면 직접 덧붙인 부분도 같은 라이선스로 공개해야 합니다.
- 운영 환경에 올리면 90일 안에 경기도 광명시에 감사하는 글과 광명을 소개하는 게시물을 올려 주세요. 교육·학습 목적이나 비영리 단체의 공익 목적으로 쓸 때는 이 의무가 면제됩니다.
