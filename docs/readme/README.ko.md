<div align="center">

<img src="media/icon.png" width="96" alt="">

# Hamster

**AI 코딩 도구가 일하는 동안 Mac 화면 아래에서 곁을 지키는 작은 햄스터.**

[소개 페이지](https://hamster-34x.pages.dev/) · [받기](https://github.com/fbwndrud/hamster/releases/latest) · [설치](#설치) · [개인정보](#개인정보) · [English](../../README.md)

![최신 릴리스](https://img.shields.io/github/v/release/fbwndrud/hamster?label=release&color=f2a65a) ![macOS 13+ · Apple Silicon](https://img.shields.io/badge/macOS%2013%2B-Apple%20Silicon-8a6f5a) ![코드: MIT](https://img.shields.io/badge/code-MIT-6b8f71)

</div>

## AI가 일하는 동안 이렇게 반응해요

| 요청을 보내면 | 일하는 동안 | 답이 오면 |
| :---: | :---: | :---: |
| <img src="media/request.gif" width="160" alt="귀를 쫑긋하는 햄스터"> | <img src="media/work.gif" width="160" alt="앞발을 두드리는 햄스터"> | <img src="media/reply.gif" width="160" alt="고개를 기울이는 햄스터"> |
| 귀가 쫑긋 | 앞발이 톡톡 | 고개를 갸웃 |

**Codex, Claude Code, Cursor Agent, Gemini CLI, Grok**의 훅으로 반응합니다. 연결한 AI 도구가 없으면 직접 입력할 때 반응합니다. 일이 없을 때는 눈을 깜빡이고 킁킁거리고 두리번거립니다.

## 같이 놀기

| 쓰다듬기 | 하이파이브 | 선물 열기 |
| :---: | :---: | :---: |
| <img src="media/pat.gif" width="160" alt="쓰다듬어 주면 좋아하는 햄스터"> | <img src="media/highfive.gif" width="160" alt="하이파이브하는 햄스터"> | <img src="media/gift.gif" width="160" alt="선물 상자를 여는 햄스터"> |
| 쉬고 있을 때 살살 | 답이 온 뒤 앞발을 톡 | 함께 일하면 받아요 |

## 기능

- **함께 일한 시간.** 도구마다 오늘과 누적으로 함께 일한 시간을 보여 줍니다. 간식과 선물은 토큰 사용량이 아니라 이 시간으로 받습니다.
- **토큰 사용량.** Codex, Claude Code, Grok, Gemini CLI(실험)는 각 도구가 이미 Mac에 남기는 기록에서 토큰 숫자만 읽어 보여 줍니다.
- **옷장.** 머리·얼굴·목 장식 40가지와 저장한 차림.
- **계정·광고·추적 없음.** 네트워크 요청은 업데이트 확인 하나뿐입니다.
- 한국어와 영어.

## 설치

Apple 실리콘(M1 이후) Mac과 macOS 13 이상이 필요합니다. Intel Mac은 지원하지 않습니다.

### 1. 내려받기

[최신 릴리스](https://github.com/fbwndrud/hamster/releases/latest)를 열고 **Assets**에서 `Hamster-<버전>.zip`을 누릅니다. 필요한 파일은 이 zip 하나입니다.

| 릴리스 페이지의 파일 | 용도 |
| --- | --- |
| `Hamster-<버전>.zip` | 앱입니다. 이 파일을 받습니다. |
| `Hamster-<버전>.zip.sha256` | [내려받은 파일 확인](#내려받은-파일-확인)용 체크섬입니다. 선택 사항입니다. |
| `latest.json` | 앱이 업데이트를 찾을 때 읽는 파일입니다. 받을 필요 없습니다. |
| Source code (zip, tar.gz) | GitHub가 자동으로 붙이는 소스입니다. 앱 실행에는 필요 없습니다. |

### 2. 압축을 풀고 응용 프로그램 폴더로 옮기기

**다운로드** 폴더에서 zip을 더블클릭하면 `Hamster.app`이 나옵니다. 열기 전에 `Hamster.app`을 **응용 프로그램** 폴더로 끌어다 놓습니다. 다운로드 폴더에서 바로 열면 macOS가 읽기 전용 임시 사본으로 실행해서 업데이트가 동작하지 않습니다.

### 3. 처음 열기

Hamster는 유료 Apple Developer ID로 서명하지 않아서 처음 한 번은 macOS가 막습니다. 한 번만 허용하면 됩니다.

1. 응용 프로그램 폴더에서 Hamster를 더블클릭합니다. 확인할 수 없는 앱이라는 안내가 나오면 **완료**를 누릅니다. 휴지통으로 이동은 누르지 않습니다.
2. **시스템 설정 → 개인정보 보호 및 보안**을 열고 **보안** 항목까지 내립니다. Hamster가 차단되었다는 안내가 보입니다.
3. **그래도 열기**를 누르고 Mac 암호나 Touch ID로 확인한 뒤, 다음 창에서 한 번 더 **그래도 열기**를 누릅니다.

화면 아래에 햄스터가 나타나고 메뉴 막대에 햄스터 아이콘이 생깁니다. 이후에는 그냥 열리고, 업데이트할 때도 이 단계를 다시 하지 않습니다. 최근 macOS에서는 오른쪽 클릭 → 열기로 이 단계를 건너뛸 수 없습니다. [Apple 안내](https://support.apple.com/ko-kr/guide/mac-help/mh40616/mac)

### 4. AI 도구 연결하기

메뉴 막대의 햄스터 아이콘을 누르고 **AI 연결 → 도구 이름 → [도구] 훅 설치…**를 고릅니다. 도구마다 따로 연결합니다. Codex는 설치한 뒤 Codex의 설정 → Hooks에서 Hamster 훅을 승인해야 합니다. 연결하면 바뀌는 파일은 [Mac에서 바꾸는 것](#mac에서-바꾸는-것)에 있습니다.

### 열리지 않을 때

- **그래도 열기 버튼이 없어요.** 앱을 열어 본 뒤 1시간 정도만 보입니다. Hamster를 다시 더블클릭하고 개인정보 보호 및 보안으로 돌아갑니다.
- **"손상되었기 때문에 열 수 없습니다"가 나와요.** 대개 내려받기가 중간에 끊겼거나 다른 압축 프로그램으로 풀었을 때 나옵니다. 지우고 zip을 다시 받아 Finder에서 더블클릭으로 풉니다.
- **"이 Mac에서 지원되지 않습니다"가 나와요.** Intel Mac입니다. Hamster는 Apple 실리콘에서만 동작합니다.
- **그래도 막혀요.** [내려받은 파일을 확인](#내려받은-파일-확인)했다면 터미널에서 "인터넷에서 받은 파일" 표시를 지우고 다시 열 수 있습니다.
  ```sh
  xattr -dr com.apple.quarantine /Applications/Hamster.app
  ```

### 내려받은 파일 확인

선택 사항입니다. 터미널에서 아래 명령을 실행하고, 결과가 `Hamster-<버전>.zip.sha256` 파일 안의 값과 같은지 봅니다. 다르면 앱을 열지 말고 [Issues](https://github.com/fbwndrud/hamster/issues)로 알려 주세요.

```sh
shasum -a 256 ~/Downloads/Hamster-*.zip
```

### 지우기

1. 연결한 도구마다 **AI 연결 → 도구 이름 → Hamster 훅 제거**를 누릅니다.
2. 메뉴에서 Hamster를 종료하고 `Hamster.app`을 휴지통으로 옮깁니다.
3. 원하면 `~/Library/Application Support/Codex Hamster/`(설정과 보상)와 각 도구 설정 폴더 안의 `hamster` 폴더(예: `~/.codex/hamster`)도 지웁니다.

## Mac에서 바꾸는 것

도구를 연결하면 그 도구의 사용자 설정에 Hamster 항목만 추가되고 다른 설정은 그대로 둡니다. **Hamster 훅 제거**를 누르면 다시 빠집니다.

| 도구 | 파일 | 훅 이벤트 |
| --- | --- | --- |
| Codex | `~/.codex/hooks.json` | `UserPromptSubmit`, `Stop`, `Interrupt` |
| Claude Code | `~/.claude/settings.json` | `UserPromptSubmit`, `Stop`, `StopFailure`, `SessionEnd` |
| Cursor Agent | `~/.cursor/hooks.json` | `beforeSubmitPrompt`, `stop`, `sessionEnd` |
| Gemini CLI | `~/.gemini/settings.json` | `BeforeAgent`, `AfterAgent`, `SessionEnd` |
| Grok | `~/.grok/hooks/hamster.json` | `UserPromptSubmit`, `Stop`, `StopFailure`, `StopCancelled`, `SessionEnd`, `Notification` (`idle_prompt`) |

Grok은 Claude Code와 Cursor의 훅 파일도 실행합니다. 도우미 프로그램은 그 호출을 무시하므로 Grok 작업은 Grok으로 한 번만 셉니다.

훅 도우미([`codex-hook.swift`](../../desktop-pet/codex-hook.swift))는 이벤트 종류와 해시한 턴 ID만 로컬 소켓으로 보냅니다. 설치 코드는 [`codex-install.cjs`](../../desktop-pet/codex-install.cjs)에 있습니다. 설정과 보상은 `~/Library/Application Support/Codex Hamster/`에 저장됩니다.

## 개인정보

- 입력한 내용은 읽지 않습니다. 입력 반응에는 시스템이 사용 중인지만 확인합니다.
- 토큰 사용량을 보여 주려고 연결한 도구가 이 Mac에 남긴 기록(`~/.codex/sessions`, `~/.claude/projects`, `~/.gemini/tmp/*/chats`, `~/.grok/sessions/*/*/usage.json`)에서 토큰 숫자를 읽습니다. 이 기록에는 프롬프트와 코드도 들어 있지만, Hamster는 숫자만 로컬 캐시에 남기고 어디로도 보내지 않습니다. Claude Code에서 작업을 중단했는지 알아보려고 그 세션 대화 기록의 끝부분에서 중단 표시도 확인합니다. Cursor는 토큰 숫자를 로컬에 남기지 않아 시간만 보여 줍니다.
- 네트워크 요청은 업데이트 확인 하나뿐입니다. 실행할 때와 12시간마다 이 저장소의 릴리스에서 `latest.json`을 HTTPS로 받아 오고, 식별 정보는 보내지 않습니다.

## 업데이트

새 릴리스가 있으면 메뉴에 **업데이트 설치**가 보입니다. 누르기 전에는 아무것도 내려받지 않습니다. 누르면 릴리스를 내려받고, 매니페스트에 올바른 Ed25519 서명이 있는지와 파일이 서명된 SHA-256·크기와 같은지 확인한 뒤에만 앱을 교체합니다. 새 버전이 실행되지 않으면 이전 버전으로 돌아갑니다.

서명을 확인하는 공개키는 [`distribution.cjs`](../../desktop-pet/distribution.cjs)에 있습니다. 릴리스에 서명할 수 있는 것은 짝이 되는 비밀키뿐이고, 비밀키는 이 저장소에 없습니다.

## 의견

- 버그와 아이디어: [Issues](https://github.com/fbwndrud/hamster/issues)에 남겨 주세요. 메뉴의 **진단 정보 복사**로 복사한 내용을 붙여 주시면 도움이 됩니다.
- 보안 문제: 공개하지 말고 [SECURITY.md](../../SECURITY.md)의 방법으로 알려 주세요.
- 풀 리퀘스트는 아직 받지 않습니다. [CONTRIBUTING.md](../../CONTRIBUTING.md)를 봐 주세요.

## 후원

Hamster는 무료입니다. 마음에 드셨다면 [Ko-fi](https://ko-fi.com/junelyoo)에서 커피 한 잔으로 응원해 주세요. 후원 보상은 없고, 계속 만드는 데 도움이 됩니다.

## 라이선스

- 코드: [MIT](../../LICENSE).
- 그림(햄스터, 동작, 장식, 아이콘)은 MIT가 **아닙니다**. Hamster 안에서 쓰고 개인적으로 고쳐 쓸 수는 있지만, 재배포하거나 판매할 수 없습니다. [ASSETS-LICENSE.md](../../ASSETS-LICENSE.md)를 봐 주세요.

직접 빌드하려면 [소스에서 빌드하기](../building.md)를 봐 주세요.
