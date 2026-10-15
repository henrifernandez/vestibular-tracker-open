# Monitor de Acertos (Score Tracker)

Track mock exams, error-driven review, a study plan and a calendar during the final stretch before Brazilian university entrance exams (ENEM, Fuvest, Unicamp and others). The interface is in Brazilian Portuguese.

[![CI](https://github.com/henrifernandez/vestibular-tracker-open/actions/workflows/ci.yml/badge.svg)](https://github.com/henrifernandez/vestibular-tracker-open/actions/workflows/ci.yml) ![License: MIT](https://img.shields.io/badge/license-MIT-2F7F73) ![Next.js 16](https://img.shields.io/badge/Next.js-16-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6)

[Versão em português](README.md)

> **What you download.** The complete app, with login and every feature. The online preview is this same code with a switch (`DEMO_MODE`) that makes it read-only, login-free and filled with fictitious data.

## Live preview

A public instance runs **read-only with fictitious data** (nothing you click changes anything), so you can try the app without installing it. Its address is in the repository description. To use your own data, run your own copy (see "Quick start").

![Dashboard](docs/capturas/painel-1280.png)

Adding an exam, with the goal in a single question:

![Add exam](docs/capturas/nova-prova-1280.png)

## Features

- **Works for any exam**: pick a ready-made template (ENEM, Fuvest, Unicamp) or build your own with any areas and number of questions. Each exam has a **date**, shown as a countdown on the dashboard.
- **Goal in a single question**: say how much you want to get right (for example 75%) and the app computes the number of correct answers needed in each area. You can fine-tune per area afterwards.
- **Mock exams per exam and area**, with the goal on the progress chart, a traffic-light status and the most-missed topics. CSV import and export.
- **Estimated score (TRI) for ENEM**, from the correct answers in each area, with configurable weights (each course weighs areas differently).
- **AI essay grading** (optional, uses the Google Gemini API with your own key), with a score per competency.
- **Error-driven review queue**: topics missed twice or more enter the queue automatically, with priority and history.
- **Study plan and weekly summary**: import a CSV (or sync from Notion) and see the classes completed during the week by subject, next to the mock exams of the period.
- **Calendar**: import an `.ics` file (Google Calendar, Apple, Outlook) or a CSV. Events of type exam become a countdown.
- **Single-password login** and a read-only **demo mode**.

## Stack

Next.js 16 (Pages Router), TypeScript, Prisma 5, PostgreSQL, Tailwind and Recharts. Runs on Vercel's free tier with a Neon database.

## Quick start

### With Docker (app and database, one command)

Requirement: Docker.

```bash
git clone https://github.com/henrifernandez/vestibular-tracker-open.git
cd vestibular-tracker-open
cp .env.example .env     # fill ADMIN_PASSWORD and SESSION_SECRET
docker compose up --build
```

Open http://localhost:3000 and sign in with the admin password. Tables are created on startup, and data lives in a Docker volume: `docker compose down` keeps it, `docker compose down -v` deletes it.

If the password contains a `$`, wrap the value in single quotes in `.env`. The compose file only listens on `localhost` and refuses to start without `ADMIN_PASSWORD` and `SESSION_SECRET`. Because access is over plain HTTP, it sets `COOKIE_SEM_HTTPS=true` (otherwise the browser drops the session cookie). If you put the app behind HTTPS, set `COOKIE_SEM_HTTPS=false` in `.env`.

### Without Docker (Node.js)

Requirements: Node.js 20+ and a Postgres database (local with Docker, or free on [Neon](https://neon.tech)).

```bash
git clone https://github.com/henrifernandez/vestibular-tracker-open.git
cd vestibular-tracker-open
npm install
cp .env.example .env     # fill DATABASE_URL, ADMIN_PASSWORD and SESSION_SECRET
docker compose up -d db  # optional: only the database, on localhost:5433
npx prisma migrate deploy
npm run dev              # http://localhost:3000
```

Use strong values for `ADMIN_PASSWORD` and `SESSION_SECRET` (for example `openssl rand -hex 32`). Sign in at `/login`.

Want to see the app full of data before using it? Use a **separate** database and run `DEMO_MODE=true npm run seed:demo` (see "Demo mode").

## First steps

1. Open **Provas e metas** (exams and goals) and pick a template (ENEM, Fuvest, Unicamp) or **Outra prova** to define the areas yourself. Check the official notice: the number of questions changes from year to year.
2. Set the **exam date** and drag the slider for **how much you want to get right**. The dashboard shows the countdown and the goal for each area.
3. Log a **mock exam** under *Simulados* (or import a CSV). The dashboard compares the result with your goal.
4. Optional: import the study plan and the calendar (see below).

`npx prisma db seed` registers the three templates at once, without a date or goal. It is optional: the *Provas e metas* page does the same.

## Environment variables

| Name | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string |
| `ADMIN_PASSWORD` | yes (except demo) | Single login password |
| `SESSION_SECRET` | yes (except demo) | Secret that signs the session cookie (32+ random characters recommended) |
| `DEMO_MODE` | no | `true` enables the read-only demo mode (no login) |
| `COOKIE_SEM_HTTPS` | no | `true` drops the `Secure` flag from the session cookie. Only for plain-HTTP access outside `localhost` (`docker compose` already sets it to `true`). Behind HTTPS, leave it out, or set `false` in the compose setup |
| `TRUST_PROXY` | no | `true` makes the login attempt limiter trust the `x-real-ip` header. Only when the app sits behind your own proxy. Without a proxy, leave it out (a client could forge the IP). Automatic on Vercel |
| `GEMINI_API_KEY` | no | Enables "Avaliar com IA" for essays. Free key at [AI Studio](https://aistudio.google.com/app/apikey) |
| `GEMINI_MODELS` | no | Comma-separated Gemini models, in order of preference |
| `AVALIACOES_POR_DIA` | no | Daily limit of essay gradings (default 20) |
| `NOTION_TOKEN` | no | Notion integration token (study plan sync) |
| `NOTION_DATABASE_ID` | no | ID of the Notion database holding the plan |

Without `ADMIN_PASSWORD` and `SESSION_SECRET` (outside demo mode) the app **refuses every request**: it never stays open by mistake.

## Study plan and calendar

- **Study plan (CSV)**: in *Resumo semanal*, download the template, fill `data, materia, feito, topicos, observacoes` and import it. There is a preview with per-row errors, and re-importing the same file updates rows without duplicating them. A ready-made prompt converts a table from another tool (such as Notion) to this format with an AI assistant.
- **Study plan (Notion)**: optional direct sync with a connection test. See [docs/integracoes/plano-de-estudo.md](docs/integracoes/plano-de-estudo.md) (Portuguese).
- **Calendar**: import `.ics` or CSV. See [docs/integracoes/calendario.md](docs/integracoes/calendario.md) (Portuguese).

## Demo mode

`DEMO_MODE=true` allows reading without login and blocks every write (HTTP 403). Write buttons are hidden and AI essay grading is unavailable. Use a **separate project and database** from your real one:

1. Create a second database.
2. Migrate and seed it: `DATABASE_URL=... DEMO_MODE=true npm run seed:demo`.
3. Deploy a second Vercel project with `DEMO_MODE=true` and that `DATABASE_URL`. Do not set `ADMIN_PASSWORD` or AI keys on it.

`DEMO_MODE` must also be set **at build time** (the banner and the hidden buttons are fixed into the bundle). On Vercel this happens on its own, because project variables apply to the build. If you build locally, do not leave a stray `DEMO_MODE=true` in `.env.local` when building for your real use.

The demo seed **deletes** exams, review items, plan and calendar rows in the target database, so it requires `DEMO_MODE=true` and `--yes`. Plan and calendar dates are relative to the day the seed runs.

## Security

- Every page and data route requires a session (`httpOnly`, `SameSite=Lax`, `Secure` in production), except `/login` and the read-only demo mode.
- Writes check the request origin, validate input with zod and cap sizes (imports: 1 MB, 2,000 rows).
- Internal errors never reach the client. Security headers and a basic CSP are set.
- CSV export neutralizes formula injection.
- **This is not a multi-user app**: there is a single admin password. For several people, run one instance each.

See [docs/SEGURANCA.md](docs/SEGURANCA.md) and [SECURITY.md](SECURITY.md).

## Costs

Everything runs on free tiers. AI essay grading uses **your** Gemini key, whose free quota is limited per day. The app caps usage at `AVALIACOES_POR_DIA` (20 by default), but the counter lives in instance memory: it is a best-effort brake, not a guarantee.

## Personal integrations (not included)

The author uses the app with an n8n automation that reads Notion databases and a RemNote flashcards plugin. Those integrations are specific to a personal setup and were **not released** here. If you want to see or adapt the workflow, open an issue labeled `integrações` or reach the author through their GitHub profile.

## Tests

```bash
npm run typecheck
npm test
```

Route tests run when `DATABASE_URL` points to a migrated Postgres. For the visual and accessibility audit (screenshots at 375, 768 and 1280 px plus axe), run the app in demo mode, then `npx playwright install chromium && npx tsx scripts/auditoria-visual.ts`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
