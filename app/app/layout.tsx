"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { collection, collectionGroup, doc, getDoc, getDocs, limit, query, where } from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
import AuthGate from "../../components/AuthGate";
import { auth, db } from "../../lib/firebase";
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
  const [searchValue, setSearchValue] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [allUsers, setAllUsers] = useState<Array<{ id: string; name: string; email: string; avatar?: string | null }>>([]);
  const searchWrapRef = useRef<HTMLDivElement | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [profileName, setProfileName] = useState("Нет имени");
  const [profileEmail, setProfileEmail] = useState("Нет данных");
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const [brokenAvatar, setBrokenAvatar] = useState(false);
  const [profilePhone, setProfilePhone] = useState("");
  const [profileAddress, setProfileAddress] = useState("");
  const [profileHoursMode, setProfileHoursMode] = useState<"month" | "all">("month");
  const [profileHours, setProfileHours] = useState<number | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileProjectName, setProfileProjectName] = useState("");
  const [profileProjectId, setProfileProjectId] = useState("");
  const [profileRole, setProfileRole] = useState("");
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
  const monthKey = useMemo(() => {
    const d = new Date();
    const m = (d.getMonth() + 1).toString().padStart(2, "0");
    return `${d.getFullYear()}-${m}`;
  }, []);

  const projectIdFromPath = useMemo(() => {
    const parts = pathname.split("/");
    if (parts[1] === "app" && parts[2] === "projects" && parts[3]) {
      return parts[3];
    }
    return "";
  }, [pathname]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setSearchLoading(true);
      try {
        const snap = await getDocs(query(collection(db, "users_public"), limit(200)));
        if (!active) return;
        const list = snap.docs.map((docSnap) => {
          const data = docSnap.data() as any;
          return {
            id: docSnap.id,
            name: data?.name ?? data?.email ?? "Нет имени",
            email: data?.email ?? "",
            avatar: data?.photoURL ?? data?.avatarUrl ?? data?.avatar ?? null,
          };
        });
        setAllUsers(list);
      } finally {
        if (active) setSearchLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!searchWrapRef.current) return;
      if (!searchWrapRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filteredUsers = useMemo(() => {
    const q = searchValue.trim().toLowerCase();
    if (!q) return [];
    return allUsers
      .filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
      .slice(0, 8);
  }, [searchValue, allUsers]);

    async function loadProfile(userId: string, projectIdOverride?: string) {
    setProfileLoading(true);
    setProfileError(null);
    setProfilePhone("");
    setProfileAddress("");
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        setProfileError("Не удалось получить токен");
        return;
      }
      const targetProjectId = projectIdOverride || projectIdFromPath;
      if (!targetProjectId) {
        setProfileError("Откройте проект, чтобы редактировать профиль");
        return;
      }
      const res = await fetch(
        `/api/user-profiles?projectId=${encodeURIComponent(targetProjectId)}&userId=${encodeURIComponent(userId)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        setProfileError("Не удалось загрузить профиль");
        return;
      }
      const data = await res.json();
      setProfilePhone(data?.profile?.phone ?? "");
      setProfileAddress(data?.profile?.address ?? "");
    } catch {
      setProfileError("Не удалось загрузить профиль");
    } finally {
      setProfileLoading(false);
    }
  }

  async function loadProjectContext(userId: string) {
    let resolvedProjectId = "";
    try {
      if (projectIdFromPath) {
        const projectSnap = await getDoc(doc(db, "projects", projectIdFromPath));
        const projectData = projectSnap.data() as any;
        setProfileProjectName(projectData?.name ?? projectIdFromPath);
        resolvedProjectId = projectIdFromPath;
        setProfileProjectId(projectIdFromPath);
        const ownerId = projectData?.ownerId ?? null;
        if (ownerId && ownerId === userId) {
          setProfileRole("руководитель");
          return resolvedProjectId;
        }
        const memberSnap = await getDoc(doc(db, "project_members", `${projectIdFromPath}_${userId}`));
        if (!memberSnap.exists()) {
          setProfileRole("не в проекте");
          return resolvedProjectId;
        }
        const role = (memberSnap.data() as any)?.role ?? "";
        setProfileRole(role === "admin" ? "менеджер" : role === "worker" ? "участник" : role || "участник");
        return resolvedProjectId;
      }

      const memberSnap = await getDocs(query(collection(db, "project_members"), where("userId", "==", userId), limit(1)));
      if (memberSnap.empty) {
        setProfileProjectName("");
        setProfileRole("не в проекте");
        setProfileProjectId("");
        return "";
      }
      const member = memberSnap.docs[0].data() as any;
      const projectId = member?.projectId ?? "";
      resolvedProjectId = projectId;
      if (projectId) {
        const projectSnap = await getDoc(doc(db, "projects", projectId));
        const projectData = projectSnap.data() as any;
        setProfileProjectName(projectData?.name ?? projectId);
      } else {
        setProfileProjectName("");
      }
      setProfileProjectId(projectId);
      const role = member?.role ?? "";
      setProfileRole(role === "admin" ? "менеджер" : role === "worker" ? "участник" : role || "участник");
    } catch {
      setProfileProjectName(projectIdFromPath || "");
      setProfileProjectId(projectIdFromPath || "");
      setProfileRole("");
    }
    return resolvedProjectId;
  }

    async function loadHours(userId: string, mode: "month" | "all", projectIdOverride?: string) {
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        setProfileHours(0);
        return;
      }
      const targetProjectId = projectIdOverride || projectIdFromPath || "";
      const url = new URL("/api/profile-hours", window.location.origin);
      url.searchParams.set("userId", userId);
      if (targetProjectId) {
        url.searchParams.set("projectId", targetProjectId);
      }
      url.searchParams.set("mode", mode);
      url.searchParams.set("monthKey", monthKey);
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setProfileHours(0);
        return;
      }
      const data = await res.json();
      setProfileHours(Number(data?.totalMinutes ?? 0));
    } catch {
      setProfileHours(0);
    }
  }

  async function openProfile(user: { id: string; name: string; email: string; avatar?: string | null }) {
    setProfileUserId(user.id);
    setProfileName(user.name || "Нет имени");
    setProfileEmail(user.email || "Нет данных");
    setProfileAvatar(user.avatar ?? null);
    setBrokenAvatar(false);
    setProfileHoursMode("month");
    setProfileHours(null);
    setProfileOpen(true);
    const resolvedProjectId = await loadProjectContext(user.id);
    loadProfile(user.id, resolvedProjectId || projectIdFromPath || profileProjectId);
    loadHours(user.id, "month", resolvedProjectId || projectIdFromPath || profileProjectId);
  }
  async function saveProfile() {
    if (!profileUserId) return;
    setProfileLoading(true);
    setProfileError(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        setProfileError("Не удалось получить токен");
        return;
      }
      if (!projectIdFromPath) {
        setProfileError("Откройте проект, чтобы редактировать профиль");
        return;
      }
      const res = await fetch(`/api/user-profiles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          projectId: projectIdFromPath,
          userId: profileUserId,
          phone: profilePhone || null,
          address: profileAddress || null,
        }),
      });
      if (!res.ok) {
        setProfileError("Не удалось сохранить");
        return;
      }
    } catch {
      setProfileError("Не удалось сохранить");
    } finally {
      setProfileLoading(false);
    }
  }

  function formatHoursValue(totalMinutes: number) {
    const hours = totalMinutes / 60;
    if (Number.isInteger(hours)) return String(hours);
    return hours.toFixed(1);
  }

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
          <header className="panel motion p-6 relative z-40 overflow-visible">
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
                <div className="relative z-50" ref={searchWrapRef}>
                  <input
                    className="input w-[260px]"
                    placeholder="Поиск сотрудника"
                    value={searchValue}
                    onChange={(e) => {
                      setSearchValue(e.target.value);
                      setSearchOpen(true);
                    }}
                    onFocus={() => setSearchOpen(true)}
                  />
                  {searchOpen && (searchValue.trim() || searchLoading) && (
                    <div className="absolute right-0 top-[calc(100%+8px)] z-[60] w-[320px] rounded-2xl border border-white/10 bg-[#0f1216] p-2 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
                      {searchLoading && (
                        <div className="px-3 py-2 text-sm text-muted">Загрузка...</div>
                      )}
                      {!searchLoading && filteredUsers.length === 0 && (
                        <div className="px-3 py-2 text-sm text-muted">Ничего не найдено</div>
                      )}
                      {!searchLoading && filteredUsers.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => {
                            setSearchOpen(false);
                            openProfile(u);
                          }}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition hover:bg-white/5"
                        >
                          {u.avatar ? (
                            <img src={u.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-[rgba(125,211,167,0.25)]" />
                          )}
                          <div>
                            <div className="font-semibold">{u.name || "Нет имени"}</div>
                            <div className="text-xs text-muted">{u.email || "Нет данных"}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
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
      {profileOpen && profileUserId && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/50 p-4" onClick={() => setProfileOpen(false)}>
          <div className="w-full max-w-[520px] rounded-3xl border border-white/10 bg-[#0f1216] p-6 shadow-[0_40px_120px_rgba(0,0,0,0.55)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                {profileAvatar && !brokenAvatar ? (
                  <img
                    src={profileAvatar}
                    alt=""
                    className="h-12 w-12 rounded-full object-cover"
                    onError={() => setBrokenAvatar(true)}
                  />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-[rgba(125,211,167,0.25)]" />
                )}
                <div>
                  <div className="text-lg font-semibold">{profileName || "Нет имени"}</div>
                  <div className="text-sm text-muted">{profileEmail || "Нет данных"}</div>
                </div>
              </div>
              <button className="btn btn-outline" onClick={() => setProfileOpen(false)}>Закрыть</button>
            </div>

            <div className="mt-6 grid gap-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-xs text-muted">Проект</div>
                    <div className="mt-1 text-sm">{profileProjectName || projectIdFromPath || "Не выбран"}</div>
                    <div className="mt-3 text-xs text-muted">Роль</div>
                    <div className="mt-1 text-sm">{profileRole || "не в проекте"}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted">Отработано</div>
                    <div className="mt-2 text-2xl font-semibold">{profileHours == null ? "Загрузка..." : `${formatHoursValue(profileHours)} ч`}</div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    className={`btn btn-outline ${profileHoursMode === "month" ? "btn-primary" : ""}`}
                    onClick={() => {
                      setProfileHoursMode("month");
                      if (profileUserId) loadHours(profileUserId, "month", profileProjectId || projectIdFromPath);
                    }}
                  >
                    За месяц
                  </button>
                  <button
                    className={`btn btn-outline ${profileHoursMode === "all" ? "btn-primary" : ""}`}
                    onClick={() => {
                      setProfileHoursMode("all");
                      if (profileUserId) loadHours(profileUserId, "all", profileProjectId || projectIdFromPath);
                    }}
                  >
                    За всё время
                  </button>
                </div>
              </div>

              {!projectIdFromPath && (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-muted">
                  Откройте проект, чтобы редактировать профиль.
                </div>
              )}

              <div className="grid gap-3">
                <div>
                  <label className="text-xs text-muted">Телефон</label>
                  <input
                    className="input mt-2"
                    value={profilePhone}
                    onChange={(e) => setProfilePhone(e.target.value)}
                    placeholder="Добавьте номер телефона"
                    disabled={!projectIdFromPath}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted">Адрес</label>
                  <input
                    className="input mt-2"
                    value={profileAddress}
                    onChange={(e) => setProfileAddress(e.target.value)}
                    placeholder="Добавьте адрес"
                    disabled={!projectIdFromPath}
                  />
                </div>
              </div>

              {profileError && <div className="text-sm text-rose-200">{profileError}</div>}

              <div className="flex flex-wrap gap-3">
                <button className="btn btn-primary" onClick={saveProfile} disabled={profileLoading || !projectIdFromPath}>
                  {profileLoading ? "Сохранение..." : "Сохранить"}
                </button>
                <button className="btn btn-outline" onClick={() => setProfileOpen(false)}>
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AuthGate>
  );
}
