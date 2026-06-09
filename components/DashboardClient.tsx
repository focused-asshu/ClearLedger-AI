"use client";

import { useMemo, useState } from "react";
import { sampleTransactions } from "@/data/sample-transactions";
import { parseTransactionsCsv } from "@/lib/csv";
import { generateComplianceReport, transactionsToCsv } from "@/lib/report";
import { scoreTransactions } from "@/lib/risk-scoring";
import type { RiskLevel, TransactionInput } from "@/lib/types";
import { DisclaimerBanner } from "./DisclaimerBanner";
import { RiskBadge } from "./RiskBadge";
import { TransactionTable } from "./TransactionTable";

type RiskFilter = RiskLevel | "All";

const riskLevels: RiskLevel[] = ["Low", "Medium", "High", "Critical"];
const riskFilters: RiskFilter[] = ["All", ...riskLevels];

function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function DashboardClient() {
  const [transactions, setTransactions] = useState<TransactionInput[]>(sampleTransactions);
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("All");
  const [uploadMessage, setUploadMessage] = useState("Using included sample transaction data.");

  const scoredTransactions = useMemo(() => scoreTransactions(transactions), [transactions]);
  const report = useMemo(() => generateComplianceReport(scoredTransactions), [scoredTransactions]);
  const filteredTransactions = useMemo(
    () =>
      riskFilter === "All"
        ? scoredTransactions
        : scoredTransactions.filter((transaction) => transaction.riskLevel === riskFilter),
    [riskFilter, scoredTransactions],
  );

  const handleUpload = async (file: File | undefined) => {
    if (!file) return;

    try {
      const csv = await file.text();
      const parsedTransactions = parseTransactionsCsv(csv);
      setTransactions(parsedTransactions);
      setUploadMessage(`Loaded ${parsedTransactions.length} transactions from ${file.name}.`);
    } catch (error) {
      setUploadMessage(error instanceof Error ? error.message : "Could not parse CSV file.");
    }
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 rounded-3xl bg-slate-950 p-6 text-white shadow-xl md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">ClearLedger AI</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">Compliance operations dashboard</h1>
            <p className="mt-3 max-w-2xl text-slate-300">
              Upload transaction CSVs, run MVP AML risk rules, review sanctions-placeholder hits, and download founder-demo compliance reports.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4 text-sm text-slate-200">
            <div className="text-2xl font-bold text-white">{report.flaggedTransactions.length}</div>
            flagged high-risk transactions
          </div>
        </header>

        <DisclaimerBanner />

        <section className="grid gap-4 md:grid-cols-4">
          {riskLevels.map((level) => (
            <div key={level} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <RiskBadge level={level} />
                <span className="text-2xl font-bold text-slate-950">{report.riskSummary[level]}</span>
              </div>
              <p className="mt-3 text-sm text-slate-500">{level} transactions in current dataset</p>
            </div>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-5">
            <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">Transaction screening</h2>
                <p className="text-sm text-slate-500">Filter by risk level and inspect rules triggered for each payment.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {riskFilters.map((level) => (
                  <button
                    key={level}
                    onClick={() => setRiskFilter(level)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      riskFilter === level
                        ? "bg-slate-950 text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
            <TransactionTable transactions={filteredTransactions} />
          </div>

          <aside className="space-y-5">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950">CSV upload</h2>
              <p className="mt-2 text-sm text-slate-500">
                Required headers: id, date, customerName, customerCountry, walletAddress, counterpartyName, counterpartyCountry, asset, amount, fiatValueUsd, direction.
              </p>
              <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600 hover:border-cyan-400 hover:bg-cyan-50">
                <span className="font-semibold text-slate-800">Choose CSV file</span>
                <span>Local browser-only parsing for Milestone 1</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  onChange={(event) => void handleUpload(event.target.files?.[0])}
                />
              </label>
              <p className="mt-3 rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-600">{uploadMessage}</p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950">Download reports</h2>
              <p className="mt-2 text-sm text-slate-500">
                Export screened transactions for internal review. Reports include the MVP disclaimer.
              </p>
              <div className="mt-4 grid gap-3">
                <button
                  className="rounded-2xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-cyan-700"
                  onClick={() =>
                    downloadFile(
                      "clearledger-compliance-report.json",
                      JSON.stringify(report, null, 2),
                      "application/json",
                    )
                  }
                >
                  Download JSON report
                </button>
                <button
                  className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
                  onClick={() =>
                    downloadFile("clearledger-transactions.csv", transactionsToCsv(scoredTransactions), "text/csv")
                  }
                >
                  Download CSV report
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950">MVP data status</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                <li>Risk engine uses transparent mock rules for demo and tests.</li>
                <li>Sanctions screening uses local sample placeholder data only; it is not connected to OFAC, UN, EU, UK, or any live sanctions/watchlist source.</li>
                <li>Supabase schema is drafted for next milestone persistence and auth.</li>
              </ul>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
