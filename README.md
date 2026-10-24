# 🎙️ StoryCast AI

<p align="center">
  <strong>Turn web novels into high-quality audiobooks with natural-sounding AI voices.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16.2-black?style=flat-square&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19-blue?style=flat-square&logo=react" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat-square&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/TailwindCSS-v4-38B2AC?style=flat-square&logo=tailwind-css" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Node.js-%3E%3D22.13-339933?style=flat-square&logo=node.js" alt="Node.js" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License" />
</p>

---

## 🌟 Overview

**StoryCast AI** is an open-source tool that automates turning online novels into audiobooks. It scrapes each chapter, cleans up the text, reads it aloud with an expressive AI voice, plays it in a built-in web player, and can export the whole story as a single **.m4b** audiobook file.

Completely **free** — no account sign-up and no third-party API key required!

---

## ✨ Features

- 🕷️ **Smart Scraper:**
  - Just paste a story link (the story's main page or chapter 1).
  - Automatically extracts chapter content using `@mozilla/readability` and `jsdom`.
  - Works with both Vietnamese novel sites (TruyenFull, Tangthuvien...) and Chinese ones (69shu, Biquge...).
  - Automatically finds the *"Next chapter"* button (`Chương sau`, `下一章`) and strips noise, ads and anti-copy characters.
- 🌏 **Chinese → Vietnamese translation (free):**
  - Paste a link from PO18 or any Chinese novel site and pick how to translate it:
    - **Convert (default):** the classic Vietnamese "convert" style — longest-match lookup in the community VietPhrase dictionaries, with character names in Hán Việt (林浅 → *Lâm Thiển*). Traditional Chinese is simplified first (OpenCC) so it matches the dictionaries. Runs offline after a one-time ~60 MB dictionary download into `data/dict/`.
    - **Google Dịch:** smoother sentences, but names come out in pinyin (*Lin Qian*).
    - **Không dịch:** keep the original and use the Chinese voice.
  - The story title, chapter titles and full chapter text are translated, then read by the Vietnamese voice. Vietnamese stories are left untouched.
- 🌐 **Browse Chinese sites in Vietnamese (Đọc web):**
  - Open **Đọc web** in the sidebar and paste any PO18 link — home page, rankings, a book page or a chapter.
  - The whole page is converted to Vietnamese (same Convert engine, names in Hán Việt), and every link inside it opens converted too, so you can browse the site in Vietnamese.
  - Each book or chapter page gets a **🎧 Tạo audio truyện này** button that opens *Thêm truyện* with the link filled in.
  - The site's scripts are removed and the page is served with `script-src 'none'`, so nothing from the site runs inside StoryCast. Search forms that use POST (like PO18's) are not supported.
- 🎙️ **Natural multilingual AI voices (Neural TTS):**
  - **Automatic language detection:** detects Vietnamese or Chinese from the chapter text.
  - **Vietnamese:** the expressive **Hoài My (`vi-VN-HoaiMyNeural`)** voice.
  - **Chinese:** the smooth novel-reading **Xiaoxiao (`zh-CN-XiaoxiaoNeural`)** voice.
  - Completely free, no character limits, and no API key needed.
  - Smart paragraph/sentence chunking that understands both Latin and CJK punctuation (`。！？；`).
- 🎧 **Built-in Web Player:**
  - Remembers which chapter you were on and the exact second you stopped.
  - Automatically moves on to the next chapter when one finishes.
  - Adjustable playback speed (`0.75x` to `2.0x`).
- 📦 **Full audiobook export:**
  - Download individual chapters as `.mp3`.
  - Package the whole story into **one `.m4b` file** with chapter markers, compatible with Apple Books, Smart AudioBook Player, Voice, and more.
- ⚙️ **Background Worker:**
  - A background queue processes chapters one by one without freezing the UI.
  - Real-time progress tracking.
- 🗄️ **Zero-Config Database:**
  - Uses the SQLite built into Node.js (`node:sqlite`) — no database server to install.

---

## 🛠️ Tech Stack

