# PRD: Auto Flow - Google Flow 자동화 크롬 확장프로그램

**문서 버전**: 1.0
**작성일**: 2026-03-29
**상태**: 초안 (Draft)

---

## 1. 개요 (Overview)

### 1.1 프로젝트 배경

유튜브 영상 제작 시 대본에 기반한 다수의 AI 이미지 프롬프트를 Google Flow에 입력하여 이미지를 생성해야 한다. 현재는 프롬프트를 하나씩 수동으로 입력해야 하므로 많은 시간이 소요된다. Auto Whisk(Google Whisk용 크롬 확장프로그램)와 유사하게, Google Flow에서 여러 이미지 프롬프트를 자동으로 순차 입력·실행하는 크롬 확장프로그램이 필요하다.

### 1.2 목표 (Goals)

- 다수의 이미지 프롬프트를 일괄 등록하고 Google Flow에 자동으로 순차 입력한다.
- 각 프롬프트 실행 후 이미지 생성 완료를 감지하여 다음 프롬프트로 자동 진행한다.
- 작업 진행 상황(완료/대기/오류)을 실시간으로 표시한다.
- 영상 제작자의 반복 작업 시간을 80% 이상 단축한다.

### 1.3 비목표 (Non-Goals)

- Google Flow 외 다른 AI 이미지 생성 플랫폼 지원 (향후 고려)
- 생성된 이미지의 자동 다운로드 또는 편집 기능 (Phase 2)
- 프롬프트 자동 생성 AI 기능

---

## 2. 사용자 페르소나 (User Persona)

| 항목 | 내용 |
|------|------|
| **주 사용자** | 유튜브 영상 제작자, 콘텐츠 크리에이터 |
| **기술 수준** | 비개발자, 크롬 확장프로그램 사용 경험 있음 |
| **핵심 Pain Point** | 수십 개의 이미지 프롬프트를 하나씩 수동 입력하는 반복 작업 |
| **목표** | 대본 씬(Scene)별 이미지를 빠르게 일괄 생성 |

---

## 3. 기능 요구사항 (Functional Requirements)

### 3.1 핵심 기능 (Must Have)

#### F-01: 프롬프트 목록 관리
- 사용자는 텍스트 영역(Textarea)에 여러 프롬프트를 줄바꿈으로 구분하여 입력할 수 있다.
- 파일 가져오기(`.txt`, `.csv`) 기능으로 프롬프트 목록을 일괄 등록할 수 있다.
- 등록된 프롬프트 목록을 번호와 함께 목록 형태로 표시한다.
- 개별 프롬프트 삭제 및 순서 변경이 가능하다.

#### F-02: 자동 순차 실행
- "Run on This Project" 버튼 클릭 시 현재 열려 있는 Google Flow 탭에서 자동 실행을 시작한다.
- 첫 번째 프롬프트부터 순서대로 Google Flow의 입력창에 텍스트를 자동 입력한다.
- 입력 후 생성(Generate/Run) 버튼을 자동으로 클릭한다.
- 이미지 생성 완료(로딩 종료) 감지 후 다음 프롬프트로 자동 진행한다.

#### F-03: 실행 제어
- "Stop" 버튼으로 자동 실행을 즉시 중단할 수 있다.
- 실행 중 일시정지(Pause) 및 재개(Resume) 기능을 제공한다.
- 사용자가 중단한 지점부터 다시 실행을 재개할 수 있다.

#### F-04: 진행 상태 표시
- 전체 프롬프트 개수 대비 완료된 개수를 표시한다 (예: `3 / 20`).
- 현재 처리 중인 프롬프트를 하이라이트로 표시한다.
- 각 프롬프트의 상태를 아이콘으로 표시한다:
  - ⏳ 대기 중 (Pending)
  - 🔄 실행 중 (Running)
  - ✅ 완료 (Done)
  - ❌ 오류 (Error)

#### F-05: 새 프로젝트 생성
- "Create New Project" 버튼으로 Google Flow에서 새 프로젝트를 자동 생성 후 실행을 시작한다.

