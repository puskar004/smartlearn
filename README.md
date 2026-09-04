# SmartLearn

CBSE Class 10–12 focus-first learning app:

- NCERT chapters & PYQs
- Gemini AI step-by-step tutor
- Education-only YouTube safe search
- Rapid chapter quizzes
- Common room (anti-spam timer)
- Extreme focus mode
- Parent WhatsApp tab-switch alerts
- Clerk authentication

## Local development

```bash
npm install
cp .env.local.example .env.local
# fill Clerk + GEMINI_API_KEY
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

| Variable | Required | Notes |
|----------|----------|--------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | Clerk Dashboard |
| `CLERK_SECRET_KEY` | Yes | Clerk Dashboard |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Yes | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Yes | `/sign-up` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | Yes | `/` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | Yes | `/` |
| `GEMINI_API_KEY` | Recommended | Google AI Studio |
| `YOUTUBE_API_KEY` | Optional | Live edu video search |

Never commit `.env.local`.

## Deploy (Vercel + GitHub)

1. Push this repo to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Add the env vars above in Vercel → Settings → Environment Variables
4. In [Clerk Dashboard](https://dashboard.clerk.com) → Domains, add your `*.vercel.app` URL and production domain
5. Each `git push` to `main` auto-deploys

```bash
npm run build
```
