# CurioSphere — Complete Project Structure Guide

**Product name (UI):** CurioSphere  
**Repository / folder name:** `smartlearn`  
**Document purpose:** PDF / viva / report — har folder, har important file, language, aur kaam  

**Live URLs:**  
- https://curiosphere-xi.vercel.app  
- https://smartlearn-xi.vercel.app (legacy alias)  

**GitHub:** https://github.com/puskar004/smartlearn  

---

## 1. Project ek nazar mein

| Item | Detail |
|------|--------|
| Type | Full-stack web application (MVP / working prototype) |
| Users | CBSE Class 10–12 **students** + **teachers** |
| Architecture | **Next.js App Router** — frontend + backend **same repo** |
| Hosting | **Vercel** (serverless Node.js) |
| Auth | **Clerk** (email OTP) |
| AI | **Google Gemini** |
| File storage | **Supabase Storage** (+ free-host / Blob fallbacks) |
| Primary languages | **TypeScript**, **TSX (React)**, **CSS**, **JSON**, **Markdown**, **Shell** |

### Language map (poori codebase)

| Language / format | Extension | Kahan use |
|-------------------|-----------|-----------|
| **TypeScript** | `.ts` | Backend APIs, `lib/` business logic, middleware, config |
| **TSX (TypeScript + React)** | `.tsx` | Pages, UI components, icons |
| **CSS** | `.css` | Global styles (`globals.css`), Tailwind via PostCSS |
| **JSON** | `.json` | `package.json`, `tsconfig.json`, lockfile, env examples |
| **Markdown** | `.md` | Docs, guides, this file |
| **JavaScript (config)** | `.mjs` | ESLint, PostCSS |
| **Shell** | `.sh` | Helper scripts |
| **SVG / PNG / ICO** | images | Logos, favicons, static assets |
| **Worker JS** | `.mjs` (pdf.worker) | PDF.js worker in browser |

**Note:** Browser aur Vercel pe TypeScript **compile hoke JavaScript** ban kar chalta hai. Source code TypeScript/TSX me hai.

---

## 2. Root folder (`/smartlearn` ya project root)

```
smartlearn/
├── app/                 → Pages + API routes (Next.js App Router)
├── components/          → Reusable React UI
├── lib/                 → Business logic, types, stores, integrations
├── public/              → Static files (logos, PDF worker)
├── docs/                → Team / role documentation
├── scripts/             → Shell helpers
├── middleware.ts        → Clerk auth middleware
├── package.json         → Dependencies & npm scripts
├── tsconfig.json        → TypeScript compiler options
├── next.config.ts       → Next.js config
├── postcss.config.mjs   → Tailwind / PostCSS
├── eslint.config.mjs    → Lint rules
├── .env.local.example   → Env variable template (no secrets)
├── .gitignore           → Git ignore list
├── README.md            → Quick start
├── DEV_GUIDELINES.md    → Dev agent rules (Next.js notes)
├── DEV_NOTES.md         → Points to DEV_GUIDELINES
├── PROJECT-STRUCTURE-GUIDE.md  → Yeh document
├── PRESENTATION-BACKEND.md     → Backend viva slides
├── NOTES-PPT-SmartLearn.md     → Pitch / PPT notes
└── (build folders, not source of truth)
    ├── node_modules/    → npm packages (generated)
    ├── .next/           → Next build output (generated)
    ├── .vercel/         → Local Vercel link metadata
    └── .data/           → Local JSON journals (dev machine)
```

### Root files — detail

