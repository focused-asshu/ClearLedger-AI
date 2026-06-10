import type { PersistentTransaction, ScoredTransaction, TransactionInput } from "./types";

export interface TransactionRow {
  id: string;
  upload_batch_id: string;
  created_at: string;
  raw_csv_row: TransactionInput;
  risk_score: number;
  risk_level: ScoredTransaction["riskLevel"];
  flags: string[] | null;
  score_breakdown: ScoredTransaction["riskBreakdown"] | null;
  reviewed: boolean;
  reviewer_note: string | null;
}

export function scoredTransactionToInsert(transaction: ScoredTransaction, uploadBatchId: string, orgId: string) {
  return {
    org_id: orgId,
    upload_batch_id: uploadBatchId,
    raw_csv_row: {
      id: transaction.id,
      date: transaction.date,
      customerName: transaction.customerName,
      customerCountry: transaction.customerCountry,
      walletAddress: transaction.walletAddress,
      counterpartyName: transaction.counterpartyName,
      counterpartyCountry: transaction.counterpartyCountry,
      asset: transaction.asset,
      amount: transaction.amount,
      fiatValueUsd: transaction.fiatValueUsd,
      direction: transaction.direction,
      status: transaction.status,
    },
    risk_score: transaction.riskScore,
    risk_level: transaction.riskLevel,
    flags: transaction.riskFactors.map((factor) => factor.label),
    score_breakdown: transaction.riskBreakdown,
  };
}

export function rowToPersistentTransaction(row: TransactionRow): PersistentTransaction {
  return {
    ...row.raw_csv_row,
    databaseId: row.id,
    uploadBatchId: row.upload_batch_id,
    uploadedAt: row.created_at,
    riskScore: row.risk_score,
    riskLevel: row.risk_level,
    riskFactors: [],
    sanctionsHits: [],
    riskBreakdown: row.score_breakdown ?? {
      amount: 0,
      jurisdiction: 0,
      structuring: 0,
      direction: 0,
      watchlist: 0,
      other: 0,
      totalBeforeCap: row.risk_score,
      cappedTotal: row.risk_score,
      calculation: "Stored transaction from Supabase history.",
    },
    reviewed: row.reviewed,
    reviewerNote: row.reviewer_note ?? "",
  };
}
