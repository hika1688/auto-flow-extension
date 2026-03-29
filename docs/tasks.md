# 구현 작업 목록: Auto Flow Chrome Extension

**문서 버전**: 1.0
**작성일**: 2026-03-29
**참조**: [PRD.md](./PRD.md) | [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## 진행 상태 범례

| 기호 | 상태 |
|------|------|
| `[ ]` | 미착수 |
| `[~]` | 진행 중 |
| `[x]` | 완료 |

---

## Phase 1 — 프로젝트 기반 및 핵심 자동화 구현

> 목표: 단일 프롬프트를 Google Flow에 자동 입력하고 완료를 감지하는 최소 동작 구현

---

### TASK-01. 프로젝트 초기 설정

- [ ] **TASK-01-1** 프로젝트 루트 디렉터리 구조 생성
  - `popup/`, `background/`, `content/`, `shared/`, `assets/`, `docs/` 폴더 생성
- [ ] **TASK-01-2** `manifest.json` 작성
  - `manifest_version: 3` 설정
  - `permissions`: `storage`, `tabs`, `notifications`, `activeTab`
  - `host_permissions`: `https://flow.google.com/*`
  - `action.default_popup`: `popup/index.html`
  - `content_scripts`: `content/content.js` → `https://flow.google.com/*` 매칭
  - `background.service_worker`: `background/worker.js`
  - `content_security_policy` 설정 (`script-src 'self'`)
- [ ] **TASK-01-3** `shared/constants.js` 작성
  - 메시지 타입 상수 정의 (`MSG_TYPE`)
    - Popup→BG: `GET_STATE`, `RUN_SESSION`, `PAUSE`, `RESUME`, `STOP`, `SAVE_SETTINGS`, `SAVE_PROMPTS`, `GET_HISTORY`
    - BG→Popup: `STATE_UPDATE`, `SESSION_COMPLETE`, `ERROR_REPORT`
    - BG→Content: `RUN_PROMPT`, `CREATE_PROJECT`, `PING`
    - Content→BG: `PROMPT_DONE`, `TIMEOUT`, `ERROR`, `PONG`
  - 기본 설정값 상수: `DEFAULT_DELAY`, `DEFAULT_TIMEOUT`, `DEFAULT_MAX_RETRIES`
  - 세션 상태 상수: `SESSION_STATE` (`IDLE`, `RUNNING`, `PAUSED`, `COMPLETED`)
  - 프롬프트 상태 상수: `PROMPT_STATUS` (`pending`, `running`, `done`, `error`)
- [ ] **TASK-01-4** `shared/utils.js` 작성
  - `sleep(ms)` 유틸 함수
  - `generateId()` UUID 생성 함수
  - `randomDelay(base, variance)` 랜덤 딜레이 함수
- [ ] **TASK-01-5** `assets/` 아이콘 파일 준비 (`icon16.png`, `icon48.png`, `icon128.png`)

---

### TASK-02. Content Script — DOM 셀렉터 및 컨트롤러

- [ ] **TASK-02-1** `content/selectors.js` 작성
  - `SELECTORS.promptInput` 배열 (4개 폴백 셀렉터)
  - `SELECTORS.generateButton` 배열 (4개 폴백 셀렉터)
  - `SELECTORS.loadingIndicator` 배열
  - `SELECTORS.resultImage` 배열
  - `SELECTORS.errorMessage` 배열
- [ ] **TASK-02-2** `content/DOMController.js` 작성
  - `findElement(selectorList)`: 폴백 셀렉터 순차 탐색, 없으면 `null` 반환
  - `findInputElement()`: 프롬프트 입력창 탐색
  - `findGenerateButton()`: Generate/Run 버튼 탐색
  - `typeIntoReactInput(element, text)`: `nativeInputValueSetter` + `input`/`change` 이벤트 디스패치로 React 상태 동기화
  - `clickButton(element)`: `mouseover` → `mousedown` → `mouseup` → `click` 이벤트 순차 발송
- [ ] **TASK-02-3** `content/StateObserver.js` 작성
  - `waitForCompletion(timeout)`: MutationObserver 기반 완료 감지
    - 전략 1: 로딩 스피너 DOM 제거 감지 (`aria-busy`, `.loading` 클래스 변화)
    - 전략 2: 결과 이미지 DOM 추가 감지
    - 전략 3: 오류 메시지 DOM 추가 감지
  - 타임아웃 시 `reject(new Error("TIMEOUT"))` 처리
  - Observer 메모리 누수 방지: `disconnect()` 보장

---

### TASK-03. Content Script — 자동화 오케스트레이터

- [ ] **TASK-03-1** `content/FlowAutomator.js` 작성
  - `runPrompt(text, config)` 메서드
    1. `DOMController.findInputElement()` 호출
    2. 입력창 없으면 `ELEMENT_NOT_FOUND` 오류 반환
    3. `DOMController.typeIntoReactInput()` 호출
    4. `100ms` 딜레이 (React 상태 안정화)
    5. `DOMController.findGenerateButton()` 호출 및 클릭
    6. `StateObserver.waitForCompletion(config.timeout)` 호출
    7. 결과 반환 (`done` / `error` / `timeout`)
  - `createNewProject()` 메서드: 새 프로젝트 생성 버튼 자동 클릭
- [ ] **TASK-03-2** `content/content.js` 작성 (진입점)
  - `chrome.runtime.onMessage` 리스너 등록
  - 메시지 타입별 라우팅:
    - `PING` → `PONG` 즉시 응답
    - `RUN_PROMPT` → `FlowAutomator.runPrompt()` 실행 후 `PROMPT_DONE` / `ERROR` / `TIMEOUT` 응답
    - `CREATE_PROJECT` → `FlowAutomator.createNewProject()` 실행

---

### TASK-04. Background Service Worker

- [ ] **TASK-04-1** `background/worker.js` — StorageService 구현
  - `getState()`: `chrome.storage.local`에서 전체 상태 읽기
  - `savePrompts(prompts[])`: 프롬프트 목록 저장
  - `updatePromptStatus(index, status)`: 단일 항목 상태 업데이트
  - `saveSession(session)`: 세션 상태 저장
  - `saveSettings(settings)`: 설정 저장
  - `saveHistory(entry)`: 기록 추가 (최대 10개, FIFO)
  - `initStorage()`: 초기 기본값 세팅 (최초 설치 시)
- [ ] **TASK-04-2** `background/worker.js` — ExecutionOrchestrator 구현
  - `start(startIndex)`: 세션 시작, `currentIndex` 초기화
  - `runNext()`: 현재 인덱스 프롬프트 실행 → Content Script에 `RUN_PROMPT` 전송
  - `onPromptDone(index)`: 상태 업데이트 → Popup에 `STATE_UPDATE` 전송 → `runNext()` 호출
  - `onError(index, message)`: 재시도 로직 실행 (`runWithRetry`)
  - `pause()` / `resume()` / `stop()`: 세션 상태 전환
  - `runWithRetry(fn, maxRetries)`: 지수 백오프 재시도 (1s, 2s, 4s)
- [ ] **TASK-04-3** `background/worker.js` — MessageRouter 구현
  - `chrome.runtime.onMessage` 리스너 등록
  - Popup으로부터 수신 메시지 라우팅
  - Content Script 완료 메시지 수신 및 처리
- [ ] **TASK-04-4** `background/worker.js` — Flow 탭 탐지
  - `findFlowTab()`: `chrome.tabs.query({ url: "https://flow.google.com/*" })`
  - 탭 없으면 `NO_FLOW_TAB` 오류 처리
- [ ] **TASK-04-5** `background/worker.js` — Service Worker 생존 전략
  - `chrome.alarms.create("keepAlive", { periodInMinutes: 0.4 })`
  - `chrome.alarms.onAlarm` 리스너 등록 (storage ping)
- [ ] **TASK-04-6** `background/worker.js` — Popup 상태 Push
  - `notifyPopup(type, payload)`: `chrome.runtime.sendMessage()`로 Popup에 상태 전송
  - Popup이 닫혀 있을 때 전송 실패 무시 처리

---

### TASK-05. Popup UI — 기본 뼈대

- [ ] **TASK-05-1** `popup/index.html` 작성
  - 섹션 구조: 헤더 / 프롬프트 목록 / 진행률 바 / 컨트롤 패널 / 안내 메시지 / 언어 선택
  - 설정 모달 HTML 포함
- [ ] **TASK-05-2** `popup/styles/popup.css` 작성
  - CSS Variables로 컬러 팔레트 정의
  - 상태별 아이콘 색상 정의 (pending/running/done/error)
  - 프로그레스 바 스타일
  - 모달 오버레이 스타일
  - 반응형 레이아웃 (팝업 고정 너비 360px)
- [ ] **TASK-05-3** `popup/services/PopupBridge.js` 작성
  - `sendMessage(type, payload)`: `chrome.runtime.sendMessage()` 래퍼
  - `onMessage(callback)`: `chrome.runtime.onMessage` 등록 래퍼
  - `getState()`: Background로부터 현재 상태 pull

---

### TASK-06. Popup UI — 컴포넌트 구현

- [ ] **TASK-06-1** `popup/components/PromptList.js` 작성
  - 프롬프트 목록 렌더링 (번호 + 상태 아이콘 + 텍스트 미리보기)
  - 현재 실행 중인 항목 하이라이트 표시
  - 개별 항목 삭제 버튼
- [ ] **TASK-06-2** `popup/components/ProgressBar.js` 작성
  - `n / total` 텍스트 표시
  - CSS width 기반 진행률 바 렌더링
  - 완료 퍼센트 계산 및 표시
- [ ] **TASK-06-3** `popup/components/ControlPanel.js` 작성
  - Run / Stop / Pause / Resume 버튼 렌더링
  - 세션 상태에 따른 버튼 활성화/비활성화 제어
    - `IDLE`: Run·CreateProject 활성 / Stop·Pause 비활성
    - `RUNNING`: Stop·Pause 활성 / Run 비활성
    - `PAUSED`: Resume·Stop 활성 / Run·Pause 비활성
    - `COMPLETED`: Run 활성 (재실행)
  - 각 버튼 클릭 시 `PopupBridge.sendMessage()` 호출
- [ ] **TASK-06-4** `popup/services/FileImporter.js` 작성
  - `.txt` 파일 줄바꿈 파싱
  - `.csv` 파일 첫 번째 열 파싱
  - 파싱 결과를 프롬프트 배열로 반환
- [ ] **TASK-06-5** `popup/index.js` 작성 (팝업 진입점)
  - 팝업 오픈 시 `PopupBridge.getState()` 호출 → UI 초기화
  - `chrome.runtime.onMessage` 수신 → `STATE_UPDATE` 처리 → UI 재렌더링
  - 파일 가져오기 input 이벤트 핸들러
  - 컴포넌트 조립 및 이벤트 바인딩

---

## Phase 2 — 안정성 강화

> 목표: 오류 상황에서도 자동 실행이 중단되지 않도록 견고성 확보

---

### TASK-07. 오류 처리 강화

- [ ] **TASK-07-1** Content Script — ELEMENT_NOT_FOUND 폴백 처리
  - 모든 셀렉터 실패 시 1초 대기 후 재탐색 (최대 3회)
  - 3회 모두 실패 시 `ERROR` 메시지 반환
- [ ] **TASK-07-2** Background — 오류 항목 처리 후 계속 진행 옵션
  - `settings.skipOnError` 옵션 추가: 오류 발생 시 해당 항목 건너뛰고 다음 진행
  - 오류 항목은 상태를 `error`로 유지하고 목록에 표시
- [ ] **TASK-07-3** Background — `NO_FLOW_TAB` 처리
  - Flow 탭 없을 때 Popup에 `ERROR_REPORT` 전송 및 안내 메시지 표시
  - 실행 시작 전 탭 유효성 사전 확인
- [ ] **TASK-07-4** Background — Content Script 미준비 상태 처리
  - `RUN_PROMPT` 전송 전 `PING`/`PONG`으로 Content Script 활성 여부 확인
  - 미응답 시 `chrome.scripting.executeScript()`로 재주입 시도 (MV3 `scripting` 권한 추가)
- [ ] **TASK-07-5** Content Script — MutationObserver 메모리 누수 방지
  - `waitForCompletion` 종료 시 항상 `observer.disconnect()` 보장
  - 페이지 언로드(`visibilitychange`) 시 Observer 정리

---

### TASK-08. 재시도 및 타임아웃

- [ ] **TASK-08-1** `shared/utils.js` — `runWithRetry` 함수 구현
  - 지수 백오프: `1000 * 2^attempt` ms (최대 10000ms)
  - 최대 재시도 횟수: `settings.maxRetries` (기본 3)
- [ ] **TASK-08-2** Background — 재시도 횟수를 Storage에 기록
  - `promptList[i].retryCount` 업데이트
  - Popup에 재시도 횟수 표시 (`재시도 2/3` 등)
- [ ] **TASK-08-3** Popup — 수동 스킵 버튼 추가
  - 특정 프롬프트가 오류 상태일 때 수동으로 다음 항목으로 넘기는 버튼
  - `SKIP` 메시지 타입 추가

---

### TASK-09. Service Worker 안정성

- [ ] **TASK-09-1** `chrome.alarms` keepAlive 구현 검증
  - 30분 이상 실행 시 Worker 유지 여부 테스트
- [ ] **TASK-09-2** Worker 재시작 시 세션 복구
  - Worker 재시작 후 `chrome.storage.local`에서 세션 상태 복원
  - `isRunning === true`이면 중단된 인덱스부터 자동 재개
- [ ] **TASK-09-3** `chrome.storage.session` 활용 검토
  - 세션 임시 데이터(`currentTabId`, `observerActive`)는 `storage.session` 사용

---

## Phase 3 — UX 개선 및 부가 기능

> 목표: 사용 편의성 향상 및 PRD F-06~F-10 부가 기능 구현

---

### TASK-10. 씬 번호 파싱 (F-07)

- [ ] **TASK-10-1** `shared/utils.js` — `parseSceneLabel(text)` 함수 구현
  - 지원 패턴: `씬1`, `씬 20`, `Scene1`, `Scene 20`, `장면1` 등
  - 정규식: `/(?:씬|Scene|장면)\s*(\d+)/i`
  - 파싱 성공 시 `"씬20"` 형태 문자열 반환, 실패 시 `null`
- [ ] **TASK-10-2** 프롬프트 저장 시 `sceneLabel` 자동 파싱 적용
- [ ] **TASK-10-3** Popup PromptList — `sceneLabel` 있을 때 번호 뱃지 표시

---

### TASK-11. 실행 기록 (History) (F-06)

- [ ] **TASK-11-1** Background — StorageService `saveHistory()` 구현
  - 세션 완료 시 자동 저장 (최대 10개, FIFO)
  - 저장 항목: `{ id, prompts[], runAt, completedCount, errorCount }`
- [ ] **TASK-11-2** Popup — History 탭/패널 UI 추가
  - 기록 목록 표시 (날짜, 완료 수, 프롬프트 수)
  - 기록 항목 클릭 시 해당 프롬프트 목록 복원
- [ ] **TASK-11-3** Popup — 기록 삭제 기능

---

### TASK-12. 설정 화면 (F-08)

- [ ] **TASK-12-1** `popup/components/SettingsModal.js` 구현
  - 프롬프트 간 추가 대기 시간 입력 (ms, 슬라이더 or 숫자 입력)
  - 생성 완료 감지 타임아웃 입력 (초)
  - 오류 발생 시 최대 재시도 횟수 입력
  - 오류 항목 건너뛰기 토글 (`skipOnError`)
- [ ] **TASK-12-2** 설정 저장 및 Background로 전달 (`SAVE_SETTINGS` 메시지)
- [ ] **TASK-12-3** 설정값 변경 즉시 다음 실행 사이클에 반영 확인

---

### TASK-13. 완료 알림 (F-09)

- [ ] **TASK-13-1** `background/worker.js` — NotificationService 구현
  - `chrome.notifications.create()` 호출
  - 완료 알림: `"모든 이미지 생성이 완료되었습니다. (20/20)"`
  - 오류 알림: `"3개 항목에서 오류가 발생했습니다."`
- [ ] **TASK-13-2** `manifest.json`에 `"notifications"` 권한 확인

---

### TASK-14. 다국어 지원 (F-10)

- [ ] **TASK-14-1** `shared/i18n/ko.json` 작성 (한국어 기본)
  - 모든 UI 문자열 키-값 정의
- [ ] **TASK-14-2** `shared/i18n/en.json` 작성 (영어)
- [ ] **TASK-14-3** `shared/utils.js` — `t(key)` 번역 함수 구현
  - `chrome.storage.local`의 `settings.language` 값 기반
- [ ] **TASK-14-4** Popup UI 전체 문자열을 `t()` 함수로 교체
- [ ] **TASK-14-5** Popup 하단 언어 토글 버튼 기능 연결 및 즉시 UI 갱신

---

### TASK-15. 프롬프트 목록 편집 개선

- [ ] **TASK-15-1** 프롬프트 항목 순서 변경 (drag-and-drop) 구현
  - HTML5 Drag & Drop API 활용
- [ ] **TASK-15-2** 실행 완료된 항목과 미완료 항목 구분 표시 스타일
- [ ] **TASK-15-3** 전체 선택 / 전체 삭제 버튼 추가
- [ ] **TASK-15-4** 프롬프트 텍스트 전체 보기 tooltip 또는 확장 UI

---

## Phase 4 — 배포 준비

> 목표: Chrome Web Store 등록 및 사용자 배포

---

### TASK-16. 코드 품질 및 테스트

- [ ] **TASK-16-1** `shared/utils.js` 단위 테스트 작성 (Vitest)
  - `parseSceneLabel()`, `runWithRetry()`, `randomDelay()` 테스트
- [ ] **TASK-16-2** `content/DOMController.js` 단위 테스트
  - 가상 DOM 환경에서 셀렉터 폴백 로직 테스트
- [ ] **TASK-16-3** `content/StateObserver.js` 단위 테스트
  - MutationObserver mock으로 완료/타임아웃/오류 시나리오 테스트
- [ ] **TASK-16-4** Background ExecutionOrchestrator 통합 테스트
  - 재시도, 일시정지, 오류 건너뛰기 시나리오 검증
- [ ] **TASK-16-5** 수동 E2E 테스트 체크리스트 작성 및 실행
  - 정상 순차 실행 (10개 프롬프트)
  - Pause → Resume 시나리오
  - Stop → 재시작 시나리오
  - Flow 탭 없는 상태에서 실행 시도
  - 타임아웃 발생 후 재시도 시나리오

---

### TASK-17. 패키징 및 배포

- [ ] **TASK-17-1** `manifest.json` 최종 버전 검토
  - 최소 권한 원칙 확인
  - 아이콘, 이름, 설명 최종 확정
- [ ] **TASK-17-2** Chrome Extension `.zip` 패키지 빌드
  - `docs/`, 테스트 파일, `.git` 제외하고 패키징
- [ ] **TASK-17-3** Chrome 개발자 모드로 로컬 설치 및 최종 검증
- [ ] **TASK-17-4** Chrome Web Store 개발자 대시보드 등록
  - 스크린샷 (1280×800 or 640×400) 준비
  - 설명문 작성 (한국어 + 영어)
  - 개인정보처리방침 URL (필수 요구사항)
- [ ] **TASK-17-5** Chrome Web Store 심사 제출

---

## 작업 의존성 그래프

```
TASK-01 (초기 설정)
  └─► TASK-02 (Content Script — DOM)
        └─► TASK-03 (Content Script — 자동화)
              └─► TASK-04 (Background Worker)
                    └─► TASK-05 (Popup 뼈대)
                          └─► TASK-06 (Popup 컴포넌트)
                                └─► TASK-07 (오류 처리)
                                      ├─► TASK-08 (재시도)
                                      └─► TASK-09 (SW 안정성)
                                            ├─► TASK-10 (씬 파싱)
                                            ├─► TASK-11 (기록)
                                            ├─► TASK-12 (설정)
                                            ├─► TASK-13 (알림)
                                            ├─► TASK-14 (다국어)
                                            └─► TASK-15 (편집 개선)
                                                  └─► TASK-16 (테스트)
                                                        └─► TASK-17 (배포)
```

---

## 작업 요약

| Phase | Task 범위 | 핵심 산출물 |
|-------|----------|------------|
| Phase 1 | TASK-01 ~ 06 | `manifest.json`, Content Script, Background Worker, Popup 기본 UI |
| Phase 2 | TASK-07 ~ 09 | 오류 처리, 재시도, Service Worker 안정성 |
| Phase 3 | TASK-10 ~ 15 | 씬 파싱, 기록, 설정, 알림, 다국어, 편집 UX |
| Phase 4 | TASK-16 ~ 17 | 테스트, 패키징, Chrome Web Store 등록 |
| **합계** | **17개 Task / 72개 세부 작업** | |

---

*이 문서는 구현 진행에 따라 지속적으로 업데이트됩니다.*