| File | Language | Purpose |
|------|----------|---------|
| `package.json` | JSON | App name, scripts (`dev`, `build`, `start`, `lint`), dependencies (Next, React, Clerk, Gemini, Supabase, Tailwind, PDF.js, etc.) |
| `package-lock.json` | JSON | Exact dependency versions lock |
| `tsconfig.json` | JSON | TypeScript paths (`@/` → project root), strict options |
| `next.config.ts` | TypeScript | Next.js framework settings |
| `next-env.d.ts` | TypeScript | Auto-generated Next type refs (do not hand-edit much) |
| `postcss.config.mjs` | JavaScript (ESM) | Tailwind CSS v4 pipeline |
| `eslint.config.mjs` | JavaScript (ESM) | Code quality rules |
| `middleware.ts` | TypeScript | Runs on requests; **Clerk** session / protection |
| `.env.local.example` | Env text | Lists required keys (Clerk, Gemini, Supabase…) without real secrets |
| `.env.local` | Env text | **Local secrets** (gitignored) — never commit |
| `.gitignore` | Text | Ignores `node_modules`, `.next`, `.env.local`, etc. |
| `README.md` | Markdown | How to run the project |
| `DEV_GUIDELINES.md` | Markdown | Notes for developers/AI about Next.js version |
| `DEV_NOTES.md` | Markdown | Short pointer to guidelines |
| `PRESENTATION-BACKEND.md` | Markdown | Backend architecture for presentations |
| `NOTES-PPT-SmartLearn.md` | Markdown | Product / pitch notes |
| `PROJECT-STRUCTURE-GUIDE.md` | Markdown | **This file** — folder encyclopedia |

---

## 3. Folder: `app/` — Screens + Backend APIs

**Language:** mostly **TSX** (pages), **TS** (API routes), **CSS** (globals)  
**Framework:** Next.js App Router  

Har subfolder ka `page.tsx` = ek **URL route**.  
`app/api/**/route.ts` = **backend HTTP API**.

### 3.1 Core app shell files

| File | Language | Purpose |
|------|----------|---------|
| `app/layout.tsx` | TSX | Root layout: fonts, **ClerkProvider**, `AppShell`, metadata, viewport |
| `app/globals.css` | CSS | Global theme, body gradients, responsive helpers, card hover, safe-area |
| `app/page.tsx` | TSX | Marketing **landing** page (`/`) |
| `app/icon.tsx` | TSX | Dynamic app icon |
| `app/apple-icon.tsx` | TSX | Apple touch icon |
| `app/favicon.ico` | Binary | Browser favicon |

### 3.2 Student / shared pages (`app/<name>/page.tsx`)

| Folder / route | File | Language | Purpose |
|----------------|------|----------|---------|
| `/dashboard` | `app/dashboard/page.tsx` | TSX | Student home: welcome, XP, feature tiles, ambient UI |
| `/ncert` | `app/ncert/page.tsx` | TSX | NCERT books & chapters browser |
| `/pyq` | `app/pyq/page.tsx` | TSX | Previous year questions |
| `/quiz` | `app/quiz/page.tsx` | TSX | Quiz subject/chapter picker |
| `/quiz/[chapterId]` | `app/quiz/[chapterId]/page.tsx` | TSX | Dynamic quiz for one chapter |
| `/ai-tutor` | `app/ai-tutor/page.tsx` | TSX | Gemini AI tutor chat UI → calls `/api/gemini` |
| `/feynman` | `app/feynman/page.tsx` | TSX | Feynman “explain” mode + scoring |
| `/flowchart` | `app/flowchart/page.tsx` | TSX | Chapter revision flowchart generator |
| `/blueprint` | `app/blueprint/page.tsx` | TSX | Study plan / blueprint |
| `/mistakes` | `app/mistakes/page.tsx` | TSX | Mistake vault / weak areas |
| `/news` | `app/news/page.tsx` | TSX | Exam / edu news |
| `/join-class` | `app/join-class/page.tsx` | TSX | Join teacher class code, materials/PDFs, leave class |
| `/live-class` | `app/live-class/page.tsx` | TSX | Student live class / Meet join |
| `/test` | `app/test/page.tsx` | TSX | **Proctored live test** (student exam UI) |
| `/remarks` | `app/remarks/page.tsx` | TSX | Teacher remarks for student |
| `/common-room` | `app/common-room/page.tsx` | TSX | Peer Q&A room |
| `/safe-search` | `app/safe-search/page.tsx` | TSX | Education-filtered YouTube search |
| `/study-music` | `app/study-music/page.tsx` | TSX | Study music player page |
| `/extreme` | `app/extreme/page.tsx` | TSX | Extreme focus / lock mode |
| `/profile` | `app/profile/page.tsx` | TSX | Settings, role, eye-focus toggle |
| `/support` | `app/support/page.tsx` | TSX | Help / support form |
| `/parent` | `app/parent/page.tsx` | TSX | Parent-related view |
| `/login` | `app/login/page.tsx` | TSX | Login entry |
| `/sign-in` | `app/sign-in/[[...sign-in]]/page.tsx` | TSX | Clerk sign-in (catch-all) |
| `/sign-up` | `app/sign-up/[[...sign-up]]/page.tsx` | TSX | Clerk sign-up (catch-all) |

