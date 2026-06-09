export type RiskLevel = "Low" | "Medium" | "High" | "Critical";

export type TransactionStatus = "pending" | "cleared" | "flagged" | "reported";

export type RiskContributionCategory =
  | "amount"
  | "jurisdiction"
  | "structuring"
  | "direction"
  | "watchlist"
  | "other";

export interface TransactionInput {
  id: string;
  date: string;
  customerName: string;
  customerCountry: string;
  walletAddress: string;
  counterpartyName: string;
  counterpartyCountry: string;
  asset: string;
  amount: number;
  fiatValueUsd: number;
  direction: "inbound" | "outbound";
  status?: TransactionStatus;
}

export interface SanctionsHit {
  list: string;
  matchedField: "customerName" | "counterpartyName" | "walletAddress" | "country";
  matchedValue: string;
  confidence: number;
  reason: string;
}

export interface RiskFactor {
  code: string;
  label: string;
  points: number;
  severity: RiskLevel;
  category: RiskContributionCategory;
}

export interface RiskBreakdown {
  amount: number;
  jurisdiction: number;
  structuring: number;
  direction: number;
  watchlist: number;
  other: number;
  totalBeforeCap: number;
  cappedTotal: number;
  calculation: string;
}

export interface ScoredTransaction extends TransactionInput {
  riskScore: number;
  riskLevel: RiskLevel;
  riskFactors: RiskFactor[];
  riskBreakdown: RiskBreakdown;
  sanctionsHits: SanctionsHit[];
}

export interface ComplianceReport {
  generatedAt: string;
  totalTransactions: number;
  totalValueUsd: number;
  riskSummary: Record<RiskLevel, number>;
  flaggedTransactions: ScoredTransaction[];
  disclaimer: string;
}
