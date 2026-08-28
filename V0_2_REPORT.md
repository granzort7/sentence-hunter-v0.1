# Sentence Hunter v0.2.0 작업 보고서

작성일: 2026-08-28 (Asia/Seoul)

## 작업 범위

- 기준: `main` / `b3a97cca0d38b16f4df34e26bcc4d6ace2c254ce`
- 작업 브랜치: `feat/v0.2-game-feel-lab`
- 목적: v0.1 규칙과 문제 데이터를 보존한 v0.2.0 게임성 개선 릴리스 제작
- 방식: 기존 Vanilla HTML/CSS/JavaScript와 30문제 데이터를 유지하고 시각·입력·반응 피드백만 보강

## 1. 변경한 파일과 이유

| 파일 | 변경 이유 |
|---|---|
| `index.html` | 3→2→1→HUNT 레이어, FIND/FIX 단계 표지, 공격 수치 표지, 결과 제목 포커스 지점과 범위가 제한된 live region 추가 |
| `app.js` | 플레이 시간 밖 카운트다운, 단계별 안내, 공격·피격·적 압박 시각 상태, 입력 방식별 포커스, 종료/재시도 잔여 효과 정리 추가 |
| `styles.css` | 기존 디자인 위에 countdown, 단계 색상, 콤보별 공격, HP 피격, Bug 접근, Fever 진입과 반응형·reduced-motion 표현 추가 |
| `tests/v0_2_regression.mjs` | 문제 원본, 게임 규칙, 점수·damage·Bug HP·난이도·Fever·최고 기록과 배포용 DOM/CSS 계약을 외부 의존성 없이 검사 |
| `V0_2_PLAN.md` | v0.1 독립 점검, 개선 우선순위, 변경/비변경 범위 기록 |
| `TEST_REPORT_V0_2.md` | 자동 검사, 실제 브라우저 흐름, 여섯 viewport, 남은 실기기 검증 기록 |
| `V0_2_REPORT.md` | 최종 구현 내용, 규칙 보존, 위험과 사용자 확인 항목 정리 |
| `CHANGELOG.md` | v0.2.0 릴리스 변경 이력 추가 |
| `README.md` | 현재 릴리스, 구현 범위, 실제 저장소와 배포 주소를 v0.2.0 기준으로 정리 |

`questions.js`, `GAME_SPEC.md`, 배포 설정과 Production 설정은 변경하지 않았습니다.

## 2. 기존 규칙 보존 여부

| 불변 항목 | 결과 |
|---|---|
| 한 판 90초, countdown은 플레이 시간 밖 | 보존 |
| 하트 3개와 하트 0 종료 | 보존 |
| 속도·난이도·콤보·Fever 점수 공식 | 보존 |
| 콤보 배율 1 / 1.25 / 1.5 / 2 | 보존 |
| 5콤보 2 damage, 10콤보 3 damage의 배수 공격 | 보존 |
| Bug HP `min(3 + floor(defeated / 3), 6)` | 보존 |
| 마지막 15초 Fever ×1.2 | 보존 |
| TIME UP과 하트 0 종료, 결과 계산 | 보존 |
| 최고 기록 키와 더 높은 점수만 저장 | 보존 |
| 난이도 추첨, 사용 문제 재설정 조건 | 보존 |
| 520/690/820/1150ms 문제 진행 간격 | 보존 |
| 30문제와 Starter 12 / Everyday 12 / Challenger 6 | 보존 |

콤보 5 이상과 10 이상에서는 공격 동작·빛·투사체의 **시각 강도**만 커집니다. 실제 HP 감소는 기존 5/10 배수 damage만 사용하며, 화면의 `-N HP` 문구도 실제 감소량을 표시합니다.

## 3. questions.js SHA-256 전후 비교

| 시점 | SHA-256 |
|---|---|
| 작업 전 기준 | `44CEC71AD8EDE22D290F616E8D365A211BAF7D6D529E4C0FCAEC98FD37177550` |
| 작업 후 | `44CEC71AD8EDE22D290F616E8D365A211BAF7D6D529E4C0FCAEC98FD37177550` |

파일 바이트, 의미 데이터 해시, 정답 키 해시가 모두 일치합니다.

## 4. 구현한 게임성 개선

1. PLAY 뒤 약 1.6초의 `3 → 2 → 1 → HUNT`를 추가하고 HUNT가 끝난 뒤 90초 timer를 시작합니다.
2. FIND는 cyan, FIX는 yellow 계열의 단계 배지·안내·카드 상태로 구분하며 답의 위치는 강조하지 않습니다.
3. 정답과 동시에 Hunter 공격, projectile, arena impact, Bug 반동, HP flash, 실제 damage 표지를 표시합니다.
4. 콤보 5/10 구간에서 시각 공격 tier를 강화하되 계산식과 damage는 그대로 둡니다.
5. 하트 손실 수에 따라 Bug가 장식적으로 조금씩 접근하고, 오답 때 짧게 돌진합니다.
6. 위치 오답은 `FIND MISS`, 교정 오답은 `FIX MISS`로 구분합니다.
7. 시작·종료·HOME·RETRY에서 timeout, projectile, 임시 class와 Fever 상태를 정리합니다.
8. 키보드 입력에는 다음 조작 지점의 포커스를 제공하고, 터치·포인터에는 임의의 첫 답처럼 보이는 포커스 링 없이 필요한 영역만 보여 줍니다.
9. 390×844를 우선 유지하고 작은 세로 화면은 정상 스크롤, 844×390은 넓어진 전투장에 맞는 projectile 거리로 보정했습니다.
10. 모든 신규 움직임은 `prefers-reduced-motion`에서 정적인 색·텍스트 피드백으로 대체됩니다.

