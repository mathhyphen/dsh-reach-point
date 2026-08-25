# dsh-reach-point

<p align="center">
  <img src="./docs/rail-preview.svg" alt="dsh-reach-point installed preview" width="720">
</p>

A lightweight input navigator for DeepSeek Harness (DSH) Web. It follows Codex's visual language: thin marks beside the left edge of the conversation, a longer dark mark for the current reading position, and a rounded preview card to the right on hover or keyboard focus.

The Host reads the complete input history from the attached session log. The Web half uses page anchors to determine which messages are loaded and only asks DSH to “load older” when an unloaded mark is selected; opening a conversation never expands all history up front.

## Features

- Click-to-jump with a short target highlight
- Wheel navigation while the pointer is over the rail
- Arrow, Home, End, Enter, and Space keyboard controls
- Every input remains reachable in long sessions; the rail scrolls independently
- Automatic DSH light/dark theme matching, responsive hiding, and reduced-motion support

## Install

Link the current directory directly:

```powershell
dsh plugin --profile web add link:/path/to/dsh-reach-point
```

For another location, use `dsh plugin --profile web add link:/absolute/path/to/dsh-reach-point`. Restart `dsh web`, then refresh the browser page.

Choose either `dsh-reach-point` or `dsh-node-nav`; do not install both because they inject overlapping navigation UI.

## Uninstall

Run `dsh plugin --profile web remove dsh-reach-point`, restart `dsh web`, and refresh the page.

## Host API

The Host registers `GET /plugins/dsh-reach-point/api/users?sessionId=<id>`. It returns genuine user inputs from attached session logs as `{ users: [{ id, seq, time, text }] }`; text blocks are joined by newlines and images become `[图片]`. Unknown or unattached sessions return an empty list, and the Web half falls back to the current page's DOM anchors.

This is a dependency-free, no-build ESM package. Run `npm test` and `npm run check` to verify it.
