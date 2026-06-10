// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DashboardClient } from "@/components/DashboardClient";

const header = "id,date,customerName,customerCountry,walletAddress,counterpartyName,counterpartyCountry,asset,amount,fiatValueUsd,direction";
const validRow = "txn1,2026-06-01,Asha Kapoor,IN,0xabc,Bluefin Capital,SG,USDT,100,100,outbound";

afterEach(() => cleanup());

describe("dashboard CSV upload feedback", () => {
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
    expect(alert).toHaveTextContent("1 rows imported, 1 rows rejected");
    expect(alert).toHaveTextContent("Row 3, customerName: Missing required value.");

    await waitFor(() => expect(screen.getByText("txn1")).toBeInTheDocument());
    expect(screen.queryByText("txn2")).not.toBeInTheDocument();
  });
});
