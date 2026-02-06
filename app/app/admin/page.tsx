"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../../lib/firebase";
import { subscribeWebUser } from "../../../lib/webUser";

type Invite = { id: string; email?: string | null; role?: string | null };

type WebUserItem = {
  id: string;
  email?: string | null;
  role?: string | null;
  approved?: boolean | null;
};

type ErrorPayload = { error?: string };

type InviteResponse = { invites?: Invite[] };

type UsersResponse = { users?: WebUserItem[] };

async function fetchAdmin(path: string, options: RequestInit = {}) {
  const user = auth.currentUser;
  const token = await user?.getIdToken();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(path, { ...options, headers });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({} as ErrorPayload))) as ErrorPayload;
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return res.json();
}

function getErrorMessage(err: unknown, fallback: string) {
  if (typeof err === "object" && err && "message" in err) {
    return String((err as { message?: unknown }).message ?? fallback);
  }
  return fallback;
}

export default function AdminPage() {
  const [email, setEmail] = useState("");
  const [invites, setInvites] = useState<Invite[]>([]);
  const [users, setUsers] = useState<WebUserItem[]>([]);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsub: (() => void) | null = null;
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) return;
      unsub = subscribeWebUser(user.uid, (u) => {
        setRole(u?.role ?? null);
        setLoading(false);
      });
    });
    return () => {
      unsubAuth();
      if (unsub) unsub();
    };
  }, []);

  useEffect(() => {
    if (role !== "admin") return;
    const load = async () => {
      setError(null);
      try {
        const [inviteData, userData] = await Promise.all([
          fetchAdmin("/api/admin/invites"),
          fetchAdmin("/api/admin/users"),
        ]);
        setInvites((inviteData as InviteResponse).invites ?? []);
        setUsers((userData as UsersResponse).users ?? []);
      } catch (e: unknown) {
        setError(getErrorMessage(e, "Ошибка загрузки"));
      }
    };
    load();
  }, [role]);

  async function addInvite() {
    const clean = email.trim().toLowerCase();
    if (!clean) return;
    setError(null);
    try {
      await fetchAdmin("/api/admin/invites", {
        method: "POST",
        body: JSON.stringify({ email: clean, role: "manager" }),
      });
      setEmail("");
      const items = (await fetchAdmin("/api/admin/invites")) as InviteResponse;
      setInvites(items.invites ?? []);
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Ошибка при создании приглашения"));
    }
  }

  async function removeInvite(id: string) {
    setError(null);
    try {
      await fetchAdmin(`/api/admin/invites/${id}`, { method: "DELETE" });
      const items = (await fetchAdmin("/api/admin/invites")) as InviteResponse;
      setInvites(items.invites ?? []);
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Ошибка при удалении приглашения"));
    }
  }

  if (loading) {
    return <div className="panel motion p-6">Загрузка...</div>;
  }

  if (role !== "admin") {
    return (
      <div className="panel motion p-6">
        <h1 className="text-2xl font-semibold">Админ</h1>
        <p className="mt-2 text-sm text-muted">Доступ только для администраторов.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="panel motion p-6">
        <h1 className="text-2xl font-semibold">Админ</h1>
        <p className="mt-2 text-sm text-muted">Управление приглашениями и пользователями.</p>
      </div>

      {error && <div className="panel motion p-4 text-sm text-red-400">{error}</div>}

      <div className="panel motion p-6">
        <h2 className="text-lg font-semibold">Пригласить менеджера</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <input className="input" placeholder="Email менеджера" onChange={(e) => setEmail(e.target.value)} />
          <button className="btn btn-primary" onClick={addInvite}>
            Пригласить
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="panel motion p-6">
          <h2 className="text-lg font-semibold">Ожидающие приглашения</h2>
          <div className="mt-4 grid gap-2 text-sm">
            {invites.map((i) => (
              <div key={i.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <span>{i.email}</span>
                <button className="btn btn-outline" onClick={() => removeInvite(i.id)}>
                  Удалить
                </button>
              </div>
            ))}
            {invites.length === 0 && <p className="text-sm text-muted">Пока нет приглашений.</p>}
          </div>
        </div>

        <div className="panel motion p-6">
          <h2 className="text-lg font-semibold">Пользователи</h2>
          <div className="mt-4 grid gap-2 text-sm">
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div>
                  <p className="font-semibold">{u.email ?? "Нет email"}</p>
                  <p className="text-xs text-muted">{u.role ?? "Роль не выбрана"}</p>
                </div>
                <span className="pill">{u.approved ? "active" : "pending"}</span>
              </div>
            ))}
            {users.length === 0 && <p className="text-sm text-muted">Пользователей пока нет.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