### 3.3 Teacher pages

| Folder / route | File | Language | Purpose |
|----------------|------|----------|---------|
| `/teacher` | `app/teacher/page.tsx` | TSX | Teacher hub: class code, students, materials, live, attendance, remarks |
| `/teacher/test` | `app/teacher/test/page.tsx` | TSX | Create/manage live tests, scores, proctor snaps |

### 3.4 Backend APIs — `app/api/`

**Language:** **TypeScript** (`route.ts`)  
**Pattern:** `export async function GET/POST` → JSON response  
**Auth:** mostly `auth()` from `@clerk/nextjs/server`

| Path | File | Purpose |
|------|------|---------|
| `/api/classroom` | `app/api/classroom/route.ts` | Main classroom API: create/join/leave/delete class, live start/end, attendance, remarks, sync, materials actions |
| `/api/classroom/material` | `app/api/classroom/material/route.ts` | Teacher **PDF upload** |
| `/api/classroom/notes` | `app/api/classroom/notes/route.ts` | Student **notes list** (journal + Supabase index) |
| `/api/classroom/pdf` | `app/api/classroom/pdf/route.ts` | PDF serve / related helpers |
| `/api/tests` | `app/api/tests/route.ts` | Live tests: create, join, submit, moments, teacher list |
| `/api/tests/convert` | `app/api/tests/convert/route.ts` | Paper/image → MCQ via Gemini |
| `/api/gemini` | `app/api/gemini/route.ts` | AI tutor answers |
| `/api/flowchart` | `app/api/flowchart/route.ts` | Chapter flowchart generation |
| `/api/common-room` | `app/api/common-room/route.ts` | Common room posts |
| `/api/support` | `app/api/support/route.ts` | Support messages |
| `/api/edu-news` | `app/api/edu-news/route.ts` | Education news feed |
| `/api/youtube-edu` | `app/api/youtube-edu/route.ts` | Safe education YouTube search |
| `/api/pdf-proxy` | `app/api/pdf-proxy/route.ts` | Proxy allowed PDF URLs |
| `/api/parent-alert` | `app/api/parent-alert/route.ts` | Parent alert hooks (optional / limited use) |

---

## 4. Folder: `components/` — Reusable UI

**Language:** **TSX (React)** + client hooks (`"use client"` where needed)  
**Imported by:** `app/layout` via `AppShell`, and individual pages.

| File | Language | Purpose |
|------|----------|---------|
| `AppShell.tsx` | TSX | App chrome: sidebar/topbar vs marketing, grade gate, locks, eye focus mount |
| `AppSidebar.tsx` | TSX | Left nav (desktop icon rail + hover expand); student/teacher links |
| `AppTopBar.tsx` | TSX | Top bar: search, notifications, streak/XP, profile |
| `MobileBottomNav.tsx` | TSX | Phone bottom tab navigation |
| `SiteHeader.tsx` | TSX | Marketing site header / menus |
| `NavAuth.tsx` | TSX | Clerk sign-in/out UI widget |
| `RoleGate.tsx` | TSX | Restrict routes by student/teacher role |
| `GradeGate.tsx` | TSX | Force grade selection for students |
| `UserBootstrap.tsx` | TSX | Initial user/progress bootstrap |
| `StudentSync.tsx` | TSX | Background sync of student progress + deleted class cleanup |
| `TaskChecklist.tsx` | TSX | Floating study checklist on dashboard |
| `MarkdownAnswer.tsx` | TSX | Renders AI answers as Markdown |
| `FlowchartView.tsx` | TSX | Draws chapter flowchart cards + exam bullets |
| `PdfReaderModal.tsx` | TSX | Modal shell to open class PDFs |
| `PdfJsViewer.tsx` | TSX | PDF.js-based in-app PDF viewer |
| `MeetFrame.tsx` | TSX | Embed / open Google Meet style frame |
| `TestProctor.tsx` | TSX | Exam proctor: camera, mic, screen share, snaps, face alerts |
| `FocusLock.tsx` | TSX | Tab-switch detection during tests |
| `FullscreenGate.tsx` | TSX | Require browser fullscreen before exam answers |
| `SessionLock.tsx` | TSX | Session lock chrome during live test |
| `ExtremeLock.tsx` | TSX | Extreme mode navigation lock |
| `EyeFocusGuard.tsx` | TSX | Study-time camera focus / away detection + beep |
| `HeroIllustration.tsx` | TSX | Landing hero illustration layout |
| `GlobalMusicPlayer.tsx` | TSX | Floating study music player |

