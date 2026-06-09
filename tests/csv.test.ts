import { describe, expect, it } from "vitest";
import { parseTransactionsCsv } from "@/lib/csv";

const header = "id,date,customerName,customerCountry,walletAddress,counterpartyName,counterpartyCountry,asset,amount,fiatValueUsd,direction";
const validRow = "txn1,2026-06-01,Asha Kapoor,IN,0xabc,Bluefin Capital,SG,USDT,100,100,Outbound";

describe("CSV parsing validation", () => {
  it("normalizes direction values before processing", () => {
    const [transaction] = parseTransactionsCsv(`${header}\n${validRow}`);

    expect(transaction.direction).toBe("outbound");
  });

  it("rejects negative amounts", () => {
    expect(() => parseTransactionsCsv(`${header}\ntxn1,2026-06-01,Asha Kapoor,IN,0xabc,Bluefin Capital,SG,USDT,-1,100,inbound`)).toThrow(
      "Negative amount values are not accepted",
    );
  });

  it("rejects zero-value transactions", () => {
    expect(() => parseTransactionsCsv(`${header}\ntxn1,2026-06-01,Asha Kapoor,IN,0xabc,Bluefin Capital,SG,USDT,0,100,inbound`)).toThrow(
      "Zero amount values are not accepted",
    );
  });

  it("rejects missing identity fields", () => {
    expect(() => parseTransactionsCsv(`${header}\ntxn1,2026-06-01,,IN,0xabc,Bluefin Capital,SG,USDT,100,100,inbound`)).toThrow(
      "Missing required value",
    );
  });

  it("rejects invalid dates", () => {
    expect(() => parseTransactionsCsv(`${header}\ntxn1,not-a-date,Asha Kapoor,IN,0xabc,Bluefin Capital,SG,USDT,100,100,inbound`)).toThrow(
      "Invalid date",
    );
    expect(() => parseTransactionsCsv(`${header}\ntxn1,2026-02-31,Asha Kapoor,IN,0xabc,Bluefin Capital,SG,USDT,100,100,inbound`)).toThrow(
      "real calendar date",
    );
  });

  it("rejects CSV formula injection attempts at upload time", () => {
    expect(() => parseTransactionsCsv(`${header}\ntxn1,2026-06-01,=cmd,IN,0xabc,Bluefin Capital,SG,USDT,100,100,inbound`)).toThrow(
      "Unsafe value",
    );
  });

  it("rejects script or HTML-like payloads at upload time", () => {
    expect(() => parseTransactionsCsv(`${header}\ntxn1,2026-06-01,<script>alert(1)</script>,IN,0xabc,Bluefin Capital,SG,USDT,100,100,inbound`)).toThrow(
      "script/HTML tags",
    );
  });

  it("enforces configurable row limits", () => {
    expect(() => parseTransactionsCsv(`${header}\n${validRow}\n${validRow}`, { maxRows: 1 })).toThrow("Maximum allowed is 1 rows");
  });

  it("enforces configurable file size limits", () => {
    expect(() => parseTransactionsCsv(`${header}\n${validRow}`, { maxBytes: 10 })).toThrow("CSV file is too large");
  });
});
