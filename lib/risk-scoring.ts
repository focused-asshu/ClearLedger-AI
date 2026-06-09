import { screenSanctions } from "./sanctions";
import type { RiskFactor, RiskLevel, ScoredTransaction, TransactionInput } from "./types";

const highRiskJurisdictions = new Set(["IR", "KP", "MM", "SY"]);
const elevatedRiskJurisdictions = new Set(["VG", "KY", "PA", "RU", "AE"]);
const privacyAssets = new Set(["XMR", "ZEC", "DASH"]);

export function riskLevelFromScore(score: number): RiskLevel {
  if (score >= 90) return "Critical";
  if (score >= 65) return "High";
  if (score >= 35) return "Medium";
  return "Low";
}

export function scoreTransaction(transaction: TransactionInput): ScoredTransaction {
  const sanctionsHits = screenSanctions(transaction);
  const factors: RiskFactor[] = [];

  if (transaction.fiatValueUsd >= 100000) {
    factors.push({
      code: "LARGE_VALUE_CRITICAL",
      label: "Transaction value is at or above $100,000.",
      points: 35,
      severity: "High",
    });
  } else if (transaction.fiatValueUsd >= 10000) {
    factors.push({
      code: "LARGE_VALUE_MEDIUM",
      label: "Transaction value is at or above $10,000.",
      points: 18,
      severity: "Medium",
    });
  }

  if (privacyAssets.has(transaction.asset.toUpperCase())) {
    factors.push({
      code: "PRIVACY_ASSET",
      label: "Transaction uses an asset commonly associated with privacy-enhanced transfers.",
      points: 22,
      severity: "High",
    });
  }

  if (highRiskJurisdictions.has(transaction.customerCountry.toUpperCase())) {
    factors.push({
      code: "CUSTOMER_HIGH_RISK_COUNTRY",
      label: "Customer jurisdiction is on the MVP high-risk jurisdiction list.",
      points: 30,
      severity: "High",
    });
  }

  if (highRiskJurisdictions.has(transaction.counterpartyCountry.toUpperCase())) {
    factors.push({
      code: "COUNTERPARTY_HIGH_RISK_COUNTRY",
      label: "Counterparty jurisdiction is on the MVP high-risk jurisdiction list.",
      points: 32,
      severity: "High",
    });
  } else if (elevatedRiskJurisdictions.has(transaction.counterpartyCountry.toUpperCase())) {
    factors.push({
      code: "COUNTERPARTY_ELEVATED_RISK_COUNTRY",
      label: "Counterparty jurisdiction needs enhanced due diligence review.",
      points: 14,
      severity: "Medium",
    });
  }

  if (transaction.direction === "outbound" && transaction.fiatValueUsd >= 50000) {
    factors.push({
      code: "LARGE_OUTBOUND_TRANSFER",
      label: "Large outbound transfer may require additional approval.",
      points: 20,
      severity: "Medium",
    });
  }

  if (sanctionsHits.length > 0) {
    factors.push({
      code: "SANCTIONS_PLACEHOLDER_HIT",
      label: "Matched local sample sanctions/watchlist placeholder data.",
      points: 90,
      severity: "Critical",
    });
  }

  const riskScore = Math.min(
    100,
    factors.reduce((total, factor) => total + factor.points, 0),
  );

  return {
    ...transaction,
    status: transaction.status ?? (riskScore >= 65 ? "flagged" : "cleared"),
    riskScore,
    riskLevel: riskLevelFromScore(riskScore),
    riskFactors: factors,
    sanctionsHits,
  };
}

export function scoreTransactions(transactions: TransactionInput[]): ScoredTransaction[] {
  return transactions.map(scoreTransaction);
}
