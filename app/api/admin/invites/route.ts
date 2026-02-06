import { NextRequest, NextResponse } from "next/server";
import { admin, adminDb } from "../../../../lib/firebaseAdmin";
import { requireAdmin } from "../adminGuard";

type InviteDoc = { email?: string; role?: string };

type InviteResponse = InviteDoc & { id: string };

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.message }, { status: guard.status });
  }

  const snap = await adminDb.collection("web_invites").get();
  const items: InviteResponse[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as InviteDoc) }));
  return NextResponse.json({ invites: items });
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.message }, { status: guard.status });
  }

  const body = (await request.json().catch(() => null)) as Partial<InviteDoc> | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = body?.role === "admin" ? "admin" : "manager";

  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  const ref = await adminDb.collection("web_invites").add({
    email,
    role,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ id: ref.id });
}
