# Hamster

[English](../../README.md) | 한국어

Mac 화면 아래에 살면서 AI 코딩 도구가 일하는 동안 곁에 있는 작은 햄스터입니다.

요청을 보내면 귀를 쫑긋하고, AI가 일하는 동안 앞발을 두드리고, 답이 오면 고개를 기울입니다. 일이 없을 때는 눈을 깜빡이고 킁킁거리고 두리번거립니다. 함께 일한 시간만큼 간식과 선물을 받고, 장식으로 차림을 꾸밀 수 있습니다.

## 기능

- Codex, Claude Code, Cursor Agent, Gemini CLI, Grok의 훅으로 반응합니다.
- 도구마다 함께 일한 시간을 보여 주고, Codex·Claude Code·Gemini CLI(실험)·Grok은 토큰 사용량도 보여 줍니다.
- AI 도구를 연결하지 않으면 내가 입력할 때 반응합니다.
- 동작 12가지와 머리·얼굴·목 장식 40개가 있고, 차림을 저장할 수 있습니다.
- 보상은 함께 일한 시간으로 받습니다. 계정·광고·추적이 없습니다.
- 한국어와 영어를 지원합니다.

## 설치

1. [최신 릴리스](https://github.com/fbwndrud/hamster/releases/latest)에서 `Hamster-<버전>.zip`을 받습니다. 릴리스 페이지에 적힌 SHA-256과 같은지 확인합니다.
   ```sh
   shasum -a 256 ~/Downloads/Hamster-<버전>.zip
   ```
2. 압축을 풀고, 열기 전에 `Hamster.app`을 **응용 프로그램** 폴더로 옮깁니다. 다운로드 폴더에서 바로 열면 업데이트가 동작하지 않습니다.
3. Apple Developer ID 서명이 없어서 처음 열 때 macOS가 막습니다. 한 번 열어 본 뒤 **시스템 설정 → 개인정보 보호 및 보안**에서 **그래도 열기**를 누릅니다. 이 버튼은 열어 보려 한 뒤 1시간 정도만 보입니다.
4. 메뉴 막대의 햄스터 메뉴에서 **AI 연결**을 골라 도구를 연결합니다.

내려받은 실행 파일을 쓰고 싶지 않다면 [직접 빌드](#소스에서-빌드하기)할 수 있습니다.

## Mac에서 바꾸는 것

도구를 연결하면 그 도구의 사용자 설정에 Hamster 항목이 추가됩니다. **AI 연결 → 도구 이름 → Hamster 훅 제거**를 누르면 다시 빠집니다.

| 도구 | 파일 | 훅 이벤트 |
| --- | --- | --- |
| Codex | `~/.codex/hooks.json` | `UserPromptSubmit`, `Stop`, `Interrupt` |
| Claude Code | `~/.claude/settings.json` | `UserPromptSubmit`, `Stop`, `StopFailure`, `SessionEnd` |
| Cursor Agent | `~/.cursor/hooks.json` | `beforeSubmitPrompt`, `stop`, `sessionEnd` |
| Gemini CLI | `~/.gemini/settings.json` | `BeforeAgent`, `AfterAgent`, `SessionEnd` |
| Grok | `~/.grok/hooks/hamster.json` | `UserPromptSubmit`, `Stop`, `StopFailure`, `StopCancelled`, `SessionEnd`, `Notification` (`idle_prompt`) |

Grok은 Claude Code와 Cursor의 훅 파일도 실행합니다. 도우미 프로그램은 그 호출을 무시하므로 Grok 작업은 Grok으로 한 번만 셉니다.

훅 도우미([`codex-hook.swift`](../../desktop-pet/codex-hook.swift))는 이벤트 종류와 해시한 턴 ID만 로컬 소켓으로 보냅니다. 설치 코드는 [`codex-install.cjs`](../../desktop-pet/codex-install.cjs)에 있습니다.

설정과 보상은 `~/Library/Application Support/Codex Hamster/`에 저장됩니다.

## 개인정보

- 입력한 내용은 읽지 않습니다. 입력 반응에는 시스템이 사용 중인지만 확인합니다.
- 토큰 사용량을 보여 주려고 연결한 도구가 이 Mac에 남긴 기록(`~/.codex/sessions`, `~/.claude/projects`, `~/.gemini/tmp/*/chats`, `~/.grok/sessions/*/*/usage.json`)에서 토큰 숫자를 읽습니다. 이 기록에는 프롬프트와 코드도 들어 있지만, Hamster는 숫자만 로컬 캐시에 남기고 어디로도 보내지 않습니다. Claude Code에서 작업을 중단했는지 알아보려고 그 세션 대화 기록의 끝부분에서 중단 표시도 확인합니다. Cursor는 토큰 숫자를 로컬에 남기지 않아 시간만 보여 줍니다.
- 네트워크 요청은 업데이트 확인 하나뿐입니다. 실행할 때와 12시간마다 이 저장소의 릴리스에서 `latest.json`을 HTTPS로 받아 오고, 식별 정보는 보내지 않습니다.

## 업데이트

새 릴리스가 있으면 메뉴에 **업데이트 설치**가 보입니다. 누르기 전에는 아무것도 내려받지 않습니다. 누르면 릴리스를 내려받고, 매니페스트에 앱에 들어 있는 키로 만든 Ed25519 서명이 있는지, 파일이 서명된 SHA-256·크기와 같은지 확인한 뒤에만 앱을 교체합니다. 새 버전이 실행되지 않으면 이전 버전으로 돌아갑니다.

## 소스에서 빌드하기

macOS, Node.js 22 이상, Xcode 명령줄 도구(Swift용)가 필요합니다.

```sh
npm ci --prefix desktop-pet
npm test --prefix desktop-pet
npm run package:mac --prefix desktop-pet -- --bootstrap
```

앱은 `output/desktop/Hamster.app`에 만들어집니다. 내 Mac에서 빌드한 앱은 다운로드한 파일로 표시되지 않아 **그래도 열기** 단계 없이 열립니다. 업데이트는 여전히 이 저장소에서 확인합니다. 포크에서 끄려면 [`distribution.cjs`](../../desktop-pet/distribution.cjs)의 매니페스트 주소와 공개키를 바꿉니다.

프로젝트 사이트는 [`hamster-site/`](../../hamster-site)에 있습니다.

## 의견

- 버그와 아이디어: [Issues](https://github.com/fbwndrud/hamster/issues)에 남겨 주세요. 메뉴의 **진단 정보 복사**로 복사한 내용을 붙여 주시면 도움이 됩니다.
- 보안 문제: 공개하지 말고 [SECURITY.md](../../SECURITY.md)의 방법으로 알려 주세요.
- 풀 리퀘스트는 아직 받지 않습니다. [CONTRIBUTING.md](../../CONTRIBUTING.md)를 봐 주세요.

## 후원

Hamster는 무료입니다. 마음에 드셨다면 [Ko-fi](https://ko-fi.com/junelyoo)에서 커피 한 잔으로 응원해 주세요. 후원 보상은 없고, 계속 만드는 데 도움이 됩니다.

## 라이선스

- 코드: [MIT](../../LICENSE).
- 그림(햄스터, 동작, 장식, 아이콘)은 MIT가 **아닙니다**. Hamster 안에서 쓰고 개인적으로 고쳐 쓸 수는 있지만, 재배포하거나 판매할 수 없습니다. [ASSETS-LICENSE.md](../../ASSETS-LICENSE.md)를 봐 주세요.
