# InkStack 墨栈

**An AI-native blogging platform.** Every writer gets an AI agent that speaks for their articles, readers can hold a conversation with the post itself, writing earns money, and the platform runs its own editorial operations.

A complete personal blog and content community — front end and back end — written end-to-end in Next.js 15, with a hand-built magazine-editorial design system.

**English** · [简体中文](../README.md)

> This repository is the GitHub mirror. Primary development happens on Gitee: https://gitee.com/du-jiangjiang/inkstack

---

## 🖼 Preview

| Home · magazine feed | Article · AI agent Q&A |
|---|---|
| ![Home](../docs/assets/preview-home.png) | ![Article and agent](../docs/assets/preview-article-agent.png) |

| AI Studio | Series collections |
|---|---|
| ![Studio](../docs/assets/preview-studio.png) | ![Series](../docs/assets/preview-series.png) |

| Ink Vault · the ink economy | Night mode |
|---|---|
| ![Ink Vault](../docs/assets/preview-points.png) | ![Night mode](../docs/assets/preview-night.png) |

<p align="center">
  <img src="../docs/assets/preview-mobile.png" width="280" alt="Mobile layout" /><br/>
  <sub>Mobile · thumb-reachable bottom navigation bar</sub>
</p>

## ✨ Features

### Writing & reading
- **Magazine-style feed** ranked by gravity (engagement × time decay), with paid `boost` weighting
- **Article page**: Markdown rendering, copy-code buttons, reading progress bar, scroll-synced table of contents, previous/next navigation
- **AI Studio**: continue writing, polish, generate titles, suggest topics — powered by DeepSeek, billed in credits
- **Series collections**: manage multi-part series and sell them as a one-price bundle
- **Weekly digest** at `/weekly`, aggregating the site's week
- **Site-wide search**, hot list, archive, tag wall, random roam

### AI agents (AgentScope)
- Every author gets a **ReAct agent clone** — readers can talk to "the article itself"
- NDJSON streaming output, with automatic switching between demo and live modes
- RAG over the author's own articles (MySQL ngram full-text index), answers returned with citations
- Python FastAPI agent service in [`agent-service/`](../agent-service); falls back to a built-in Node mode when it's not running

### The ink economy (credit monetisation)
- Top-ups, tipping (90/10 split), paid article unlock (70/30 split), series bundle pricing
- Limited-time discounts, boost, sales-heat banners, paid-conversion funnel dashboard
- Every money movement is **atomic in a single transaction** — placeholder with duplicate guard, `FOR UPDATE` debit, split ledger written in the same transaction

### Community & moderation
- Registration and login via email one-time code, comment likes, report workflow, moderation queue (`pending` → `approved`)
- Authors with the right role publish without review; moderators get a dedicated comment-management surface

### Security layer (v13.5+)
- `scrypt` salted password hashing + HMAC-SHA256 signed session cookies + a database session table as the second line of defence
- TOTP two-factor authentication (hand-written RFC 6238, **zero external dependencies**) with one-time backup codes
- Site-wide API rate limiting (120 req/min) and CSP / COOP / CORP / HSTS response headers
- Have I Been Pwned breached-password check (fail-open), new-device login email alerts, forgot-password invalidates every session
- Security centre at `/security`: device management, password change, 2FA, audit-event timeline
- Fully parameterised SQL, XSS filtering with DOMPurify, `LIKE` wildcard escaping, and site-wide request-body type coercion (type confusion can no longer produce a 5xx)

### Roles & operations console
- Roles: `developer > admin > author > reader`, with a single `isStaff()` check used site-wide
- Console at `/admin` with eight tabs: overview, moderation, content (including price edits), users (including role management), reports, logs, comments, and money flow
- Role management is restricted to `developer`; the money-flow ledger is a `UNION ALL` over every income and expense source

### Responsive by design
- Separate desktop and mobile layouts (`body.m` mobile system + bottom thumb navigation bar)
- Site-wide night theme driven by `data-theme`, plus a manual layout switch
- All animation automatically disabled under `prefers-reduced-motion`

## 🛠 Tech stack

| Layer | Choice |
|---|---|
| Front end + back end | Next.js 15 (App Router) + React 19 + TypeScript |
| Database | MySQL 8 via `mysql2` directly — no ORM, with a global connection pool to prevent hot-reload leaks |
| AI agents | Python FastAPI + AgentScope 1.x + DeepSeek ([`agent-service/`](../agent-service)) |
| Email | nodemailer (SMTP) |
| Security | Hand-written `scrypt` / HMAC / TOTP on `node:crypto` — zero external auth dependencies |

