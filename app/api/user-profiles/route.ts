import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "../../../lib/firebaseAdmin";
import { queryDb } from "../../../lib/db";

type ProjectDoc = { ownerId?: string | null };

type MemberDoc = { role?: string | null };

type ProfileRow = { user_id: string; phone: string | null; address: string | null };

type ProfilePayload = { projectId?: string; userId?: string; phone?: string | null; address?: string | null };

async function requireAuth(request: NextRequest) {
  const authHeader = request.headers.get("authorization") ?? "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return { ok: false, status: 401, message: "Нет токена" } as const;
  }
  try {
    const token = match[1];
    const decoded = await adminAuth.verifyIdToken(token);
    return { ok: true, uid: decoded.uid } as const;
  } catch {
    return { ok: false, status: 401, message: "Неверный токен" } as const;
  }
}

async function canAccessProfile(uid: string, targetId: string, projectId: string) {
  if (uid === targetId) return true;
  const projectSnap = await adminDb.collection("projects").doc(projectId).get();
  const ownerId = projectSnap.exists ? (projectSnap.data() as ProjectDoc)?.ownerId ?? null : null;
  if (ownerId && ownerId === uid) return true;
  const memberId = `${projectId}_${uid}`;
  const memberSnap = await adminDb.collection("project_members").doc(memberId).get();
  const role = memberSnap.exists ? (memberSnap.data() as MemberDoc)?.role ?? null : null;
  return role === "admin";
}

export async function GET(request: NextRequest) {
  const guard = await requireAuth(request);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.message }, { status: guard.status });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId") ?? "";
  const userId = searchParams.get("userId") ?? "";

  if (!projectId || !userId) {
    return NextResponse.json({ error: "Не хватает параметров" }, { status: 400 });
  }

  const allowed = await canAccessProfile(guard.uid, userId, projectId);
  if (!allowed) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }

  const rows = await queryDb<ProfileRow[]>(
    "SELECT user_id, phone, address FROM user_profiles WHERE user_id = ?",
    [userId]
  );

  const profile = rows[0] ?? null;
  return NextResponse.json({ profile });
}

export async function POST(request: NextRequest) {
  const guard = await requireAuth(request);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.message }, { status: guard.status });
  }

  const body = (await request.json().catch(() => null)) as ProfilePayload | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
  }

  const projectId = body.projectId ?? "";
  const userId = body.userId ?? "";
  if (!projectId || !userId) {
    return NextResponse.json({ error: "Не хватает параметров" }, { status: 400 });
  }

  const allowed = await canAccessProfile(guard.uid, userId, projectId);
  if (!allowed) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }

  const phone = body.phone ?? null;
  const address = body.address ?? null;

  await queryDb(
    "INSERT INTO user_profiles (user_id, phone, address) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE phone = VALUES(phone), address = VALUES(address)",
    [userId, phone, address]
  );

  return NextResponse.json({ ok: true });
}
