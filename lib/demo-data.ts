import { sampleTransactions } from "@/data/sample-transactions";
import { scoreTransactions } from "@/lib/risk-scoring";
import type { PersistentTransaction, TransactionInput } from "@/lib/types";

const DEMO_TIMESTAMP = "2026-07-01T09:00:00.000Z";

export function createDemoTransactions(
  transactions: TransactionInput[] = sampleTransactions,
  batchId = "demo-sample-batch",
): PersistentTransaction[] {
  return scoreTransactions(transactions).map((transaction, index) => ({
    ...transaction,
    databaseId: `demo-${batchId}-${index}-${transaction.id}`,
    uploadBatchId: batchId,
    uploadedAt: DEMO_TIMESTAMP,
    reviewed: false,
    reviewerNote: "",
  }));
}