### 3.2 부가 기능 (Nice to Have)

#### F-06: 프롬프트 기록 (History)
- 최근 사용한 프롬프트 목록을 최대 10개 저장·불러오기 기능을 제공한다.

#### F-07: 씬 번호 파싱
- 프롬프트 텍스트에서 `씬1`, `씬20`, `Scene 1` 등의 패턴을 자동 인식하여 목록에 씬 번호를 표시한다.

#### F-08: 실행 간격 설정
- 프롬프트 간 대기 시간(딜레이)을 사용자가 직접 설정할 수 있다 (기본값: 자동 감지).

#### F-09: 완료 알림
- 모든 프롬프트 실행 완료 시 브라우저 알림(Notification)을 발송한다.

#### F-10: 다국어 지원
- 한국어(기본), 영어(English) UI를 지원한다.

---

## 4. 비기능 요구사항 (Non-Functional Requirements)

| 항목 | 요구사항 |
|------|---------|
| **호환성** | Chrome 버전 120 이상, Google Flow 웹 앱 |
| **성능** | 이미지 생성 완료 감지 오류율 < 5% |
| **안정성** | 네트워크 오류 발생 시 3회 자동 재시도 후 오류 표시 |
| **보안** | 사용자 데이터를 외부 서버로 전송하지 않음 (로컬 처리) |
| **UX** | 클릭 3회 이내에 자동 실행 시작 |
| **설치** | Chrome Web Store 또는 개발자 모드로 설치 가능 |

---

## 5. 시스템 아키텍처 (System Architecture)

```
┌─────────────────────────────────────────┐
│         Chrome Extension                │
│                                         │
│  ┌──────────────┐   ┌────────────────┐  │
│  │  Popup UI    │   │ Background     │  │
│  │  (React or   │◄──│ Service Worker │  │
│  │   Vanilla JS)│   │                │  │
│  └──────┬───────┘   └────────┬───────┘  │
│         │                   │           │
│         └──────┬────────────┘           │
│                │                        │
│         ┌──────▼───────┐                │
│         │ Content      │                │
│         │ Script       │                │
│         │ (flow.google │                │
│         │  .com 주입)   │                │
│         └──────────────┘                │
└─────────────────────────────────────────┘
          │
          ▼
   Google Flow DOM 조작
   (입력창 타이핑, 버튼 클릭,
    생성 완료 감지)
```

### 5.1 주요 컴포넌트

| 컴포넌트 | 역할 |
|---------|------|
| **Popup UI** | 프롬프트 목록 관리, 실행 제어, 상태 표시 |
| **Content Script** | Google Flow DOM 접근, 입력 자동화, 완료 감지 (MutationObserver) |
| **Background Worker** | 탭 간 통신, 상태 영속화 (chrome.storage) |
| **chrome.storage** | 프롬프트 목록, 진행 상태, 설정값 로컬 저장 |

---

## 6. 핵심 기술 스펙 (Technical Specifications)

### 6.1 Google Flow DOM 자동화 전략

1. **프롬프트 입력창 탐지**: `[data-testid="prompt-input"]` 또는 CSS 셀렉터로 입력창을 찾는다.
2. **텍스트 입력**: `InputEvent`, `KeyboardEvent` 디스패치로 React/Angular 상태를 올바르게 업데이트한다.
3. **생성 버튼 클릭**: Generate/Run 버튼 클릭을 자동화한다.
4. **완료 감지**: `MutationObserver`로 로딩 스피너 제거 또는 결과 이미지 DOM 추가를 감지한다.

### 6.2 Manifest V3 구조

```json
{
  "manifest_version": 3,
  "name": "Auto Flow",
  "version": "1.0.0",
  "permissions": ["storage", "tabs", "notifications", "activeTab"],
  "host_permissions": ["https://flow.google.com/*"],
  "action": { "default_popup": "popup/index.html" },
  "content_scripts": [{
    "matches": ["https://flow.google.com/*"],
    "js": ["content/content.js"]
  }],
  "background": { "service_worker": "background/worker.js" }
}
```

