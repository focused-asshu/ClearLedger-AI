import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const body = (await request.json()) as { reviewed?: boolean; reviewerNote?: string };
  const patch: { reviewed?: boolean; reviewer_note?: string } = {};

  if (typeof body.reviewed === "boolean") patch.reviewed = body.reviewed;
  if (typeof body.reviewerNote === "string") patch.reviewer_note = body.reviewerNote;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No supported fields were provided." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("transactions")
    .update(patch)
    .eq("id", id)
    .select("id, reviewed, reviewer_note")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    id: data.id,
    reviewed: data.reviewed,
    reviewerNote: data.reviewer_note ?? "",
  });
}
