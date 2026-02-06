import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "../../../../../lib/firebaseAdmin";
import { requireAdmin } from "../../adminGuard";

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin(request);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.message }, { status: guard.status });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Missing invite id" }, { status: 400 });
  }

  await adminDb.collection("web_invites").doc(id).delete();
  return NextResponse.json({ ok: true });
}
