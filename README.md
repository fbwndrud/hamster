# Hamster

English | [한국어](docs/readme/README.ko.md)

A small hamster that lives at the bottom of your Mac screen and keeps you company while your AI coding tools work.

When you send a request, its ears perk up. While the AI works, it taps its paws. When the reply lands, it tilts its head. Between tasks it blinks, sniffs, and looks around. Spend time working together and it earns snacks, gifts, and outfits you can dress it in.

## Features

- Reacts to Codex, Claude Code, Cursor Agent, Gemini CLI, and Grok through their hook systems.
- Shows time worked together with each tool, and token usage for Codex, Claude Code, Gemini CLI (experimental), and Grok.
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

