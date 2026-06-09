# ClearLedger AI agent instructions

## Project rules
- Build this as a founder-demo-friendly B2B SaaS MVP for compliance assistance, not legal advice.
- Keep disclaimers visible when compliance, sanctions, or AML outputs are shown.
- Never hardcode API keys, Supabase keys, AI keys, payment keys, or other secrets.
- Prefer environment variable placeholders and document them in `.env.example` and `README.md`.
- Keep risk scoring logic transparent and covered by tests.
- Treat sanctions screening in this MVP as local sample-data placeholder behavior only.
- Do not add paid services unless optional and free-tier-compatible.

## Stack expectations
- Next.js App Router, TypeScript, Tailwind CSS.
- Supabase for future database/auth integration.
- Vercel-ready deployment.
- AI provider code should remain abstracted so Claude or another provider can be added later.

## Quality bar
- Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build` when dependencies are available.
- If dependency installation is blocked by the environment, document the exact command and error in the final response.
