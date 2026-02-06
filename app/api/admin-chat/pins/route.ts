import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "../../../../lib/firebaseAdmin";
import { queryDb } from "../../../../lib/db";

type PinRow = { message_id: number | string };

async function requireProjectAdmin(request: NextRequest, projectId: string) {
  const authHeader = request.headers.get("authorization") ?? "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return { ok: false, status: 401, message: "Missing bearer token" } as const;
  }

  try {
    const token = match[1];
    const decoded = await adminAuth.verifyIdToken(token);
    const docId = `${projectId}_${decoded.uid}`;
    const memberSnap = await adminDb.collection("project_members").doc(docId).get();
    const role = memberSnap.exists ? (memberSnap.data()?.role as string | undefined) : undefined;
    if (role !== "admin") {
      return { ok: false, status: 403, message: "Project admin only" } as const;
    }
    return { ok: true, uid: decoded.uid } as const;
  } catch {
    return { ok: false, status: 401, message: "Invalid token" } as const;
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const projectId = body?.projectId ?? "";
  const messageId = body?.messageId ?? "";
  const action = body?.action ?? "toggle";

  if (!projectId || !messageId) {
    return NextResponse.json({ error: "projectId and messageId are required" }, { status: 400 });
  }

  const guard = await requireProjectAdmin(request, projectId);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.message }, { status: guard.status });
  }

  const exists = await queryDb<PinRow[]>(
    "SELECT message_id FROM project_admin_chat_pins WHERE project_id = ? AND message_id = ? LIMIT 1",
    [projectId, messageId]
  );

  if (exists.length > 0 && action === "toggle") {
    await queryDb(
      "DELETE FROM project_admin_chat_pins WHERE project_id = ? AND message_id = ?",
      [projectId, messageId]
    );
    return NextResponse.json({ ok: true, removed: true });
  }

  await queryDb(
    "INSERT INTO project_admin_chat_pins (project_id, message_id, pinned_by, created_at) VALUES (?, ?, ?, NOW())",
    [projectId, messageId, guard.uid]
  );

  return NextResponse.json({ ok: true, added: true });
}
