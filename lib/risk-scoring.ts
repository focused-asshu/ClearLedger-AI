import { screenSanctions } from "./sanctions";
import type {
  RiskBreakdown,
  RiskContributionCategory,
  RiskFactor,
  RiskLevel,
  ScoredTransaction,
  StructuringAlert,
  TransactionInput,
} from "./types";

const highRiskJurisdictions = new Set(["IR", "KP", "MM", "SY", "CU"]);
const elevatedRiskJurisdictions = new Set(["VG", "KY", "PA", "RU", "AE", "AF", "BY", "VE", "ZW"]);
const privacyAssets = new Set(["XMR", "ZEC", "DASH"]);
const structuringWindowDays = 7;
const structuringTransactionThresholdUsd = 10000;
const structuringMinimumCount = 3;
const structuringScoreFloor = 70;
const structuringLargeWindowTotalUsd = 50_000;
const structuringLargeWindowScoreFloor = 90;

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

function hasStructuringFactor(factors: RiskFactor[]): boolean {
  return factors.some((factor) => factor.code.startsWith("STRUCTURING_"));
}

function hasCriticalStructuringFactor(factors: RiskFactor[]): boolean {
  return factors.some((factor) =>
    [
      "STRUCTURING_PATTERN_7_DAY_OVER_50K",
      "STRUCTURING_PATTERN_10_PLUS_TRANSACTIONS",
      "STRUCTURING_HIGH_RISK_JURISDICTION",
    ].includes(factor.code),
  );
}

function scoreFloorFromFactors(factors: RiskFactor[]): { floor: number; reasons: string[] } {
  const reasons: string[] = [];
  let floor = 0;

  if (hasStructuringFactor(factors)) {
    floor = Math.max(floor, structuringScoreFloor);
    reasons.push(`structuring detected, so final score is floored at ${structuringScoreFloor}`);
  }

  if (hasCriticalStructuringFactor(factors)) {
    floor = Math.max(floor, structuringLargeWindowScoreFloor);
    reasons.push(
      `critical structuring trigger met (combined value above $${structuringLargeWindowTotalUsd.toLocaleString()}, 10+ linked transactions, or high-risk jurisdiction), so final score is floored at ${structuringLargeWindowScoreFloor}`,
    );
  }

  const hasPrivacyAsset = factors.some((factor) => factor.code === "PRIVACY_ASSET");
  const hasHighRiskJurisdiction = factors.some((factor) =>
    ["CUSTOMER_HIGH_RISK_COUNTRY", "COUNTERPARTY_HIGH_RISK_COUNTRY"].includes(factor.code),
  );

  if (hasPrivacyAsset && hasHighRiskJurisdiction) {
    floor = Math.max(floor, 90);
    reasons.push("privacy asset combined with a high-risk/sanctioned jurisdiction, so final score is floored at 90");
  }

  return { floor, reasons };
}

function finalizeScore(transaction: TransactionInput, factors: RiskFactor[], structuringAlert?: StructuringAlert): ScoredTransaction {
  const sanctionsHits = screenSanctions(transaction);
  const baseRiskBreakdown = buildBreakdown(factors);
  const scoreFloor = scoreFloorFromFactors(factors);
  const riskScore = Math.max(baseRiskBreakdown.cappedTotal, scoreFloor.floor);
  const floorExplanation =
    scoreFloor.reasons.length > 0
      ? `; score floor applied: ${scoreFloor.reasons.join("; ")}; final score ${riskScore}/100`
      : "";
  const riskBreakdown = {
    ...baseRiskBreakdown,
    cappedTotal: riskScore,
    calculation: `${baseRiskBreakdown.calculation}${floorExplanation}`,
  };

  return {
    ...transaction,
    status: transaction.status ?? (riskScore >= 65 ? "flagged" : "cleared"),
    riskScore,
    riskLevel: riskLevelFromScore(riskScore),
    riskFactors: factors,
    riskBreakdown,
    sanctionsHits,
    structuringAlert,
  };
}

