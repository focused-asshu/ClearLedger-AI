import { afterEach, describe, expect, it } from "vitest";
import { createDemoTransactions } from "@/lib/demo-data";
import { isDemoMode } from "@/lib/demo-mode";

const originalDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE;

afterEach(() => {
  if (originalDemoMode === undefined) delete process.env.NEXT_PUBLIC_DEMO_MODE;
  else process.env.NEXT_PUBLIC_DEMO_MODE = originalDemoMode;
});

describe("demo mode", () => {
  it("is enabled only by the exact public value true", () => {
    for (const value of [undefined, "false", "TRUE", "1"]) {
      if (value === undefined) delete process.env.NEXT_PUBLIC_DEMO_MODE;
      else process.env.NEXT_PUBLIC_DEMO_MODE = value;
      expect(isDemoMode()).toBe(false);
    }
    process.env.NEXT_PUBLIC_DEMO_MODE = "true";
    expect(isDemoMode()).toBe(true);
  });

  it("creates labelled, local-only persistent records with unchanged risk scoring", () => {
    const transactions = createDemoTransactions();
    expect(transactions).toHaveLength(5);
    expect(transactions.every((transaction) => transaction.databaseId.startsWith("demo-"))).toBe(true);
    expect(transactions.some((transaction) => transaction.riskScore > 0)).toBe(true);
  });
});
