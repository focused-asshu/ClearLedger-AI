"use client";

import { useMemo, useState, useTransition } from "react";
import { sampleTransactions } from "@/data/sample-transactions";
import { DEFAULT_CSV_UPLOAD_LIMITS, parseTransactionsCsvWithDiagnostics } from "@/lib/csv";
import { generateComplianceReport, transactionsToCsv } from "@/lib/report";
import type { PersistentTransaction, RiskLevel, TransactionInput } from "@/lib/types";
import { DisclaimerBanner } from "./DisclaimerBanner";
import { RiskBadge } from "./RiskBadge";
import { TransactionTable } from "./TransactionTable";
import { logout } from "@/app/auth/actions";

const riskLevels: RiskLevel[] = ["Low", "Medium", "High", "Critical"];
type RiskFilter = RiskLevel | "All";
type ReviewFilter = "All" | "Unreviewed" | "Reviewed";
const riskFilters: RiskFilter[] = ["All", ...riskLevels];
const reviewFilters: ReviewFilter[] = ["All", "Unreviewed", "Reviewed"];

function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function DashboardClient({ initialTransactions = [], userEmail = "" }: { initialTransactions?: PersistentTransaction[]; userEmail?: string }) {
  const [transactions, setTransactions] = useState<PersistentTransaction[]>(initialTransactions);
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("All");
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("All");
  const [isPending, startTransition] = useTransition();
  const [uploadMessage, setUploadMessage] = useState("No transactions loaded. Upload a CSV or load sample data to begin.");
  const [uploadStatus, setUploadStatus] = useState<"info" | "success" | "error">("info");
  const [uploadRowErrors, setUploadRowErrors] = useState<Array<{ rowNumber: number; field: string; reason: string }>>([]);

  const scoredTransactions = useMemo(() => transactions, [transactions]);
  const report = useMemo(() => generateComplianceReport(scoredTransactions), [scoredTransactions]);
  const filteredTransactions = useMemo(
    () =>
      scoredTransactions.filter((transaction) => {
        const matchesRisk = riskFilter === "All" || transaction.riskLevel === riskFilter;
        const matchesReview =
          reviewFilter === "All" ||
          (reviewFilter === "Reviewed" && transaction.reviewed) ||
          (reviewFilter === "Unreviewed" && !transaction.reviewed);
        return matchesRisk && matchesReview;
      }),
    [riskFilter, reviewFilter, scoredTransactions],
  );
  const prioritizedAlerts = useMemo(
    () =>
      scoredTransactions
        .filter((transaction) => ["Critical", "High"].includes(transaction.riskLevel))
        .sort((left, right) => right.riskScore - left.riskScore)
        .slice(0, 4),
    [scoredTransactions],
  );
  const totalValueFormatted = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(report.totalValueUsd),
    [report.totalValueUsd],
  );

  const persistScreenedTransactions = async (parsedTransactions: TransactionInput[], sourceName: string) => {
    const response = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactions: parsedTransactions }),
    });
    const payload = (await response.json()) as { transactions?: PersistentTransaction[]; error?: string };

    if (!response.ok || !payload.transactions) {
      throw new Error(payload.error ?? "Could not save transactions to Supabase.");
    }

    setTransactions((current) => [...payload.transactions!, ...current].slice(0, 200));
    setRiskFilter("All");
    setReviewFilter("All");
    setUploadStatus("success");
    setUploadMessage(`${payload.transactions.length} rows screened and saved from ${sourceName}. History keeps the most recent 200 transactions.`);
  };

  const handleLoadSampleData = () => {
    setUploadRowErrors([]);
    startTransition(() => {
      void persistScreenedTransactions(sampleTransactions, "sample data").catch((error) => {
        setUploadStatus("error");
        setUploadMessage(error instanceof Error ? error.message : "Could not save sample transactions.");
      });
    });
  };

  const handleUpload = async (file: File | undefined) => {
    if (!file) return;

    try {
      if (file.size > DEFAULT_CSV_UPLOAD_LIMITS.maxBytes) {
        throw new Error(
          `CSV file is too large. Maximum size is ${DEFAULT_CSV_UPLOAD_LIMITS.maxBytes.toLocaleString()} bytes.`,
        );
      }

      const csv = await file.text();
      const { transactions: parsedTransactions, rejectedRows } = parseTransactionsCsvWithDiagnostics(csv);
      setUploadRowErrors(rejectedRows);
      await persistScreenedTransactions(parsedTransactions, file.name);
      if (rejectedRows.length > 0) {
        setUploadStatus("error");
        setUploadMessage(
          `${parsedTransactions.length} rows imported and saved, ${rejectedRows.length} rows rejected from ${file.name}.`,
        );
      }
    } catch (error) {
      setUploadStatus("error");
      setUploadRowErrors([]);
      setUploadMessage(error instanceof Error ? error.message : "Could not parse CSV file.");
    }
  };

  const handleReviewedChange = async (databaseId: string, reviewed: boolean) => {
    setTransactions((current) => current.map((transaction) => transaction.databaseId === databaseId ? { ...transaction, reviewed } : transaction));
    const response = await fetch(`/api/transactions/${databaseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewed }),
    });
    if (!response.ok) {
      setTransactions((current) => current.map((transaction) => transaction.databaseId === databaseId ? { ...transaction, reviewed: !reviewed } : transaction));
      setUploadStatus("error");
      setUploadMessage("Could not update reviewed status. Please retry.");
    }
  };

  const handleReviewerNoteSave = async (databaseId: string, reviewerNote: string) => {
    const response = await fetch(`/api/transactions/${databaseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewerNote }),
    });
    const payload = (await response.json()) as { reviewerNote?: string; error?: string };
    if (!response.ok) {
      setUploadStatus("error");
      setUploadMessage(payload.error ?? "Could not save reviewer note. Please retry.");
      return;
    }
    setTransactions((current) => current.map((transaction) => transaction.databaseId === databaseId ? { ...transaction, reviewerNote: payload.reviewerNote ?? reviewerNote } : transaction));
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 rounded-3xl bg-slate-950 p-6 text-white shadow-xl md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">ClearLedger AI</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">Compliance operations dashboard</h1>
            <p className="mt-3 max-w-2xl text-slate-300">
              Upload transaction CSVs or explicitly load sample data, run MVP AML risk rules, review sanctions-placeholder hits, and download founder-demo compliance reports.
            </p>
          </div>
          <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/10 p-4 text-sm text-slate-200">
            <div>
              <div className="text-2xl font-bold text-white">{report.flaggedTransactions.length}</div>
              flagged high-risk transactions
            </div>
            <div className="text-xs text-slate-300">Signed in as {userEmail}</div>
            <form action={logout}>
              <button type="submit" className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-slate-100">Log out</button>
            </form>
          </div>
        </header>

        <DisclaimerBanner />

        <section className="grid gap-4 md:grid-cols-4">
          {riskLevels.map((level) => (
            <button
              key={level}
              onClick={() => setRiskFilter(level)}
              className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <RiskBadge level={level} />
                <span className="text-2xl font-bold text-slate-950">{report.riskSummary[level]}</span>
              </div>
              <p className="mt-3 text-sm text-slate-500">{level} transactions in current dataset</p>
            </button>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Risk overview</h2>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl bg-slate-50 p-4">
                <dt className="text-slate-500">Screened value</dt>
                <dd className="mt-1 text-lg font-bold text-slate-950">{totalValueFormatted}</dd>
              </div>
              <div className="rounded-2xl bg-red-50 p-4">
                <dt className="text-red-700">Critical workflow</dt>
                <dd className="mt-1 text-lg font-bold text-red-950">{report.riskSummary.Critical} immediate reviews</dd>
              </div>
            </dl>
            <p className="mt-4 text-xs leading-5 text-slate-500">
              Critical and High items should be reviewed first. This MVP remains compliance assistance only and uses local sample watchlist data.
            </p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Prioritized alerts</h2>
            {prioritizedAlerts.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">No High or Critical alerts in the current dataset.</p>
            ) : (
              <ol className="mt-4 space-y-3">
                {prioritizedAlerts.map((transaction) => (
                  <li key={transaction.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-slate-950">{transaction.id}</span>
                      <RiskBadge level={transaction.riskLevel} />
                    </div>
                    <p className="mt-1 text-xs text-slate-600">{transaction.riskBreakdown.calculation}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-5">
            <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">Transaction screening</h2>
                <p className="text-sm text-slate-500">Filter by risk level, review state, and inspect rules triggered for each payment.</p>
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
                {reviewFilters.map((level) => (
                  <button
                    key={level}
                    onClick={() => setReviewFilter(level)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      reviewFilter === level
                        ? "bg-cyan-700 text-white"
                        : "bg-cyan-50 text-cyan-800 hover:bg-cyan-100"
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
            {transactions.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
                <h3 className="text-lg font-semibold text-slate-950">No transactions loaded.</h3>
                <p className="mt-2 text-sm text-slate-500">Upload CSV or use the Load Sample Data button to populate this founder-demo workspace.</p>
              </div>
            ) : null}
            <TransactionTable transactions={filteredTransactions} onReviewedChange={handleReviewedChange} onReviewerNoteSave={handleReviewerNoteSave} />
          </div>

          <aside className="space-y-5">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950">CSV upload</h2>
              <p className="mt-2 text-sm text-slate-500">
                Required headers: id, date, customerName, customerCountry, walletAddress, counterpartyName, counterpartyCountry, asset, amount, fiatValueUsd, direction. Upload limit: {DEFAULT_CSV_UPLOAD_LIMITS.maxRows.toLocaleString()} rows / {DEFAULT_CSV_UPLOAD_LIMITS.maxBytes.toLocaleString()} bytes.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={handleLoadSampleData}
                  className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
                >
                  Load Sample Data
                </button>
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-600 hover:border-cyan-400 hover:bg-cyan-50">
                  <span className="font-semibold text-slate-800">Choose CSV file</span>
                  <span>Screens and appends to Supabase history</span>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="sr-only"
                    disabled={isPending}
                    onChange={(event) => void handleUpload(event.target.files?.[0])}
                  />
                </label>
              </div>
              <div
                role={uploadStatus === "error" ? "alert" : "status"}
                className={`mt-3 rounded-xl px-3 py-2 text-xs ${
                  uploadStatus === "error"
                    ? "border border-red-200 bg-red-50 text-red-700"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                <p>{uploadMessage}</p>
                {uploadRowErrors.length > 0 ? (
                  <ul className="mt-2 list-disc space-y-1 pl-4">
                    {uploadRowErrors.map((rowError) => (
                      <li key={`${rowError.rowNumber}-${rowError.field}`}>
                        Row {rowError.rowNumber}, {rowError.field}: {rowError.reason}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
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
                <li>Risk engine uses transparent progressive amount ranges and category-level score breakdowns.</li>
                <li>Sanctions screening uses local sample data only.</li>
                <li>Sanctions screening uses local sample placeholder data only; it is not connected to OFAC, UN, EU, UK, or any live sanctions/watchlist source.</li>
                <li>Authenticated workspaces persist transaction history in Supabase with RLS-scoped organization ownership.</li>
              </ul>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
