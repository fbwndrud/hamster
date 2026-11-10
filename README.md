# Hamster

A small hamster that lives at the bottom of your Mac screen and keeps you company while your AI coding tools work.

When you send a request, its ears perk up. While the AI works, it taps its paws. When the reply lands, it tilts its head. Between tasks it blinks, sniffs, and looks around. Spend time working together and it earns snacks, gifts, and outfits you can dress it in.

[한국어 안내](#한국어)

## Features

- Reacts to Codex, Claude Code, Cursor Agent, and Gemini CLI through their hook systems.
- Reacts to your own typing when no AI tool is connected.
- 12 motions and 40 accessories for head, face, and neck, with saved outfits.
- Rewards based on time spent working together. No accounts, no ads, no tracking.
- Korean and English.

## Install

1. Download `Hamster-<version>.zip` from the [latest release](https://github.com/fbwndrud/hamster/releases/latest). Check the SHA-256 on the release page:
   ```sh
   shasum -a 256 ~/Downloads/Hamster-<version>.zip
   ```
2. Unzip it and move `Hamster.app` to **Applications** before opening it. Opening it from Downloads breaks updates.
3. Hamster is not signed with an Apple Developer ID, so macOS blocks the first launch. Open it once, then go to **System Settings → Privacy & Security** and click **Open Anyway**. The button appears for about an hour after you try to open the app.
4. Open the hamster menu in the menu bar and choose **AI connection** to connect your tools.

Prefer not to run a downloaded binary? [Build it yourself](#build-from-source).

## What it changes on your Mac

Connecting a tool adds a Hamster entry to that tool's user config. **AI connection → [tool] → Remove Hamster hooks** takes it out again.

| Tool | File | Hook events |
| --- | --- | --- |
| Codex | `~/.codex/hooks.json` | `UserPromptSubmit`, `Stop`, `Interrupt` |
| Claude Code | `~/.claude/settings.json` | `UserPromptSubmit`, `Stop`, `StopFailure`, `SessionEnd` |
| Cursor Agent | `~/.cursor/hooks.json` | `beforeSubmitPrompt`, `stop`, `sessionEnd` |
| Gemini CLI | `~/.gemini/settings.json` | `BeforeAgent`, `AfterAgent`, `SessionEnd` |

The hook helper ([`codex-hook.swift`](desktop-pet/codex-hook.swift)) sends only the event type and a hashed turn ID to a local socket. Install logic is in [`codex-install.cjs`](desktop-pet/codex-install.cjs).

Settings and rewards are stored in `~/Library/Application Support/Codex Hamster/`.

## Privacy

- Hamster does not read your prompts, code, or what you type. For typing reactions it reads only whether the system is active.
- The only network request is the update check: a plain HTTPS request for `latest.json` from this repository's releases, at launch and every 12 hours. It carries no identifiers.

## Updates

When a new release is available, the menu shows **Install update**. Nothing is downloaded until you click it. The app then downloads the release, checks that its manifest carries a valid Ed25519 signature from the key built into the app and that the file matches the signed SHA-256 and size, and only then replaces itself. If the new version fails to start, it rolls back.

## Build from source

Requires macOS, Node.js 22+, and the Xcode command line tools (for Swift).

```sh
npm ci --prefix desktop-pet
npm test --prefix desktop-pet
npm run package:mac --prefix desktop-pet -- --bootstrap
```

The app is written to `output/desktop/Hamster.app`. A build made on your own Mac is not marked as downloaded, so it should open without the Open Anyway step. It still checks this repository for updates; to turn that off in your fork, change the manifest URL and public key in [`distribution.cjs`](desktop-pet/distribution.cjs).

The project site is in [`hamster-site/`](hamster-site).

## Feedback

- Bugs and ideas: [Issues](https://github.com/fbwndrud/hamster/issues). Use **Copy diagnostics** in the menu and paste it into the report.
- Security problems: report privately, see [SECURITY.md](SECURITY.md).
- Pull requests are not accepted yet; see [CONTRIBUTING.md](CONTRIBUTING.md).

## Support

Hamster is free. If it made your day a little nicer, you can [buy me a coffee on Ko-fi](https://ko-fi.com/junelyoo). There are no rewards for supporting; it just helps me keep building.

## License

- Code: [MIT](LICENSE).
- Artwork (the hamster, its animations, accessories, and icons): **not** MIT. You may use and personally modify it within Hamster, but not redistribute or sell it. See [ASSETS-LICENSE.md](ASSETS-LICENSE.md).

---

## 한국어

Mac 화면 아래에 살면서 AI 코딩 도구가 일하는 동안 곁에 있는 작은 햄스터입니다. 요청을 보내면 귀를 쫑긋하고, AI가 일하는 동안 앞발을 두드리고, 답이 오면 고개를 기울입니다. 함께 일한 시간만큼 간식과 선물을 받고, 장식으로 꾸밀 수 있습니다.

**설치**

1. [최신 릴리스](https://github.com/fbwndrud/hamster/releases/latest)에서 `Hamster-<버전>.zip`을 받고, 릴리스에 적힌 SHA-256과 같은지 확인합니다.
2. 압축을 풀고 `Hamster.app`을 **응용 프로그램** 폴더로 옮긴 뒤 엽니다.
3. Apple Developer ID 서명이 없어 처음에는 macOS가 막습니다. 한 번 열어 본 뒤 **시스템 설정 → 개인정보 보호 및 보안**에서 **그래도 열기**를 누릅니다.
4. 메뉴 막대의 햄스터 메뉴 → **AI 연결**에서 도구를 연결합니다.

**개인정보:** 프롬프트·코드·입력 내용을 읽지 않습니다. 네트워크 요청은 업데이트 확인(실행 시와 12시간마다 이 저장소의 `latest.json` 요청) 하나뿐이며 식별 정보를 보내지 않습니다.

**업데이트:** 새 버전이 있으면 메뉴에 표시되고, 누를 때만 내려받습니다. 앱에 들어 있는 공개키로 서명과 SHA-256을 확인한 뒤에만 교체합니다.

**의견:** [Issues](https://github.com/fbwndrud/hamster/issues)에 남겨 주세요. 메뉴의 **진단 정보 복사**를 붙여 주시면 도움이 됩니다. 보안 문제는 [SECURITY.md](SECURITY.md)를 봐 주세요.

**후원:** 무료입니다. 마음에 드셨다면 [Ko-fi](https://ko-fi.com/junelyoo)에서 커피 한 잔으로 응원해 주세요. 후원 보상은 없습니다.

**라이선스:** 코드는 [MIT](LICENSE)입니다. 햄스터 그림·동작·장식·아이콘은 MIT가 아니며, Hamster 안에서 쓰고 고쳐 쓰는 것은 되지만 재배포·판매는 할 수 없습니다. [ASSETS-LICENSE.md](ASSETS-LICENSE.md)