| Layer | Technology / Library |
|---|---|
| **Framework** | [Next.js 16](https://nextjs.org/) (App Router), [React 19](https://react.dev/) |
| **Language** | [TypeScript 5](https://www.typescriptlang.org/) |
| **UI** | [Tailwind CSS v4](https://tailwindcss.com/), Radix UI, React Icons |
| **State management** | [Zustand](https://zustand-demo.pmnd.rs/) |
| **Text-to-Speech** | [msedge-tts](https://github.com/schroffl/msedge-tts) |
| **Parser & Scraper** | `@mozilla/readability`, `jsdom` |
| **Database** | `node:sqlite` (native SQLite in Node.js) |
| **Audio processing** | `ffmpeg` |

---

## 📋 Requirements

You need **two** things installed before you start:

### 1. Node.js `>= 22.13.0` (required)

Node.js provides the `node` and `npm` commands used in every step below, and version 22.13+ is required for `node:sqlite`.

First, check whether you already have it:

```bash
node -v
```

- If it prints `v22.13.0` or higher, you're good — skip to step 2.
- If it prints **`command not found`**, or a version lower than `v22.13.0`, install Node.js first using **one** of the options below.

**Linux / macOS — using nvm (recommended, works on any distro):**
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
# close and reopen your terminal, then:
nvm install 22
```

**Ubuntu / Debian — using apt:**
```bash
sudo apt install nodejs npm -y
node -v   # must be v22.13.0 or higher
```
> ⚠️ The Node.js version in apt depends on your Ubuntu/Debian release. Older releases (e.g. Ubuntu 22.04 / 24.04) ship a version that is too old — if `node -v` shows lower than `v22.13.0`, remove it and use nvm instead.

**macOS — using Homebrew:**
```bash
brew install node
```

**Windows:**
```powershell
winget install OpenJS.NodeJS.LTS
```
Or download the **LTS** installer from [nodejs.org](https://nodejs.org/). Reopen your terminal after installing.

Verify the installation before continuing:
```bash
node -v   # v22.13.0 or higher
npm -v
```

### 2. ffmpeg

Needed to merge chapters into a `.m4b` file.

- **Ubuntu/Debian:** `sudo apt install ffmpeg -y`
- **macOS:** `brew install ffmpeg`
- **Windows:** `winget install Gyan.FFmpeg` or via Chocolatey.

---

## 🚀 Installation & Running

> Make sure `node -v` works (see [Requirements](#-requirements)) before running these steps. Without Node.js, every `npm` command fails with `npm: command not found` and nothing will be running at `localhost:3000`.

### 1. Get the source code
```bash
git clone https://github.com/mochihat/storycast-ai.git
cd storycast-ai
```

### 2. Install dependencies
```bash
npm install
```

### 3. Run in development mode
```bash
npm run dev
```
Wait until the terminal shows `✓ Ready`, then open **[http://localhost:3000](http://localhost:3000)** in your browser.

Keep this terminal open — closing it (or pressing `Ctrl+C`) stops the server.

### 4. Build and run in production mode (recommended)
For smoother performance and lower memory usage:
```bash
npm run build
npm start
```

---

## 🩺 Troubleshooting

| Symptom | Cause & fix |
|---|---|
| `node: command not found` / `npm: command not found` | Node.js isn't installed. Follow [Requirements → Node.js](#1-nodejs--22130-required), then run `npm install` again. |
| Browser says *"This site can't be reached"* at `localhost:3000` | The server isn't running. Check the terminal where you ran `npm run dev` for an error, and make sure it shows `✓ Ready`. |
| `No such built-in module: node:sqlite` | Your Node.js is older than 22.13. Upgrade it (e.g. `nvm install 22`). |
| `Port 3000 is in use` | Another app is using port 3000. Stop it, or open the alternative port Next.js prints in the terminal. |
| `ExperimentalWarning: SQLite is an experimental feature` | Just a warning, not an error — the app works normally. |
| The first Chinese story takes ~30 s to start | The convert dictionaries (~60 MB) are being downloaded into `data/dict/`. Later stories start in a few seconds. They also use ~250 MB of RAM while the server runs. |
| Weird errors after `npm install` failed earlier | Delete the `node_modules` folder and run `npm install` again. |

---

## 📖 Usage

1. **Add a story:**
   - Paste the URL of chapter 1 or the story's main page (e.g. from popular sites like `truyenfull`).
   - Enter how many chapters you want to turn into audio.
2. **Track progress:**
   - The background worker scrapes and converts each chapter in turn.
   - Each chapter's status switches to ready as soon as it's done.
3. **Listen:**
   - Play directly from the Player bar at the bottom of the page.
   - Download individual `.mp3` chapters, or click **Tải cả quyển (.m4b)** (download the whole book) to listen offline on your phone.

---

## 📂 Project Structure

```text
storycast-ai/
├── app/                  # Next.js App Router (UI & API endpoints)
│   ├── api/              # API routes for stories, audio and downloads
│   └── page.tsx          # Main dashboard page
├── components/           # UI components (Player, Sidebar, Cover...)
├── data/                 # Local storage (gitignored)
│   ├── storycast.db      # SQLite database
│   └── audio/            # Generated mp3 files, grouped by story ID
├── lib/                  # Core logic
│   ├── book.ts           # Builds the m4b file and chapter metadata with ffmpeg
│   ├── db.ts             # node:sqlite connection and queries
│   ├── scraper.ts        # Chapter extraction and anti-copy cleanup
│   ├── convert.ts        # VietPhrase "convert" with Hán Việt names
│   ├── drm.ts            # Sec-MS-GEC v2 token required by Edge TTS
│   ├── translate.ts      # Chooses convert or Google Translate
│   ├── webpage.ts        # Converts a whole web page and routes its links back through StoryCast
│   ├── tts.ts            # Edge TTS connection and text chunking
│   └── worker.ts         # Background processing queue
├── types.ts              # TypeScript type definitions
└── public/               # Static assets
```

---

## 💾 Data & Backup

All data created while using the app lives in the `data/` folder:
- `data/storycast.db`: the story list, chapter info and chapter text.
- `data/audio/<story_id>/`: the `.mp3` audio files for each chapter.

> 💡 **Tips:**
> - To **back up:** just copy the `data/` folder.
> - To **reset everything:** stop the server and delete the `data/` folder.

---

## 🌐 Supported Sites

- Tested and optimized for: **TruyenFull**, **Wattpad**.
- **PO18 (po18.tw):** every book page requires a logged-in account, so StoryCast uses your own browser session:
  1. Log in at [po18.tw](https://www.po18.tw) in your browser.
  2. Open DevTools (F12) → **Network**, reload the page, click the first request and copy the whole value of the `Cookie` request header.
  3. Create a file `.env.local` in the project folder containing `PO18_COOKIE=<the value you copied>`, then restart the server.
  4. Paste the book link (`https://www.po18.tw/books/<id>`) or a chapter link (`.../books/<id>/articles/<id>`).
  - Only chapters your account can read (free chapters, or paid chapters you have bought) can be fetched.
- Other sites: StoryCast uses smart content detection (`Readability`) and automatically looks for *"Next chapter"* links, so most novel sites with standard HTML structure work well.
- *Note:* Sites that require logging in, or that load content through complex client-side JavaScript, may not be extractable.

---

### Dictionaries used by Convert

- VietPhrase, Name, Pronouns and ChinesePhienAmWords from [ducbui0/tong-hop-tu-dien](https://github.com/ducbui0/tong-hop-tu-dien) — community QuickTranslator dictionaries; no license is stated.
- Traditional → simplified table `TSCharacters.txt` from [OpenCC](https://github.com/BYVoid/OpenCC) (Apache-2.0).

Both are pinned to a specific commit in `lib/convert.ts` and downloaded at runtime; they are not part of this repository.

---

## ⚖️ Disclaimer

- This project is built for **learning, research and personal listening**.
- Please respect the rights of authors, translators and the websites that publish the stories.
- Voices are provided by the public Microsoft Edge TTS service; please follow Microsoft's terms of service.

---

## 📄 License

Distributed under the **[MIT License](LICENSE)**.
