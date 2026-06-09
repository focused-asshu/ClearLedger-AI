# ClearLedger AI

ClearLedger AI is a B2B SaaS compliance-assistance MVP for small crypto exchanges and fintech startups in India and globally. It accepts transaction data, applies transparent AML-style mock risk rules, checks a local sample sanctions/watchlist placeholder, flags suspicious transactions, and exports compliance review reports.

> **Important:** ClearLedger AI Milestone 1 is a compliance-assistance demo. It is not legal advice, does not replace licensed compliance counsel, and does not guarantee regulatory compliance or sanctions-screening completeness.
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
- Supabase client placeholder and SQL schema draft
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

Open `http://localhost:3000` and use `/dashboard` for the MVP workflow.

## Environment variables

Copy `.env.example` to `.env.local` when enabling hosted services:

```bash
cp .env.example .env.local
```

| Variable | Required for Milestone 1 | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | No | Future Supabase project URL for auth/database |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No | Future Supabase browser anon key |
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
- High-risk jurisdiction checks for countries such as North Korea, Iran, Syria, Myanmar, and Cuba (+40 customer / +42 counterparty)
- Elevated-risk/enhanced due diligence jurisdiction checks (+18 points)
- Local sanctions/watchlist placeholder hits (+90 points)
- Local sample sanctions/watchlist placeholder hits only; no live OFAC, UN, EU, UK, or official watchlist lookup is performed

Every screened transaction includes an inline category breakdown for amount, jurisdiction, structuring, direction, watchlist, and other rule contributions. Final scores are capped at 100 and mapped to Low (<35), Medium (35-64), High (65-89), and Critical (90-100).

This rules engine is intentionally simple and explainable for founder demos and early customer discovery.

## Supabase schema

A draft schema is available in `supabase/schema.sql`. It includes organizations, profiles, transactions, compliance reports, enums, and starter row-level security policies.

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

Milestone 1.8 should add regression fixtures for larger real-world CSV samples, reviewer disposition notes, escalation workflow states, and improved sanctions-data abstraction while still avoiding live paid services until the product scope is validated.
