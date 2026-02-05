"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "../../lib/firebase";
import { subscribeWebUser, updateWebUser } from "../../lib/webUser";

export default function RolePage() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsub: (() => void) | null = null;
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }
      setUid(user.uid);
      unsub = subscribeWebUser(user.uid, (u) => {
        setCurrentRole(u?.role ?? null);
        setLoading(false);
      });
    });
    return () => {
      unsubAuth();
      if (unsub) unsub();
    };
  }, [router]);

  async function setRole(role: "admin" | "manager") {
    if (!uid) return;
    await updateWebUser(uid, { role });
    router.replace("/app");
  }

  if (loading) {
    return <div className="min-h-screen grid place-items-center">...</div>;
  }

  return (
    <div className="min-h-screen grid place-items-center px-6">
      <div className="glass w-full max-w-2xl rounded-3xl p-8">
        <h1 className="text-2xl font-semibold">Выберите роль</h1>
        <p className="mt-2 text-sm text-muted">Роль определяет доступ к проектам и отчётам.</p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <button className="panel p-5 text-left card-hover" onClick={() => setRole("manager")}>
            <p className="text-sm uppercase tracking-[0.25em] text-muted">Manager</p>
            <h2 className="mt-3 text-lg font-semibold">Менеджер</h2>
            <p className="mt-2 text-sm text-muted">Доступ к сменам, отчётам и подтверждениям.</p>
          </button>

          <button className="panel p-5 text-left card-hover" onClick={() => setRole("admin")}>
            <p className="text-sm uppercase tracking-[0.25em] text-muted">Administrator</p>
            <h2 className="mt-3 text-lg font-semibold">Администратор</h2>
            <p className="mt-2 text-sm text-muted">Полный доступ к настройкам и команде.</p>
          </button>
        </div>

        {currentRole && (
          <p className="mt-6 text-sm text-muted">Текущая роль: <span className="text-[#7dd3a7]">{currentRole}</span></p>
        )}
      </div>
    </div>
  );
}
