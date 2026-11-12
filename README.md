<div align="center">

<img src="docs/readme/media/icon.png" width="96" alt="">

# Hamster

**A little hamster that keeps you company at the bottom of your Mac screen while your AI coding tools work.**

[Website](https://hamster-34x.pages.dev/en/) · [Download](https://github.com/fbwndrud/hamster/releases/latest) · [Install](#install) · [Privacy](#privacy) · [한국어](docs/readme/README.ko.md)

![Latest release](https://img.shields.io/github/v/release/fbwndrud/hamster?label=release&color=f2a65a) ![macOS 13+ · Apple Silicon](https://img.shields.io/badge/macOS%2013%2B-Apple%20Silicon-8a6f5a) ![Code: MIT](https://img.shields.io/badge/code-MIT-6b8f71)

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

You need a Mac with Apple silicon (M1 or later) and macOS 13 or later. Intel Macs are not supported.

### 1. Download

Open the [latest release](https://github.com/fbwndrud/hamster/releases/latest) and click `Hamster-<version>.zip` under **Assets**. That zip is the only file you need.

| File on the release page | What it is |
| --- | --- |
| `Hamster-<version>.zip` | The app. Download this one. |
| `Hamster-<version>.zip.sha256` | A checksum, if you want to [check your download](#check-your-download). |
| `latest.json` | Read by the app to find updates. You don't need it. |
| Source code (zip, tar.gz) | Added by GitHub. You don't need it to run the app. |

### 2. Unzip it and move it to Applications

Double-click the zip in **Downloads** to get `Hamster.app`. Drag `Hamster.app` into the **Applications** folder before you open it. If you open it from Downloads, macOS runs it from a temporary read-only copy and updates won't work.

### 3. Open it the first time

Hamster is not signed with a paid Apple Developer ID, so macOS blocks it the first time. You approve it once:

1. Double-click Hamster in Applications. macOS says it couldn't verify the app. Click **Done**, not Move to Trash.
2. Open **System Settings → Privacy & Security** and scroll down to **Security**. You'll see a note that Hamster was blocked.
3. Click **Open Anyway**, enter your Mac password or use Touch ID, and confirm **Open Anyway** in the next dialog.

The hamster appears at the bottom of your screen, with a hamster icon in the menu bar. From then on it opens normally, and updates don't need this step again. On recent macOS, right-click → Open no longer skips it. See [Apple's guide](https://support.apple.com/guide/mac-help/open-a-mac-app-from-an-unknown-developer-mh40616/mac).

### 4. Connect your AI tools

Click the hamster icon in the menu bar and choose **AI Connection → [tool] → Install [tool] Hooks…**. Connect each tool separately. For Codex, also approve the Hamster hooks in Codex's Settings → Hooks. See [what this changes on your Mac](#what-it-changes-on-your-mac).

### If it doesn't open

- **No Open Anyway button.** It shows for about an hour after you try to open the app. Double-click Hamster again, then go back to Privacy & Security.
- **"Hamster is damaged and can't be opened."** This usually means the download was cut off or the zip was unpacked by another tool. Delete it, download the zip again, and unzip it by double-clicking in Finder.
- **"Not supported on this Mac."** This is an Intel Mac. Hamster runs only on Apple silicon.
- **Still blocked.** If you've [checked the download](#check-your-download), you can remove the "downloaded from the internet" mark in Terminal and open it again:
  ```sh
  xattr -dr com.apple.quarantine /Applications/Hamster.app
  ```

### Check your download

Optional. Run this in Terminal and compare the result with the text in `Hamster-<version>.zip.sha256`. If they differ, don't open the app, and tell us in [Issues](https://github.com/fbwndrud/hamster/issues).

```sh
shasum -a 256 ~/Downloads/Hamster-*.zip
```

### Uninstall

1. For each connected tool, choose **AI Connection → [tool] → Remove Hamster Hooks**.
2. Quit Hamster from its menu and move `Hamster.app` to the Trash.
3. Optionally delete `~/Library/Application Support/Codex Hamster/` (settings and rewards) and the `hamster` folder in each tool's config folder, such as `~/.codex/hamster`.

## What it changes on your Mac

Connecting a tool adds a Hamster entry to that tool's user config and leaves your other settings alone. **Remove Hamster Hooks** takes it out again.

| Tool | File | Hook events |
| --- | --- | --- |
| Codex | `~/.codex/hooks.json` | `UserPromptSubmit`, `Stop`, `Interrupt` |
| Claude Code | `~/.claude/settings.json` | `UserPromptSubmit`, `Stop`, `StopFailure`, `SessionEnd` |
| Cursor Agent | `~/.cursor/hooks.json` | `beforeSubmitPrompt`, `stop`, `sessionEnd` |
| Gemini CLI | `~/.gemini/settings.json` | `BeforeAgent`, `AfterAgent`, `SessionEnd` |
| Grok | `~/.grok/hooks/hamster.json` | `UserPromptSubmit`, `Stop`, `StopFailure`, `StopCancelled`, `SessionEnd`, `Notification` (`idle_prompt`) |

Grok also runs the Claude Code and Cursor hook files. The helper ignores those calls, so Grok work is counted once, as Grok.

The hook helper ([`codex-hook.swift`](desktop-pet/codex-hook.swift)) sends only the event type and a hashed turn ID to a local socket. Install logic is in [`codex-install.cjs`](desktop-pet/codex-install.cjs). Settings and rewards are stored in `~/Library/Application Support/Codex Hamster/`.

## Privacy

- Hamster does not read what you type. For typing reactions it reads only whether the system is active.
- For token usage, it reads the token counts from each connected tool's records on this Mac (`~/.codex/sessions`, `~/.claude/projects`, `~/.gemini/tmp/*/chats`, `~/.grok/sessions/*/*/usage.json`). Those records also contain your prompts and code; Hamster keeps only the counts, in a local cache, and never sends them anywhere. To notice when you stop a Claude Code turn, it also checks the end of that session's transcript for the interrupt marker. Cursor keeps no token counts locally, so it shows time only.
- The only network request is the update check: a plain HTTPS request for `latest.json` from this repository's releases, at launch and every 12 hours. It carries no identifiers.

## Updates

When a new release is available, the menu shows **Install Update**. Nothing is downloaded until you click it. The app then downloads the release and replaces itself only after checking that the manifest carries a valid Ed25519 signature and that the file matches the signed SHA-256 and size. If the new version fails to start, it rolls back.

The public key that checks the signature is in [`distribution.cjs`](desktop-pet/distribution.cjs). Only the matching private key can sign a release, and it is never in this repository.

## Feedback

- Bugs and ideas: [Issues](https://github.com/fbwndrud/hamster/issues). Use **Copy Diagnostics** in the menu and paste it into the report.
- Security problems: report privately, see [SECURITY.md](SECURITY.md).
- Pull requests are not accepted yet; see [CONTRIBUTING.md](CONTRIBUTING.md).

## Support

Hamster is free. If it made your day a little nicer, you can [buy me a coffee on Ko-fi](https://ko-fi.com/junelyoo). There are no rewards for supporting; it just helps me keep building.

## License

- Code: [MIT](LICENSE).
- Artwork (the hamster, its animations, accessories, and icons): **not** MIT. You may use and personally modify it within Hamster, but not redistribute or sell it. See [ASSETS-LICENSE.md](ASSETS-LICENSE.md).

Prefer to build it yourself? See [Building from source](docs/building.md).
