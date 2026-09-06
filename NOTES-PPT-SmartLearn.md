# SmartLearn — PPT Technical Notes

**Product:** CBSE Class 10–12 study platform  
**Live:** https://smartlearn-xi.vercel.app  
**Repo:** Next.js full-stack web app (student + teacher roles)  
**Saved for:** Presentation / PPT preparation

---

## 1. Tech Stack — Kya use hua & Kaise

### Frontend

| Technology | Role |
|---|---|
| **Next.js 16 (App Router)** | Pages, layouts, client/server components |
| **React 19** | UI components (dashboard, quiz, NCERT reader, tests) |
| **TypeScript** | Type-safe app code |
| **Tailwind CSS v4** | Styling, responsive UI, landing page |
| **Lucide React** | Icons |
| **pdf.js (`pdfjs-dist`)** | In-app NCERT/PYQ PDF rendering (Chrome X-Frame bypass) |
| **react-markdown + KaTeX** | AI answers with formulas |
| **Clerk UI components** | Sign-in / UserButton |

**How:** Browser pe SPA-like routes (`/dashboard`, `/ncert`, `/quiz`, `/test`…). Student shell = sidebar + top bar + focus lock + Spotify mini-player.

---

### Backend

| Technology | Role |
|---|---|
| **Next.js Route Handlers** (`app/api/*`) | REST-style APIs |
| **Node.js runtime (Vercel serverless)** | API execution |

**Main APIs:**

- `/api/gemini` — AI tutor / Feynman grading
- `/api/pdf-proxy` — NCERT/CBSE PDF fetch + stream
- `/api/tests` + `/api/tests/convert` — live class tests
- `/api/common-room` — shared doubt wall
- `/api/classroom` — teacher class codes
- `/api/youtube-edu` — safe educational search
- `/api/support` — help tickets (+ optional email)

**How:** Frontend `fetch()` → serverless function → Clerk auth check → business logic → JSON response.

---

### AI / ML

| Piece | Use |
|---|---|
| **No custom ML training** | Rule + bank based quizzes, matching |
| **Heuristic quiz engine** | Tag matching chapter → MCQ pool |
| **PDF text → MCQ parser** | Local regex parser + Gemini convert |
| **Focus lock logic** | Tab-switch detection (visibility API) |

**How:** “ML-like” behavior mostly **LLM + curated data**, not trained neural nets on your data.

---

### LLM

| Technology | Role |
|---|---|
| **Google Gemini** (`@google/generative-ai`) | AI Tutor, Feynman scoring, paper→MCQ |
| **Models tried** | `gemini-flash-lite`, flash variants (fallback chain) |
| **Env** | `GEMINI_API_KEY` / `GOOGLE_API_KEY` |

**Flows:**

1. Student question → prompt (CBSE tutor style) → Markdown answer
2. Feynman explanation → SCORE / STRENGTHS / GAPS / simpler version
3. Teacher pastes paper text → Gemini JSON MCQs → live test

---

### Database / Storage (current architecture)

| Layer | What stores what |
|---|---|
| **Clerk `publicMetadata`** | Role, classroom, wall posts, live tests (durable-ish) |
| **Browser `localStorage`** | XP, streak, mistakes, study plan chapters, notifications, Spotify state |
| **Server file cache** | `/tmp` (Vercel) or `.data/` — common room, tests, support |
| **No Mongo/Postgres yet** | Prototype / MVP storage |

**How:** Per-user progress = local + Clerk user id isolation. Shared data = Clerk user list scan + file cache (2-day TTL for common room).

---

### Authentication

| Technology | Role |
|---|---|
| **Clerk** (`@clerk/nextjs`) | Auth provider |
| **Email OTP / Clerk methods** | Sign-in / sign-up |
| **Middleware + RoleGate** | Protect routes; student vs teacher split |
| **Roles** | `student` \| `teacher` (metadata + local role store) |

**How:** Login → Clerk session → `userId` → role pick → student goes `/dashboard`, teacher `/teacher`.

---

### Deployment

| Technology | Role |
|---|---|
| **Vercel** | Hosting, serverless APIs, CDN, HTTPS |
| **GitHub** | Source → push → deploy |
| **Domain alias** | `smartlearn-xi.vercel.app` |
| **Env vars on Vercel** | Clerk keys, Gemini, optional YouTube/Resend |

**How:** `git push` → Vercel build (`next build`) → production alias.

---

### Other integrations

- **Spotify embed** — mood music in-app (no official Spotify API required for embeds)
- **YouTube Data API** (optional) — safe search; fallback curated catalog
- **WhatsApp deep links** (`wa.me`) — parent tab-switch alerts
- **NCERT / CBSE public PDFs** — via proxy
- **Resend** (optional) — support email

---

## 2. Project modules (PPT feature map)

- **Student:** NCERT PDF, PYQ, Quiz bank, AI Tutor, Feynman, Study Plan, Live Test join, Common Room, Focus Lock, Parent portal, Extreme mode, Spotify
- **Teacher:** Class code, materials, live session, **Live Tests** (PDF text → MCQ → code → scores)
- **Safety:** In-app media, tab-switch parent alert, student/teacher isolation

---

## 3. Technical Feasibility (bullets)

- Built on mature stack (Next.js + React + TypeScript) → fast delivery
- Clerk handles auth security (OTP, sessions) without custom auth server
- Gemini API covers tutoring without training own LLM
- NCERT/CBSE content via public PDFs + proxy/pdf.js is feasible in-browser
- Serverless APIs fit bursty student traffic (quizzes, AI calls)
- Role-based UI already separates student/teacher flows
- Core CBSE features (chapters, MCQs, plans) work offline-of-DB using local + Clerk
- PDF in-app reading solved via same-origin proxy + pdf.js (Chrome frame block)
- Live tests work end-to-end with code join + timer + auto-submit
- Spotify/YouTube can stay embed-based (no heavy media backend)

