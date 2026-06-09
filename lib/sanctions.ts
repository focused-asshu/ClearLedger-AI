import { sanctionsSample } from "@/data/sanctions-sample";
import type { SanctionsHit, TransactionInput } from "./types";

const normalize = (value: string) => value.trim().toLowerCase();

const nameMatches = (source: string, watchValue: string) => {
  const normalizedSource = normalize(source);
  const normalizedWatchValue = normalize(watchValue);
  return (
    normalizedSource === normalizedWatchValue ||
    normalizedSource.includes(normalizedWatchValue) ||
    normalizedWatchValue.includes(normalizedSource)
  );
};

export function screenSanctions(transaction: TransactionInput): SanctionsHit[] {
  const hits: SanctionsHit[] = [];

  for (const record of sanctionsSample) {
    if (record.type === "wallet" && normalize(transaction.walletAddress) === normalize(record.value)) {
      hits.push({
        list: record.list,
        matchedField: "walletAddress",
        matchedValue: transaction.walletAddress,
        confidence: 1,
        reason: record.reason,
      });
    }

    if (record.type === "entity" && nameMatches(transaction.counterpartyName, record.value)) {
      hits.push({
        list: record.list,
        matchedField: "counterpartyName",
        matchedValue: transaction.counterpartyName,
        confidence: 0.92,
        reason: record.reason,
      });
    }

    if (record.type === "person" && nameMatches(transaction.customerName, record.value)) {
      hits.push({
        list: record.list,
        matchedField: "customerName",
        matchedValue: transaction.customerName,
        confidence: 0.9,
        reason: record.reason,
      });
    }

    if (
      record.type === "country" &&
      [transaction.customerCountry, transaction.counterpartyCountry].some(
        (country) => normalize(country) === normalize(record.value),
      )
    ) {
      hits.push({
        list: record.list,
        matchedField: "country",
        matchedValue: record.value,
        confidence: 0.85,
        reason: record.reason,
      });
    }
  }

  return hits;
}