---

## 5. Folder: `lib/` — Core logic (brain of the app)

**Language:** **TypeScript (`.ts`)**  
**Used by:** API routes + sometimes client imports (stores, pure helpers).  
**Rule of thumb:** heavy server secrets stay in `*-server.ts` / API-only imports.

### 5.1 Types & utilities

| File | Language | Purpose |
|------|----------|---------|
| `classroom-types.ts` | TS | Shared types: Classroom, materials, live session, remarks, attendance |
| `flowchart-types.ts` | TS | Flowchart node/edge types |
| `utils.ts` | TS | Small helpers (e.g. `cn()` className merge) |
| `dates.ts` | TS | Date formatting helpers |
| `display-name.ts` | TS | Safe display name from Clerk user |
| `plain-math.ts` | TS | Convert LaTeX/`$...$` formulas to readable Unicode text |

### 5.2 Auth / role / client stores

| File | Language | Purpose |
|------|----------|---------|
| `clerk-appearance.ts` | TS | Clerk UI theme/branding (CurioSphere) |
| `clerk-meta-cache.ts` | TS | Cache Clerk metadata; reduce rate limits |
| `teacher-store.ts` | TS | Client helpers: role, joined classes, left-class blocklist, API wrappers (`apiJoin…`) |
| `user-store.ts` | TS | localStorage progress: XP, streak, mistakes, grade |
| `role-events.ts` | TS | Browser events when role changes |
| `pending-role.ts` | TS | Pending role selection helpers |
| `eye-focus-store.ts` | TS | Persist eye-focus on/off |
| `notifications.ts` | TS | In-app notification list (localStorage) |
| `student-materials.ts` | TS | Student PDF dismiss / visibility helpers |
| `tasks.ts` | TS | Study tasks / checklist logic |

### 5.3 Classroom, live, materials (server-heavy)

| File | Language | Purpose |
|------|----------|---------|
| `classroom-server.ts` | TS | **Main classroom backend logic**: create/join/leave/delete class, live, attendance, remarks, materials attach |
| `class-code-index.ts` | TS | Shared index: code→teacher, live payload, **deleted codes**, materials pointers |
| `class-materials-journal.ts` | TS | Append-only materials journal per class code |
| `class-materials-public.ts` | TS | Public materials listing helpers |
| `materials-bank-store.ts` | TS | Materials bank storage |
| `material-files.ts` | TS | Save uploaded PDF buffer (Supabase first, then fallbacks) |
| `live-attendance-journal.ts` | TS | Multi-student live join/leave attendance journal |
| `remarks-store.ts` | TS | File/memory backup of student remarks |
| `remote-upload.ts` | TS | Upload buffers to Blob / free public hosts |

### 5.4 Supabase

| File | Language | Purpose |
|------|----------|---------|
| `supabase-admin.ts` | TS | Server Supabase client (service role) |
| `supabase-storage.ts` | TS | Upload PDF/image to storage bucket |
| `supabase-materials-index.ts` | TS | `meta/{CODE}.json` catalog + list files under class code |

### 5.5 Tests (live exam)

| File | Language | Purpose |
|------|----------|---------|
| `test-server.ts` | TS | Create/find/list/submit live tests; Clerk light copy |
| `test-durable.ts` | TS | Cross-instance durable test + submission mirror |

### 5.6 Curriculum, quiz, catalogs