---

## 7. UX/UI 설계

### 7.1 팝업 레이아웃

```
┌─────────────────────────────────┐
│  🎬 Auto Flow          [설정] [?]│
├─────────────────────────────────┤
│  Prompt List          [파일 가져오기]│
│  ┌───────────────────────────┐  │
│  │ 1. ✅ 씬1 - Flat editorial... │
│  │ 2. 🔄 씬2 - Wide angle...   │
│  │ 3. ⏳ 씬3 - Close-up shot...│
│  │ ...                       │  │
│  └───────────────────────────┘  │
│  진행: 1 / 20  ████░░░░░░  5%  │
├─────────────────────────────────┤
│  [✨ Create New Project]         │
│  [▶ Run on This Project] [■ Stop]│
├─────────────────────────────────┤
│  ⚠️ Flow 탭을 열어 두세요.        │
│  [🇰🇷 한국어]  [🇺🇸 English]     │
└─────────────────────────────────┘
```

### 7.2 설정 화면

- 프롬프트 간 추가 대기 시간 (ms)
- 생성 완료 감지 타임아웃 (초)
- 오류 발생 시 재시도 횟수

---

## 8. 사용자 흐름 (User Flow)

```
사용자 → 확장프로그램 팝업 오픈
       → 프롬프트 목록 입력 또는 파일 가져오기
       → Google Flow 탭 활성화
       → "Run on This Project" 클릭
       → [자동 실행 루프]
           ├─ 입력창에 프롬프트 입력
           ├─ Generate 버튼 클릭
           ├─ 생성 완료 대기 (MutationObserver)
           ├─ 상태 업데이트 (✅ 완료)
           └─ 다음 프롬프트 → 반복
       → 전체 완료 알림
```

---

## 9. 개발 마일스톤 (Milestones)

| 단계 | 내용 | 산출물 |
|------|------|--------|
| **Phase 1** | 기본 자동화 구현 | Content Script, 팝업 UI, 순차 실행 |
| **Phase 2** | 안정성 강화 | 오류 처리, 재시도, 완료 감지 개선 |
| **Phase 3** | UX 개선 | 다국어, 기록, 설정 화면, 알림 |
| **Phase 4** | 배포 준비 | Chrome Web Store 등록, 아이콘, 문서 |

---

## 10. 성공 지표 (Success Metrics)

| 지표 | 목표 |
|------|------|
| 자동 실행 성공률 | ≥ 95% (오류 없이 완료) |
| 작업 시간 단축 | ≥ 80% (수동 대비) |
| 완료 감지 정확도 | ≥ 95% |
| 사용자 만족도 | 설치 후 재사용률 ≥ 80% |

---

## 11. 위험 요소 및 대응 (Risks & Mitigations)

| 위험 | 영향 | 대응 방안 |
|------|------|----------|
| Google Flow UI 업데이트로 셀렉터 변경 | 높음 | 다중 셀렉터 폴백, 빠른 패치 대응 |
| 이미지 생성 완료 감지 실패 | 중간 | 타임아웃 + 재시도 + 수동 스킵 버튼 |
| Chrome Manifest V3 API 변경 | 낮음 | 공식 문서 모니터링 |
| Google Flow 봇 감지 차단 | 중간 | 사람처럼 자연스러운 이벤트 디스패치, 딜레이 조정 |

---

## 12. 참고 자료 (References)

- [Auto Whisk Chrome Extension](https://chromewebstore.google.com) - 유사 기능 Whisk용 확장프로그램
- [Chrome Extensions Manifest V3](https://developer.chrome.com/docs/extensions/mv3/)
- [Google Flow](https://flow.google.com) - 대상 플랫폼
- [MutationObserver API](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver)

---

*이 문서는 Auto Flow 크롬 확장프로그램 개발을 위한 요구사항 명세서입니다.*
