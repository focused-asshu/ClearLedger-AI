"use client";

import { useState } from "react";
import { RiskBadge } from "./RiskBadge";
import type { PersistentTransaction } from "@/lib/types";

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatUploadedAt(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function TransactionTable({
  transactions,
  onReviewedChange,
  onReviewerNoteSave,
}: {
  transactions: PersistentTransaction[];
  onReviewedChange: (databaseId: string, reviewed: boolean) => void;
  onReviewerNoteSave: (databaseId: string, reviewerNote: string) => Promise<void>;
}) {
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-4">Review</th>
              <th className="px-5 py-4">Transaction</th>
              <th className="px-5 py-4">Customer</th>
              <th className="px-5 py-4">Counterparty</th>
              <th className="px-5 py-4">Asset</th>
              <th className="px-5 py-4">Value</th>
              <th className="px-5 py-4">Risk</th>
              <th className="px-5 py-4">Flags</th>
              <th className="px-5 py-4">Reviewer notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {transactions.map((transaction) => {
              const draft = draftNotes[transaction.databaseId] ?? transaction.reviewerNote;

              return (
                <tr key={transaction.databaseId} className="hover:bg-slate-50/80">
                  <td className="px-5 py-4 align-top">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                      <input
                        type="checkbox"
                        checked={transaction.reviewed}
                        onChange={(event) => onReviewedChange(transaction.databaseId, event.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-cyan-600"
                      />
                      Reviewed
                    </label>
                    {transaction.reviewed ? (
                      <span className="mt-2 inline-flex rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">Reviewed</span>
                    ) : null}
                  </td>
                  <td className="px-5 py-4 align-top">
                    <div className="font-medium text-slate-950">{transaction.id}</div>
                    <div className="text-xs text-slate-500">{transaction.date} · {transaction.direction}</div>
                    <div className="mt-1 text-[11px] text-slate-400">Uploaded {formatUploadedAt(transaction.uploadedAt)}</div>
                  </td>
                  <td className="px-5 py-4 align-top">
                    <div className="font-medium text-slate-800">{transaction.customerName}</div>
                    <div className="text-xs text-slate-500">{transaction.customerCountry}</div>
                  </td>
                  <td className="px-5 py-4 align-top">
                    <div className="font-medium text-slate-800">{transaction.counterpartyName}</div>
                    <div className="text-xs text-slate-500">{transaction.counterpartyCountry}</div>
                  </td>
                  <td className="px-5 py-4 align-top font-medium text-slate-800">
                    {transaction.amount.toLocaleString()} {transaction.asset}
                  </td>
                  <td className="px-5 py-4 align-top font-semibold text-slate-950">
                    ${transaction.fiatValueUsd.toLocaleString()}
                  </td>
                  <td className="px-5 py-4 align-top">
                    <div className="flex items-center gap-2">
                      <RiskBadge level={transaction.riskLevel} />
                      <span className="text-xs text-slate-500">{transaction.riskScore}/100</span>
                    </div>
                    <div className="mt-2 grid min-w-72 grid-cols-2 gap-1 rounded-xl bg-slate-50 p-2 text-[11px] leading-4 text-slate-600">
                      <span>Amount: +{transaction.riskBreakdown.amount}</span>
                      <span>Jurisdiction: +{transaction.riskBreakdown.jurisdiction}</span>
                      <span>Structuring: +{transaction.riskBreakdown.structuring}</span>
                      <span>Direction: +{transaction.riskBreakdown.direction}</span>
                      <span>Watchlist: +{transaction.riskBreakdown.watchlist}</span>
                      <span>Other: +{transaction.riskBreakdown.other}</span>
                      {transaction.structuringAlert ? (
                        <>
                          <span className="col-span-2 font-semibold text-amber-800">Combined structured value: {formatUsd(transaction.structuringAlert.combinedValueUsd)}</span>
                          <span className="col-span-2 font-semibold text-amber-800">Structured transaction count: {transaction.structuringAlert.linkedTransactionCount}</span>
                        </>
                      ) : null}
                      <span className="col-span-2 font-medium text-slate-700">{transaction.riskBreakdown.calculation}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 align-top text-xs text-slate-600">
                    {transaction.structuringAlert ? (
                      <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900">
                        <div className="font-bold">Structuring Alert</div>
                        <div>{transaction.structuringAlert.linkedTransactionCount} linked transactions</div>
                        <div>Combined value: {formatUsd(transaction.structuringAlert.combinedValueUsd)}</div>
                        <div>Time window: {transaction.structuringAlert.timeWindow} ({transaction.structuringAlert.windowStart} to {transaction.structuringAlert.windowEnd})</div>
                      </div>
                    ) : null}
                    {transaction.riskFactors.length === 0 ? (
                      <span>No rules triggered</span>
                    ) : (
                      <ul className="max-w-xs list-disc space-y-1 pl-4">
                        {transaction.riskFactors.slice(0, 6).map((factor) => (
                          <li key={`${transaction.databaseId}-${factor.category}-${factor.code}`}>{factor.label} (+{factor.points})</li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="px-5 py-4 align-top text-xs text-slate-600">
                    {transaction.reviewerNote ? <p className="mb-2 max-w-xs rounded-xl bg-slate-50 p-2 text-slate-700">{transaction.reviewerNote}</p> : null}
                    {editingNoteId === transaction.databaseId ? (
                      <form
                        className="space-y-2"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void onReviewerNoteSave(transaction.databaseId, draft).then(() => setEditingNoteId(null));
                        }}
                      >
                        <input
                          value={draft}
                          onChange={(event) => setDraftNotes((current) => ({ ...current, [transaction.databaseId]: event.target.value }))}
                          className="w-56 rounded-lg border border-slate-300 px-2 py-1 text-slate-950"
                          placeholder="Reviewer note"
                        />
                        <div className="flex gap-2">
                          <button type="submit" className="rounded-full bg-slate-950 px-3 py-1 font-semibold text-white">Save</button>
                          <button type="button" onClick={() => setEditingNoteId(null)} className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">Cancel</button>
                        </div>
                      </form>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setDraftNotes((current) => ({ ...current, [transaction.databaseId]: transaction.reviewerNote }));
                          setEditingNoteId(transaction.databaseId);
                        }}
                        className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700 hover:bg-slate-200"
                      >
                        {transaction.reviewerNote ? "Edit note" : "Add note"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