| File | Language | Purpose |
|------|----------|---------|
| `curriculum.ts` | TS | Class 10–12 subjects/chapters graph |
| `ncert-books.ts` | TS | NCERT book URL/code mapping |
| `ncert-pdf.ts` | TS | NCERT PDF resolution helpers |
| `pyq-catalog.ts` | TS | PYQ catalog data |
| `quiz-bank.ts` | TS | Quiz questions bank |
| `quiz-engine.ts` | TS | Quiz selection / scoring helpers |
| `quiz-subject.ts` | TS | Subject family filters (Physics vs Chem, etc.) |
| `quiz-maths-12-ch1.ts` | TS | Extra maths chapter question set |
| `media-catalog.ts` | TS | Media / topic tags catalog |
| `spotify-catalog.ts` | TS | Study music catalog entries |
| `flowchart-bank.ts` | TS | Offline detailed flowcharts + generic template |
| `pdf-fetch.ts` | TS | Safe allowlist fetch for PDF hosts |

### 5.7 Proctor / focus / misc

| File | Language | Purpose |
|------|----------|---------|
| `face-presence.ts` | TS | Heuristic face/eyes/phone/empty detection from video frames |
| `proctor-beep.ts` | TS | Browser AudioContext alert beep |
| `fullscreen.ts` | TS | Cross-browser fullscreen helpers |
| `common-room-server.ts` | TS | Common room server helpers |
| `whatsapp.ts` | TS | WhatsApp-related helper stubs/links |

---

## 6. Folder: `public/` — Static assets

**Language:** not code — **images / SVG / worker JS**  
**Served as:** `https://yoursite/filename`

| File | Type | Purpose |
|------|------|---------|
| `curiosphere-logo.svg` | SVG | Main brand logo |
| `smartlearn-logo.svg` / `.png` | SVG/PNG | Legacy logo assets |
| `clerk-logo.png` | PNG | Auth-related image |
| `favicon-32.png` | PNG | Favicon |
| `hero-students.svg` | SVG | Landing illustration |
| `pdf.worker.min.mjs` | JavaScript (worker) | PDF.js web worker for in-browser PDF render |
| `file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg` | SVG | Default/template icons |

---

## 7. Folder: `docs/`

**Language:** **Markdown**

| Path | Purpose |
|------|---------|
| `docs/team/README.md` | Index of team role guides |
| `docs/team/01-team-lead-and-pitch-specialist.md` | Pitch / lead role guide |
| `docs/team/02-frontend-lead-ui-ux.md` | Frontend UI/UX guide |
| `docs/team/03-frontend-integrator.md` | Frontend integration guide |
| `docs/team/04-backend.md` | Backend role guide |
| `docs/team/05-database-architect.md` | Data architecture guide |
| `docs/team/06-core-logic-devops-qa-deployment.md` | Logic, DevOps, QA, deploy |

---

## 8. Folder: `scripts/`

| File | Language | Purpose |
|------|----------|---------|
| `scripts/connect-github.sh` | **Bash / Shell** | Helper script related to GitHub connection |

---

## 9. Generated / local-only folders (usually not in PDF “source code” list)

| Folder | Purpose | In Git? |
|--------|---------|---------|
| `node_modules/` | Installed npm packages | No (gitignore) |
| `.next/` | Build output | No |
| `.vercel/` | CLI project link | Often local |
| `.data/` | Local JSON journals on dev machine | Usually gitignored / local |
| `.env.local` | Real API keys | **Never commit** |

---

## 10. How folders connect (one diagram)

```
User Browser
    │
    │  React pages (app/**/page.tsx) + components/*
    │  fetch("/api/...")
    ▼
middleware.ts  (Clerk session)
    │
    ▼
app/api/**/route.ts   ←── TypeScript backend
    │
    ├── lib/classroom-server.ts, test-server.ts, …
    ├── Clerk (users + metadata)
    ├── Gemini (AI)
    └── Supabase Storage (PDFs + meta JSON)
```

| Layer | Folder | Language |
|-------|--------|----------|
| UI screens | `app/*/page.tsx` | TSX |
| UI widgets | `components/` | TSX |
| HTTP API | `app/api/` | TS |
| Business rules | `lib/` | TS |
| Static media | `public/` | assets |
| Docs | `docs/`, `*.md` | Markdown |
| Config | root `*.json`, `*.mjs`, `*.ts` | JSON / JS / TS |

