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
    expect(structured.every((transaction) => transaction.riskLevel === "Medium")).toBe(true);
    expect(structured.every((transaction) => transaction.riskBreakdown.structuring === 40)).toBe(true);
    expect(structured[0].riskFactors[0].label).toContain("possible structuring/smurfing");
    expect(scored.find((transaction) => transaction.id === "other")?.riskBreakdown.structuring).toBe(0);
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
