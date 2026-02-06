import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "../../../lib/firebaseAdmin";
import { queryDb } from "../../../lib/db";

type SettingsRow = {
  company_name?: string | null;
  timezone?: string | null;
  currency?: string | null;
  language?: string | null;
  max_shift_hours?: number | null;
  min_break_minutes?: number | null;
  confirm_hours?: number | null;
  overtime_policy?: string | null;
  email_sender?: string | null;
  copy_lead?: string | null;
  slack_channel?: string | null;
  telegram_channel?: string | null;
};

type SettingsValues = {
  company_name: string | null;
  timezone: string | null;
  currency: string | null;
  language: string | null;
  max_shift_hours: number | null;
  min_break_minutes: number | null;
  confirm_hours: number | null;
  overtime_policy: string | null;
  email_sender: string | null;
  copy_lead: string | null;
  slack_channel: string | null;
  telegram_channel: string | null;
};

async function requireAuth(request: NextRequest) {
  const authHeader = request.headers.get("authorization") ?? "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return { ok: false, status: 401, message: "Missing bearer token" } as const;
  }
  try {
    const token = match[1];
    const decoded = await adminAuth.verifyIdToken(token);
    return { ok: true, uid: decoded.uid } as const;
  } catch {
    return { ok: false, status: 401, message: "Invalid token" } as const;
  }
}

export async function GET(request: NextRequest) {
  const guard = await requireAuth(request);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.message }, { status: guard.status });
  }

  const rows = await queryDb<SettingsRow[]>(
    "SELECT company_name, timezone, currency, language, max_shift_hours, min_break_minutes, confirm_hours, overtime_policy, email_sender, copy_lead, slack_channel, telegram_channel FROM app_settings WHERE user_id = ?",
    [guard.uid]
  );

  const settings = rows[0] ?? null;
  return NextResponse.json({ settings });
}

export async function POST(request: NextRequest) {
  const guard = await requireAuth(request);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.message }, { status: guard.status });
  }

  const body = (await request.json().catch(() => null)) as Partial<SettingsRow> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const values: SettingsValues = {
    company_name: body.company_name ?? null,
    timezone: body.timezone ?? null,
    currency: body.currency ?? null,
    language: body.language ?? null,
    max_shift_hours: body.max_shift_hours ?? null,
    min_break_minutes: body.min_break_minutes ?? null,
    confirm_hours: body.confirm_hours ?? null,
    overtime_policy: body.overtime_policy ?? null,
    email_sender: body.email_sender ?? null,
    copy_lead: body.copy_lead ?? null,
    slack_channel: body.slack_channel ?? null,
    telegram_channel: body.telegram_channel ?? null,
  };

  await queryDb(
    "INSERT INTO app_settings (user_id, company_name, timezone, currency, language, max_shift_hours, min_break_minutes, confirm_hours, overtime_policy, email_sender, copy_lead, slack_channel, telegram_channel) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE company_name = VALUES(company_name), timezone = VALUES(timezone), currency = VALUES(currency), language = VALUES(language), max_shift_hours = VALUES(max_shift_hours), min_break_minutes = VALUES(min_break_minutes), confirm_hours = VALUES(confirm_hours), overtime_policy = VALUES(overtime_policy), email_sender = VALUES(email_sender), copy_lead = VALUES(copy_lead), slack_channel = VALUES(slack_channel), telegram_channel = VALUES(telegram_channel)",
    [
      guard.uid,
      values.company_name,
      values.timezone,
      values.currency,
      values.language,
      values.max_shift_hours,
      values.min_break_minutes,
      values.confirm_hours,
      values.overtime_policy,
      values.email_sender,
      values.copy_lead,
      values.slack_channel,
      values.telegram_channel,
    ]
  );

  return NextResponse.json({ ok: true });
}
