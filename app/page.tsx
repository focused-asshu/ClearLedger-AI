import Link from "next/link";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";

const features = [
  "CSV transaction upload",
  "Transparent AML-style mock rules",
  "Local sample sanctions watchlist",
  "Low / Medium / High / Critical labels",
  "Downloadable JSON and CSV reports",
  "Supabase-ready schema draft",
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#cffafe,transparent_34%),#f8fafc]">
      <section className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-8 sm:px-6 lg:px-8">
        <nav className="flex items-center justify-between py-4">
          <div className="text-xl font-black tracking-tight text-slate-950">ClearLedger AI</div>
          <Link href="/dashboard" className="rounded-full bg-slate-950 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800">
            Open dashboard
          </Link>
        </nav>

        <div className="grid flex-1 items-center gap-12 py-16 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <div className="inline-flex rounded-full border border-cyan-200 bg-white/80 px-4 py-2 text-sm font-semibold text-cyan-800 shadow-sm">
              B2B compliance-assistance MVP for crypto and fintech teams
            </div>
            <h1 className="mt-6 max-w-4xl text-5xl font-black tracking-tight text-slate-950 sm:text-6xl lg:text-7xl">
              Screen transactions and prepare compliance reports in minutes.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              ClearLedger AI helps small exchanges and fintech startups in India and globally triage AML-style transaction risk, surface watchlist placeholders, and export clean review packets for compliance teams.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/dashboard" className="rounded-2xl bg-cyan-600 px-6 py-4 text-center font-semibold text-white shadow-lg shadow-cyan-600/20 hover:bg-cyan-700">
                Try Milestone 1 demo
              </Link>
              <a href="#scope" className="rounded-2xl border border-slate-300 bg-white px-6 py-4 text-center font-semibold text-slate-800 hover:bg-slate-50">
                View MVP scope
              </a>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-2xl shadow-slate-200 backdrop-blur">
            <div className="rounded-3xl bg-slate-950 p-5 text-white">
              <p className="text-sm text-cyan-300">Live risk snapshot</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {["Low", "Medium", "High", "Critical"].map((level, index) => (
                  <div key={level} className="rounded-2xl bg-white/10 p-4">
                    <div className="text-3xl font-bold">{[2, 1, 1, 1][index]}</div>
                    <div className="text-sm text-slate-300">{level}</div>
                  </div>
                ))}
              </div>
            </div>
            <div id="scope" className="mt-6 grid gap-3">
              {features.map((feature) => (
                <div key={feature} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-medium text-slate-700">
                  <span className="h-2.5 w-2.5 rounded-full bg-cyan-500" />
                  {feature}
                </div>
              ))}
            </div>
          </div>
        </div>

        <DisclaimerBanner />
      </section>
    </main>
  );
}
