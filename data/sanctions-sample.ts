export interface SanctionsSampleRecord {
  name: string;
  type: "person" | "entity" | "wallet" | "country";
  list: string;
  value: string;
  reason: string;
}

export const sanctionsSample: SanctionsSampleRecord[] = [
  {
    name: "Sample Blocked Wallet Alpha",
    type: "wallet",
    list: "Local MVP Sample Watchlist",
    value: "0xblockedwallet000000000000000000000000000001",
    reason: "Demo wallet included to validate exact wallet screening behavior.",
  },
  {
    name: "North Star Trading LLC",
    type: "entity",
    list: "Local MVP Sample Watchlist",
    value: "north star trading llc",
    reason: "Demo entity for fuzzy counterparty-name screening.",
  },
  {
    name: "Demo High Risk Jurisdiction",
    type: "country",
    list: "Local MVP Jurisdiction Watchlist",
    value: "KP",
    reason: "Demo jurisdiction entry for placeholder sanctions-country screening.",
  },
];
