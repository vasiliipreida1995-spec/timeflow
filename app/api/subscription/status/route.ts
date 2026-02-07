import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "../../../../lib/firebaseAdmin";
import { queryDb } from "../../../../lib/db";

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

const SUPERADMIN_EMAIL = (process.env.SUPERADMIN_EMAIL ?? "").toLowerCase();

export async function GET(request: NextRequest) {
  const guard = await requireAuth(request);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.message }, { status: guard.status });
  }

  try {
    await queryDb(
      "INSERT INTO users (user_id, email) VALUES (?, ?) ON DUPLICATE KEY UPDATE email = VALUES(email)",
      [guard.uid, guard.email]
    );
    if (SUPERADMIN_EMAIL && guard.email && guard.email.toLowerCase() === SUPERADMIN_EMAIL) {
      await queryDb("UPDATE users SET role = \"superadmin\" WHERE user_id = ?", [guard.uid]);
    }

    const rows = await queryDb<
      Array<{ role: string | null; plan: string | null; ends_at: string | null }>
    >(
      "SELECT u.role, s.plan, s.ends_at FROM users u LEFT JOIN subscriptions s ON s.user_id = u.user_id AND s.status = 'active' AND (s.ends_at IS NULL OR s.ends_at >= NOW()) WHERE u.user_id = ? ORDER BY s.id DESC LIMIT 1",
      [guard.uid]
    );

    const row = rows[0];
    const active = Boolean(row?.plan);

    return NextResponse.json({
      active,
      plan: row?.plan ?? null,
      endsAt: row?.ends_at ?? null,
      role: row?.role ?? "user",
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ active: false, plan: null, endsAt: null, role: "user" });
  }
}
