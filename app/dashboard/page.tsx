export const dynamic = "force-dynamic";

import { DashboardClient } from "@/components/DashboardClient";
import { rowToPersistentTransaction, type TransactionRow } from "@/lib/persistence";
import { createClient } from "@/lib/supabase/server";
import { createDemoTransactions } from "@/lib/demo-data";
import { isDemoMode } from "@/lib/demo-mode";

export default async function DashboardPage() {
  if (isDemoMode()) {
    return <DashboardClient initialTransactions={createDemoTransactions()} demoMode />;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: rows } = await supabase
    .from("transactions")
    .select("id, upload_batch_id, created_at, raw_csv_row, risk_score, risk_level, flags, score_breakdown, reviewed, reviewer_note")
    .order("created_at", { ascending: false })
    .limit(200);

  return <DashboardClient initialTransactions={((rows ?? []) as TransactionRow[]).map(rowToPersistentTransaction)} userEmail={user?.email ?? ""} />;
}
