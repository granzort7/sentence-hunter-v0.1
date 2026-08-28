# Sentence Hunter v0.2.0 회귀 검증 보고서

검증일: 2026-08-28 (Asia/Seoul)

## 검증 기준

- 작업 브랜치: `feat/v0.2-game-feel-lab`
- 기준 main 커밋: `b3a97cca0d38b16f4df34e26bcc4d6ace2c254ce`
- 로컬 URL: `http://127.0.0.1:8766/`
- 브라우저 기준 화면: 390×844
- 문제 원본 SHA-256: `44CEC71AD8EDE22D290F616E8D365A211BAF7D6D529E4C0FCAEC98FD37177550`

## 자동 검사

실행 명령:

```powershell
node --check app.js
node --check questions.js
node tests/v0_2_regression.mjs
```

결과:

- `app.js`, `questions.js` JavaScript 문법 오류 0개
- 문제 30개, ID `g001`~`g030` 순서 및 중복 없음
- Starter 12 / Everyday 12 / Challenger 6
- 모든 문제의 9개 필드, 비어 있지 않은 값, 오류 인덱스, 고유한 선택지 3개, 정답 1회 포함 통과
- 오류 토큰을 정답으로 치환한 문장과 `correctSentence` 일치
- 원본 파일·전체 의미 데이터·정답 키 해시 일치
- 콤보 배율 경계 1/4/5/9/10/14/15 통과
- 1·5·10·15·20콤보의 점수와 1·2·3·2·3 damage 통과
- Bug 처치 수 0/2/3/6/9/99에서 HP 3/3/4/5/6/6 진행식 통과
- 해결 수와 난수 경계별 Starter/Everyday/Challenger 추첨 규칙 통과
- 74,999ms에는 Fever 미진입, 75,000ms부터 점수 ×1.2, 공격력 불변, 진입 효과 1회 통과
- 하트 0 하한 및 즉시 종료 통과
- 동일·낮은 점수 미저장, 높은 점수 1회 저장 통과
- 가짜 타이머 기준 RETRY 3회마다 interval 1개, 종료 후 0개 및 예약 timeout 0개 통과
- countdown 순서와 timer 시작 위치, 필수 DOM ID, `polite` 알림, 44px 터치·reduced-motion·가로 투사체 CSS 계약 통과

`tests/v0_2_regression.mjs`는 외부 의존성 없는 소스·규칙 계약 검사입니다. 실제 timeout 실행, 포커스, 애니메이션, 반응형은 아래 브라우저 실측으로 별도 확인했습니다.

## 로컬 HTTP 및 콘솔

| 경로 | 상태 | Content-Type |
|---|---:|---|
| `/` | 200 | `text/html` |
| `/styles.css` | 200 | `text/css` |
| `/questions.js` | 200 | `text/javascript` |
| `/app.js` | 200 | `text/javascript` |

- 브라우저 console warning/error: 0개
- 정상 info 로그: `[Question validation] 30 questions passed.`
- 외부 이미지, 음원, CDN 요청 없음
- 앱이 사용하는 네 개의 동일 출처 리소스 모두 200, 404 없음

## 실제 브라우저 기능 흐름

### 시작과 두 단계 조작

- PLAY 직후: countdown `3`, timer `90`, 게임 입력 비활성
- 1.6초 countdown 종료 직후: timer `90`, `STEP 1 · FIND`, 첫 문장 입력 영역 표시
- 오류 위치 정답: `STEP 2 · FIX`, 교정 선택 영역 표시
- 터치·포인터 입력: 임의의 첫 답에 포커스 링을 주지 않고 필요한 영역만 viewport 안으로 이동
- 키보드 입력: 다음 조작의 첫 네이티브 버튼으로 포커스 이동
- 오류 위치 오답: `FIND MISS`, 하트 -1, 콤보 0, Bug 접근 단계 +1
- 교정 선택 오답: `FIX MISS`, 정답·짧은 기존 설명 표시, 하트 -1, 모든 선택지 잠금
- 교정 선택 정답: 모든 선택지 즉시 잠금, 점수·콤보·HP·공격 효과 동시 반영

### 전투·콤보

실제 UI로 10문제를 연속 정답 처리했습니다.

| 시점 | 기존 damage | 새 시각 tier | 확인 결과 |
|---|---:|---|---|
| 5콤보 | 2 | `power-2 critical` | `POWER HIT · -2 HP`, combo hot |
| 10콤보 | 3 | `power-3 critical` | `MEGA HIT · -3 HP`, combo hot+blazing |

