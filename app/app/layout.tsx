"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useMemo, useState } from "react";
import AuthGate from "../../components/AuthGate";
import { auth } from "../../lib/firebase";
import { subscribeWebUser } from "../../lib/webUser";
import { logoutUser } from "../../lib/userAccess";

const NAV_ITEMS = [
  { href: "/app/overview", label: "Control Room", desc: "Пульс по часам и проектам" },
  { href: "/app/projects", label: "Projects", desc: "Портфель работ и загрузок" },
  { href: "/app/team", label: "Team", desc: "Роли, смены, доступы" },
  { href: "/app/reports", label: "Reports", desc: "Экспорт и аналитика" },
  { href: "/app/settings", label: "Settings", desc: "Политики и интеграции" },
];const SETTINGS_NAV = [
  { href: "/app/settings?section=org", label: "Организация" },
  { href: "/app/settings?section=limits", label: "Лимиты" },
  { href: "/app/settings?section=templates", label: "Шаблоны" },
  { href: "/app/settings?section=communications", label: "Коммуникации" },
  { href: "/app/settings?section=integrations", label: "Интеграции" },
];export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [role, setRole] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let unsub: (() => void) | null = null;
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) return;
      setEmail(user.email ?? null);
      unsub = subscribeWebUser(user.uid, (u) => {
        setRole(u?.role ?? null);
      });
    });
    return () => {
      unsubAuth();
      if (unsub) unsub();
    };
  }, []);

  const nav = useMemo(() => {
    const items = [...NAV_ITEMS];
    if (role === "admin") {
      items.push({ href: "/app/admin", label: "Admin", desc: "  " });
    }
    return items;
  }, [role]);

  const showSettingsNav = pathname.startsWith("/app/settings");

  return (
    <AuthGate>
      <div className="relative min-h-screen overflow-hidden">
        <div className="orb orb--a" />
        <div className="orb orb--b" />
        <div className="orb orb--c" />

        <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-8 px-6 py-8">
          <header className="panel motion p-6">
            <div className="flex flex-wrap items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#7dd3a7] text-[#0b1412] font-semibold">
                    TF
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Timeflow Ops</p>
                    <p className="text-xs text-muted">Web-first OS</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted">
                  <span className="chip">Web-first OS</span>
                  {role && <span className="chip">{role === "admin" ? "Администратор" : "Менеджер"}</span>}
                  {email && <span className="chip">{email}</span>}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button className="btn btn-outline">Создать проект</button>
                <button className="btn btn-primary">Открыть брифинг</button>
                <button className="btn btn-outline" onClick={() => logoutUser()}>Выйти</button>
              </div>
            </div>
          </header>

          <div className="flex flex-col gap-6 lg:flex-row">
            <aside className="w-full shrink-0 lg:w-72">
              <div className="panel p-5">
                <p className="text-xs uppercase tracking-[0.3em] text-muted">Навигация</p>
                <div className="mt-4 grid gap-2">
                  {nav.map((item) => {
                    const active = pathname.startsWith(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`rounded-2xl px-3 py-3 text-sm transition ${
                          active
                            ? "bg-[#7dd3a7]/15 text-[#dff7ec] border border-[#7dd3a7]/40"
                            : "text-muted hover:bg-white/5"
                        }`}
                      >
                        <div className="font-semibold">{item.label}</div>
                        <div className="text-xs text-muted">{item.desc}</div>
                      </Link>
                    );
                  })}
                </div>
              </div>

              {showSettingsNav && (
                <div className="panel mt-4 p-5">
                  <p className="text-xs uppercase tracking-[0.3em] text-muted">Навигация</p>
                  <div className="mt-4 grid gap-2">
                    {SETTINGS_NAV.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="rounded-2xl px-3 py-2 text-sm text-muted transition hover:bg-white/5"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </aside>

            <main className="flex min-h-[70vh] flex-1 flex-col gap-6">
              {children}
            </main>
          </div>
        </div>
      </div>
    </AuthGate>
  );
}
