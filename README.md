# ClearLedger AI

ClearLedger AI is a B2B SaaS compliance-assistance MVP for small crypto exchanges and fintech startups in India and globally. It accepts transaction data, applies transparent AML-style mock risk rules, checks a local sample sanctions/watchlist placeholder, flags suspicious transactions, and exports compliance review reports.

> **Important:** ClearLedger AI Milestone 1 is a compliance-assistance demo. It is not legal advice, does not replace licensed compliance counsel, and does not guarantee regulatory compliance or sanctions-screening completeness.

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

`direction` must be `inbound` or `outbound`.

## Risk scoring model

Milestone 1 uses transparent deterministic rules in `lib/risk-scoring.ts`:

- Large transaction value thresholds
- Large outbound transfer checks
- Privacy-asset checks
- High-risk/elevated-risk jurisdiction checks
- Local sanctions/watchlist placeholder hits

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

Milestone 2 should add Supabase authentication, organization workspaces, persistent transaction imports, and saved compliance reports.
