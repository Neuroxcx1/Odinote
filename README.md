<div align="center">

<img src="App/Icon/Icon.png" width="110" alt="Odinote logo" />

# Odinote

**A free, open-source infinite canvas for people whose ideas don't fit on one screen.**

Nested boards, unlimited notes, offline-first. A [Milanote](https://odinote-web.vercel.app/milanote-alternative.html) and [Miro](https://odinote-web.vercel.app/miro-alternative.html) alternative with no card limit and no subscription.

[**▶ Try it in your browser**](https://odinote-web.vercel.app/#try-web) · [**⬇ Download for Windows**](https://github.com/Neuroxcx1/Odinote/releases/latest) · [**📖 User guide**](https://odinote-web.vercel.app/guide.html) · [**🌐 Website**](https://odinote-web.vercel.app)

![License](https://img.shields.io/badge/license-MIT-90B968?style=flat-square)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Web-595459?style=flat-square)
![Price](https://img.shields.io/badge/price-free%20forever-E6544F?style=flat-square)
![Stars](https://img.shields.io/github/stars/Neuroxcx1/Odinote?style=flat-square&color=F7DA84)

</div>

<!--
  ⬇ SCREENSHOT / GIF GOES HERE ⬇
  This is the single most important element on this page for converting visitors.
  Edit this file in the GitHub web editor and drag a PNG or GIF right into it —
  GitHub uploads it and generates the link for you. A short GIF (5-10s) showing
  nodes being dragged onto the canvas and a nested board being opened works best.
-->

---

## Why Odinote exists

Visual canvas tools are wonderful for planning games, novels and creative projects — but the popular ones cap how much you can create (Milanote stops at 100 notes, Miro at 3 editable boards), lock the useful parts behind subscriptions, or keep your work in their cloud.

Odinote was built by one developer who kept hitting those ceilings while organising game design documents, art references and task boards. It has the same spatial feel, none of the limits, and your files stay on your machine.

## What makes it different: real recursion

A board in Odinote isn't a folder — it's a **complete canvas**, and any canvas inside it can hold more boards, forever.

```
Root canvas — pitch, core loop, roadmap
└── Art board
    └── Characters board
        └── Mood board per character  →  and deeper, as far as you need
```

Breadcrumbs always show where you are, so you never lose context and never run out of space.

## Features

| | |
|---|---|
| 🌀 **Nested canvases** | Boards inside boards, infinitely recursive |
| 🧩 **16+ node types** | Notes, to-dos, documents, images, audio, links, tables, calendars, columns, frames, comments, colour palettes |
| ↗ **Connectors** | Link any two nodes — curved or right-angle routing, labels and styles |
| 🔒 **Offline & private** | No account required; data lives on your device |
| ☁️ **Optional sync** | Put a workspace online and it syncs through **your own** Google Drive — no server of ours involved |
| 🎨 **Themes & polish** | Dark mode, per-canvas backgrounds, snapping guides, interface sounds |
| 🌍 **11 languages** | English, Spanish, French, German, Italian, Portuguese, Chinese, Japanese, Korean, Arabic, Russian |
| 💾 **Own your data** | Local vault folders with real media files, plus JSON export/import |

## Install

### Windows

Download the latest installer or portable ZIP from the [**Releases page**](https://github.com/Neuroxcx1/Odinote/releases/latest), run it, and you're done.

### Web

No installation, nothing to sign up for: **[odinote-web.vercel.app](https://odinote-web.vercel.app/#try-web)**

### Run from source

```bash
git clone https://github.com/Neuroxcx1/Odinote.git
cd Odinote/App
npm install
npm start
```

Build a Windows executable with `npm run build:exe`, or an installer with `npm run build:installer`.

## Tech

Electron + React, with JSX transpiled in the browser — no bundler, no build step for the web version. Google Drive integration uses Google's official APIs directly from your device; sign-in uses Firebase Authentication for accounts only. Your note content never touches a server we control.

## Contributing

Issues and pull requests are genuinely welcome — bug reports especially.

- 🐞 [Report a bug](https://github.com/Neuroxcx1/Odinote/issues)
- 💡 [Suggest a feature or ask a question](https://github.com/Neuroxcx1/Odinote/discussions)
- ☕ [Support development on Ko-fi](https://ko-fi.com/neuroxcx)

If Odinote is useful to you, a ⭐ on the repo genuinely helps other people find it.

## License

MIT — see [LICENSE](App/LICENSE). Free to use, copy, modify and distribute.

Project icons are [Fluent Emoji](https://github.com/microsoft/fluentui-emoji) (© Microsoft, MIT); interface icons are [Material Symbols](https://fonts.google.com/icons) (Apache 2.0).
