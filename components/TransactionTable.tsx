import { RiskBadge } from "./RiskBadge";
import type { ScoredTransaction } from "@/lib/types";

export function TransactionTable({ transactions }: { transactions: ScoredTransaction[] }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-4">Transaction</th>
              <th className="px-5 py-4">Customer</th>
              <th className="px-5 py-4">Counterparty</th>
              <th className="px-5 py-4">Asset</th>
              <th className="px-5 py-4">Value</th>
              <th className="px-5 py-4">Risk</th>
              <th className="px-5 py-4">Flags</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {transactions.map((transaction) => (
              <tr key={transaction.id} className="hover:bg-slate-50/80">
                <td className="px-5 py-4">
                  <div className="font-medium text-slate-950">{transaction.id}</div>
                  <div className="text-xs text-slate-500">{transaction.date} · {transaction.direction}</div>
                </td>
                <td className="px-5 py-4">
                  <div className="font-medium text-slate-800">{transaction.customerName}</div>
                  <div className="text-xs text-slate-500">{transaction.customerCountry}</div>
                </td>
                <td className="px-5 py-4">
                  <div className="font-medium text-slate-800">{transaction.counterpartyName}</div>
                  <div className="text-xs text-slate-500">{transaction.counterpartyCountry}</div>
                </td>
                <td className="px-5 py-4 font-medium text-slate-800">
                  {transaction.amount.toLocaleString()} {transaction.asset}
                </td>
                <td className="px-5 py-4 font-semibold text-slate-950">
                  ${transaction.fiatValueUsd.toLocaleString()}
                </td>
                <td className="px-5 py-4">
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
                    <span className="col-span-2 font-medium text-slate-700">{transaction.riskBreakdown.calculation}</span>
                  </div>
                </td>
                <td className="px-5 py-4 text-xs text-slate-600">
                  {transaction.riskFactors.length === 0 ? (
                    <span>No rules triggered</span>
                  ) : (
                    <ul className="max-w-xs list-disc space-y-1 pl-4">
                      {transaction.riskFactors.slice(0, 5).map((factor) => (
                        <li key={`${factor.category}-${factor.code}`}>{factor.label} (+{factor.points})</li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
