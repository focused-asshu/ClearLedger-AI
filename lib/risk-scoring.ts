import { screenSanctions } from "./sanctions";
import type {
  RiskBreakdown,
  RiskContributionCategory,
  RiskFactor,
  RiskLevel,
  ScoredTransaction,
  TransactionInput,
} from "./types";

const highRiskJurisdictions = new Set(["IR", "KP", "MM", "SY", "CU"]);
const elevatedRiskJurisdictions = new Set(["VG", "KY", "PA", "RU", "AE", "AF", "BY", "VE", "ZW"]);
const privacyAssets = new Set(["XMR", "ZEC", "DASH"]);
const structuringWindowDays = 7;
const structuringTransactionThresholdUsd = 10000;
const structuringMinimumCount = 3;

export const AMOUNT_SCORING_RANGES = [
  { minimumUsd: 1_000_000_000, points: 94, label: "At or above $1B: critical-scale transaction value." },
  { minimumUsd: 500_000_000, points: 90, label: "$500M-$999.99M: near-ceiling transaction value." },
  { minimumUsd: 100_000_000, points: 86, label: "$100M-$499.99M: extremely large transaction value." },
  { minimumUsd: 10_000_000, points: 78, label: "$10M-$99.99M: very large transaction value." },
  { minimumUsd: 1_000_000, points: 70, label: "$1M-$9.99M: major transaction value." },
  { minimumUsd: 500_000, points: 62, label: "$500k-$999.99k: substantial transaction value." },
  { minimumUsd: 100_000, points: 45, label: "$100k-$499.99k: high transaction value." },
  { minimumUsd: 50_000, points: 35, label: "$50k-$99.99k: elevated transaction value." },
  { minimumUsd: 10_000, points: 18, label: "$10k-$49.99k: reporting-threshold transaction value." },
] as const;

export function riskLevelFromScore(score: number): RiskLevel {
  if (score >= 90) return "Critical";
  if (score >= 65) return "High";
  if (score >= 35) return "Medium";
  return "Low";
}

function buildFactor(
  code: string,
  label: string,
  points: number,
  severity: RiskLevel,
  category: RiskContributionCategory,
): RiskFactor {
  return { code, label, points, severity, category };
}

function amountRiskFactor(fiatValueUsd: number): RiskFactor | undefined {
  const range = AMOUNT_SCORING_RANGES.find((candidate) => fiatValueUsd >= candidate.minimumUsd);
  if (!range) return undefined;

  return buildFactor("AMOUNT_PROGRESSIVE_VALUE", range.label, range.points, riskLevelFromScore(range.points), "amount");
}

function buildBreakdown(factors: RiskFactor[]): RiskBreakdown {
  const categories: RiskContributionCategory[] = [
    "amount",
    "jurisdiction",
    "structuring",
    "direction",
    "watchlist",
    "other",
  ];
  const subtotalByCategory = categories.reduce(
    (summary, category) => ({
      ...summary,
      [category]: factors
        .filter((factor) => factor.category === category)
        .reduce((total, factor) => total + factor.points, 0),
    }),
    {} as Record<RiskContributionCategory, number>,
  );
  const totalBeforeCap = categories.reduce((total, category) => total + subtotalByCategory[category], 0);
  const cappedTotal = Math.min(100, totalBeforeCap);

  return {
    ...subtotalByCategory,
    totalBeforeCap,
    cappedTotal,
    calculation: `amount ${subtotalByCategory.amount} + jurisdiction ${subtotalByCategory.jurisdiction} + structuring ${subtotalByCategory.structuring} + direction ${subtotalByCategory.direction} + watchlist ${subtotalByCategory.watchlist} + other ${subtotalByCategory.other} = ${totalBeforeCap}; capped at ${cappedTotal}/100`,
  };
}

