import { describe, expect, it } from "vitest";
import { sampleTransactions } from "@/data/sample-transactions";
import { COMPLIANCE_DISCLAIMER, generateComplianceReport, transactionsToCsv } from "@/lib/report";
import { scoreTransaction, scoreTransactions } from "@/lib/risk-scoring";
import type { TransactionInput } from "@/lib/types";

const exportInjectionTransaction: TransactionInput = {
  id: "=txn_1",
  date: "2026-06-01",
  customerName: "+Mallory",
  customerCountry: "IN",
  walletAddress: "@wallet",
  counterpartyName: "-Counterparty",
  counterpartyCountry: "SG",
  asset: "USDT",
  amount: 100,
  fiatValueUsd: 100,
  direction: "inbound",
};

describe("compliance report generation", () => {
  it("summarizes risk levels and includes the MVP disclaimer", () => {
    const scored = scoreTransactions(sampleTransactions);
    const report = generateComplianceReport(scored, "2026-06-09T00:00:00.000Z");

    expect(report.generatedAt).toBe("2026-06-09T00:00:00.000Z");
    expect(report.totalTransactions).toBe(sampleTransactions.length);
    expect(report.totalValueUsd).toBe(399900);
    expect(report.riskSummary.Critical).toBeGreaterThan(0);
    expect(report.disclaimer).toBe(COMPLIANCE_DISCLAIMER);
  });

  it("exports screened transaction rows as CSV with explainable score breakdowns", () => {
    const csv = transactionsToCsv(scoreTransactions(sampleTransactions));

    expect(csv).toContain("id,date,customerName");
    expect(csv).toContain("amountContribution,jurisdictionContribution,structuringContribution");
    expect(csv).toContain("riskCalculation");
    expect(csv).toContain("txn_1002");
    expect(csv).toContain("watchlist:SANCTIONS_PLACEHOLDER_HIT:90");
  });

  it("sanitizes CSV formula injection values during export", () => {
    const csv = transactionsToCsv([scoreTransaction(exportInjectionTransaction)]);

    expect(csv).toContain("'=txn_1");
    expect(csv).toContain("'+Mallory");
    expect(csv).toContain("'-Counterparty");
  });
});