---

## 4. Cost Feasibility (bullets)

- **Vercel Hobby/Pro:** free–low cost for MVP; scales with usage
- **Clerk:** free tier for early users; paid as MAU grows
- **Gemini API:** pay-per-token; flash models keep cost low for school use
- **No dedicated DB yet:** saves Mongo/Postgres cost in MVP
- **No custom GPU/ML infra:** huge cost avoided
- **NCERT/CBSE PDFs:** free public sources (bandwidth only)
- **Spotify embeds:** free (user’s own account)
- **Optional YouTube API / Resend:** small add-on costs
- **Main cost drivers later:** AI tokens, auth MAU, DB, storage for images/PDFs
- **Student pricing path:** freemium + optional Extreme Mode / school license

---

## 5. Scalability & Viability (bullets)

- **Horizontal scale:** Vercel serverless auto-scales API routes
- **Static/edge assets:** landing + UI via CDN
- **Viability:** clear CBSE 10–12 niche (exams, NCERT, parents, teachers)
- **Growth path:** schools → teacher codes → class tests → retention
- **Content scale:** chapter banks (e.g. 100 Maths Ch1 MCQs) expandable per subject
- **AI scale:** rate-limit + caching answers for common NCERT doubts
- **Data scale (next step):** move Clerk-metadata/file store → Postgres/Supabase
- **Media scale:** object storage (S3/R2) for common-room images & teacher PDFs
- **Multi-tenant schools:** org accounts on Clerk + DB tenancy
- **Business viability:** B2C students + B2B schools/coaching

---

## 6. Risks + Mitigation (bullets only)

- **Risk:** Clerk metadata / `/tmp` not true multi-user DB → data loss on cold start
  - **Mitigation:** Migrate to Postgres/Supabase; keep Clerk only for auth

- **Risk:** Gemini API cost spikes / rate limits
  - **Mitigation:** Flash models, caching, daily AI quotas, school plans

- **Risk:** NCERT/gov servers block cloud IPs or change PDF URLs
  - **Mitigation:** Proxy + Wayback fallback + pdf.js; mirror critical PDFs legally

- **Risk:** Chrome/browser blocks third-party embeds (PDF/YouTube)
  - **Mitigation:** Same-origin proxy, pdf.js canvas, curated catalogs

- **Risk:** Common-room images large → storage/privacy issues
  - **Mitigation:** Compress images, 2-day TTL, moderate content, object storage

- **Risk:** Focus lock / WhatsApp can annoy or open wrong parent chat
  - **Mitigation:** Opt-in parent number, cooldown, clear consent in Profile

- **Risk:** Academic content accuracy / wrong MCQ keys
  - **Mitigation:** Curated banks, teacher review on live tests, NCERT-aligned prompts

- **Risk:** Cheating in live tests (tab switch)
  - **Mitigation:** Timer, focus alerts, fullscreen extreme mode, shuffle options

- **Risk:** Spotify/YouTube ToS / login friction
  - **Mitigation:** Official embeds only; no scraping; optional ambient fallback

- **Risk:** Single-region Vercel latency / outage
  - **Mitigation:** Multi-region later; status page; graceful offline local progress

- **Risk:** Privacy (minors, parent data, chat)
  - **Mitigation:** Minimal PII, Clerk security, school admin controls, policy pages

- **Risk:** Scope creep (too many features)
  - **Mitigation:** MVP core = NCERT + Quiz + AI + Tests; rest phased

---

## 7. Suggested PPT slide order

1. Problem (CBSE overload, tab distraction, no unified desk)
2. Solution — SmartLearn
3. Users (Student / Teacher / Parent)
4. Feature demo map
5. Architecture diagram (Browser → Next.js → Clerk / Gemini / PDFs / Vercel)
6. Frontend stack
7. Backend + APIs
8. LLM & AI usage
9. Auth
10. Data storage (current → future DB)
11. Deployment
12. Technical feasibility
13. Cost feasibility
14. Scalability & viability
15. Risks + mitigation
16. Roadmap (DB, school admin, more question banks)
17. Live link + demo

---

## 8. One-line architecture (for diagram)

```text
Student/Teacher Browser (React + Tailwind)
        ↓ HTTPS
Next.js on Vercel (UI + API routes)
        ↓
   ┌────┴────┬──────────┬────────────┐
Clerk Auth   Gemini LLM  PDF Proxy   File/Clerk store
   │            │         (NCERT)    (room/tests)
   └────────────┴─────────┴────────────┘
```

---

## 9. Env vars (reference)

- `NEXT_PUBLIC_CLERK_*` / Clerk keys — authentication
- `GEMINI_API_KEY` or `GOOGLE_API_KEY` — AI Tutor / Feynman / test convert
- `YOUTUBE_API_KEY` — optional safe search
- `SUPPORT_EMAIL` + `RESEND_API_KEY` — optional support email
- `NEXT_PUBLIC_APP_URL` — app URL

---

## 10. Quick speaker one-liners

- **Frontend:** Next.js + React + Tailwind — modern, fast UI for students and teachers.
- **Backend:** Next.js API routes on Vercel serverless — no separate Express server needed.
- **LLM:** Google Gemini for doubts, Feynman grading, and paper-to-MCQ.
- **Auth:** Clerk email OTP with student/teacher roles.
- **Data:** MVP uses Clerk metadata + localStorage; production path is Postgres.
- **Deploy:** GitHub → Vercel continuous deploy at smartlearn-xi.vercel.app.
