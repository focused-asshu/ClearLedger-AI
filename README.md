# ClearLedger AI

ClearLedger AI is a B2B SaaS compliance-assistance MVP for small crypto exchanges and fintech startups in India and globally. It accepts transaction data, applies transparent AML-style mock risk rules, checks a local sample sanctions/watchlist placeholder, flags suspicious transactions, and exports compliance review reports.

> **Important:** ClearLedger AI Milestone 2 is a compliance-assistance demo. It is not legal advice, does not replace licensed compliance counsel, and does not guarantee regulatory compliance or sanctions-screening completeness.
> **Important:** ClearLedger AI Milestone 1 is a compliance-assistance demo, not legal advice. It does not replace licensed compliance counsel, does not guarantee regulatory compliance, and does not perform live OFAC, UN, EU, UK, or other official sanctions screening. Sanctions/watchlist results come only from local sample placeholder data for demos and tests.

## Milestone 1 scope

- Landing page for founder demos
- Dashboard layout
- CSV transaction upload UI
- Transaction table with risk labels
- Mock AML/risk scoring engine
- Local sample sanctions-screening placeholder
- Risk filters: Low, Medium, High, Critical
- Downloadable JSON compliance report
- Downloadable CSV screened transaction report
- Supabase schema draft
- Seed/sample transaction data
- Tests for risk scoring and report generation

## Tech stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase Auth, SSR cookie sessions, and organization-scoped persistence
- Vitest for core logic tests
- Vercel-ready configuration

## Getting started

Install dependencies in the cloud/dev environment:

```bash
npm install
```

Run the app locally:

```bash
npm run dev
```

Open `http://localhost:3000`, create an account at `/signup`, and use `/dashboard` for the authenticated MVP workflow.

## Environment variables

Copy `.env.example` to `.env.local` when enabling hosted services:

```bash
cp .env.example .env.local
```

| Variable | Required for Milestone 2 | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL for Auth and database access |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key used by browser and server SSR clients; RLS controls data access |
| `ANTHROPIC_API_KEY` | No | Future server-only Claude API support |

Do not commit real secrets.

## CSV upload format

The dashboard accepts CSV files with these headers:

```csv
id,date,customerName,customerCountry,walletAddress,counterpartyName,counterpartyCountry,asset,amount,fiatValueUsd,direction
```

`direction` is normalized before processing, so values such as `INBOUND`, `Outbound`, and `outbound` are accepted. Uploads are limited to 1,000 data rows and 1,000,000 bytes by default.

Rows are rejected before screening when required identity fields are missing, dates are invalid, `amount` or `fiatValueUsd` is zero/negative/non-numeric, or any non-numeric field begins with a spreadsheet formula prefix (`=`, `+`, `-`, `@`) or contains script/HTML-like tags.

## Risk scoring model

Milestone 1.7 uses transparent deterministic rules in `lib/risk-scoring.ts`:

- Progressive amount scoring instead of a fixed ceiling:
  - `$10k-$49.99k`: +18 points
  - `$50k-$99.99k`: +35 points
  - `$100k-$499.99k`: +45 points
  - `$500k-$999.99k`: +62 points
  - `$1M-$9.99M`: +70 points
  - `$10M-$99.99M`: +78 points
  - `$100M-$499.99M`: +86 points
  - `$500M-$999.99M`: +90 points
  - `$1B+`: +94 points
- Structuring/smurfing detection: same wallet and same counterparty in 3 or more transactions within any 7-day window, each below $10,000, where the combined total exceeds $10,000 (+40 points to each transaction in the detected window)
- Large outbound transfer checks (+20 points at $50,000+)
- Privacy-asset checks (+22 points)
- High-risk jurisdiction checks for countries such as North Korea, Iran, Syria, Myanmar, Cuba, and Russia (+40 customer / +42 counterparty)
- Elevated-risk/enhanced due diligence jurisdiction checks (+18 points)
- Local sanctions/watchlist placeholder hits (+90 points)
- Local sample sanctions/watchlist placeholder hits only; no live OFAC, UN, EU, UK, or official watchlist lookup is performed

Every screened transaction includes an inline category breakdown for amount, jurisdiction, structuring, direction, watchlist, and other rule contributions. Final scores are capped at 100 and mapped to Low (<35), Medium (35-64), High (65-89), and Critical (90-100). Calibration floors keep clear escalation cases from remaining Medium: high-risk jurisdiction plus privacy asset, high-risk outbound transfers at or above $25,000, high-risk jurisdiction transfers at or above $100,000, and severe structuring floor at Critical; transfers at or above $500,000 and EDD jurisdictions combined with suspicious patterns floor at High.

This rules engine is intentionally simple and explainable for founder demos and early customer discovery.

## Supabase setup

Run the complete SQL file in `supabase/schema.sql` from the Supabase SQL editor before testing authentication. It creates:

- `organizations` with one owner per workspace.
- `transactions` with `upload_batch_id`, raw CSV JSON, risk outputs, reviewed state, and reviewer notes.
- RLS policies that allow authenticated users to read, insert, and update only rows belonging to their own organization via `auth.uid()` checks.
- A secure `auth.users` trigger that creates the first organization automatically during email/password signup, so the app never needs a Supabase service-role key.

Do not add `SUPABASE_SERVICE_ROLE_KEY` to the app environment. Milestone 2 uses only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` with RLS.

## Auth flow local testing

1. Create a Supabase project and run `supabase/schema.sql` in the SQL editor.
2. Copy `.env.example` to `.env.local` and fill `NEXT_PUBLIC_SUPABASE_URL` plus `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. In Supabase Auth settings, keep email/password signups enabled. For this MVP demo, disable mandatory email confirmation if you want immediate login after signup.
4. Run `npm run dev`.
5. Visit `/signup`, create an organization, confirm you land on `/dashboard`, refresh the page to verify session persistence, upload a CSV, mark transactions reviewed, and add reviewer notes.
6. Click **Log out** and verify `/dashboard` redirects to `/login`.

## Quality checks

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Deployment

The project is Vercel-ready:

1. Import the GitHub repository into Vercel.
2. Add environment variables from `.env.example` only when enabling Supabase/AI integrations.
3. Deploy the Next.js app.

## Next recommended milestone

The next milestone should add password reset, optional email verification configuration, and team member invitations after the authenticated single-organization workflow is validated.
