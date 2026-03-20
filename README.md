# SME Web Service - 소상공인 웹사이트 템플릿

우리 동네 소상공인을 위한 웹사이트 템플릿입니다.
코드 수정 없이 설정 파일(JSON)만 변경하면 어떤 업종에도 적용할 수 있습니다.

## 주요 기능

- 업체 소개 및 서비스/가격표
- Google Maps 지도 연동
- 온라인 예약 시스템 (좌석/리소스 관리, 시간 충돌 방지)
- 문의 폼 (이메일 알림)
- 관리자 대시보드
- 개인정보 수집 동의 + reCAPTCHA 스팸 방지
- 모바일 반응형 디자인

## 빠른 시작

### 1단계: 프로젝트 복사

```bash
git clone https://github.com/parandurume-labs/sme-web-service.git
cd sme-web-service
```

### 2단계: 내 업체 정보 입력

`data/config.json` 파일을 열어 내 업체 정보로 수정합니다:

```json
{
  "business": {
    "name": "우리가게 강남점",
    "shortName": "우리가게",
    "description": "최고의 서비스를 제공합니다.",
    "address": "서울시 강남구 ...",
    "phone": "02-1234-5678",
    "hours": {
      "weekday": "09:00 - 18:00",
      "saturday": "09:00 - 14:00",
      "sunday": "휴무"
    }
  }
}
```

### 3단계: 서비스 메뉴 수정

`data/services.json` 파일에서 서비스를 추가/수정/삭제합니다:

```json
{
  "id": "my-service",
  "name": "서비스 이름",
  "price": "10,000원",
  "duration": 30,
  "description": "서비스 설명",
  "icon": "&#9986;"
}
```

### 4단계: 로컬에서 확인

```bash
npx serve .
```

브라우저에서 `http://localhost:3000` 접속

### 5단계: 백엔드 설정

문의 폼과 예약 시스템을 활성화하려면 Google Apps Script 설정이 필요합니다.
상세한 설정 방법은 `docs/setup-guide.html` 파일을 브라우저에서 열어 확인하세요.

## 파일 구조

```
sme-web-service/
├── index.html              # 메인 웹페이지
├── admin.html              # 관리자 대시보드
├── css/styles.css          # 스타일시트
├── js/main.js              # 프론트엔드 로직
├── data/
│   ├── config.json         # 업체 정보 + API 설정 (이것만 수정!)
│   └── services.json       # 서비스 메뉴 (이것만 수정!)
├── google-apps-script.js   # Google Apps Script 백엔드 코드
├── docs/
│   └── setup-guide.html    # 설정 가이드 (브라우저에서 열기)
└── README.md               # 이 파일
```

## 수정이 필요한 파일 (2개만!)

| 파일 | 수정 내용 |
|---|---|
| `data/config.json` | 업체명, 주소, 전화, 영업시간, API URL, reCAPTCHA 키 |
| `data/services.json` | 서비스 목록 (이름, 가격, 소요시간) |

나머지 파일(`index.html`, `main.js`, `styles.css`)은 수정할 필요가 없습니다.

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

## 문의

contact@paranduru.me

## 라이선스

GM-Social License v1.0 — 자유롭게 사용하되, 출처를 밝히고 광명을 발견하세요.
자세한 내용은 [LICENSE](LICENSE) 파일을 참고하세요.