export function scoreTransaction(transaction: TransactionInput): ScoredTransaction {
  return finalizeScore(transaction, baseRiskFactors(transaction));
}

function parseValidDate(date: string): number | undefined {
  const timestamp = Date.parse(date);
  return Number.isNaN(timestamp) ? undefined : timestamp;
}

type StructuringWindowRow = { index: number; transaction: TransactionInput; timestamp: number };
type StructuringDetection = { factors: RiskFactor[]; alert: StructuringAlert };

const rapidBurstWindowMs = 24 * 60 * 60 * 1000;
const nearThresholdMinimumUsd = 9_700;

function formatUsd(value: number): string {
  return `$${value.toLocaleString()}`;
}

function buildTimeWindow(startTimestamp: number, endTimestamp: number): string {
  const durationHours = Math.max(0, Math.round((endTimestamp - startTimestamp) / (60 * 60 * 1000)));

  if (durationHours < 24) return `${durationHours} hours`;
  const durationDays = Math.round(durationHours / 24);
  return `${durationDays} days`;
}

function isEscalatingPattern(windowRows: StructuringWindowRow[]): boolean {
  if (windowRows.length < 4) return false;

  const values = windowRows.map((row) => row.transaction.fiatValueUsd);
  const hasMeaningfulIncrease = values.at(-1)! >= nearThresholdMinimumUsd && values[0] <= values.at(-1)! * 0.6;
  return hasMeaningfulIncrease && values.every((value, index) => index === 0 || value > values[index - 1]);
}

function buildStructuringFactors(windowRows: StructuringWindowRow[], total: number): RiskFactor[] {
  const factors: RiskFactor[] = [];
  const linkedCount = windowRows.length;
  const hasHighRiskJurisdiction = windowRows.some(
    ({ transaction }) =>
      highRiskJurisdictions.has(transaction.customerCountry.toUpperCase()) ||
      highRiskJurisdictions.has(transaction.counterpartyCountry.toUpperCase()),
  );
  const nearThresholdCount = windowRows.filter(
    ({ transaction }) => transaction.fiatValueUsd >= nearThresholdMinimumUsd,
  ).length;
  const hasRapidBurst = windowRows.some((row, index) => {
    let burstCount = 0;
    for (let cursor = index; cursor < windowRows.length; cursor += 1) {
      if (windowRows[cursor].timestamp - row.timestamp <= rapidBurstWindowMs) burstCount += 1;
    }
    return burstCount >= 5;
  });
  const hasEscalatingPattern = isEscalatingPattern(windowRows);
  const criticalCodes: string[] = [];

  if (total > structuringLargeWindowTotalUsd) criticalCodes.push("STRUCTURING_PATTERN_7_DAY_OVER_50K");
  if (linkedCount >= 10) criticalCodes.push("STRUCTURING_PATTERN_10_PLUS_TRANSACTIONS");
  if (hasHighRiskJurisdiction) criticalCodes.push("STRUCTURING_HIGH_RISK_JURISDICTION");

  factors.push(
    buildFactor(
      criticalCodes[0] ?? "STRUCTURING_PATTERN_7_DAY",
      `Structuring detected: +40. ${linkedCount} linked sub-$${structuringTransactionThresholdUsd.toLocaleString()} transfers from the same wallet to the same counterparty total ${formatUsd(total)} within ${structuringWindowDays} days.`,
      40,
      criticalCodes.length > 0 ? "Critical" : "High",
      "structuring",
    ),
  );

  criticalCodes.slice(1).forEach((code) => {
    factors.push(
      buildFactor(
        code,
        code === "STRUCTURING_PATTERN_10_PLUS_TRANSACTIONS"
          ? `Structured transaction count: ${linkedCount}. 10+ linked transactions trigger the critical structuring score floor.`
          : "High-risk jurisdiction involved in a structured transaction window triggers the critical structuring score floor.",
        0,
        "Critical",
        "structuring",
      ),
    );
  });

  if (nearThresholdCount >= structuringMinimumCount) {
    factors.push(
      buildFactor(
        "STRUCTURING_NEAR_THRESHOLD_PATTERN",
        `Near-threshold pattern: +15. ${nearThresholdCount} linked transfers are at or above ${formatUsd(nearThresholdMinimumUsd)} but below ${formatUsd(structuringTransactionThresholdUsd)}.`,
        15,
        "High",
        "structuring",
      ),
    );
  }

  if (hasRapidBurst) {
    factors.push(
      buildFactor(
        "STRUCTURING_RAPID_BURST_24H",
        "Rapid burst: +10. 5+ linked transfers occurred within 24 hours.",
        10,
        "High",
        "structuring",
      ),
    );
  }

  if (hasEscalatingPattern) {
    factors.push(
      buildFactor(
        "STRUCTURING_ESCALATING_PATTERN",
        "Escalating structuring pattern: +15. Linked transfer values increase toward the reporting threshold over the window.",
        15,
        "High",
        "structuring",
      ),
    );
  }

  if (total > structuringLargeWindowTotalUsd && !factors.some((factor) => factor.code === "STRUCTURING_PATTERN_7_DAY_OVER_50K")) {
    factors.push(
      buildFactor(
        "STRUCTURING_PATTERN_7_DAY_OVER_50K",
        `Combined structured value: ${formatUsd(total)}. Values above ${formatUsd(structuringLargeWindowTotalUsd)} trigger the critical structuring score floor.`,
        0,
        "Critical",
        "structuring",
      ),
    );
  }

  return factors;
}

