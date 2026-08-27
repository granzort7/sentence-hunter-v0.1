# Sentence Hunter v0.1

틀린 영어 문장을 찾아 고치고 Grammar Bug를 공격하는 **90초 모바일 웹 프로토타입**입니다.

## 실행 방법

별도 설치 없이 실행할 수 있습니다.

### 가장 간단한 방법

1. 이 폴더에서 터미널을 엽니다.
2. 아래 명령을 실행합니다.

```bash
python -m http.server 8080
```

3. 브라우저에서 `http://localhost:8080`을 엽니다.

Windows에서 `python` 명령이 없으면 아래를 사용합니다.

```bash
py -m http.server 8080
```

단순 확인은 `index.html`을 직접 열어도 되지만, 로컬 서버 실행을 권장합니다.

## 현재 구현 범위

- 90초 Grammar Survival
- 하트 3개
- 오류 부분 찾기 → 올바른 표현 선택
- 점수, 속도 보너스, 콤보 배율
- 5콤보·10콤보 특수 공격
- Grammar Bug 체력과 처치 수
- 마지막 15초 Fever 배율
- 결과 등급, 정확도, 약점 문법 표시
- 최고 점수 브라우저 저장
- Starter 12문제, Everyday 12문제, Challenger 6문제
- 모바일 반응형 화면과 간단한 효과음·진동

## 테스트할 핵심 질문

1. 설명 없이 10초 이내에 조작법을 이해하는가?
2. 틀린 부분을 누르는 행위가 불편하지 않은가?
3. 정답 후 공격·콤보 피드백이 만족스러운가?
4. 한 판이 끝난 뒤 바로 다시 도전하고 싶은가?
5. 문법 문제를 푼다는 느낌보다 게임 느낌이 더 강한가?
6. 정답이 애매하다고 느끼는 문항이 있는가?

## 파일

- `index.html`: 화면 구조
- `styles.css`: 모바일 UI 및 애니메이션
- `questions.js`: 검수된 30문제 데이터
- `app.js`: 게임 상태·점수·콤보·전투·결과 로직
- `GAME_SPEC.md`: v0.1 확정 명세
- `CODEX_PROMPT.md`: Codex에 전달할 다음 개발 프롬프트

## 프로젝트 구조와 배포 방식

이 프로젝트는 외부 프레임워크, CDN, 로그인, 데이터베이스가 없는 Vanilla HTML/CSS/JavaScript 정적 사이트입니다. 패키지 설치와 빌드 과정이 없으며, 웹 서버가 이 폴더의 `index.html`을 그대로 제공하면 실행됩니다.

브라우저는 `questions.js`를 먼저 불러온 뒤 `app.js`를 실행합니다. 두 파일의 로드 순서를 바꾸지 마세요.

30개 문제 데이터 보존 확인용 `questions.js` SHA-256은 다음과 같습니다.

```text
44CEC71AD8EDE22D290F616E8D365A211BAF7D6D529E4C0FCAEC98FD37177550
```

## GitHub 업로드

GitHub에서 README, 라이선스, `.gitignore`를 자동 생성하지 않은 빈 저장소를 만든 뒤 프로젝트 루트에서 실행합니다.

```bash
git init -b main
git add .
git commit -m "Prepare Sentence Hunter v0.1 for static deployment"
git remote add origin https://github.com/YOUR_ACCOUNT/sentence-hunter-v0.1.git
git push -u origin main
```

`YOUR_ACCOUNT`는 실제 GitHub 계정명으로 바꾸세요. 이미 Git 저장소가 초기화되어 있다면 `git init -b main`은 생략합니다.

## Vercel 배포

이 프로젝트에는 별도 `package.json`이나 `vercel.json`이 필요하지 않습니다.

개인·비상업 프로토타입 테스트라면 무료 Vercel Hobby 플랜을 사용할 수 있습니다. 상업 또는 조직 용도로 전환할 때는 Vercel의 현재 플랜 조건을 다시 확인하세요.

1. Vercel Dashboard에서 **Add New → Project**를 선택합니다.
2. 위에서 만든 GitHub 저장소를 Import합니다.
3. **Framework Preset**은 `Other`를 선택합니다.
4. **Root Directory**는 저장소 루트인 `.`을 사용합니다.
5. **Build Command**는 Override를 켜고 비워 둡니다.
6. **Output Directory**는 기본 감지값 `.`을 사용합니다. 다른 값이 들어가면 `.`으로 지정합니다.
7. 환경 변수는 추가하지 않습니다.
8. **Deploy**를 누른 뒤 생성된 `https://...vercel.app` 주소로 접속합니다.

이후 `main` 브랜치에 push하면 Vercel이 새 프로덕션 배포를 자동으로 만듭니다.

## 배포 후 체크리스트

- HTTPS 주소의 `/`에 직접 접속했을 때 시작 화면이 나타나는가
- 개발자 도구 콘솔에 오류가 없고 `styles.css`, `questions.js`, `app.js`가 모두 200으로 로드되는가
- 390×844에서 시작 → PLAY → 오류 선택 → 교정 선택 → 결과 → RETRY → HOME 흐름이 가능한가
- 320×568, 360×800, 412×915 및 모바일 가로 화면에서 가로 스크롤이나 잘린 버튼이 없는가
- PC Chrome/Edge에서 520px 게임 영역이 중앙에 표시되고 마우스·키보드로 버튼을 조작할 수 있는가
- iOS Safari와 Android Chrome/Samsung Internet에서 터치, 소리 토글, 진동 허용 범위가 정상인가
- 90초 종료와 하트 0 종료가 모두 결과 화면으로 이동하는가
- 새 최고 점수만 저장되고 새로고침 후에도 복원되는가
- 배포 전후 `questions.js` SHA-256이 위 값과 동일한가
