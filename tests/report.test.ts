import { describe, expect, it } from "vitest";
import { sampleTransactions } from "@/data/sample-transactions";
import { COMPLIANCE_DISCLAIMER, generateComplianceReport, transactionsToCsv } from "@/lib/report";
import { scoreTransactions } from "@/lib/risk-scoring";

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

  it("exports screened transaction rows as CSV", () => {
    const csv = transactionsToCsv(scoreTransactions(sampleTransactions));

    expect(csv).toContain("id,date,customerName");
    expect(csv).toContain("txn_1002");
    expect(csv).toContain("SANCTIONS_PLACEHOLDER_HIT");
  });
});
