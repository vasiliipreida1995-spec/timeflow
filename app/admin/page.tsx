"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { auth } from "../../lib/firebase";

const PLAN_OPTIONS = [
  { value: "start", label: "Start" },
  { value: "team", label: "Team" },
  { value: "business", label: "Business" },
];

const ROLE_OPTIONS = [
  { value: "user", label: "Пользователь" },
  { value: "manager", label: "Руководитель" },
  { value: "superadmin", label: "Superadmin" },
];

type UserRow = {
  user_id: string;
  email: string | null;
  role: string | null;
  plan: string | null;
  status: string | null;
  ends_at: string | null;
};

export default function AdminPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        setError("Нужна авторизация");
        return;
      }
      const res = await fetch("/api/admin/subscriptions", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setError(res.status === 403 ? "Нет доступа" : "Ошибка загрузки");
        return;
      }
      const data = await res.json();
      setUsers(data?.users ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const setRole = async (userId: string, role: string) => {
    setSaving(userId);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;
      await fetch("/api/admin/subscriptions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: "set_role", userId, role }),
      });
      await load();
    } finally {
      setSaving(null);
    }
  };

  const setSubscription = async (userId: string, plan: string, status: string, endsAt: string) => {
    setSaving(userId);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;
      await fetch("/api/admin/subscriptions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "set_subscription",
          userId,
          plan,
          status,
          endsAt: endsAt || null,
        }),
      });
      await load();
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="orb orb--a" />
      <div className="orb orb--b" />
      <div className="orb orb--c" />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 pb-10 pt-8">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#7dd3a7] text-[#0b1412] shadow-[0_10px_30px_rgba(125,211,167,0.35)]">
            TF
          </div>
          <div>
            <p className="text-lg font-semibold">Timeflow Admin</p>
            <p className="text-sm text-muted">Управление руководителями и подписками</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link className="rounded-full border border-soft px-4 py-2 text-sm font-medium text-white/80 transition hover:border-white/30" href="/">
            На сайт
          </Link>
          <Link className="rounded-full bg-[#7dd3a7] px-4 py-2 text-sm font-semibold text-[#0b1412] shadow-[0_12px_30px_rgba(125,211,167,0.25)] transition hover:bg-[#59c48f]" href="/app">
            В приложение
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 pb-24">
        <div className="glass card-hover rounded-3xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-muted">Доступы</p>
              <h1 className="mt-2 text-2xl font-semibold">Руководители и подписки</h1>
              <p className="mt-2 text-sm text-muted">Назначайте роли и активируйте планы прямо здесь.</p>
            </div>
            <button className="btn btn-outline" onClick={load} disabled={loading}>Обновить</button>
          </div>
        </div>

        {error && (
          <div className="glass card-hover rounded-3xl p-6 text-sm text-rose-200">{error}</div>
        )}

        <div className="grid gap-4">
          {loading && <div className="glass card-hover rounded-3xl p-6 text-sm text-muted">Загрузка...</div>}
          {!loading && users.length === 0 && (
            <div className="glass card-hover rounded-3xl p-6 text-sm text-muted">Нет пользователей.</div>
          )}
          {users.map((u) => (
            <div key={u.user_id} className="glass card-hover rounded-3xl p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold">{u.email || u.user_id}</p>
                  <p className="text-xs text-muted">UID: {u.user_id}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <div className="grid gap-2">
                    <p className="text-xs text-muted">Роль</p>
                    <select
                      className="input"
                      defaultValue={u.role ?? "user"}
                      onChange={(e) => setRole(u.user_id, e.target.value)}
                      disabled={saving === u.user_id}
                    >
                      {ROLE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <p className="text-xs text-muted">Подписка</p>
                    <div className="flex flex-wrap gap-2">
                      <select className="input" id={`plan-${u.user_id}`} defaultValue={u.plan ?? "start"}>
                        {PLAN_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      <select className="input" id={`status-${u.user_id}`} defaultValue={u.status ?? "active"}>
                        <option value="active">Активна</option>
                        <option value="inactive">Неактивна</option>
                      </select>
                      <input className="input" id={`ends-${u.user_id}`} type="date" defaultValue={u.ends_at ? u.ends_at.slice(0, 10) : ""} />
                      <button
                        className="btn btn-primary"
                        disabled={saving === u.user_id}
                        onClick={() => {
                          const planEl = document.getElementById(`plan-${u.user_id}`) as HTMLSelectElement | null;
                          const statusEl = document.getElementById(`status-${u.user_id}`) as HTMLSelectElement | null;
                          const endsEl = document.getElementById(`ends-${u.user_id}`) as HTMLInputElement | null;
                          if (!planEl || !statusEl || !endsEl) return;
                          setSubscription(u.user_id, planEl.value, statusEl.value, endsEl.value);
                        }}
                      >
                        Сохранить
                      </button>
                    </div>
                    <p className="text-xs text-muted">Текущий план: {u.plan ?? "нет"}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
