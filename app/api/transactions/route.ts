import { NextResponse } from "next/server";
import { scoreTransactions } from "@/lib/risk-scoring";
import { scoredTransactionToInsert, rowToPersistentTransaction, type TransactionRow } from "@/lib/persistence";
import { createClient } from "@/lib/supabase/server";
import type { TransactionInput } from "@/lib/types";
import { createDemoTransactions } from "@/lib/demo-data";
import { isDemoMode } from "@/lib/demo-mode";

async function getOrganizationId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data, error } = await supabase
    .from("organizations")
    .select("id")
    .eq("owner_user_id", userId)
    .single();

  if (error || !data) {
    throw new Error("Organization workspace was not found for the signed-in user.");
  }

  return data.id as string;
}

export async function POST(request: Request) {
  if (isDemoMode()) {
    const body = (await request.json()) as { transactions?: TransactionInput[] };
    const transactions = body.transactions ?? [];
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return NextResponse.json({ error: "No transactions were provided." }, { status: 400 });
    }
    const uploadBatchId = `demo-${crypto.randomUUID()}`;
    return NextResponse.json({
      uploadBatchId,
      transactions: createDemoTransactions(transactions, uploadBatchId),
    });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const body = (await request.json()) as { transactions?: TransactionInput[] };
  const transactions = body.transactions ?? [];

  if (!Array.isArray(transactions) || transactions.length === 0) {
    return NextResponse.json({ error: "No transactions were provided." }, { status: 400 });
  }

  const orgId = await getOrganizationId(supabase, user.id);
  const uploadBatchId = crypto.randomUUID();
  const scoredTransactions = scoreTransactions(transactions);
  const rows = scoredTransactions.map((transaction) => scoredTransactionToInsert(transaction, uploadBatchId, orgId));

  const { data, error } = await supabase
    .from("transactions")
    .insert(rows)
    .select("id, upload_batch_id, created_at, raw_csv_row, risk_score, risk_level, flags, score_breakdown, reviewed, reviewer_note")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    uploadBatchId,
    transactions: ((data ?? []) as TransactionRow[]).map(rowToPersistentTransaction),
  });
}
