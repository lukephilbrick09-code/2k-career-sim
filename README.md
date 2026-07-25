# MyCareer Sim — Setup

## 1. Database (one-time)
1. Go to your Supabase project → **SQL Editor** → New Query
2. Paste everything from `schema.sql` and click **Run**

## 2. Put it online (free)
1. Create a new GitHub repo, upload these 5 files: `index.html`, `style.css`, `app.js`, `config.js`, `schema.sql`
2. Go to vercel.com → **Add New Project** → import that repo → Deploy
3. Vercel gives you a free `.vercel.app` URL — that's your live app, bookmark it on your phone

`config.js` already has your Supabase URL and **publishable key** wired in, so it should work immediately after deploy.

## ⚠️ Important security note
You shared a **secret key** (`sb_secret_...`) earlier in this chat. That key has full admin access to your database and must never appear in `config.js`, the GitHub repo, or anywhere client-side — only the publishable key belongs there (already set up correctly). Since the secret key was pasted in this conversation, go rotate it now: Supabase → Project Settings → API → regenerate the secret key. You won't need it for this app at all.

Also: since there's no login system, anyone with your app's URL could view/edit your data. Fine for personal use — just don't post the link publicly.

## What's built (Phase 1 + 2)
- **Multiple career slots** — create, duplicate, delete, export/import as JSON files (your local backup)
- **Box score logging** — full stat line + game context (win, playoff, finals, championship, clutch, player of the game)
- **XP engine** — stats convert to XP across 5 attribute categories (25 attributes total) and feed a career Level (1–99)
- **Real NBA 2K26 badges** — all 40 badges across 6 categories, progressing bronze → silver → gold → HOF → legend
- **VC system** — manually add VC you earned in real 2K26, spend it to instantly train any attribute (bypassing games)
- **Contracts** — sign salary/years/options, signing bonus pays out immediately
- **Seasons & Awards** — season-by-season averages, career totals, an awards cabinet, and an "Advance Season" button that pays your contract salary into VC

## Not built yet (Phase 3, if you want it later)
Training staff/facilities, housing, vehicles, business investments, endorsements, PEDs with risk events, hidden attributes, player photos, career milestones/records auto-detection.

## Tuning the numbers
All formulas live near the top of `app.js`:
- `statCategoryPools()` — how a box score converts to XP per category
- `xpNeededForAttr()` — attribute level-up cost curve
- `TIER_THRESHOLDS` — badge tier costs
- `LEVEL_MILESTONES` — level-up XP curve

Change any number, refresh the page, done — no rebuild step.
