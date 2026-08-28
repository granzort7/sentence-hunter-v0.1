# Sentence Hunter v0.2.1 Beta Test Kit 검증 보고서

검증일: 2026-08-28
작업 브랜치: `feat/v0.2.1-beta-test-kit`
기준 main: `19842d9c549c175d5ee4e295d9593a052b3411e2`
기준 릴리스: `v0.2.0`

## 1. 결론

로컬 자동 검사와 브라우저 검사는 통과했습니다. 베타 UI는 `beta=1`일 때만 생성되며, 일반 URL에서는 베타 DOM이 0개이고 기존 v0.2.0 제목·푸터·게임·결과 배치를 유지합니다. 게임 규칙과 `questions.js`는 변경하지 않았습니다.

이 보고서는 기능 브랜치의 로컬 검증 결과입니다. 실제 iOS/Android 공유창·클립보드 권한·진동·화면 키보드는 Vercel Preview HTTPS 주소에서 실기기로 확인해야 합니다.

## 2. 고정 기준

| 항목 | 기대값 | 결과 |
|---|---|---|
| 기준 main | `19842d9c549c175d5ee4e295d9593a052b3411e2` | PASS |
| 문제 수 | 30 | PASS |
| 난이도 분포 | Starter 12 / Everyday 12 / Challenger 6 | PASS |
| 문제 ID·순서 | `g001`~`g030` | PASS |
| choices | 문항당 3개 | PASS |
| 정답 포함 | 각 choices에 정확히 1회 | PASS |
| `questions.js` SHA-256 | `44CEC71AD8EDE22D290F616E8D365A211BAF7D6D529E4C0FCAEC98FD37177550` | PASS |

## 3. 자동 검사

실행 명령:

```powershell
node --check app.js
node --check beta.js
node --check questions.js
node tests/v0_2_regression.mjs
node tests/v0_2_1_beta_regression.mjs
git diff --check
```

검사 결과:

- 기존 90초, 하트 3개, 3→2→1→HUNT, FIND→FIX 계약 유지
- 점수, 속도 보너스, 콤보 배율, 5·10콤보 공격력 유지
- Bug HP·처치 보너스·Fever·난이도·최고 기록 계약 유지
- `beta=1` 정확 일치와 일반 모드 no-op 확인
- ANON, tester 허용문자 제거, 12자 제한 확인
- 결과 snapshot과 TIME UP/HEARTS 변환 확인
- 필수 평가, 100·200자 제한, RETRY·HOME 세션 의미 확인
- Web Share 성공·취소, clipboard 성공·실패, 수동 복사 fallback 확인
- 피드백 수정·새 공유 시 오래된 수동 복사 payload와 상태 문구 제거 확인
- tester 제거 기본 베타 링크 확인
- 베타 코드의 `innerHTML`, 저장소, 추적·전송 API 사용 없음 확인
- 앱 소스의 외부 asset URL 없음 확인

## 4. 일반 모드 비회귀

`http://127.0.0.1:8768/`에서 확인했습니다.

| 항목 | 결과 |
|---|---|
| 베타 배지 | 없음 |
| 테스트 링크 공유 버튼 | 없음 |
| 피드백 버튼·패널 | 없음 |
| 베타 DOM | 0개 |
| 제목 | `Sentence Hunter v0.2.0` |
| 푸터 | `Version 0.2.0 · Original 30 questions preserved` |
| 카운트다운 후 타이머 | 90 |
| 첫 단계 | `STEP 1 · FIND` |
| 하트 종료 결과 | 기존 `GAME OVER` |
| 390×844 결과 body 높이 | 844px, 기존 화면과 동일 |
| 콘솔 warning/error | 0건 |

기존 `tests/v0_2_regression.mjs`도 변경 없이 통과했습니다.

## 5. 베타 모드 기능 검사

| 시나리오 | 기대 결과 | 결과 |
|---|---|---|
| `?beta=1` | `BETA TEST · ANON` | PASS |
| `?beta=1&tester=T01` | `BETA TEST · T01` | PASS |
| `?beta=0&tester=T01` | 일반 모드 | PASS |
| `<> T-01!` | `T-01` | PASS |
| 14자 tester | 앞 12자만 표시 | PASS |
| 게임 결과 전 | 결과 피드백 접근 불가 | PASS |
| 결과 직후 | `20초 피드백 남기기`만 표시, 패널 접힘 | PASS |
| 필수 평가 누락 | 안내 후 첫 누락 항목 포커스 | PASS |
| 평가 선택·변경 | radio/select 정상 | PASS |
| 개인정보 안내 | 이름·이메일 비입력 안내 표시, form autocomplete OFF | PASS |
| 자유 입력 | 100자·200자 강제 | PASS |
| HTML/script 입력 | DOM 노드·스크립트 생성 0 | PASS |
| 결과 복사 | 실제 score·accuracy·combo·solved·defeated 반영 | PASS |
| 하트 종료 | `End Reason: HEARTS` | PASS |
| 시간 종료 | `End Reason: TIME UP` | PASS |
| 첫 판 | `Retries: 0` | PASS |
| RETRY 뒤 두 번째 결과 | `Retries: 1` | PASS |
| HOME 뒤 새 판 | `Retries: 0` | PASS |
| HOME 뒤 tester | T01 유지 | PASS |
| 테스트 링크 공유 | tester 제거, `?beta=1`만 유지 | PASS |