function baseRiskFactors(transaction: TransactionInput): RiskFactor[] {
  const sanctionsHits = screenSanctions(transaction);
  const factors: RiskFactor[] = [];
  const amountFactor = amountRiskFactor(transaction.fiatValueUsd);

  if (amountFactor) factors.push(amountFactor);

  if (privacyAssets.has(transaction.asset.toUpperCase())) {
    factors.push(
      buildFactor(
        "PRIVACY_ASSET",
        "Transaction uses an asset commonly associated with privacy-enhanced transfers.",
        22,
        "High",
        "other",
      ),
    );
  }

  if (highRiskJurisdictions.has(transaction.customerCountry.toUpperCase())) {
    factors.push(
      buildFactor(
        "CUSTOMER_HIGH_RISK_COUNTRY",
        "Customer jurisdiction is on the MVP high-risk jurisdiction list and requires urgent review.",
        40,
        "High",
        "jurisdiction",
      ),
    );
  } else if (elevatedRiskJurisdictions.has(transaction.customerCountry.toUpperCase())) {
    factors.push(
      buildFactor(
        "CUSTOMER_EDD_COUNTRY",
        "Customer jurisdiction requires enhanced due diligence in the MVP model.",
        18,
        "Medium",
        "jurisdiction",
      ),
    );
  }

  if (highRiskJurisdictions.has(transaction.counterpartyCountry.toUpperCase())) {
    factors.push(
      buildFactor(
        "COUNTERPARTY_HIGH_RISK_COUNTRY",
        "Counterparty jurisdiction is on the MVP high-risk jurisdiction list and requires urgent review.",
        42,
        "High",
        "jurisdiction",
      ),
    );
  } else if (elevatedRiskJurisdictions.has(transaction.counterpartyCountry.toUpperCase())) {
    factors.push(
      buildFactor(
        "COUNTERPARTY_EDD_COUNTRY",
        "Counterparty jurisdiction requires enhanced due diligence in the MVP model.",
        18,
        "Medium",
        "jurisdiction",
      ),
    );
  }

  if (transaction.direction === "outbound" && transaction.fiatValueUsd >= 50_000) {
    factors.push(
      buildFactor(
        "LARGE_OUTBOUND_TRANSFER",
        "Large outbound transfer may require additional approval.",
        20,
        "Medium",
        "direction",
      ),
    );
  }

  if (sanctionsHits.length > 0) {
    factors.push(
      buildFactor(
        "SANCTIONS_PLACEHOLDER_HIT",
        "Matched local sample sanctions/watchlist placeholder data.",
        90,
        "Critical",
        "watchlist",
      ),
    );
  }

  return factors;
}

function finalizeScore(transaction: TransactionInput, factors: RiskFactor[]): ScoredTransaction {
  const sanctionsHits = screenSanctions(transaction);
  const riskBreakdown = buildBreakdown(factors);
  const riskScore = riskBreakdown.cappedTotal;

  return {
    ...transaction,
    status: transaction.status ?? (riskScore >= 65 ? "flagged" : "cleared"),
    riskScore,
    riskLevel: riskLevelFromScore(riskScore),
    riskFactors: factors,
    riskBreakdown,
    sanctionsHits,
  };
}

export function scoreTransaction(transaction: TransactionInput): ScoredTransaction {
  return finalizeScore(transaction, baseRiskFactors(transaction));
}

function parseValidDate(date: string): number | undefined {
  const timestamp = Date.parse(date);
  return Number.isNaN(timestamp) ? undefined : timestamp;
}

function detectStructuringIndexes(transactions: TransactionInput[]): Map<number, RiskFactor> {
  const structuredIndexes = new Map<number, RiskFactor>();
  const groups = new Map<string, Array<{ index: number; transaction: TransactionInput; timestamp: number }>>();
  const windowMs = structuringWindowDays * 24 * 60 * 60 * 1000;

  transactions.forEach((transaction, index) => {
    if (transaction.fiatValueUsd <= 0 || transaction.fiatValueUsd >= structuringTransactionThresholdUsd) return;
    const timestamp = parseValidDate(transaction.date);
    if (timestamp === undefined) return;
    const groupKey = `${transaction.walletAddress.trim().toLowerCase()}::${transaction.counterpartyName.trim().toLowerCase()}`;
    const group = groups.get(groupKey) ?? [];
    group.push({ index, transaction, timestamp });
    groups.set(groupKey, group);
  });

  groups.forEach((group) => {
    const sorted = [...group].sort((left, right) => left.timestamp - right.timestamp);

    for (let start = 0; start < sorted.length; start += 1) {
      const windowRows = [];
      let total = 0;

      for (let end = start; end < sorted.length; end += 1) {
        if (sorted[end].timestamp - sorted[start].timestamp > windowMs) break;
        windowRows.push(sorted[end]);
        total += sorted[end].transaction.fiatValueUsd;
      }

      if (windowRows.length >= structuringMinimumCount && total > structuringTransactionThresholdUsd) {
        const factor = buildFactor(
          "STRUCTURING_PATTERN_7_DAY",
          `${windowRows.length} transactions from the same wallet to the same counterparty within ${structuringWindowDays} days are each below $${structuringTransactionThresholdUsd.toLocaleString()} but total $${total.toLocaleString()}, indicating possible structuring/smurfing.`,
          40,
          "High",
          "structuring",
        );
        windowRows.forEach((row) => structuredIndexes.set(row.index, factor));
      }
    }
  });

  return structuredIndexes;
}

export function scoreTransactions(transactions: TransactionInput[]): ScoredTransaction[] {
  const structuringByIndex = detectStructuringIndexes(transactions);

  return transactions.map((transaction, index) => {
    const factors = baseRiskFactors(transaction);
    const structuringFactor = structuringByIndex.get(index);
    if (structuringFactor) factors.push(structuringFactor);
    return finalizeScore(transaction, factors);
  });
}
