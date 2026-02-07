"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const totalUsers = users.length;
  const activeSubs = users.filter((u) => u.plan && u.status === "active").length;
  const admins = users.filter((u) => u.role === "manager" || u.role === "superadmin").length;
  const expiringSoon = users.filter((u) => {
    if (!u.ends_at) return false;
    const d = new Date(u.ends_at);
    if (Number.isNaN(d.getTime())) return false;
    const diff = d.getTime() - Date.now();
    return diff > 0 && diff <= 1000 * 60 * 60 * 24 * 7;
  }).length;
  const formatDate = (value: string | null) => {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("ru-RU");
  };

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
    const unsub = auth.onAuthStateChanged((user) => {
      setSignedIn(Boolean(user));
      setAuthReady(true);
      if (!user) {
        router.replace("/login");
        return;
      }
      load();
    });
    return () => unsub();
  }, []);

  if (!authReady) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-muted">
        Проверяем доступ...
      </div>
    );
  }

  if (!signedIn) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-muted">
        Требуется вход.
      </div>
    );
  }


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
        <div className="grid gap-4 lg:grid-cols-4">
          <div className="glass card-hover rounded-3xl p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-muted">Сводка админки</p>
            <p className="mt-3 text-3xl font-semibold">{totalUsers}</p>
            <p className="mt-2 text-sm text-muted">Всего пользователей</p>
          </div>
          <div className="glass card-hover rounded-3xl p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-muted">Подписки</p>
            <p className="mt-3 text-3xl font-semibold">{activeSubs}</p>
            <p className="mt-2 text-sm text-muted">Активные планы</p>
          </div>
          <div className="glass card-hover rounded-3xl p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-muted">Руководители</p>
            <p className="mt-3 text-3xl font-semibold">{admins}</p>
            <p className="mt-2 text-sm text-muted">Роли manager/superadmin</p>
          </div>
          <div className="glass card-hover rounded-3xl p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-muted">Истекают</p>
            <p className="mt-3 text-3xl font-semibold">{expiringSoon}</p>
            <p className="mt-2 text-sm text-muted">В течение 7 дней</p>
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
          <div className="glass card-hover rounded-3xl p-4">
            <div className="overflow-auto">
              <table className="min-w-[900px] w-full text-sm">
                <thead className="text-xs uppercase tracking-[0.2em] text-muted">
                  <tr className="border-b border-soft">
                    <th className="py-3 text-left font-semibold">Пользователь</th>
                    <th className="py-3 text-left font-semibold">Роль</th>
                    <th className="py-3 text-left font-semibold">Подписка</th>
                    <th className="py-3 text-left font-semibold">Статус</th>
                    <th className="py-3 text-left font-semibold">До</th>
                    <th className="py-3 text-left font-semibold">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-soft">
                  {users.map((u) => (
                    <tr key={u.user_id} className="align-top">
                      <td className="py-4 pr-4">
                        <div className="font-semibold">{u.email || u.user_id}</div>
                        <div className="text-xs text-muted">UID: {u.user_id}</div>
                      </td>
                      <td className="py-4 pr-4">
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
                      </td>
                      <td className="py-4 pr-4">
                        <select className="input" id={`plan-${u.user_id}`} defaultValue={u.plan ?? "start"}>
                          {PLAN_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-4 pr-4">
                        <select className="input" id={`status-${u.user_id}`} defaultValue={u.status ?? "active"}>
                          <option value="active">Активна</option>
                          <option value="inactive">Неактивна</option>
                        </select>
                      </td>
                      <td className="py-4 pr-4">
                        <input className="input" id={`ends-${u.user_id}`} type="date" defaultValue={u.ends_at ? u.ends_at.slice(0, 10) : ""} />
                        <div className="mt-2 text-xs text-muted">{formatDate(u.ends_at)}</div>
                      </td>
                      <td className="py-4">
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
                        <div className="mt-2 text-xs text-muted">Текущий план: {u.plan ?? "нет"}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
