import { describe, expect, it } from "vitest";
import { scoreTransaction, scoreTransactions } from "@/lib/risk-scoring";
import type { TransactionInput } from "@/lib/types";

const baseTransaction: TransactionInput = {
  id: "txn_test",
  date: "2026-06-01",
  customerName: "Test Customer",
  customerCountry: "IN",
  walletAddress: "0xtest000000000000000000000000000000000000",
  counterpartyName: "Safe Counterparty",
  counterpartyCountry: "SG",
  asset: "USDT",
  amount: 100,
  fiatValueUsd: 100,
  direction: "inbound",
};

describe("risk scoring", () => {
  it("labels small ordinary transfers as low risk with a transparent breakdown", () => {
    const scored = scoreTransaction(baseTransaction);

    expect(scored.riskLevel).toBe("Low");
    expect(scored.riskScore).toBe(0);
    expect(scored.riskFactors).toHaveLength(0);
    expect(scored.riskBreakdown.calculation).toContain("amount 0 + jurisdiction 0");
  });

  it("scores $65k transfers as medium instead of low", () => {
    const scored = scoreTransaction({
      ...baseTransaction,
      fiatValueUsd: 65_000,
      amount: 1,
      asset: "BTC",
    });

    expect(scored.riskLevel).toBe("Medium");
    expect(scored.riskBreakdown.amount).toBe(35);
  });

  it("rapidly approaches critical for huge transaction values", () => {
    const scored = scoreTransaction({
      ...baseTransaction,
      fiatValueUsd: 574_000_000,
      amount: 574_000_000,
    });

    expect(scored.riskLevel).toBe("Critical");
    expect(scored.riskScore).toBe(90);
    expect(scored.riskFactors.map((factor) => factor.code)).toContain("AMOUNT_PROGRESSIVE_VALUE");
  });

  it("scores billion-dollar suspicious transactions as critical", () => {
    const scored = scoreTransaction({
      ...baseTransaction,
      counterpartyCountry: "IR",
      fiatValueUsd: 2_300_000_000,
      amount: 2_300_000_000,
      direction: "outbound",
    });

    expect(scored.riskLevel).toBe("Critical");
    expect(scored.riskScore).toBe(100);
    expect(scored.riskBreakdown.amount).toBe(94);
    expect(scored.riskBreakdown.jurisdiction).toBe(42);
  });

  it("flags local sample sanctions wallet hits as critical", () => {
    const scored = scoreTransaction({
      ...baseTransaction,
      walletAddress: "0xblockedwallet000000000000000000000000000001",
    });

    expect(scored.riskLevel).toBe("Critical");
    expect(scored.riskScore).toBe(90);
    expect(scored.sanctionsHits).toHaveLength(1);
    expect(scored.riskFactors.map((factor) => factor.code)).toContain("SANCTIONS_PLACEHOLDER_HIT");
    expect(scored.riskBreakdown.watchlist).toBe(90);
  });

  it("escalates high-value outbound privacy-asset transfers with high-risk countries", () => {
    const scored = scoreTransaction({
      ...baseTransaction,
      counterpartyCountry: "KP",
      asset: "XMR",
      fiatValueUsd: 125000,
      direction: "outbound",
    });

    expect(scored.riskLevel).toBe("Critical");
    expect(scored.riskScore).toBe(100);
    expect(scored.riskFactors.map((factor) => factor.code)).toEqual(
      expect.arrayContaining([
        "AMOUNT_PROGRESSIVE_VALUE",
        "PRIVACY_ASSET",
        "COUNTERPARTY_HIGH_RISK_COUNTRY",
        "LARGE_OUTBOUND_TRANSFER",
      ]),
    );
  });

  it("detects structuring across same wallet and counterparty in any 7-day window", () => {
    const scored = scoreTransactions([
      { ...baseTransaction, id: "s1", date: "2026-06-01", fiatValueUsd: 9_700, amount: 9_700 },
      { ...baseTransaction, id: "s2", date: "2026-06-03", fiatValueUsd: 9_800, amount: 9_800 },
      { ...baseTransaction, id: "s3", date: "2026-06-07", fiatValueUsd: 9_999, amount: 9_999 },
      { ...baseTransaction, id: "other", walletAddress: "0xother", fiatValueUsd: 9_900, amount: 9_900 },
    ]);

    const structured = scored.filter((transaction) => transaction.id.startsWith("s"));
    expect(structured.every((transaction) => transaction.riskLevel === "High")).toBe(true);
    expect(structured.every((transaction) => transaction.riskScore >= 70)).toBe(true);
    expect(structured.every((transaction) => transaction.riskBreakdown.structuring === 55)).toBe(true);
    expect(structured[0].riskFactors[0].label).toContain("Structuring detected: +40");
    expect(structured[0].riskFactors.map((factor) => factor.code)).toContain("STRUCTURING_NEAR_THRESHOLD_PATTERN");
    expect(structured[0].riskBreakdown.calculation).toContain("structuring detected");
    expect(scored.find((transaction) => transaction.id === "other")?.riskBreakdown.structuring).toBe(0);
  });

  it("floors large structuring windows above $50k at critical risk", () => {
    const scored = scoreTransactions([
      { ...baseTransaction, id: "s1", date: "2026-06-01", fiatValueUsd: 9_700, amount: 9_700 },
      { ...baseTransaction, id: "s2", date: "2026-06-02", fiatValueUsd: 9_800, amount: 9_800 },
      { ...baseTransaction, id: "s3", date: "2026-06-03", fiatValueUsd: 9_900, amount: 9_900 },
      { ...baseTransaction, id: "s4", date: "2026-06-04", fiatValueUsd: 9_950, amount: 9_950 },
      { ...baseTransaction, id: "s5", date: "2026-06-05", fiatValueUsd: 9_990, amount: 9_990 },
      { ...baseTransaction, id: "s6", date: "2026-06-06", fiatValueUsd: 9_995, amount: 9_995 },
    ]);

    expect(scored.every((transaction) => transaction.riskLevel === "Critical")).toBe(true);
    expect(scored.every((transaction) => transaction.riskScore >= 90)).toBe(true);
    expect(scored[0].riskBreakdown.calculation).toContain("critical structuring trigger met");
    expect(scored[0].riskFactors.map((factor) => factor.code)).toContain("STRUCTURING_PATTERN_7_DAY_OVER_50K");
  });

  it("makes 10 x $9,900 transfers critical with transparent linked-count and combined-value details", () => {
    const scored = scoreTransactions(
      Array.from({ length: 10 }, (_, index) => ({
        ...baseTransaction,
        id: `ten_${index + 1}`,
        date: `2026-06-01T${String(index).padStart(2, "0")}:00:00Z`,
        fiatValueUsd: 9_900,
        amount: 9_900,
      })),
    );

    expect(scored.every((transaction) => transaction.riskLevel === "Critical")).toBe(true);
    expect(scored.every((transaction) => transaction.riskScore >= 90)).toBe(true);
    expect(scored[0].structuringAlert).toMatchObject({
      label: "Structuring Alert",
      linkedTransactionCount: 10,
      combinedValueUsd: 99_000,
    });
    expect(scored[0].riskFactors.map((factor) => factor.code)).toEqual(
      expect.arrayContaining([
        "STRUCTURING_PATTERN_7_DAY_OVER_50K",
        "STRUCTURING_PATTERN_10_PLUS_TRANSACTIONS",
        "STRUCTURING_NEAR_THRESHOLD_PATTERN",
      ]),
    );
  });

  it("adds rapid burst risk for 5 linked transfers inside 24 hours", () => {
    const scored = scoreTransactions(
      Array.from({ length: 5 }, (_, index) => ({
        ...baseTransaction,
        id: `burst_${index + 1}`,
        date: `2026-06-01T${String(index * 2).padStart(2, "0")}:00:00Z`,
        fiatValueUsd: 2_500,
        amount: 2_500,
      })),
    );

    expect(scored.every((transaction) => transaction.riskScore >= 70)).toBe(true);
    expect(scored[0].riskBreakdown.structuring).toBe(50);
    expect(scored[0].riskFactors.map((factor) => factor.code)).toContain("STRUCTURING_RAPID_BURST_24H");
  });

  it("adds near-threshold risk for repeated values close to reporting thresholds", () => {
    const scored = scoreTransactions([9_700, 9_850, 9_950, 9_999].map((value, index) => ({
      ...baseTransaction,
      id: `near_${index + 1}`,
      date: `2026-06-0${index + 1}`,
      fiatValueUsd: value,
      amount: value,
    })));

    expect(scored[0].riskBreakdown.structuring).toBe(55);
    expect(scored[0].riskFactors.find((factor) => factor.code === "STRUCTURING_NEAR_THRESHOLD_PATTERN")?.label).toContain("Near-threshold pattern: +15");
  });

  it("adds escalating-pattern risk when values climb toward the reporting threshold", () => {
    const scored = scoreTransactions([2_000, 4_000, 6_000, 8_000, 9_900].map((value, index) => ({
      ...baseTransaction,
      id: `escalating_${index + 1}`,
      date: `2026-06-0${index + 1}`,
      fiatValueUsd: value,
      amount: value,
    })));

    expect(scored[0].riskBreakdown.structuring).toBe(55);
    expect(scored[0].riskFactors.map((factor) => factor.code)).toContain("STRUCTURING_ESCALATING_PATTERN");
  });

  it("does not flag normal repeated payroll transfers as structuring", () => {
    const scored = scoreTransactions(
      Array.from({ length: 6 }, (_, index) => ({
        ...baseTransaction,
        id: `payroll_${index + 1}`,
        date: `2026-${String(index + 1).padStart(2, "0")}-15`,
        counterpartyName: "Payroll Processor",
        fiatValueUsd: 4_500,
        amount: 4_500,
      })),
    );

    expect(scored.every((transaction) => transaction.structuringAlert === undefined)).toBe(true);
    expect(scored.every((transaction) => transaction.riskBreakdown.structuring === 0)).toBe(true);
  });

  it("floors structured activity involving a high-risk jurisdiction at critical risk", () => {
    const scored = scoreTransactions([
      { ...baseTransaction, id: "hr1", date: "2026-06-01", counterpartyCountry: "IR", fiatValueUsd: 4_000, amount: 4_000 },
      { ...baseTransaction, id: "hr2", date: "2026-06-02", counterpartyCountry: "IR", fiatValueUsd: 4_000, amount: 4_000 },
      { ...baseTransaction, id: "hr3", date: "2026-06-03", counterpartyCountry: "IR", fiatValueUsd: 4_000, amount: 4_000 },
    ]);

    expect(scored.every((transaction) => transaction.riskLevel === "Critical")).toBe(true);
    expect(scored.every((transaction) => transaction.riskScore >= 90)).toBe(true);
    expect(scored[0].riskFactors.map((factor) => factor.code)).toContain("STRUCTURING_HIGH_RISK_JURISDICTION");
  });

  it("floors high-risk jurisdiction plus privacy coin at critical risk even for low-value transfers", () => {
    const scored = scoreTransaction({
      ...baseTransaction,
      customerCountry: "IR",
      asset: "XMR",
      fiatValueUsd: 100,
      amount: 100,
    });

    expect(scored.riskLevel).toBe("Critical");
    expect(scored.riskScore).toBeGreaterThanOrEqual(90);
    expect(scored.riskBreakdown.calculation).toContain("privacy asset combined with a high-risk/sanctioned jurisdiction");
  });

  it("makes high-risk jurisdiction and large transfer combinations critical", () => {
    const scored = scoreTransaction({
      ...baseTransaction,
      customerCountry: "SY",
      counterpartyCountry: "KP",
      fiatValueUsd: 500_000,
      amount: 500_000,
    });

    expect(scored.riskLevel).toBe("Critical");
    expect(scored.riskScore).toBe(100);
    expect(scored.riskBreakdown.jurisdiction).toBe(82);
  });
});
