import type { TransactionInput, TransactionStatus } from "./types";

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

const requiredTextFields = [
  "id",
  "date",
  "customerName",
  "customerCountry",
  "walletAddress",
  "counterpartyName",
  "counterpartyCountry",
  "asset",
  "direction",
];

export const DEFAULT_CSV_UPLOAD_LIMITS = {
  maxRows: 1_000,
  maxBytes: 1_000_000,
} as const;

interface ParseTransactionsCsvOptions {
  maxRows?: number;
  maxBytes?: number;
}

export interface CsvRowError {
  rowNumber: number;
  field: string;
  reason: string;
}

export interface ParseTransactionsCsvResult {
  transactions: TransactionInput[];
  rejectedRows: CsvRowError[];
}

class CsvRowValidationError extends Error {
  constructor(
    public readonly rowNumber: number,
    public readonly field: string,
    public readonly reason: string,
  ) {
    super(reason);
  }
}

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

function rejectRow(rowNumber: number, field: string, reason: string): never {
  throw new CsvRowValidationError(rowNumber, field, reason);
}

function assertSafeCell(value: string, field: string, rowNumber: number) {
  const trimmed = value.trim();
  const startsWithFormulaPrefix = /^[=+\-@]/.test(trimmed);
  const containsMarkup = /<\s*\/?\s*[a-z][^>]*>/i.test(trimmed);
  const startsWithJavascriptProtocol = /^javascript:/i.test(trimmed);

  if (startsWithJavascriptProtocol) {
    rejectRow(rowNumber, field, "Values beginning with javascript: are not accepted.");
  }

  if (startsWithFormulaPrefix || containsMarkup) {
    rejectRow(
      rowNumber,
      field,
      "CSV formula prefixes (=, +, -, @) and script/HTML tags are not accepted.",
    );
  }
}

function parsePositiveNumber(value: string, field: "amount" | "fiatValueUsd", rowNumber: number): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    rejectRow(rowNumber, field, `Invalid numeric value: ${value}`);
  }

  if (parsed < 0) {
    rejectRow(rowNumber, field, `Negative ${field} values are not accepted.`);
  }

  if (parsed === 0) {
    rejectRow(rowNumber, field, `Zero ${field} values are not accepted.`);
  }

  return parsed;
}

function assertValidDate(value: string, rowNumber: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());

  if (!match) {
    rejectRow(rowNumber, "date", `Invalid date: ${value}. Use YYYY-MM-DD.`);
  }

  const [, year, month, day] = match;
  const parsed = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  const isRoundTripValid =
    parsed.getUTCFullYear() === Number(year) &&
    parsed.getUTCMonth() + 1 === Number(month) &&
    parsed.getUTCDate() === Number(day);

  if (!isRoundTripValid) {
    rejectRow(rowNumber, "date", `Invalid date: ${value}. Use a real calendar date.`);
  }
}

function normalizeDirection(value: string, rowNumber: number): TransactionInput["direction"] {
  const direction = value.trim().toLowerCase();

  if (direction !== "inbound" && direction !== "outbound") {
    rejectRow(rowNumber, "direction", `Invalid direction: ${value}`);
  }

  return direction;
}

function parseTransactionRow(headers: string[], line: string, rowNumber: number): TransactionInput {
  const values = parseLine(line);
  const row = Object.fromEntries(headers.map((header, headerIndex) => [header, values[headerIndex] ?? ""]));

  for (const field of requiredTextFields) {
    if (!row[field]?.trim()) {
      rejectRow(rowNumber, field, "Missing required value.");
    }
  }

  const amount = parsePositiveNumber(row.amount, "amount", rowNumber);
  const fiatValueUsd = parsePositiveNumber(row.fiatValueUsd, "fiatValueUsd", rowNumber);

  headers.forEach((header) => {
    if (header !== "amount" && header !== "fiatValueUsd") {
      assertSafeCell(row[header] ?? "", header, rowNumber);
    }
  });

  assertValidDate(row.date, rowNumber);
  const direction = normalizeDirection(row.direction, rowNumber);

  return {
    id: row.id,
    date: row.date,
    customerName: row.customerName,
    customerCountry: row.customerCountry,
    walletAddress: row.walletAddress,
    counterpartyName: row.counterpartyName,
    counterpartyCountry: row.counterpartyCountry,
    asset: row.asset,
    amount,
    fiatValueUsd,
    direction,
    status: row.status as TransactionStatus | undefined,
  };
}

export function parseTransactionsCsvWithDiagnostics(
  csv: string,
  options: ParseTransactionsCsvOptions = {},
): ParseTransactionsCsvResult {
  const maxRows = options.maxRows ?? DEFAULT_CSV_UPLOAD_LIMITS.maxRows;
  const maxBytes = options.maxBytes ?? DEFAULT_CSV_UPLOAD_LIMITS.maxBytes;
  const csvBytes = new TextEncoder().encode(csv).byteLength;

  if (csvBytes > maxBytes) {
    throw new Error(`CSV file is too large. Maximum size is ${maxBytes.toLocaleString()} bytes.`);
  }

  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return { transactions: [], rejectedRows: [] };

  const dataRowCount = lines.length - 1;
  if (dataRowCount > maxRows) {
    throw new Error(`CSV has ${dataRowCount.toLocaleString()} rows. Maximum allowed is ${maxRows.toLocaleString()} rows.`);
  }

  const headers = parseLine(lines[0]);
  const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));
  if (missingHeaders.length > 0) {
    throw new Error(`Missing required CSV headers: ${missingHeaders.join(", ")}`);
  }

  const transactions: TransactionInput[] = [];
  const rejectedRows: CsvRowError[] = [];

  lines.slice(1).forEach((line, index) => {
    const rowNumber = index + 2;

    try {
      transactions.push(parseTransactionRow(headers, line, rowNumber));
    } catch (error) {
      if (error instanceof CsvRowValidationError) {
        rejectedRows.push({ rowNumber: error.rowNumber, field: error.field, reason: error.reason });
        return;
      }

      throw error;
    }
  });

  return { transactions, rejectedRows };
}

export function parseTransactionsCsv(csv: string, options: ParseTransactionsCsvOptions = {}): TransactionInput[] {
  return parseTransactionsCsvWithDiagnostics(csv, options).transactions;
}
