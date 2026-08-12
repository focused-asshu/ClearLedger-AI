// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardClient } from "@/components/DashboardClient";
import { scoreTransactions } from "@/lib/risk-scoring";
import type { PersistentTransaction, TransactionInput } from "@/lib/types";
import { createDemoTransactions } from "@/lib/demo-data";

vi.mock("@/app/auth/actions", () => ({
  logout: vi.fn(),
}));

const header = "id,date,customerName,customerCountry,walletAddress,counterpartyName,counterpartyCountry,asset,amount,fiatValueUsd,direction";
const validRow = "txn1,2026-06-01,Asha Kapoor,IN,0xabc,Bluefin Capital,SG,USDT,100,100,outbound";

function toPersistent(transactions: TransactionInput[]): PersistentTransaction[] {
  return scoreTransactions(transactions).map((transaction, index) => ({
    ...transaction,
    databaseId: `db-${transaction.id}-${index}`,
    uploadBatchId: "batch-1",
    uploadedAt: "2026-06-10T19:00:00Z",
    reviewed: false,
    reviewerNote: "",
  }));
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as { transactions?: TransactionInput[] };
    return new Response(JSON.stringify({ transactions: toPersistent(body.transactions ?? []) }), { status: 200 });
  }));
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

describe("dashboard CSV upload feedback", () => {
  it("starts empty and only loads sample data when requested", async () => {
    render(<DashboardClient />);

    expect(screen.getByText("No transactions loaded.")).toBeInTheDocument();
    expect(screen.queryByText("txn_1001")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /load sample data/i }));

    await waitFor(() => expect(screen.getByText("txn_1001")).toBeInTheDocument());
  });

  it("shows a visible red error when CSV parsing fails", async () => {
    render(<DashboardClient />);

    const input = screen.getByLabelText(/choose csv file/i);
    const file = new File(["wrong,headers\nvalue"], "bad.csv", { type: "text/csv" });

    fireEvent.change(input, { target: { files: [file] } });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Missing required CSV headers");
    expect(alert).toHaveClass("bg-red-50");
  });

  it("imports valid rows and displays row-level errors for rejected rows", async () => {
    render(<DashboardClient />);

    const input = screen.getByLabelText(/choose csv file/i);
    const invalidRow = "txn2,2026-06-01,,IN,0xdef,Bluefin Capital,SG,USDT,100,100,inbound";
    const file = new File([`${header}\n${validRow}\n${invalidRow}`], "partial.csv", { type: "text/csv" });

    fireEvent.change(input, { target: { files: [file] } });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("1 rows imported and saved, 1 rows rejected");
    expect(alert).toHaveTextContent("Row 3, customerName: Missing required value.");

    await waitFor(() => expect(screen.getByText("txn1")).toBeInTheDocument());
    expect(screen.queryByText("txn2")).not.toBeInTheDocument();
  });
});

describe("dashboard public demo isolation", () => {
  it("screens uploads and saves review notes without fetching Supabase APIs", async () => {
    const fetchMock = vi.mocked(fetch);
    render(<DashboardClient initialTransactions={createDemoTransactions()} demoMode />);

    expect(screen.getByText("Demo Mode")).toBeInTheDocument();
    expect(screen.getByText("txn_1001")).toBeInTheDocument();

    const input = screen.getByLabelText(/choose csv file/i);
    fireEvent.change(input, { target: { files: [new File([`${header}\n${validRow}`], "demo.csv", { type: "text/csv" })] } });
    await waitFor(() => expect(screen.getByText("txn1")).toBeInTheDocument());

    fireEvent.click(screen.getAllByRole("button", { name: "Add note" })[0]);
    fireEvent.change(screen.getByPlaceholderText("Reviewer note"), { target: { value: "Demo review only" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByText("Demo review only")).toBeInTheDocument());

    expect(fetchMock).not.toHaveBeenCalled();
    expect(window.localStorage.getItem("clearledger-demo-transactions-v1")).toContain("Demo review only");
  });
});
