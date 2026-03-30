# Job Auto-Filler — Chrome Sidebar Extension

A Chrome extension that opens in the browser's **side panel**, lets you upload your resume (PDF/DOCX), extracts your data using an LLM, and **auto-fills job application forms** in seconds.

## Features

- **Side Panel UI** — Always accessible while browsing job boards
- **Multi-LLM Support** — OpenAI, Anthropic Claude, Google Gemini, Groq, or custom endpoint
- **Resume Parsing** — Upload PDF/DOCX, AI extracts name, email, experience, education, skills
- **Saved Fields** — Store repetitive data (college, roll number, GPA) that fills instantly without AI
- **Smart Matching** — Fuzzy alias matching maps your data to any form field
- **Auto-Fill** — One click fills all detected fields with realistic input events
- **Supported Boards** — LinkedIn, Greenhouse, Lever, Google Forms, Workday, Ashby + generic fallback
- **Dark Mode** — Toggle light/dark themes
- **Privacy First** — All data stays local, no backend server

## Installation

1. Clone or download this folder
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** and select the `job-auto-filler` folder
5. The extension icon appears in your toolbar

> **Important:** You need to generate PNG icons before loading. Open `assets/icons/icon.svg` and convert to 16x16, 32x32, 48x48, and 128x128 PNGs named `icon16.png`, `icon32.png`, `icon48.png`, `icon128.png`.

## Usage

1. Click the extension icon to open the side panel
2. Select your LLM provider and enter your API key
3. Upload your resume (PDF or DOCX, max 5MB)
4. Click **Extract Resume Data** — AI parses and shows your profile
5. Review and edit extracted data in the **Profile** tab
6. Add repetitive fields (college name, roll no) in the **Saved** tab
7. Navigate to a job application page
8. Click **Auto-Fill Now** — all fields get filled!

## Project Structure

```
job-auto-filler/
├── manifest.json              # Chrome extension manifest (MV3)
├── background/
│   └── service-worker.js      # Background worker: LLM calls, message routing
├── sidepanel/
│   ├── index.html             # Side panel UI
│   ├── styles.css             # Complete stylesheet
│   └── app.js                 # UI logic: tabs, upload, profile, saved fields
├── content/
│   ├── events.js              # Input event simulation (React-compatible)
│   ├── detector.js            # DOM field detection + board-specific detectors
│   └── filler.js              # Auto-fill orchestration
├── lib/
│   ├── storage.js             # chrome.storage.local helpers
│   ├── pdf-parser.js          # PDF text extraction via pdf.js
│   ├── saved-fields.js        # Saved fields manager with templates
│   ├── alias-matcher.js       # Fuzzy alias matching engine
│   └── field-mapper.js        # Field label → profile key mapper
└── assets/
    └── icons/                 # Extension icons
```

## Saved Fields (No LLM Needed)

The **Saved** tab lets you store repetitive data that appears on every application:

| Field | Example | Auto-matches |
|---|---|---|
| College | NIT Rourkela | "university", "institute", "college name" |
| Roll No | 122BM0243 | "roll number", "student id", "enrollment no" |
| GPA | 8.5 | "cgpa", "grade", "percentage" |
| Grad Year | 2026 | "graduation year", "batch", "year of passing" |

These fields are matched using fuzzy alias matching and fill **instantly** — no API call required.

## Tech Stack

- **Chrome Extension Manifest V3**
- **Vanilla JS** — No framework, fast and lightweight
- **pdf.js** — Client-side PDF parsing
- **LLM APIs** — OpenAI, Anthropic, Gemini, Groq
- **Chrome Side Panel API** — Native sidebar integration

## License

MIT
