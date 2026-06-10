import { describe, expect, it } from "vitest";
import { parseTransactionsCsv, parseTransactionsCsvWithDiagnostics } from "@/lib/csv";

const header = "id,date,customerName,customerCountry,walletAddress,counterpartyName,counterpartyCountry,asset,amount,fiatValueUsd,direction";
const validRow = "txn1,2026-06-01,Asha Kapoor,IN,0xabc,Bluefin Capital,SG,USDT,100,100,Outbound";

describe("CSV parsing validation", () => {
  it("normalizes direction values before processing", () => {
    const [transaction] = parseTransactionsCsv(`${header}\n${validRow}`);

    expect(transaction.direction).toBe("outbound");
  });

  it("collects invalid negative amount rows without rejecting valid rows", () => {
    const result = parseTransactionsCsvWithDiagnostics(
      `${header}\n${validRow}\ntxn2,2026-06-01,Asha Kapoor,IN,0xdef,Bluefin Capital,SG,USDT,-1,100,inbound`,
    );

    expect(result.transactions).toHaveLength(1);
    expect(result.rejectedRows).toEqual([
      {
        rowNumber: 3,
        field: "amount",
        reason: "Negative amount values are not accepted.",
      },
    ]);
  });

  it("collects invalid zero-value rows", () => {
    const result = parseTransactionsCsvWithDiagnostics(
      `${header}\ntxn1,2026-06-01,Asha Kapoor,IN,0xabc,Bluefin Capital,SG,USDT,0,100,inbound`,
    );

    expect(result.transactions).toHaveLength(0);
    expect(result.rejectedRows[0]).toMatchObject({ field: "amount", reason: "Zero amount values are not accepted." });
  });

  it("collects rows with missing identity fields", () => {
    const result = parseTransactionsCsvWithDiagnostics(
      `${header}\ntxn1,2026-06-01,,IN,0xabc,Bluefin Capital,SG,USDT,100,100,inbound`,
    );

    expect(result.transactions).toHaveLength(0);
    expect(result.rejectedRows[0]).toMatchObject({ rowNumber: 2, field: "customerName", reason: "Missing required value." });
  });

  it("collects invalid date rows", () => {
    const malformedDate = parseTransactionsCsvWithDiagnostics(
      `${header}\ntxn1,not-a-date,Asha Kapoor,IN,0xabc,Bluefin Capital,SG,USDT,100,100,inbound`,
    );
    const impossibleDate = parseTransactionsCsvWithDiagnostics(
      `${header}\ntxn1,2026-02-31,Asha Kapoor,IN,0xabc,Bluefin Capital,SG,USDT,100,100,inbound`,
    );

    expect(malformedDate.rejectedRows[0].reason).toContain("Invalid date");
    expect(impossibleDate.rejectedRows[0].reason).toContain("real calendar date");
  });

  it("collects CSV formula injection attempts at upload time", () => {
    const result = parseTransactionsCsvWithDiagnostics(
      `${header}\ntxn1,2026-06-01,=cmd,IN,0xabc,Bluefin Capital,SG,USDT,100,100,inbound`,
    );

    expect(result.transactions).toHaveLength(0);
    expect(result.rejectedRows[0]).toMatchObject({ field: "customerName" });
    expect(result.rejectedRows[0].reason).toContain("CSV formula prefixes");
  });

  it("collects script or HTML-like payloads at upload time", () => {
    const result = parseTransactionsCsvWithDiagnostics(
      `${header}\ntxn1,2026-06-01,<script>alert(1)</script>,IN,0xabc,Bluefin Capital,SG,USDT,100,100,inbound`,
    );

    expect(result.transactions).toHaveLength(0);
    expect(result.rejectedRows[0].reason).toContain("script/HTML tags");
  });

  it("rejects javascript: payloads case-insensitively at upload time", () => {
    const result = parseTransactionsCsvWithDiagnostics(
      `${header}\ntxn1,2026-06-01, JaVaScRiPt:alert(1),IN,0xabc,Bluefin Capital,SG,USDT,100,100,inbound`,
    );

    expect(result.transactions).toHaveLength(0);
    expect(result.rejectedRows).toEqual([
      {
        rowNumber: 2,
        field: "customerName",
        reason: "Values beginning with javascript: are not accepted.",
      },
    ]);
  });

  it("parses valid rows while collecting invalid row errors", () => {
    const result = parseTransactionsCsvWithDiagnostics(
      `${header}\n${validRow}\ntxn2,2026-06-01,,IN,0xabc,Bluefin Capital,SG,USDT,100,100,inbound`,
    );

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].id).toBe("txn1");
    expect(result.rejectedRows).toHaveLength(1);
    expect(result.rejectedRows[0]).toMatchObject({ rowNumber: 3, field: "customerName" });
  });

  it("enforces configurable row limits", () => {
    expect(() => parseTransactionsCsv(`${header}\n${validRow}\n${validRow}`, { maxRows: 1 })).toThrow("Maximum allowed is 1 rows");
  });

  it("enforces configurable file size limits", () => {
    expect(() => parseTransactionsCsv(`${header}\n${validRow}`, { maxBytes: 10 })).toThrow("CSV file is too large");
  });
});
