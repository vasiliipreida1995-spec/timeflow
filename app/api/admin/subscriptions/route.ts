import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "../../../../lib/firebaseAdmin";
import { queryDb } from "../../../../lib/db";

const SUPERADMIN_EMAIL = (process.env.SUPERADMIN_EMAIL ?? "").toLowerCase();

async function requireAuth(request: NextRequest) {
  const authHeader = request.headers.get("authorization") ?? "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return { ok: false, status: 401, message: "Нет токена" } as const;
  }
  try {
    const token = match[1];
    const decoded = await adminAuth.verifyIdToken(token);
    return { ok: true, uid: decoded.uid, email: decoded.email ?? null } as const;
  } catch {
    return { ok: false, status: 401, message: "Неверный токен" } as const;
  }
}

async function ensureUser(uid: string, email: string | null) {
  await queryDb(
    "INSERT INTO users (user_id, email) VALUES (?, ?) ON DUPLICATE KEY UPDATE email = VALUES(email)",
    [uid, email]
  );
  if (SUPERADMIN_EMAIL && email && email.toLowerCase() === SUPERADMIN_EMAIL) {
    await queryDb("UPDATE users SET role = \"superadmin\" WHERE user_id = ?", [uid]);
  }
}

async function requireSuperadmin(uid: string) {
  const rows = await queryDb<Array<{ role: string | null }>>(
    "SELECT role FROM users WHERE user_id = ? LIMIT 1",
    [uid]
  );
  return rows[0]?.role === "superadmin";
}

export async function GET(request: NextRequest) {
  const guard = await requireAuth(request);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.message }, { status: guard.status });
  }

  await ensureUser(guard.uid, guard.email);

  const isAdmin = await requireSuperadmin(guard.uid);
  if (!isAdmin) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }

  const rows = await queryDb<
    Array<{
      user_id: string;
      email: string | null;
      role: string | null;
      plan: string | null;
      status: string | null;
      ends_at: string | null;
    }>
  >(
    "SELECT u.user_id, u.email, u.role, s.plan, s.status, s.ends_at FROM users u LEFT JOIN subscriptions s ON s.user_id = u.user_id AND s.status = 'active' AND (s.ends_at IS NULL OR s.ends_at >= NOW()) ORDER BY u.updated_at DESC"
  );

  return NextResponse.json({ users: rows });
}

export async function POST(request: NextRequest) {
  const guard = await requireAuth(request);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.message }, { status: guard.status });
  }

  await ensureUser(guard.uid, guard.email);

  const isAdmin = await requireSuperadmin(guard.uid);
  if (!isAdmin) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }

  const body = await request.json();
  const action = String(body?.action ?? "");

  if (action === "set_role") {
    const userId = String(body?.userId ?? "");
    const role = String(body?.role ?? "user");
    if (!userId) return NextResponse.json({ error: "Нет userId" }, { status: 400 });
    await queryDb("UPDATE users SET role = ? WHERE user_id = ?", [role, userId]);
    return NextResponse.json({ ok: true });
  }

  if (action === "set_subscription") {
    const userId = String(body?.userId ?? "");
    const plan = String(body?.plan ?? "start");
    const status = String(body?.status ?? "active");
    const endsAt = body?.endsAt ? String(body.endsAt) : null;
    if (!userId) return NextResponse.json({ error: "Нет userId" }, { status: 400 });
    await queryDb(
      "INSERT INTO subscriptions (user_id, plan, status, starts_at, ends_at) VALUES (?, ?, ?, NOW(), ?)",
      [userId, plan, status, endsAt]
    );
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
}
