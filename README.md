# dhf.io.vn — personal site + Photobook ULAW

A hand-coded personal portfolio and a small real-world web app, built from scratch — **no front-end framework, no page builder** — and self-hosted. This repo is the source for [dhf.io.vn](https://dhf.io.vn).

I'm a first-year computer-science student heading toward **blue-team / defensive security**, so the project doubles as a place to practice building things *and* defending them.

## What's here

### 1. The portfolio (`site/`)
A static, fast, accessible single-page site.

- **Vanilla HTML / CSS / JS** — zero dependencies, no build step.
- **Bilingual (EN primary, VI toggle)** — language preference persisted client-side.
- **Hybrid CMS rendering** — the page ships with content "baked" into the HTML, and `hydrate.js` live-reads the latest content from the backend on load. If the backend is down, the baked content stays — the page is **never blank** (fail-closed), which is also good for SEO and resilience.
- **Accessibility** — skip link, focus management for the nav drawer, ARIA, `prefers-reduced-motion` support throughout the animations.
- **Details** — JSON-LD `Person`, Open Graph / Twitter cards, an animated "radar" hero, a terminal-style journey log.

### 2. Photobook ULAW (`site/photobook-ulaw/`)
A temporary **take-a-number queue web app** I built for a friend's photobook event at the University of Law (ULAW). Built, deployed, and used at a real event.

- **Public page** — live "now serving" board, estimated wait, one number per device (no sign-up), a pose-inspiration gallery, real-time updates by polling.
- **Manager page** — call the next number, mark served/absent, record photo counts + revenue, manage every ticket.
- **Resilient UX** — optimistic updates, retry on network loss, safe-area handling for notched phones.

### 3. Backend (`pb_hooks/`)
The dynamic parts run on **[PocketBase](https://pocketbase.io)** (a single Go binary + SQLite), extended with custom JavaScript hooks.

Security-conscious by design:

- **Locked collections** — the Photobook data collections have all CRUD rules disabled; *every* read/write goes through server-side hooks, so the public never touches the database directly (full isolation from the portfolio data).
- **No secrets in code** — the manager passphrase and API keys are read from environment variables (`$os.getenv`), never hard-coded.
- **Input hardening** — output is HTML-escaped at every dynamic sink (defense against stored/DOM XSS), filter queries use bound parameters (no string concatenation → no injection), numeric inputs are coerced and clamped, and the manager passphrase is sent in a request header (kept out of URLs/logs).

## Stack

| Layer | Tech |
|---|---|
| Frontend | Hand-written HTML / CSS / JS (no framework) |
| Backend | PocketBase (Go + SQLite) + custom JS hooks |
| Serving | Nginx (static) + reverse proxy to PocketBase; HTTPS, security headers |
| Hosting | Self-managed Linux server |

## Notes

- Deployment configuration, server details, and data are intentionally kept out of this repository.
- This is a learning project — built, broken, and rebuilt by me.