---

## 11. Major features → code map

| Feature | Main UI | Main API / lib |
|---------|---------|----------------|
| Login | `sign-in`, `sign-up`, `NavAuth` | Clerk + `middleware.ts` |
| Dashboard | `app/dashboard` | `user-store`, `AppShell` |
| NCERT | `app/ncert` | `curriculum`, `ncert-books` |
| Quiz | `app/quiz` | `quiz-bank`, `quiz-engine`, `quiz-subject` |
| AI Tutor | `app/ai-tutor` | `/api/gemini` |
| Flowchart | `app/flowchart` + `FlowchartView` | `/api/flowchart`, `flowchart-bank` |
| Join class + PDFs | `app/join-class` | `/api/classroom`, `material`, `notes`, Supabase libs |
| Live class | `app/live-class`, `MeetFrame` | `/api/classroom` live actions, attendance journal |
| Live test | `app/test`, `TestProctor` | `/api/tests`, `test-server`, `test-durable` |
| Teacher hub | `app/teacher` | classroom-server + teacher-store APIs |
| Teacher tests | `app/teacher/test` | `/api/tests` |
| Remarks | `app/remarks` | remarks in classroom-server + remarks-store |
| Eye focus | `EyeFocusGuard` | `face-presence`, `proctor-beep` |
| Notifications | `AppTopBar` | `notifications.ts` |

---

## 12. Environment variables (config, not a folder)

Defined in `.env.local` / Vercel (names only for docs):

| Variable | Used for |
|----------|----------|
| `NEXT_PUBLIC_CLERK_*` / `CLERK_SECRET_KEY` | Authentication |
| `GEMINI_API_KEY` | AI tutor, flowchart, convert |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public Supabase key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server uploads |
| `SUPABASE_STORAGE_BUCKET` | e.g. `class-materials` |
| `NEXT_PUBLIC_APP_URL` | Canonical site URL |
| `YOUTUBE_API_KEY` | Optional safe search |
| `BLOB_READ_WRITE_TOKEN` | Optional Vercel Blob |

---

## 13. npm dependencies (from `package.json`) — what language ecosystem

| Package | Role |
|---------|------|
| `next`, `react`, `react-dom` | Web framework + UI (JS/TS) |
| `typescript` | Type-checking |
| `@clerk/nextjs` | Auth |
| `@google/generative-ai` | Gemini AI |
| `@supabase/supabase-js` | Storage / Supabase client |
| `@vercel/blob` | Optional file blob storage |
| `tailwindcss`, `@tailwindcss/postcss` | Styling |
| `lucide-react` | Icons |
| `pdfjs-dist` | PDF rendering |
| `react-markdown`, `remark-gfm`, math plugins | Formatted AI answers |
| `clsx`, `tailwind-merge` | className utilities |

---

## 14. PDF banate waqt checklist

Is document se PDF ke liye:

1. Title page: **CurioSphere — Project Structure Guide**  
2. Section 1–2: overview + languages  
3. Section 3–8: folder-by-folder tables  
4. Section 10–11: architecture + feature map  
5. Optional appendix: env vars + stack  

**Print tip:** tables landscape page pe better padhte hain.

---

## 15. One-page summary (memorize)

| Folder | Language | One line |
|--------|----------|----------|
| `app/` | TSX + TS | Pages (UI) + `api/` (backend) |
| `components/` | TSX | Reusable React UI |
| `lib/` | TS | Business logic & integrations |
| `public/` | Assets | Logos, PDF worker |
| `docs/` | MD | Team documentation |
| `scripts/` | Shell | Dev helpers |
| Root configs | JSON/TS/JS | Build, lint, Next, TypeScript |

**Final line for viva:**  
> “CurioSphere is a TypeScript Next.js monorepo: `app` for routes and APIs, `components` for UI, `lib` for core logic, deployed as one Vercel app with Clerk, Gemini, and Supabase.”

---

*End of PROJECT-STRUCTURE-GUIDE.md*  
*Generated for documentation / PDF export. Application runtime does not depend on this file.*
