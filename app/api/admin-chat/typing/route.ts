import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "../../../../lib/firebaseAdmin";
import { queryDb } from "../../../../lib/db";

type TypingRow = { user_id: string | number };

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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId") ?? "";
  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  const guard = await requireProjectAdmin(request, projectId);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.message }, { status: guard.status });
  }

  const rows = await queryDb<TypingRow[]>(
    "SELECT user_id FROM project_admin_chat_typing WHERE project_id = ? AND updated_at >= (NOW() - INTERVAL 10 SECOND)",
    [projectId]
  );

  return NextResponse.json({ typingUsers: rows.map((r) => String(r.user_id)) });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const projectId = body?.projectId ?? "";
  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  const guard = await requireProjectAdmin(request, projectId);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.message }, { status: guard.status });
  }

  await queryDb(
    "INSERT INTO project_admin_chat_typing (project_id, user_id, updated_at) VALUES (?, ?, NOW()) ON DUPLICATE KEY UPDATE updated_at = NOW()",
    [projectId, guard.uid]
  );

  return NextResponse.json({ ok: true });
}
