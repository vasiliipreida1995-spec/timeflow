import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "../../../lib/firebaseAdmin";
import { queryDb } from "../../../lib/db";

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
  } catch (e) {
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

  const rows = await queryDb<any[]>(
    "SELECT id, sender_id, text, created_at, attachment_url, attachment_name, priority FROM project_admin_chat WHERE project_id = ? ORDER BY created_at DESC LIMIT 50",
    [projectId]
  );

  const messages = rows.map((row) => ({
    id: String(row.id),
    senderId: row.sender_id,
    text: row.text,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
  }));

  const ids = messages.map((m) => m.id);
  let reactions: Record<string, { emoji: string; count: number; mine: boolean }[]> = {};
  let pinnedIds: string[] = [];
  let readCounts: Record<string, number> = {};

  if (ids.length > 0) {
    const placeholders = ids.map(() => "?").join(",");
    const reactionRows = await queryDb<any[]>(
      `SELECT message_id, emoji, COUNT(*) as count, SUM(sender_id = ?) as mine
       FROM project_admin_chat_reactions
       WHERE project_id = ? AND message_id IN (${placeholders})
       GROUP BY message_id, emoji`,
      [guard.uid, projectId, ...ids]
    );

    reactions = reactionRows.reduce((acc, row) => {
      const id = String(row.message_id);
      if (!acc[id]) acc[id] = [];
      acc[id].push({ emoji: row.emoji, count: Number(row.count), mine: Number(row.mine) > 0 });
      return acc;
    }, {} as Record<string, { emoji: string; count: number; mine: boolean }[]>);

    const pinRows = await queryDb<any[]>(
      "SELECT message_id FROM project_admin_chat_pins WHERE project_id = ?",
      [projectId]
    );
    pinnedIds = pinRows.map((r) => String(r.message_id));

    const readRows = await queryDb<any[]>(
      `SELECT r.message_id, COUNT(DISTINCT r.user_id) as count
       FROM project_admin_chat_reads r
       JOIN project_admin_chat m ON m.id = r.message_id
       WHERE r.project_id = ? AND r.message_id IN (${placeholders}) AND r.user_id <> m.sender_id
       GROUP BY r.message_id`,
      [projectId, ...ids]
    );
    readCounts = readRows.reduce((acc, row) => {
      acc[String(row.message_id)] = Number(row.count) || 0;
      return acc;
    }, {} as Record<string, number>);
  }

  return NextResponse.json({ messages: messages.reverse(), reactions, pinnedIds, readCounts });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const projectId = body?.projectId ?? "";
  const text = body?.text ?? "";

  if (!projectId || typeof text !== "string") {
    return NextResponse.json({ error: "projectId and text are required" }, { status: 400 });
  }

  const clean = text.trim();
  if (!clean) {
    return NextResponse.json({ error: "Empty message" }, { status: 400 });
  }

  const guard = await requireProjectAdmin(request, projectId);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.message }, { status: guard.status });
  }

  await queryDb(
    "INSERT INTO project_admin_chat (project_id, sender_id, text, attachment_url, attachment_name, priority, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())",
    [projectId, guard.uid, clean, body?.attachmentUrl ?? null, body?.attachmentName ?? null, body?.priority ?? "normal"]
  );

  return NextResponse.json({ ok: true });
}