## 5. 적용하지 않은 개선과 이유

- 문제 추가·수정, 난이도나 점수 재조정: 원본 데이터와 규칙 보존 범위 밖입니다.
- 새 모드, 캐릭터, 랭킹, 계정, DB, 광고, 결제, 상점: 이번 릴리스 범위 밖입니다.
- 긴 해설 modal: 90초 흐름을 막고 기존 문제 진행 시간을 바꿀 수 있어 추가하지 않았습니다.
- 외부 이미지·음원·프레임워크·CDN: 정적 배포 단순성과 저작권·의존성 안전을 유지하기 위해 추가하지 않았습니다.
- 결과 화면 전면 재설계: 기존 정보 구조와 RETRY 우선순위가 이미 적절해 필요한 강조와 안정성만 유지했습니다.
- `main` 보호 규칙이나 CI 설정: 저장소 운영 정책 변경은 v0.2.0의 최소 변경 범위 밖이어서 적용하지 않았습니다.

## 6. 자동 테스트 결과

다음 검사가 모두 통과했습니다.

```powershell
node --check app.js
node --check questions.js
node tests/v0_2_regression.mjs
git diff --check
```

- JavaScript 문법 오류 0개
- 문제 30개, ID·필드·선택지·정답·오류 인덱스·12/12/6 분포와 세 가지 해시 통과
- 점수, 콤보, 5/10 특수 damage, Bug HP, 난이도 추첨 경계 통과
- Fever 직전/진입/1회 효과, 하트 0, 최고 기록 strict-greater 저장 통과
- countdown/timer 코드 순서, 필수 DOM, 44px 터치 영역, reduced-motion, 가로 투사체 계약 통과

Node 검사는 소스·규칙 계약용이며 실제 timeout 실행, layout, 포커스와 animation은 브라우저에서 별도 검증했습니다.

## 7. 수동 브라우저 테스트 결과

- 320×568, 360×800, 390×844, 412×915, 844×390, 1366×768에서 가로 넘침 없음
- HOME, PLAY, countdown, FIND/FIX 정답·오답, combo 5/10, Fever, 하트 0, 90초 종료, 결과, RETRY 3회, HOME 복귀 통과
- countdown 중 timer 90 유지, 종료 뒤 점수·화면·projectile 변화 없음, interval 중복 없음
- 콘솔 warning/error 0개, 앱 리소스 404 0개
- 390×844 결과 화면은 HOME까지 무스크롤, 작은 높이는 전체 콘텐츠에 세로 스크롤로 접근 가능
- 포인터 입력에서 첫 토큰·선택지·RETRY가 정답/추천처럼 포커스되지 않음을 최종 캡처로 재확인

상세 표와 캡처 목록은 `TEST_REPORT_V0_2.md`에 있습니다.

## 8. 남은 위험과 보류 사항

- 실제 iPhone Safari와 Samsung Internet의 safe-area, 주소창 높이, Web Audio 및 진동 정책은 로컬 데스크톱 자동화로 대신할 수 없습니다.
- OS 설정을 켠 실제 reduced-motion 체감과 실제 하드웨어 키보드 Enter/Space 체감은 남은 실기기 검증입니다.
- 3→2→1→HUNT 길이와 콤보 시각 tier가 플레이 리듬에 적절한지는 사용자 테스트가 필요합니다.
- GitHub `main`은 현재 branch protection과 자동 필수 검사가 없는 상태입니다. 이 브랜치를 검토할 때는 PR을 사용하고 `main` 직접 push를 피해야 합니다.
- 기능 브랜치 Preview 검증 뒤 PR을 통해 `main`에 병합하고 Production 자동 배포를 확인하는 릴리스 절차를 사용했습니다.

## 9. 사용자에게 직접 확인받아야 할 부분

1. 390×844 실제 휴대폰에서 countdown 길이가 답답하지 않은지
2. FIND와 FIX가 즉시 구분되면서도 정답 힌트처럼 보이지 않는지
3. 일반/5콤보/10콤보의 시각 강도 차이가 과하거나 약하지 않은지
4. 짧은 세로 화면에서 오답 설명과 결과 요약이 스크롤로 자연스럽게 읽히는지
5. 실제 iOS Safari와 Samsung Internet에서 소리·진동·safe-area·주소창 변화가 안정적인지