## 🚀 Getting started

Requirements: Node.js ≥ 20, MySQL ≥ 8. **No database is needed to boot** — without one, the app starts in demo mode with bundled sample data.

```bash
# 1. Install dependencies
npm install

# 2. Run (falls back to built-in demo data when DATABASE_URL is absent)
npm run dev        # http://localhost:3100
```

### Connecting MySQL

```bash
# 1. Create the database and tables (including the ngram full-text index)
mysql -u root -p < db/schema.sql

# 2. Configure environment variables
cp .env.example .env    # then fill in your database password

# 3. Seed sample articles
npm run seed

# 4. Restart
npm run dev
```

### Running the AI agent service (optional, recommended)

```bash
cd agent-service
python -m venv .venv
.venv\Scripts\activate            # Windows; use `source .venv/bin/activate` on Linux/macOS
pip install -r requirements.txt
cp .env.example .env              # fill in DEEPSEEK_API_KEY and your database password
python main.py                    # http://127.0.0.1:8100
```

Point `AGENT_SERVICE_URL=http://127.0.0.1:8100` in the root `.env` and agent Q&A is proxied straight through to the AgentScope `ReActAgent`; if the service is down, the app falls back to the built-in Node mode automatically. See [`docs/AgentScope集成方案.md`](../docs/AgentScope集成方案.md) (Chinese).

### Promoting an admin / developer

```bash
# Create an admin account (the password is a CLI argument — no default password is ever baked in)
node scripts/make-admins.mjs --admin=you@example.com=YourStrongPassword=AdminNickname

# Promote an existing user to developer (highest privilege, can manage roles)
node scripts/make-admins.mjs --dev-email=someone@example.com
```

Or directly in the database: `UPDATE users SET role='admin' WHERE email='you@example.com';`

## ⚙️ Environment variables

The full list with explanations lives in [`.env.example`](../.env.example). The essentials:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | MySQL connection string; omit it to run in demo mode |
| `SESSION_SECRET` | Session signing key — a strong random value is mandatory in production |
| `NEXT_PUBLIC_SITE_URL` | Public site URL (used by sitemap and OAuth callbacks) |
| `TRUST_PROXY` | Set to `1` behind a reverse proxy so rate limiting and auditing see the real IP |
| `AGENT_SERVICE_URL` | Address of the Python agent service |
| `GITEE/GITHUB/QQ_CLIENT_*` | OAuth login (optional) |
| `SMTP_*` | Email one-time-code delivery (optional) |
| `WECHAT_PAY_*` | WeChat Pay merchant credentials (optional) |

## 📦 Deployment

The full deployment manual is in [`DEPLOY.md`](../DEPLOY.md) (Chinese) — database setup, the environment-variable checklist, reverse proxy configuration, pm2 supervision, and a pre-launch checklist.

Production essentials:
- `next build && next start` (port 3100 by default), reverse-proxy 80 → 3100 with Caddy or nginx
- **Set `TRUST_PROXY=1` behind a proxy** — otherwise rate limiting can be bypassed with forged headers
- Build absolute redirects and OAuth callbacks from `NEXT_PUBLIC_SITE_URL`, never from `req.url`
- A missing SMTP config in production will not leak the verification code (`devCode` is non-production only)

## 🗂 Project structure

```
inkstack/
├── app/                    # Next.js App Router (pages + API routes)
│   ├── page.tsx            # home: the magazine feed
│   ├── article/[slug]/     # article page + agent Q&A + comments
│   ├── studio/             # AI Studio
│   ├── series/ weekly/ hot/ search/ archive/ tag/ ...
│   ├── security/           # Security centre (devices / 2FA / audit timeline)
│   ├── admin/              # Operations console (8 tabs)
│   └── api/                # auth / articles / agent / ai / admin / ...
├── agent-service/          # ⭐ AgentScope agent service (Python · FastAPI)
├── components/             # Masthead / AdminConsole / AgentChat / CommentsSection ...
├── lib/                    # auth / data / points / rag / db / mailer / totp ...
├── db/schema.sql           # Table definitions (including ngram full-text index)
└── scripts/                # Seed data and operational scripts
```

## 🎨 Design system

- Direction: **magazine editorial** — rule lines, numbered typography, drop caps, vermilion seals, vertical-set title characters
- Palette: warm paper `#F6F1E7` · near-black `#211C14` · vermilion accent `#C2401A`
- Display type: Source Han Serif + Fraunces; body: Source Han Sans
- Every design token lives in `app/globals.css`, layered by version — new layers are appended, old ones are never rewritten

## 📄 License

[MIT](../LICENSE)
