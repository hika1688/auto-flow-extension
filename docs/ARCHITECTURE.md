# 시스템 아키텍처 설계 문서: Auto Flow

**문서 버전**: 1.0
**작성일**: 2026-03-29
**참조 문서**: [PRD.md](./PRD.md)
**상태**: 초안 (Draft)

---

## 목차

1. [아키텍처 개요](#1-아키텍처-개요)
2. [레이어 구조](#2-레이어-구조)
3. [컴포넌트 상세 설계](#3-컴포넌트-상세-설계)
4. [데이터 흐름](#4-데이터-흐름)
5. [상태 관리](#5-상태-관리)
6. [통신 프로토콜](#6-통신-프로토콜)
7. [DOM 자동화 전략](#7-dom-자동화-전략)
8. [오류 처리 및 복구](#8-오류-처리-및-복구)
9. [디렉터리 구조](#9-디렉터리-구조)
10. [기술 스택](#10-기술-스택)
11. [보안 설계](#11-보안-설계)
12. [성능 설계](#12-성능-설계)

---

## 1. 아키텍처 개요

### 1.1 전체 시스템 구조

Auto Flow는 Chrome Extension Manifest V3 기반으로 3개의 독립된 실행 컨텍스트(Popup, Background, Content Script)가 메시지 패싱으로 협력하는 구조다.

```
┌──────────────────────────────────────────────────────────────────┐
│                        Chrome Browser                            │
│                                                                  │
│  ┌─────────────────────────┐    ┌──────────────────────────────┐ │
│  │     Extension Context   │    │      Web Page Context        │ │
│  │                         │    │   (flow.google.com)          │ │
│  │  ┌───────────────────┐  │    │                              │ │
│  │  │    Popup UI       │  │    │  ┌────────────────────────┐  │ │
│  │  │  (popup/index.html│  │    │  │   Content Script       │  │ │
│  │  │   popup/index.js) │  │    │  │  (content/content.js)  │  │ │
│  │  └────────┬──────────┘  │    │  │                        │  │ │
│  │           │             │    │  │  ┌──────────────────┐  │  │ │
│  │           │chrome.      │    │  │  │  FlowAutomator   │  │  │ │
│  │           │runtime      │    │  │  │  DOMController   │  │  │ │
│  │           │.sendMessage │    │  │  │  StateObserver   │  │  │ │
│  │           │             │    │  │  └──────────────────┘  │  │ │
│  │  ┌────────▼──────────┐  │    │  └───────────┬────────────┘  │ │
│  │  │ Background Worker │◄─┼────┼──────────────┘              │ │
│  │  │(background/worker │  │    │    chrome.tabs.sendMessage   │ │
│  │  │        .js)       │  │    │                              │ │
│  │  └────────┬──────────┘  │    └──────────────────────────────┘ │
│  │           │             │                                      │
│  │  ┌────────▼──────────┐  │                                      │
│  │  │  chrome.storage   │  │                                      │
│  │  │    (local)        │  │                                      │
│  │  └───────────────────┘  │                                      │
│  └─────────────────────────┘                                      │
└──────────────────────────────────────────────────────────────────┘
```

### 1.2 실행 컨텍스트 비교

| 컨텍스트 | 파일 | 생명주기 | DOM 접근 | 권한 |
|---------|------|---------|---------|------|
| **Popup UI** | `popup/index.html` | 팝업 열림~닫힘 | 자체 팝업만 | 제한적 |
| **Background Worker** | `background/worker.js` | 이벤트 기반 (Service Worker) | 불가 | 모든 chrome.* API |
| **Content Script** | `content/content.js` | 탭 생존 동안 | flow.google.com DOM | 제한적 chrome.* |

---

## 2. 레이어 구조

```
┌──────────────────────────────────────────────────────┐
│                   Layer 4: UI Layer                   │
│         Popup HTML + CSS + UI 이벤트 핸들러            │
├──────────────────────────────────────────────────────┤
│               Layer 3: Application Layer              │
│    PromptManager │ ExecutionController │ HistoryManager│
├──────────────────────────────────────────────────────┤
│               Layer 2: Communication Layer            │
│         MessageBus (chrome.runtime messaging)         │
├──────────────────────────────────────────────────────┤
│               Layer 1: Infrastructure Layer           │
│  StorageService │ FlowAutomator │ StateObserver       │
├──────────────────────────────────────────────────────┤
│               Layer 0: Platform Layer                 │
│      chrome.storage │ chrome.tabs │ DOM API           │
└──────────────────────────────────────────────────────┘
```

---

## 3. 컴포넌트 상세 설계

### 3.1 Popup UI (`popup/`)

사용자와의 모든 인터랙션을 담당하는 진입점.

```
popup/
├── index.html          # 팝업 HTML 뼈대
├── index.js            # 팝업 진입점, 이벤트 바인딩
├── components/
│   ├── PromptList.js   # 프롬프트 목록 렌더링 및 편집
│   ├── ProgressBar.js  # 진행률 표시 (n/total, %)
│   ├── ControlPanel.js # Run/Stop/Pause/Resume 버튼
│   └── SettingsModal.js# 딜레이/타임아웃/재시도 설정
├── services/
│   ├── PopupBridge.js  # Background Worker와의 메시지 통신
│   └── FileImporter.js # .txt/.csv 파일 파싱
└── styles/
    └── popup.css
```

**PromptList 컴포넌트 책임**:
- 프롬프트 항목 추가 / 삭제 / 순서 변경 (drag-and-drop)
- 씬 번호 자동 파싱 및 표시 (`씬1`, `Scene 1` 패턴)
- 각 항목 상태 아이콘 렌더링 (⏳ / 🔄 / ✅ / ❌)

**PopupBridge 통신 규칙**:
- Popup → Background: `chrome.runtime.sendMessage()`
- Background → Popup: `chrome.runtime.onMessage` 리스너 + `sendResponse`
- 상태 동기화: 팝업 오픈 시 Background로부터 현재 세션 상태를 즉시 pull

---

### 3.2 Background Service Worker (`background/worker.js`)

확장프로그램의 두뇌. 상태를 보존하고 Popup ↔ Content Script 간 중계 역할.

```
background/
└── worker.js
    ├── SessionState         # 메모리 내 실행 세션 상태
    ├── MessageRouter        # 메시지 수신 및 라우팅
    ├── ExecutionOrchestrator# 자동 실행 순서 제어 로직
    ├── StorageService       # chrome.storage.local CRUD
    └── NotificationService  # chrome.notifications API
```

**ExecutionOrchestrator 책임**:
- 프롬프트 큐(Queue) 관리 및 순서 제어
- Content Script에 개별 실행 명령 전달
- 완료 / 오류 / 타임아웃 이벤트 수신 및 다음 단계 진행
- Pause / Resume / Stop 상태 전환 처리
- 최대 3회 재시도 로직 (지수 백오프)

**Service Worker 생명주기 주의사항**:
- Manifest V3의 Service Worker는 비활성 시 종료될 수 있음
- `chrome.storage.session`(임시) + `chrome.storage.local`(영속)을 분리 사용
- 장시간 실행 시 `chrome.alarms` API로 Worker 유지

---

### 3.3 Content Script (`content/`)

flow.google.com 페이지에 주입되어 실제 DOM을 조작하는 유일한 컴포넌트.

```
content/
├── content.js          # 진입점, 메시지 수신 라우터
├── FlowAutomator.js    # 핵심 자동화 오케스트레이터
├── DOMController.js    # DOM 요소 탐지 및 이벤트 발송
├── StateObserver.js    # MutationObserver로 생성 완료 감지
└── selectors.js        # CSS 셀렉터 상수 모음 (중앙 관리)
```

**FlowAutomator 실행 흐름**:

```
Background로부터 RUN_PROMPT 메시지 수신
         │
         ▼
DOMController.findInputElement()
  ├─ 성공 → 다음 단계
  └─ 실패 → ERROR 메시지 반환
         │
         ▼
DOMController.typePrompt(text)
  (InputEvent + nativeInputValueSetter로 React 상태 동기화)
         │
         ▼
DOMController.clickGenerateButton()
         │
         ▼
StateObserver.waitForCompletion()
  ├─ 완료 감지 → PROMPT_DONE 메시지 반환
  ├─ 타임아웃  → TIMEOUT 메시지 반환
  └─ 오류 감지 → ERROR 메시지 반환
```

**DOMController 셀렉터 전략** (다중 폴백):

```javascript
// selectors.js
export const SELECTORS = {
  promptInput: [
    '[data-testid="prompt-input"]',
    'textarea[placeholder*="prompt"]',
    '.prompt-input textarea',
    'div[contenteditable="true"]',
  ],
  generateButton: [
    '[data-testid="generate-button"]',
    'button[aria-label*="Generate"]',
    'button[aria-label*="Run"]',
    '.generate-btn',
  ],
  loadingIndicator: [
    '[data-testid="loading-spinner"]',
    '.loading-indicator',
    '[aria-busy="true"]',
  ],
  resultImage: [
    '[data-testid="generated-image"]',
    '.result-image img',
    '.output-panel img',
  ],
};
```

**StateObserver 완료 감지 로직**:

```
MutationObserver 감시 대상:
  1. 로딩 스피너 DOM 제거 감지
  2. 결과 이미지 DOM 추가 감지
  3. 오류 메시지 DOM 추가 감지

폴백 타임아웃: 설정값(기본 120초) 초과 시 TIMEOUT 반환
```

---

### 3.4 StorageService (`chrome.storage.local`)

모든 영속 데이터의 단일 저장소. Background Worker만 직접 접근.

**스토리지 스키마**:

```typescript
interface StorageSchema {
  // 프롬프트 목록
  promptList: {
    id: string;          // UUID
    text: string;        // 프롬프트 원문
    sceneLabel: string;  // 파싱된 씬 번호 (예: "씬20")
    status: "pending" | "running" | "done" | "error";
    retryCount: number;
    createdAt: number;
  }[];

  // 현재 실행 세션
  session: {
    isRunning: boolean;
    isPaused: boolean;
    currentIndex: number;   // 현재 처리 중인 프롬프트 인덱스
    totalCount: number;
    doneCount: number;
    startedAt: number | null;
  };

  // 사용자 설정
  settings: {
    delayBetweenPrompts: number; // ms, 기본값 1000
    generationTimeout: number;   // 초, 기본값 120
    maxRetries: number;          // 기본값 3
    language: "ko" | "en";
  };

  // 실행 기록 (최대 10개)
  history: {
    id: string;
    prompts: string[];
    runAt: number;
    completedCount: number;
  }[];
}
```

---

## 4. 데이터 흐름

### 4.1 자동 실행 전체 흐름

```
[Popup]                [Background]              [Content Script]
   │                        │                           │
   │ ── RUN_SESSION ──────► │                           │
   │                        │ chrome.storage에 세션 저장│
   │                        │ ── RUN_PROMPT(index=0) ─► │
   │                        │                           │ DOM 입력
   │                        │                           │ 버튼 클릭
   │                        │                           │ 완료 감지
   │                        │ ◄── PROMPT_DONE ───────── │
   │ ◄── STATE_UPDATE ───── │                           │
   │ (UI 상태 업데이트)       │ chrome.storage 업데이트  │
   │                        │ ── RUN_PROMPT(index=1) ─► │
   │                        │          ... 반복 ...     │
   │                        │                           │
   │                        │ 전체 완료                 │
   │ ◄── SESSION_COMPLETE ─ │                           │
   │                        │ 브라우저 알림 발송         │
```

### 4.2 일시정지 / 재개 흐름

```
[Popup]                [Background]              [Content Script]
   │                        │                           │
   │ ── PAUSE ────────────► │                           │
   │                        │ session.isPaused = true   │
   │                        │ (현재 프롬프트 완료 대기)  │
   │                        │                           │ (완료까지 진행)
   │                        │ ◄── PROMPT_DONE ───────── │
   │                        │ 다음 프롬프트 진행 안 함   │
   │ ◄── STATE_UPDATE ───── │                           │
   │                        │                           │
   │ ── RESUME ───────────► │                           │
   │                        │ session.isPaused = false  │
   │                        │ ── RUN_PROMPT(next) ────► │
```

### 4.3 오류 재시도 흐름

```
[Background]              [Content Script]
     │                           │
     │ ── RUN_PROMPT ──────────► │
     │                           │ 오류 발생 or 타임아웃
     │ ◄── ERROR / TIMEOUT ───── │
     │                           │
     │ retryCount < maxRetries?  │
     │ ├─ Yes: 딜레이 후 재시도  │
     │ │    ── RUN_PROMPT ──────►│
     │ └─ No: status = "error"   │
     │        다음 프롬프트로 진행│
```

---

## 5. 상태 관리

### 5.1 세션 상태 머신 (State Machine)

```
                    ┌─────────┐
                    │  IDLE   │ ◄──────────────────┐
                    └────┬────┘                    │
                         │ RUN_SESSION             │
                         ▼                         │
                    ┌─────────┐                    │
              ┌────►│ RUNNING │ ─── STOP ──────────┤
              │     └────┬────┘                    │
              │          │ PAUSE                   │
              │          ▼                         │
   RESUME     │     ┌─────────┐                   │
   ───────────┘     │ PAUSED  │                   │
                    └────┬────┘                   │
                         │ RESUME                 │
                         └───────────────────────►│
                                                  │
                    ┌──────────┐                  │
                    │COMPLETED │ ─────────────────┘
                    └──────────┘
```

### 5.2 프롬프트 항목 상태 전환

```
pending ──► running ──► done
               │
               └──► error (재시도 초과)
               └──► pending (재시도 중)
```

### 5.3 상태 동기화 전략

- **진실의 원천(Single Source of Truth)**: `chrome.storage.local`의 `session` 객체
- Popup 오픈 시: Background로 `GET_STATE` 메시지 → 현재 상태 전체 수신
- 실행 중: Background가 변경 시마다 Popup에 `STATE_UPDATE` push
- Popup 닫힘: 상태는 storage에 유지 → 재오픈 시 복원

---

## 6. 통신 프로토콜

### 6.1 메시지 타입 정의

모든 메시지는 `{ type, payload }` 구조를 따른다.

#### Popup → Background

| type | payload | 설명 |
|------|---------|------|
| `GET_STATE` | - | 현재 세션 상태 요청 |
| `RUN_SESSION` | `{ prompts[], startIndex }` | 자동 실행 시작 |
| `PAUSE` | - | 일시정지 |
| `RESUME` | - | 재개 |
| `STOP` | - | 전체 중단 |
| `SAVE_SETTINGS` | `{ settings }` | 설정 저장 |
| `SAVE_PROMPTS` | `{ prompts[] }` | 프롬프트 목록 저장 |
| `GET_HISTORY` | - | 실행 기록 요청 |

#### Background → Popup

| type | payload | 설명 |
|------|---------|------|
| `STATE_UPDATE` | `{ session, promptList[] }` | 상태 변경 push |
| `SESSION_COMPLETE` | `{ doneCount, errorCount }` | 전체 완료 |
| `ERROR_REPORT` | `{ index, message }` | 특정 항목 오류 |

#### Background → Content Script

| type | payload | 설명 |
|------|---------|------|
| `RUN_PROMPT` | `{ text, index, config }` | 단일 프롬프트 실행 |
| `CREATE_PROJECT` | - | 새 프로젝트 생성 |
| `PING` | - | Content Script 활성 여부 확인 |

#### Content Script → Background

| type | payload | 설명 |
|------|---------|------|
| `PROMPT_DONE` | `{ index }` | 프롬프트 생성 완료 |
| `TIMEOUT` | `{ index }` | 타임아웃 발생 |
| `ERROR` | `{ index, message }` | DOM 오류 발생 |
| `PONG` | - | PING 응답 |

### 6.2 탭 ID 관리

Background Worker가 Google Flow 탭 ID를 동적으로 탐지:

```javascript
// Background: flow.google.com 탭 탐지
async function findFlowTab() {
  const tabs = await chrome.tabs.query({
    url: "https://flow.google.com/*",
    active: false,
  });
  if (tabs.length === 0) throw new Error("NO_FLOW_TAB");
  return tabs[0].id; // 가장 최근 Flow 탭 사용
}
```

---

## 7. DOM 자동화 전략

### 7.1 텍스트 입력 시 React 상태 동기화

Google Flow는 React 기반으로 추정. 단순 `element.value = text` 로는 React 상태가 업데이트되지 않으므로 네이티브 setter를 통해 강제 동기화:

```javascript
function typeIntoReactInput(element, text) {
  // 1. 포커스
  element.focus();

  // 2. 네이티브 value setter로 강제 설정
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype, "value"
  ).set;
  nativeInputValueSetter.call(element, text);

  // 3. React 상태 업데이트 트리거
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}
```

### 7.2 MutationObserver 완료 감지 전략

```javascript
function waitForCompletion(timeout = 120000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      observer.disconnect();
      reject(new Error("TIMEOUT"));
    }, timeout);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        // 전략 1: 로딩 스피너 제거 감지
        if (isSpinnerRemoved(mutation)) {
          clearTimeout(timer);
          observer.disconnect();
          return resolve("DONE_BY_SPINNER");
        }

        // 전략 2: 결과 이미지 추가 감지
        if (isResultImageAdded(mutation)) {
          clearTimeout(timer);
          observer.disconnect();
          return resolve("DONE_BY_IMAGE");
        }

        // 전략 3: 오류 메시지 감지
        if (isErrorMessageAdded(mutation)) {
          clearTimeout(timer);
          observer.disconnect();
          return reject(new Error("GENERATION_ERROR"));
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-busy", "class"],
    });
  });
}
```

### 7.3 봇 감지 회피 전략

| 기법 | 구현 방법 |
|------|---------|
| **자연스러운 타이핑 딜레이** | 문자 단위 입력 대신 전체 텍스트를 한 번에 붙여넣기 이벤트로 처리 |
| **프롬프트 간 랜덤 딜레이** | `baseDelay ± (Math.random() * 500)` ms |
| **포커스/블러 이벤트** | 실제 사용자처럼 클릭 → 포커스 → 입력 → 버튼 클릭 순서 유지 |
| **마우스 이벤트 선행** | 버튼 클릭 전 `mouseover`, `mousedown`, `mouseup` 이벤트 순차 발송 |

---

## 8. 오류 처리 및 복구

### 8.1 오류 분류

| 오류 유형 | 원인 | 처리 방식 |
|---------|------|---------|
| `NO_FLOW_TAB` | Flow 탭 없음 | 팝업에 안내 메시지 표시 |
| `ELEMENT_NOT_FOUND` | DOM 셀렉터 실패 | 다중 폴백 셀렉터 순차 시도 |
| `TIMEOUT` | 생성 완료 미감지 | 재시도 or 수동 스킵 |
| `GENERATION_ERROR` | Flow 측 오류 | 재시도 or 오류 표시 후 다음 진행 |
| `CONTENT_SCRIPT_NOT_READY` | 스크립트 미주입 | PING/PONG으로 확인 후 재시도 |
| `WORKER_INACTIVE` | Service Worker 종료 | `chrome.alarms`로 유지 또는 재시작 |

### 8.2 재시도 로직 (지수 백오프)

```javascript
async function runWithRetry(fn, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxRetries) throw err;
      const delay = Math.min(1000 * 2 ** attempt, 10000); // 1s, 2s, 4s, max 10s
      await sleep(delay);
    }
  }
}
```

### 8.3 Service Worker 생존 전략

```javascript
// Background Worker: alarms로 생존 유지
chrome.alarms.create("keepAlive", { periodInMinutes: 0.4 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "keepAlive") {
    // 스토리지 ping으로 Worker 활성 유지
    chrome.storage.local.get("session");
  }
});
```

---

## 9. 디렉터리 구조

```
auto-flow/
├── manifest.json               # Manifest V3 설정
├── docs/
│   ├── PRD.md
│   └── ARCHITECTURE.md         # 이 문서
│
├── popup/                      # Popup UI 컨텍스트
│   ├── index.html
│   ├── index.js                # 팝업 진입점
│   ├── components/
│   │   ├── PromptList.js
│   │   ├── ProgressBar.js
│   │   ├── ControlPanel.js
│   │   └── SettingsModal.js
│   ├── services/
│   │   ├── PopupBridge.js      # Background 통신
│   │   └── FileImporter.js     # 파일 파싱
│   └── styles/
│       └── popup.css
│
├── background/                 # Background Service Worker
│   └── worker.js
│       ├── MessageRouter
│       ├── ExecutionOrchestrator
│       ├── StorageService
│       └── NotificationService
│
├── content/                    # Content Script
│   ├── content.js              # 진입점
│   ├── FlowAutomator.js        # 실행 오케스트레이터
│   ├── DOMController.js        # DOM 조작
│   ├── StateObserver.js        # MutationObserver
│   └── selectors.js            # 셀렉터 상수
│
├── shared/                     # 공용 모듈
│   ├── constants.js            # 메시지 타입, 기본값
│   ├── utils.js                # sleep, UUID 등
│   └── i18n/
│       ├── ko.json             # 한국어
│       └── en.json             # 영어
│
└── assets/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## 10. 기술 스택

| 영역 | 선택 | 이유 |
|------|------|------|
| **언어** | Vanilla JavaScript (ES2022+) | 번들러 없이 크롬 확장 바로 로드 가능, 외부 의존성 Zero |
| **모듈 시스템** | ES Modules (`type="module"`) | Popup에서만 사용, Content Script는 단일 번들 |
| **스타일** | CSS Variables + Vanilla CSS | 경량, 번들 불필요 |
| **스토리지** | `chrome.storage.local` | 로컬 영속화, 최대 10MB |
| **통신** | `chrome.runtime.sendMessage` | Manifest V3 표준 |
| **DOM 감지** | `MutationObserver` | 네이티브 API, 추가 의존성 없음 |
| **빌드 도구** | 없음 (Plain files) | 확장 배포 단순화 |
| **테스트** | Vitest (선택적) | Unit 테스트용 |

---

## 11. 보안 설계

### 11.1 Content Security Policy

```json
// manifest.json
"content_security_policy": {
  "extension_pages": "script-src 'self'; object-src 'self'"
}
```

### 11.2 데이터 보안 원칙

- 모든 데이터는 `chrome.storage.local`에만 저장 (외부 서버 전송 없음)
- Content Script ↔ Background 통신은 Chrome 내부 IPC (암호화됨)
- 사용자 프롬프트에 포함된 개인정보는 로그에 기록하지 않음
- `host_permissions`는 `https://flow.google.com/*`만 최소 권한 부여

### 11.3 XSS 방지

Content Script에서 DOM에 HTML을 직접 삽입하지 않음. 텍스트 입력은 `value` setter 또는 `textContent`만 사용.

---

## 12. 성능 설계

### 12.1 메모리 효율

- Popup이 닫혀도 Background Worker가 상태를 유지하므로 Popup은 경량 렌더러 역할만 수행
- 프롬프트 목록이 1000개를 초과할 경우 가상 스크롤(Virtual Scroll) 적용 고려

### 12.2 타이밍 설계

```
프롬프트 입력 완료
    └─ 100ms 딜레이 (React 상태 안정화 대기)
           └─ Generate 버튼 클릭
                  └─ MutationObserver 감시 시작
                         └─ 완료 감지
                                └─ settings.delayBetweenPrompts ms 대기
                                       └─ 다음 프롬프트 실행
```

### 12.3 성능 목표

| 지표 | 목표값 |
|------|-------|
| Popup 초기 렌더링 | < 200ms |
| Background → Content Script 메시지 왕복 | < 50ms |
| 완료 감지 응답 지연 | < 500ms (실제 생성 완료 후) |
| Storage 읽기/쓰기 | < 10ms |

---

*이 문서는 PRD.md를 기반으로 작성된 Auto Flow 시스템 아키텍처 설계 문서입니다.*
*구현 시작 전 각 컴포넌트의 인터페이스와 메시지 스키마를 최종 확정할 것을 권장합니다.*
