import { describe, expect, it } from "vitest";
import { scoreTransaction } from "@/lib/risk-scoring";
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
  it("labels small ordinary transfers as low risk", () => {
    const scored = scoreTransaction(baseTransaction);

    expect(scored.riskLevel).toBe("Low");
    expect(scored.riskScore).toBe(0);
    expect(scored.riskFactors).toHaveLength(0);
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
        "LARGE_VALUE_CRITICAL",
        "PRIVACY_ASSET",
        "COUNTERPARTY_HIGH_RISK_COUNTRY",
        "LARGE_OUTBOUND_TRANSFER",
      ]),
    );
  });
});
