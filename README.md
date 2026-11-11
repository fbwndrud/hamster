<div align="center">

<img src="docs/readme/media/icon.png" width="96" alt="">

# Hamster

**A little hamster that keeps you company at the bottom of your Mac screen while your AI coding tools work.**

[Download](https://github.com/fbwndrud/hamster/releases/latest) · [Install](#install) · [Privacy](#privacy) · [한국어](docs/readme/README.ko.md)

![Latest release](https://img.shields.io/github/v/release/fbwndrud/hamster?label=release&color=f2a65a) ![macOS · Apple Silicon](https://img.shields.io/badge/macOS-Apple%20Silicon-8a6f5a) ![Code: MIT](https://img.shields.io/badge/code-MIT-6b8f71)

</div>

## It reacts while the AI works

| Send a prompt | While it works | When the reply lands |
| :---: | :---: | :---: |
| <img src="docs/readme/media/request.gif" width="160" alt="The hamster's ears perk up"> | <img src="docs/readme/media/work.gif" width="160" alt="The hamster taps its paws"> | <img src="docs/readme/media/reply.gif" width="160" alt="The hamster tilts its head"> |
| Ears perk up | Little paws tap | A little head tilt |

Works with **Codex, Claude Code, Cursor Agent, Gemini CLI and Grok** through their hook systems. With no AI tool connected, it reacts to your own typing instead. Between tasks it blinks, sniffs and looks around.

## Play together

| Pet it | High five | Open a gift |
| :---: | :---: | :---: |
| <img src="docs/readme/media/pat.gif" width="160" alt="The hamster enjoys a pat"> | <img src="docs/readme/media/highfive.gif" width="160" alt="The hamster gives a high five"> | <img src="docs/readme/media/gift.gif" width="160" alt="The hamster opens a gift box"> |
| A gentle pat while it rests | Tap its paw after a reply | Earned by working together |

## Features

- **Time together.** Every tool's menu shows how long you've worked with it today and in total. Snacks and gifts come from that time, not from how many tokens you spend.
- **Token usage** for Codex, Claude Code, Grok and Gemini CLI (experimental), read only from the records each tool already keeps on your Mac.
- **A wardrobe.** 40 accessories for the head, face and neck, with saved outfits.
- **No accounts, no ads, no tracking.** The only network request is the update check.
- Korean and English.

## Install

1. Download `Hamster-<version>.zip` from the [latest release](https://github.com/fbwndrud/hamster/releases/latest). Check the SHA-256 on the release page:
   ```sh
   shasum -a 256 ~/Downloads/Hamster-<version>.zip
   ```
2. Unzip it and move `Hamster.app` to **Applications** before opening it. Opening it from Downloads breaks updates.
3. Hamster is not signed with an Apple Developer ID, so macOS blocks the first launch. Open it once, then go to **System Settings → Privacy & Security** and click **Open Anyway**. The button appears for about an hour after you try to open the app.
4. Open the hamster menu in the menu bar and choose **AI Connection** to connect your tools.

Prefer not to run a downloaded binary? [Build it yourself](#build-from-source).

## What it changes on your Mac

Connecting a tool adds a Hamster entry to that tool's user config. **AI Connection → [tool] → Remove Hamster Hooks** takes it out again.

| Tool | File | Hook events |
| --- | --- | --- |
| Codex | `~/.codex/hooks.json` | `UserPromptSubmit`, `Stop`, `Interrupt` |
| Claude Code | `~/.claude/settings.json` | `UserPromptSubmit`, `Stop`, `StopFailure`, `SessionEnd` |
| Cursor Agent | `~/.cursor/hooks.json` | `beforeSubmitPrompt`, `stop`, `sessionEnd` |
| Gemini CLI | `~/.gemini/settings.json` | `BeforeAgent`, `AfterAgent`, `SessionEnd` |
| Grok | `~/.grok/hooks/hamster.json` | `UserPromptSubmit`, `Stop`, `StopFailure`, `StopCancelled`, `SessionEnd`, `Notification` (`idle_prompt`) |

Grok also runs the Claude Code and Cursor hook files. The helper ignores those calls, so Grok work is counted once, as Grok.

The hook helper ([`codex-hook.swift`](desktop-pet/codex-hook.swift)) sends only the event type and a hashed turn ID to a local socket. Install logic is in [`codex-install.cjs`](desktop-pet/codex-install.cjs).

Settings and rewards are stored in `~/Library/Application Support/Codex Hamster/`.

## Privacy

- Hamster does not read what you type. For typing reactions it reads only whether the system is active.
- For token usage, it reads the token counts from each connected tool's records on this Mac (`~/.codex/sessions`, `~/.claude/projects`, `~/.gemini/tmp/*/chats`, `~/.grok/sessions/*/*/usage.json`). Those records also contain your prompts and code; Hamster keeps only the counts, in a local cache, and never sends them anywhere. To notice when you stop a Claude Code turn, it also checks the end of that session's transcript for the interrupt marker. Cursor keeps no token counts locally, so it shows time only.
- The only network request is the update check: a plain HTTPS request for `latest.json` from this repository's releases, at launch and every 12 hours. It carries no identifiers.

## Updates

When a new release is available, the menu shows **Install Update**. Nothing is downloaded until you click it. The app then downloads the release, checks that its manifest carries a valid Ed25519 signature from the key built into the app and that the file matches the signed SHA-256 and size, and only then replaces itself. If the new version fails to start, it rolls back.

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

- Bugs and ideas: [Issues](https://github.com/fbwndrud/hamster/issues). Use **Copy Diagnostics** in the menu and paste it into the report.
- Security problems: report privately, see [SECURITY.md](SECURITY.md).
- Pull requests are not accepted yet; see [CONTRIBUTING.md](CONTRIBUTING.md).

## Support

Hamster is free. If it made your day a little nicer, you can [buy me a coffee on Ko-fi](https://ko-fi.com/junelyoo). There are no rewards for supporting; it just helps me keep building.

## License

- Code: [MIT](LICENSE).
- Artwork (the hamster, its animations, accessories, and icons): **not** MIT. You may use and personally modify it within Hamster, but not redistribute or sell it. See [ASSETS-LICENSE.md](ASSETS-LICENSE.md).

