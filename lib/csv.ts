import type { TransactionInput } from "./types";

const requiredHeaders = [
  "id",
  "date",
  "customerName",
  "customerCountry",
  "walletAddress",
  "counterpartyName",
  "counterpartyCountry",
  "asset",
  "amount",
  "fiatValueUsd",
  "direction",
];

function parseLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"' && inQuotes && nextCharacter === '"') {
      current += '"';
      index += 1;
    } else if (character === '"') {
      inQuotes = !inQuotes;
    } else if (character === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }

  values.push(current.trim());
  return values;
}

export function parseTransactionsCsv(csv: string): TransactionInput[] {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = parseLine(lines[0]);
  const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));
  if (missingHeaders.length > 0) {
    throw new Error(`Missing required CSV headers: ${missingHeaders.join(", ")}`);
  }

  return lines.slice(1).map((line) => {
    const values = parseLine(line);
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));

    const direction = row.direction?.toLowerCase();
    if (direction !== "inbound" && direction !== "outbound") {
      throw new Error(`Invalid direction for transaction ${row.id}: ${row.direction}`);
    }

    return {
      id: row.id,
      date: row.date,
      customerName: row.customerName,
      customerCountry: row.customerCountry,
      walletAddress: row.walletAddress,
      counterpartyName: row.counterpartyName,
      counterpartyCountry: row.counterpartyCountry,
      asset: row.asset,
      amount: Number(row.amount),
      fiatValueUsd: Number(row.fiatValueUsd),
      direction,
      status: row.status as TransactionInput["status"],
    };
  });
}