HOME은 새 베타 플레이 세션의 경계로 정의했습니다. HOME은 재도전 수, 직전 결과, 폼과 수동 복사 상태를 초기화하며 URL의 beta/tester 값과 기존 최고 기록은 유지합니다.

## 6. 공유 fallback 검사

| 조건 | 결과 |
|---|---|
| Web Share 성공 | 공유 1회, clipboard 0회, `공유 창을 열었습니다.` |
| Web Share `AbortError` | clipboard 0회, 오류 문구·예외 없음 |
| Web Share 미지원 | clipboard 복사와 성공 상태 |
| Web Share 일반 실패 | clipboard fallback |
| clipboard 미지원·실패 | readonly textarea 표시·포커스·전체 선택 |
| 수동 fallback 뒤 폼 수정 | 오래된 textarea·상태 즉시 제거 |
| 이전 수동 fallback 뒤 공유 취소 | 오래된 textarea 제거, 오류 표시 없음 |
| 연속 클릭 | 처리 중 버튼 비활성화, 중복 호출 방지 |

실제 OS 공유창은 자동 검사에서 열지 않고 mock으로 분기를 검증했습니다.

## 7. 반응형 브라우저 검사

일반 모드는 시작·게임·결과, 베타 모드는 시작·게임·접힌 결과·펼친 패널을 확인했습니다.

| 화면 | 일반 가로 넘침 | 베타 가로 넘침 | 44×44 미만 | 패널 세로 스크롤 | 시작 UI 겹침 |
|---|---|---|---|---|---|
| 320×568 | 없음 | 없음 | 0개 | 정상 | 없음 |
| 360×800 | 없음 | 없음 | 0개 | 정상 | 없음 |
| 390×844 | 없음 | 없음 | 0개 | 정상 | 없음 |
| 412×915 | 없음 | 없음 | 0개 | 정상 | 없음 |
| 844×390 | 없음 | 없음 | 0개 | 정상 | 없음 |
| 1366×768 | 없음 | 없음 | 0개 | 정상 | 없음 |

- 390×844 베타 결과의 접힌 상태는 기존 결과에 46px 피드백 버튼만 추가하며 패널 내용은 렌더링되지 않습니다.
- 펼친 패널은 document의 일반 세로 스크롤을 사용하며 fixed/modal을 만들지 않습니다.
- 결과 화면의 포커스 가능한 DOM 순서는 사운드 → RETRY → HOME → 피드백 열기 → 평가 → 선택 입력 → 공유/복사입니다.
- radio label, select, textarea와 모든 베타 버튼의 측정된 터치 영역은 최소 44px입니다.
- 기존 `prefers-reduced-motion` 규칙이 새 베타 UI에도 적용되며 베타 전용 애니메이션은 추가하지 않았습니다.

## 8. 리소스·콘솔·개인정보 검사

| 항목 | 결과 |
|---|---|
| `/` | HTTP 200 |
| `/styles.css` | HTTP 200 |
| `/questions.js` | HTTP 200 |
| `/beta.js` | HTTP 200 |
| `/app.js` | HTTP 200 |
| 브라우저 warning/error | 0건 |
| 앱 리소스 404 | 0건 |
| 외부 asset·CDN | 0개 |
| 제출 API·fetch/XHR/WebSocket/beacon | 없음 |
| beta localStorage/sessionStorage | 없음 |
| IP·위치·이름·이메일·전체 UA 수집 | 없음 |

## 9. Preview에서 다시 확인할 항목

- Preview의 정확한 Git SHA와 `READY` 상태
- 기본 Preview에서 베타 DOM 0개
- Preview `?beta=1`과 `?beta=1&tester=T01`
- HTTPS 실제 clipboard 권한과 Web Share 취소 동작
- Preview 리소스 200, 콘솔 warning/error 0
- Production이 계속 기준 main `19842d9c...`와 v0.2.0 화면을 제공하는지 확인

## 10. 실제 기기 보류 항목

- iOS Safari와 Android Chrome/Samsung Internet의 OS 공유 시트
- 앱 간 공유 대상 선택 후 복귀 동작
- clipboard 권한이 명시적으로 거부된 실제 모바일 환경
- 모바일 화면 키보드가 열린 상태의 textarea 스크롤·가림
- 실제 진동·효과음과 무음 모드 조합
- VoiceOver/TalkBack의 radio group·live status 읽기

이 항목은 Preview HTTPS 주소를 실제 기기로 열어야 최종 확인할 수 있습니다.