- 점수는 모든 정답에서 유한한 0 이상의 정수로 증가
- Bug HP 0% 후 새 Bug 100% 복원
- 처치 수와 250점 보너스는 기존 로직 그대로 반영
- Hunter 공격, projectile, Bug 반동, HP flash, impact label은 460ms 안에 정리

### 종료·재도전·HOME

- 하트 0: 즉시 `GAME OVER`, 결과 화면. 포인터 입력은 상단 요약 유지, 키보드 입력은 결과 제목부터 읽기
- 실제 시간 경과: `90 → 45 → 0`, 정확히 `TIME UP` 전환
- TIME UP 1.5초 후에도 화면·점수·projectile 상태 변화 없음
- RETRY 3회 연속 각각 countdown `3`, timer 90, score 0, hearts 3, combo 0, Q1로 초기화
- HOME 복귀: 시작 화면과 scrollY 0. 키보드 입력일 때만 PLAY 포커스
- 낮은 후속 점수 뒤에도 기존 최고 기록 2,924가 유지되어 UI 복원 확인

## 반응형 실측

각 화면 크기에서 HOME → countdown → FIND → FIX → 교정 오답 → 위치 오답 → 결과를 실제로 순회했습니다.

| 화면 | 가로 넘침 | 최소 핵심 버튼 | 세로 동작 | 앱 폭 |
|---|---:|---:|---|---:|
| 320×568 | 없음 | 44px | HOME/FIX/결과에서 정상 스크롤 | 305~320px |
| 360×800 | 없음 | 약 44px | FIX에서 약 8px 정상 스크롤 | 345~360px |
| 390×844 | 없음 | 44px | HOME/FIND/FIX/결과 모두 무스크롤 | 390px |
| 412×915 | 없음 | 약 44px | 무스크롤 | 412px |
| 844×390 | 없음 | 약 44px | 작은 높이에서 정상 스크롤 | 760px |
| 1366×768 | 없음 | 약 44px | 긴 FIX/결과에서 소량 정상 스크롤 | 520px |

추가 확인:

- 390×844의 FIX 오답 설명은 화면 안에서 읽히며 가로 넘침 없음
- 320×568에서 FIND/FIX 입력 영역이 viewport 안에 표시되고, 포인터 입력은 첫 선택지를 정답처럼 강조하지 않음
- 390×844 결과 화면은 HOME까지 높이 844px 안에 표시
- 844×390에서 투사체 이동 거리가 전투장 폭에 맞춰 늘어나며, 적 피격·impact label과 같은 방향으로 연결됨
- 모든 작은 높이에서 `overflow-y`가 차단되지 않아 전체 콘텐츠 접근 가능

## 접근성·모션

- 모든 조작 대상은 `type="button"`인 네이티브 버튼
- 입력 방식 추적: 키보드 사용 시 FIND→FIX→다음 문항 및 결과 제목→HOME의 포커스 경로를 제공하고, 터치·포인터에서는 강제 포커스 링을 만들지 않음
- 전체 `main` live region 제거, countdown(`polite`)/phase/feedback/result에만 범위 제한
- 하트의 접근 가능한 이름이 실제 개수와 함께 갱신
- 사운드 버튼 `aria-pressed`와 현재 동작 label 갱신
- `prefers-reduced-motion`에서 animation과 transition을 0.01ms로 축소하고 projectile을 숨기며, impact label·HP 색상은 정적 피드백으로 유지하도록 정적 계약 검사 통과

## 캡처

`outputs/v0.2-review/`에 다음 390×844 캡처를 저장했습니다.

- `01-home-390x844.png`
- `02-countdown-390x844.png`
- `03-find-390x844.png`
- `04-fix-390x844.png`
- `05-attack-390x844.png`
- `06-result-390x844.png`
- `07-attack-844x390.png`
- `08-arena-attack-844x390.png`

`outputs/`는 `.gitignore` 대상이며 기능 브랜치 커밋에는 포함하지 않습니다.

## 남은 수동 검증

- 실제 iPhone Safari의 safe-area, 터치, Web Audio 허용 정책
- 실제 Android Chrome 및 Samsung Internet의 진동·터치·주소창 높이 변화
- OS reduced-motion을 켠 실제 브라우저의 체감 확인
- 실제 하드웨어 키보드의 Enter/Space 체감 확인. DOM 포커스와 네이티브 버튼 구조는 확인했지만 인앱 자동화의 합성 키 입력은 버튼 기본 동작을 재현하지 못했습니다.
- 사용자 5~10명의 게임성, 즉시 재도전율, countdown 길이와 공격 강도 선호도