function shouldReplaceStructuringDetection(
  existing: StructuringDetection | undefined,
  candidate: StructuringDetection,
): boolean {
  if (!existing) return true;
  if (candidate.alert.linkedTransactionCount !== existing.alert.linkedTransactionCount) {
    return candidate.alert.linkedTransactionCount > existing.alert.linkedTransactionCount;
  }
  if (candidate.alert.combinedValueUsd !== existing.alert.combinedValueUsd) {
    return candidate.alert.combinedValueUsd > existing.alert.combinedValueUsd;
  }
  return candidate.factors.reduce((total, factor) => total + factor.points, 0) > existing.factors.reduce((total, factor) => total + factor.points, 0);
}

function detectStructuringIndexes(transactions: TransactionInput[]): Map<number, StructuringDetection> {
  const structuredIndexes = new Map<number, StructuringDetection>();
  const groups = new Map<string, StructuringWindowRow[]>();
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
      const windowRows: StructuringWindowRow[] = [];
      let total = 0;

      for (let end = start; end < sorted.length; end += 1) {
        if (sorted[end].timestamp - sorted[start].timestamp > windowMs) break;
        windowRows.push(sorted[end]);
        total += sorted[end].transaction.fiatValueUsd;
      }

      if (windowRows.length >= structuringMinimumCount && total > structuringTransactionThresholdUsd) {
        const startDate = new Date(windowRows[0].timestamp).toISOString().slice(0, 10);
        const endDate = new Date(windowRows.at(-1)!.timestamp).toISOString().slice(0, 10);
        const factors = buildStructuringFactors(windowRows, total);
        const detection: StructuringDetection = {
          factors,
          alert: {
            label: "Structuring Alert",
            linkedTransactionCount: windowRows.length,
            combinedValueUsd: total,
            windowStart: startDate,
            windowEnd: endDate,
            timeWindow: buildTimeWindow(windowRows[0].timestamp, windowRows.at(-1)!.timestamp),
          },
        };

        windowRows.forEach((row) => {
          if (shouldReplaceStructuringDetection(structuredIndexes.get(row.index), detection)) {
            structuredIndexes.set(row.index, detection);
          }
        });
      }
    }
  });

  return structuredIndexes;
}

export function scoreTransactions(transactions: TransactionInput[]): ScoredTransaction[] {
  const structuringByIndex = detectStructuringIndexes(transactions);

  return transactions.map((transaction, index) => {
    const factors = baseRiskFactors(transaction);
    const structuringDetection = structuringByIndex.get(index);
    if (structuringDetection) factors.push(...structuringDetection.factors);
    return finalizeScore(transaction, factors, structuringDetection?.alert);
  });
}
