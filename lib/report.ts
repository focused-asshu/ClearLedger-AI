import type { ComplianceReport, RiskLevel, ScoredTransaction } from "./types";

export const COMPLIANCE_DISCLAIMER =
  "ClearLedger AI is an MVP compliance-assistance tool. It is not legal advice, does not replace licensed compliance counsel, and does not guarantee regulatory compliance or sanctions-screening completeness.";
  "ClearLedger AI is an MVP compliance-assistance prototype, not legal advice. It does not replace licensed compliance counsel, does not guarantee regulatory compliance, and does not perform live OFAC, UN, EU, UK, or other official sanctions screening. Sanctions/watchlist results come only from local sample placeholder data for demos and tests.";

const riskLevels: RiskLevel[] = ["Low", "Medium", "High", "Critical"];

export function generateComplianceReport(
  transactions: ScoredTransaction[],
  generatedAt = new Date().toISOString(),
): ComplianceReport {
  return {
    generatedAt,
    totalTransactions: transactions.length,
    totalValueUsd: transactions.reduce((sum, transaction) => sum + transaction.fiatValueUsd, 0),
    riskSummary: riskLevels.reduce(
      (summary, level) => ({
        ...summary,
        [level]: transactions.filter((transaction) => transaction.riskLevel === level).length,
      }),
      { Low: 0, Medium: 0, High: 0, Critical: 0 } as Record<RiskLevel, number>,
    ),
    flaggedTransactions: transactions.filter((transaction) =>
      ["High", "Critical"].includes(transaction.riskLevel),
    ),
    disclaimer: COMPLIANCE_DISCLAIMER,
  };
}

const csvEscape = (value: string | number) => {
  const stringValue = String(value);
  return /[",\n]/.test(stringValue) ? `"${stringValue.replaceAll('"', '""')}"` : stringValue;
};

export function transactionsToCsv(transactions: ScoredTransaction[]): string {
  const headers = [
    "id",
    "date",
    "customerName",
    "customerCountry",
    "counterpartyName",
    "counterpartyCountry",
    "asset",
    "amount",
    "fiatValueUsd",
    "direction",
    "riskScore",
    "riskLevel",
    "status",
    "riskFactors",
    "sanctionsHits",
  ];

  const rows = transactions.map((transaction) =>
    [
      transaction.id,
      transaction.date,
      transaction.customerName,
      transaction.customerCountry,
      transaction.counterpartyName,
      transaction.counterpartyCountry,
      transaction.asset,
      transaction.amount,
      transaction.fiatValueUsd,
      transaction.direction,
      transaction.riskScore,
      transaction.riskLevel,
      transaction.status ?? "pending",
      transaction.riskFactors.map((factor) => factor.code).join(";"),
      transaction.sanctionsHits.map((hit) => `${hit.list}:${hit.matchedField}`).join(";"),
    ].map(csvEscape).join(","),
  );

  return [headers.join(","), ...rows].join("\n");
}
