"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  addDoc,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../../../lib/firebase";
import { safeOnSnapshot } from "../../../../lib/firestoreSafe";
export default function ProjectPage() {
  const params = useParams();
  const projectId = params?.projectId as string | undefined;

  const [userId, setUserId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string>("Проект");
  const [loadingRole, setLoadingRole] = useState(true);
  const [isManager, setIsManager] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [showRules, setShowRules] = useState(false);

  const [tab, setTab] = useState<"chat" | "pinned" | "schedule" | "people" | "hours">("chat");

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setUserId(user?.uid ?? null);
    });
  }, []);

  useEffect(() => {
    if (!projectId) return;

    const unsubProject = safeOnSnapshot(doc(db, "projects", projectId), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as any;
        setProjectName(data?.name ?? "Проект");
      }
    });

    return () => {
      unsubProject();
    };
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !userId) {
      setLoadingRole(false);
      return;
    }

    let unsubMember: (() => void) | null = null;

    const load = async () => {
      setLoadingRole(true);

      unsubMember = safeOnSnapshot(doc(db, "project_members", `${projectId}_${userId}`), async (snap) => {
        let manager = false;
        let member = false;
        let pending = false;

        if (snap.exists()) {
          const role = (snap.data() as any)?.role;
          if (role === "admin") manager = true;
          if (role === "pending") pending = true;
          if (role !== "pending") member = true;
        }

        const projectSnap = await getDoc(doc(db, "projects", projectId));
        if (projectSnap.exists()) {
          const ownerId = (projectSnap.data() as any)?.ownerId;
          if (ownerId && ownerId === userId) {
            manager = true;
            member = true;
            pending = false;
          }
        }

        setIsManager(manager);
        setIsMember(member);
        setIsPending(pending);
        setLoadingRole(false);
      });
    };

    load();

    return () => {
      if (unsubMember) unsubMember();
    };
  }, [projectId, userId]);

  if (!projectId) {
    return (
      <div className="panel motion p-6">
        <h1 className="text-2xl font-semibold">Проект не найден</h1>
      </div>
    );
  }

  if (loadingRole) {
    return <div className="panel motion p-6">Загрузка...</div>;
  }

  if (!userId) {
    return <div className="panel motion p-6">Нужно войти в аккаунт.</div>;
  }

  if (showRules) {
    return <ProjectRules />;
  }

  if (!isMember) {
    return (
      <JoinProject
        projectId={projectId}
        projectName={projectName}
        isPending={isPending}
        onApply={() => setShowRules(true)}
      />
    );
  }

  return (
    <div className="grid gap-6">
      <div className="panel motion p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{projectName}</h1>
            <p className="text-sm text-muted">Проект: {projectId}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className={`btn ${tab === "chat" ? "btn-primary" : "btn-outline"}`} onClick={() => setTab("chat")}>
              Чат
            </button>
            <button className={`btn ${tab === "pinned" ? "btn-primary" : "btn-outline"}`} onClick={() => setTab("pinned")}>
              Закрепы
            </button>
            <button className={`btn ${tab === "schedule" ? "btn-primary" : "btn-outline"}`} onClick={() => setTab("schedule")}>
              Расписание
            </button>
            <button className={`btn ${tab === "people" ? "btn-primary" : "btn-outline"}`} onClick={() => setTab("people")}>
              Люди
            </button>
            <button className={`btn ${tab === "hours" ? "btn-primary" : "btn-outline"}`} onClick={() => setTab("hours")}>
              Часы
            </button>
          </div>
        </div>
      </div>

      {tab === "chat" && <ChatTab projectId={projectId} currentUserId={userId} isManager={isManager} />}
      {tab === "pinned" && <PinnedTab projectId={projectId} isManager={isManager} />}
      {tab === "schedule" && <ScheduleTab projectId={projectId} userId={userId} isManager={isManager} />}
      {tab === "people" && <PeopleTab projectId={projectId} isManager={isManager} />}
      {tab === "hours" && <HoursTab projectId={projectId} currentUserId={userId} />}
    </div>
  );
}

function JoinProject({
  projectId,
  projectName,
  isPending,
  onApply,
}: {
  projectId: string;
  projectName: string;
  isPending: boolean;
  onApply: () => void;
}) {
  return (
    <div className="panel motion p-6">
      <h1 className="text-2xl font-semibold">Запрос на вступление</h1>
      <p className="mt-2 text-sm text-muted">Проект: {projectName || projectId}</p>
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-muted">
        Подайте заявку, чтобы руководитель проекта подтвердил доступ. После подтверждения вы увидите чат,
        расписание и участников.
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button className="btn btn-primary" onClick={onApply} disabled={isPending}>
          {isPending ? "Заявка отправлена" : "Оставить заявку"}
        </button>
      </div>
    </div>
  );
}
function ChatTab({
  projectId,
  currentUserId,
  isManager,
}: {
  projectId: string;
  currentUserId: string;
  isManager: boolean;
}) {
  const [messages, setMessages] = useState<any[]>([]);
  const [pinned, setPinned] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [userAvatars, setUserAvatars] = useState<Record<string, string>>({});
  const [brokenAvatars, setBrokenAvatars] = useState<Record<string, boolean>>({});
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const isAtBottomRef = useRef(true);
  const initialLoadRef = useRef(true);

  useEffect(() => {
    const q = query(
      collection(db, "project_chats", projectId, "messages"),
      orderBy("createdAt", "asc")
    );
    return safeOnSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
      requestAnimationFrame(() => {
        const el = chatScrollRef.current;
        if (!el) return;
        if (initialLoadRef.current || isAtBottomRef.current) {
          el.scrollTop = el.scrollHeight;
          initialLoadRef.current = false;
        }
      });
    });
  }, [projectId]);

  useEffect(() => {
    const q = query(
      collection(db, "project_chats", projectId, "pinned"),
      orderBy("createdAt", "desc")
    );
    return safeOnSnapshot(q, (snap) => {
      setPinned(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    });
  }, [projectId]);

  useEffect(() => {
    const ids = new Set<string>();
    messages.forEach((m) => {
      if (m.senderId) ids.add(String(m.senderId));
    });
    if (ids.size === 0) {
      setUserNames({});
      setUserAvatars({});
      return;
    }
    const q = query(collection(db, "users_public"), where("__name__", "in", Array.from(ids).slice(0, 10)));
    return safeOnSnapshot(q, (snap) => {
      const names: Record<string, string> = {};
      const avatars: Record<string, string> = {};
      snap.forEach((docSnap) => {
        const data = docSnap.data() as any;
        names[docSnap.id] = data?.name ?? data?.email ?? "Нет имени";
        const avatar = data?.photoURL ?? data?.avatarUrl ?? data?.avatar ?? null;
        if (avatar) avatars[docSnap.id] = avatar;
      });
      setUserNames(names);
      setUserAvatars(avatars);
    });
  }, [messages]);

  async function sendMessage() {
    const clean = text.trim();
    if (!clean) return;
    setText("");
    requestAnimationFrame(() => {
      const el = chatScrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
    await addDoc(collection(db, "project_chats", projectId, "messages"), {
      text: clean,
      senderId: currentUserId,
      createdAt: serverTimestamp(),
    });
  }

  async function addPinned() {
    if (!isManager) return;
    const value = window.prompt("Введите закреп");
    if (!value) return;
    await addDoc(collection(db, "project_chats", projectId, "pinned"), {
      text: value.trim(),
      authorId: currentUserId,
      createdAt: serverTimestamp(),
    });
  }

  return (
    <div className="grid gap-6">
      {pinned.length > 0 && (
        <div className="chat-pinned">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Закрепы</p>
            {isManager && (
              <button className="btn btn-outline" onClick={addPinned}>
                Добавить
              </button>
            )}
          </div>
          <div className="mt-2 grid gap-2">
            {pinned.map((p) => (
              <div key={p.id} className="chat-pinned-item">
                {p.text}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="panel motion p-6">
        <div
          className="chat-area rounded-2xl border border-white/10 bg-white/5 p-4 h-[360px] overflow-y-auto hide-scrollbar"
          ref={chatScrollRef}
          onScroll={() => {
            const el = chatScrollRef.current;
            if (!el) return;
            const threshold = 24;
            isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
          }}
        >
          {messages.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-muted">
              Пока нет сообщений в этом чате.
            </div>
          )}
          {messages.length > 0 && (
            <div className="grid gap-4">
              {messages.map((m, index) => {
                const isMine = m.senderId === currentUserId;
                const prev = index > 0 ? messages[index - 1] : null;
                const isSameSender = prev?.senderId && prev.senderId === m.senderId;
                const avatarId = m.senderId ?? "";
                const hasAvatar = userAvatars[avatarId] && !brokenAvatars[avatarId];
                const showAvatar = !isSameSender;
                return (
                  <div
                    key={m.id ?? index}
                    className={`chat-row group flex w-full items-start gap-3 ${isMine ? "justify-end" : "justify-start"}`}
                  >
                    {showAvatar && (
                      <>
                        {hasAvatar ? (
                          <img
                            src={userAvatars[avatarId]}
                            alt=""
                            className="h-9 w-9 rounded-full object-cover"
                            onError={() => setBrokenAvatars((prev) => ({ ...prev, [avatarId]: true }))}
                          />
                        ) : (
                          <div className="h-9 w-9 rounded-full bg-[rgba(125,211,167,0.25)]" />
                        )}
                      </>
                    )}
                    <div className={`chat-bubble min-w-0 ${isMine ? "ml-auto" : ""}${isSameSender ? " chat-bubble-compact" : ""}`}>
                      {!isMine && !isSameSender && (
                        <div className="mb-1 text-xs text-muted">
                          {userNames[avatarId] ?? "Нет имени"}
                        </div>
                      )}
                      <div className="chat-text">{m.text ?? ""}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <label className="text-xs text-muted">Сообщение</label>
          <textarea
            className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/90"
            rows={3}
            placeholder="Напишите сообщение"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="chat-controls">
            <button className="btn btn-primary" onClick={sendMessage} disabled={!text.trim()}>
              Отправить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
function PinnedTab({ projectId, isManager }: { projectId: string; isManager: boolean }) {
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, "project_chats", projectId, "pinned"),
      orderBy("createdAt", "desc")
    );
    return safeOnSnapshot(q, (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    });
  }, [projectId]);

  async function addPinned() {
    if (!isManager) return;
    const value = window.prompt("Введите закреп");
    if (!value) return;
    await addDoc(collection(db, "project_chats", projectId, "pinned"), {
      text: value.trim(),
      createdAt: serverTimestamp(),
    });
  }

  async function editPinned(id: string, currentText: string) {
    if (!isManager) return;
    const value = window.prompt("Редактировать закреп", currentText);
    if (!value) return;
    await updateDoc(doc(db, "project_chats", projectId, "pinned", id), {
      text: value.trim(),
      editedAt: serverTimestamp(),
    });
  }

  async function deletePinned(id: string) {
    if (!isManager) return;
    const ok = window.confirm("Удалить закреп?");
    if (!ok) return;
    await deleteDoc(doc(db, "project_chats", projectId, "pinned", id));
  }

  return (
    <div className="panel motion p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Закрепы</h2>
        {isManager && (
          <button className="btn btn-primary" onClick={addPinned}>
            Добавить
          </button>
        )}
      </div>
      <div className="mt-4 grid gap-3">
        {items.length === 0 && <div className="text-sm text-muted">Закрепов пока нет.</div>}
        {items.map((p) => (
          <div key={p.id} className="flex items-start justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="text-sm">{p.text}</div>
            {isManager && (
              <div className="flex gap-2">
                <button className="btn btn-outline" onClick={() => editPinned(p.id, p.text)}>
                  Редактировать
                </button>
                <button className="btn btn-outline" onClick={() => deletePinned(p.id)}>
                  Удалить
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
function ScheduleTab({ projectId, userId, isManager }: { projectId: string; userId: string; isManager: boolean }) {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [members, setMembers] = useState<string[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [createUserId, setCreateUserId] = useState("");
  const [createDate, setCreateDate] = useState("");
  const [createTime, setCreateTime] = useState("");
  const [confirming, setConfirming] = useState<any | null>(null);
  const [confirmStart, setConfirmStart] = useState("");
  const [confirmEnd, setConfirmEnd] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "project_schedules"), where("projectId", "==", projectId), orderBy("start"));
    return safeOnSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      setSchedules(list);
    });
  }, [projectId]);

  useEffect(() => {
    const q = query(
      collection(db, "project_members"),
      where("projectId", "==", projectId),
      where("role", "in", ["admin", "worker"])
    );
    return safeOnSnapshot(q, (snap) => {
      const ids = snap.docs.map((d) => (d.data() as any)?.userId).filter(Boolean);
      setMembers(Array.from(new Set(ids)));
    });
  }, [projectId]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (members.length === 0) {
        setNames({});
        return;
      }
      const entries = await Promise.all(
        members.map(async (uid) => {
          const snap = await getDoc(doc(db, "users_public", uid));
          const data = snap.data() as any;
          return [uid, data?.name ?? data?.email ?? "Нет имени"] as const;
        })
      );
      if (!active) return;
      setNames(Object.fromEntries(entries));
    };
    load();
    return () => {
      active = false;
    };
  }, [members]);

  const visibleSchedules = isManager ? schedules : schedules.filter((s) => s.userId === userId);

  async function createSchedule() {
    if (!createUserId || !createDate || !createTime) return;
    const start = new Date(`${createDate}T${createTime}`);
    if (Number.isNaN(start.getTime())) return;
    setSubmitting(true);
    try {
      const oldSchedules = await getDocs(
        query(
          collection(db, "project_schedules"),
          where("projectId", "==", projectId),
          where("userId", "==", createUserId)
        )
      );
      for (const d of oldSchedules.docs) {
        await deleteDoc(d.ref);
      }
      await addDoc(collection(db, "project_schedules"), {
        projectId,
        userId: createUserId,
        start: Timestamp.fromDate(start),
        createdAt: serverTimestamp(),
      });
      setCreateOpen(false);
      setCreateUserId("");
      setCreateDate("");
      setCreateTime("");
    } finally {
      setSubmitting(false);
    }
  }

  function openConfirm(schedule: any) {
    const planned = schedule?.start?.toDate ? schedule.start.toDate() : new Date();
    setConfirming(schedule);
    setConfirmStart(formatTime(planned));
    setConfirmEnd("");
  }

  async function confirmShift() {
    if (!confirming || !confirmStart || !confirmEnd) return;
    const planned = confirming?.start?.toDate ? confirming.start.toDate() : new Date();
    const date = `${planned.getFullYear()}-${(planned.getMonth() + 1).toString().padStart(2, "0")}-${planned
      .getDate()
      .toString()
      .padStart(2, "0")}`;
    const start = new Date(`${date}T${confirmStart}`);
    const end = new Date(`${date}T${confirmEnd}`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;
    setSubmitting(true);
    try {
      const shiftsRef = collection(db, "work_shifts", userId, "shifts");
      const oldShifts = await getDocs(
        query(shiftsRef, where("projectId", "==", projectId), where("source", "==", "schedule"), where("shiftDate", "==", date))
      );
      for (const d of oldShifts.docs) {
        await deleteDoc(d.ref);
      }
      await addDoc(shiftsRef, {
        projectId,
        shiftDate: date,
        start: Timestamp.fromDate(start),
        end: Timestamp.fromDate(end),
        breakMinutes: 0,
        createdAt: serverTimestamp(),
        source: "schedule",
      });
      await updateDoc(doc(db, "project_schedules", confirming.id), {
        scheduleConfirmed: true,
        confirmedAt: serverTimestamp(),
      });
      await addWorkDayToAccounting({
        userId,
        projectId,
        start,
        end,
        breakMinutes: 0,
      });
      setConfirming(null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6">
      <div className="panel motion p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Расписание</h2>
            <p className="mt-1 text-sm text-muted">Смены по проекту и подтверждение часов</p>
          </div>
          {isManager && (
            <button className="btn btn-primary" onClick={() => setCreateOpen((v) => !v)}>
              {createOpen ? "Скрыть форму" : "Добавить"}
            </button>
          )}
        </div>
        {createOpen && isManager && (
          <div className="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="grid gap-2">
              <label className="text-sm text-muted">Участник</label>
              <select className="input" value={createUserId} onChange={(e) => setCreateUserId(e.target.value)}>
                <option value="">Выберите участника</option>
                {members.map((uid) => (
                  <option key={uid} value={uid}>
                    {names[uid] ?? "Нет имени"}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <label className="text-sm text-muted">Дата</label>
              <input className="input" type="date" value={createDate} onChange={(e) => setCreateDate(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <label className="text-sm text-muted">Время начала</label>
              <input className="input" type="time" value={createTime} onChange={(e) => setCreateTime(e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-3">
              <button className="btn btn-primary" onClick={createSchedule} disabled={submitting}>
                Создать смену
              </button>
              <button className="btn btn-outline" onClick={() => setCreateOpen(false)} disabled={submitting}>
                Отмена
              </button>
            </div>
          </div>
        )}
      </div>

      {confirming && (
        <div className="panel motion p-6">
          <h3 className="text-lg font-semibold">Подтверждение смены</h3>
          <p className="mt-1 text-sm text-muted">Укажите фактическое время работы.</p>
          <div className="mt-4 grid gap-3">
            <div className="grid gap-2">
              <label className="text-sm text-muted">Начал работу</label>
              <input className="input" type="time" value={confirmStart} onChange={(e) => setConfirmStart(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <label className="text-sm text-muted">Закончил работу</label>
              <input className="input" type="time" value={confirmEnd} onChange={(e) => setConfirmEnd(e.target.value)} />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button className="btn btn-primary" onClick={confirmShift} disabled={submitting}>
              Подтвердить
            </button>
            <button className="btn btn-outline" onClick={() => setConfirming(null)} disabled={submitting}>
              Отмена
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-3">
        {visibleSchedules.length === 0 && <div className="panel motion p-6 text-sm text-muted">Расписаний нет.</div>}
        {visibleSchedules.map((schedule) => {
          const planned = schedule?.start?.toDate ? schedule.start.toDate() : null;
          const confirmed = schedule?.scheduleConfirmed === true;
          const scheduleUserId = schedule?.userId ?? "";
          return (
            <div key={`${schedule.id ?? ""}-${scheduleUserId}-${planned ? planned.getTime() : "no-date"}`} className="panel motion p-6">
              <div className="flex items-center gap-4">
                <div className="rounded-2xl bg-emerald-500/20 px-4 py-3 text-lg font-semibold text-emerald-200">
                  {planned ? formatTime(planned) : "--:--"}
                </div>
                <div className="flex-1">
                  <div className="font-semibold">{names[scheduleUserId] ?? "Нет имени"}</div>
                  <div className="text-sm text-muted">{planned ? formatDate(planned) : "Дата не указана"}</div>
                  {planned && (
                    <ScheduleWorkedMinutes projectId={projectId} userId={scheduleUserId} plannedStart={planned} />
                  )}
                </div>
                {confirmed && <div className="text-xs text-emerald-300">Подтверждено</div>}
              </div>
              {!confirmed && scheduleUserId === userId && (
                <div className="mt-4">
                  <button className="btn btn-primary" onClick={() => openConfirm(schedule)}>
                    Подтвердить смену
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PeopleTab({ projectId, isManager }: { projectId: string; isManager: boolean }) {
  const [members, setMembers] = useState<any[]>([]);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [userEmails, setUserEmails] = useState<Record<string, string>>({});
  const [userAvatars, setUserAvatars] = useState<Record<string, string>>({});
  const [brokenAvatars, setBrokenAvatars] = useState<Record<string, boolean>>({});
  const [profileOpen, setProfileOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [profilePhone, setProfilePhone] = useState("");
  const [profileAddress, setProfileAddress] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [hoursMode, setHoursMode] = useState<"month" | "all">("month");
  const [hoursValue, setHoursValue] = useState<number | null>(null);

  const monthKey = useMemo(() => {
    const d = new Date();
    const m = (d.getMonth() + 1).toString().padStart(2, "0");
    return `${d.getFullYear()}-${m}`;
  }, []);

  useEffect(() => {
    const unsubProject = safeOnSnapshot(doc(db, "projects", projectId), (snap) => {
      const data = snap.data() as any;
      setOwnerId(data?.ownerId ?? null);
    });
    const q = query(
      collection(db, "project_members"),
      where("projectId", "==", projectId),
      where("role", "in", ["admin", "worker"])
    );
    const unsubMembers = safeOnSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      setMembers(list);
    });
    return () => {
      unsubProject();
      unsubMembers();
    };
  }, [projectId]);

  const uniqueMembers = useMemo(() => {
    const seen = new Set<string>();
    const list: any[] = [];
    for (const m of members) {
      if (!m?.userId || seen.has(m.userId)) continue;
      seen.add(m.userId);
      list.push(m);
    }
    if (ownerId && !seen.has(ownerId)) {
      list.unshift({ userId: ownerId, role: "owner" });
    }
    return list;
  }, [members, ownerId]);

  useEffect(() => {
    const ids = uniqueMembers.map((m) => m.userId).filter(Boolean);
    if (!ids.length) {
      setUserNames({});
      setUserEmails({});
      setUserAvatars({});
      return;
    }
    const q = query(collection(db, "users_public"), where("__name__", "in", Array.from(ids).slice(0, 10)));
    return safeOnSnapshot(q, (snap) => {
      const names: Record<string, string> = {};
      const emails: Record<string, string> = {};
      const avatars: Record<string, string> = {};
      snap.forEach((docSnap) => {
        const data = docSnap.data() as any;
        names[docSnap.id] = data?.name ?? data?.email ?? "Нет имени";
        emails[docSnap.id] = data?.email ?? "";
        const avatar = data?.photoURL ?? data?.avatarUrl ?? data?.avatar ?? null;
        if (avatar) avatars[docSnap.id] = avatar;
      });
      setUserNames(names);
      setUserEmails(emails);
      setUserAvatars(avatars);
    });
  }, [uniqueMembers]);

  async function loadProfile(targetId: string) {
    setProfileLoading(true);
    setProfileError(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        setProfileError("Не удалось получить токен");
        return;
      }
      const res = await fetch(
        `/api/user-profiles?projectId=${encodeURIComponent(projectId)}&userId=${encodeURIComponent(targetId)}`,
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

  async function loadHours(targetId: string, mode: "month" | "all") {
    const qBase = query(collectionGroup(db, "months"), where("projectId", "==", projectId), where("userId", "==", targetId));
    const q = mode === "month" ? query(qBase, where("month", "==", monthKey)) : qBase;
    const snap = await getDocs(q);
    let total = 0;
    snap.forEach((d) => {
      const data = d.data() as any;
      total += Number(data?.totalMinutes ?? 0);
    });
    setHoursValue(total);
  }

  function openProfile(targetId: string) {
    setSelectedId(targetId);
    setProfileOpen(true);
    setHoursMode("month");
    setHoursValue(null);
    setProfilePhone("");
    setProfileAddress("");
    loadProfile(targetId);
    loadHours(targetId, "month");
  }

  async function saveProfile() {
    if (!selectedId) return;
    setProfileLoading(true);
    setProfileError(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        setProfileError("Не удалось получить токен");
        return;
      }
      const res = await fetch(`/api/user-profiles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          projectId,
          userId: selectedId,
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

  return (
    <div className="panel motion p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Люди</h2>
          <p className="mt-1 text-sm text-muted">Участники и роли в проекте</p>
        </div>
        <div className="text-sm text-muted">Всего: {uniqueMembers.length}</div>
      </div>
      <div className="mt-4 grid gap-3">
        {uniqueMembers.length === 0 && <div className="text-sm text-muted">Пока нет участников.</div>}
        {uniqueMembers.map((m) => {
          const role =
            m.userId === ownerId
              ? "руководитель"
              : m.role === "admin"
                ? "менеджер"
                : "участник";
          const avatarId = m.userId ?? "";
          const hasAvatar = userAvatars[avatarId] && !brokenAvatars[avatarId];
          return (
            <button
              key={m.userId}
              type="button"
              onClick={() => openProfile(avatarId)}
              className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left transition hover:border-white/20"
            >
              <div className="flex items-center gap-3">
                {hasAvatar ? (
                  <img
                    src={userAvatars[avatarId]}
                    alt=""
                    className="h-9 w-9 rounded-full object-cover"
                    onError={() => setBrokenAvatars((prev) => ({ ...prev, [avatarId]: true }))}
                  />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-[rgba(125,211,167,0.25)]" />
                )}
                <div>
                  <div className="font-semibold">{userNames[avatarId] ?? "Нет имени"}</div>
                  <div className="text-xs text-muted">{userEmails[avatarId] || "Нет данных"}</div>
                </div>
              </div>
              <div className="text-sm text-muted">{role}</div>
            </button>
          );
        })}
      </div>

      {profileOpen && selectedId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-[520px] rounded-3xl border border-white/10 bg-[#0f1216] p-6 shadow-[0_40px_120px_rgba(0,0,0,0.55)]">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                {userAvatars[selectedId] && !brokenAvatars[selectedId] ? (
                  <img
                    src={userAvatars[selectedId]}
                    alt=""
                    className="h-12 w-12 rounded-full object-cover"
                    onError={() => setBrokenAvatars((prev) => ({ ...prev, [selectedId]: true }))}
                  />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-[rgba(125,211,167,0.25)]" />
                )}
                <div>
                  <div className="text-lg font-semibold">{userNames[selectedId] ?? "Нет имени"}</div>
                  <div className="text-sm text-muted">{userEmails[selectedId] || "Нет данных"}</div>
                </div>
              </div>
              <button className="btn btn-outline" onClick={() => setProfileOpen(false)}>Закрыть</button>
            </div>

            <div className="mt-6 grid gap-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-muted">Отработано</div>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    className={`btn btn-outline ${hoursMode === "month" ? "btn-primary" : ""}`}
                    onClick={() => {
                      setHoursMode("month");
                      loadHours(selectedId, "month");
                    }}
                  >
                    За месяц
                  </button>
                  <button
                    className={`btn btn-outline ${hoursMode === "all" ? "btn-primary" : ""}`}
                    onClick={() => {
                      setHoursMode("all");
                      loadHours(selectedId, "all");
                    }}
                  >
                    За всё время
                  </button>
                </div>
                <div className="mt-3 text-2xl font-semibold">
                  {hoursValue == null ? "Загрузка..." : `${formatHours(hoursValue)} ч`}
                </div>
              </div>

              <div className="grid gap-3">
                <div>
                  <label className="text-xs text-muted">Телефон</label>
                  <input
                    className="input mt-2"
                    value={profilePhone}
                    onChange={(e) => setProfilePhone(e.target.value)}
                    placeholder="Добавьте номер телефона"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted">Адрес</label>
                  <input
                    className="input mt-2"
                    value={profileAddress}
                    onChange={(e) => setProfileAddress(e.target.value)}
                    placeholder="Добавьте адрес"
                  />
                </div>
              </div>

              {profileError && <div className="text-sm text-rose-200">{profileError}</div>}

              <div className="flex flex-wrap gap-3">
                <button className="btn btn-primary" onClick={saveProfile} disabled={profileLoading}>
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
    </div>
  );
}
function HoursTab({ projectId, currentUserId }: { projectId: string; currentUserId: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [monthKey, setMonthKey] = useState("");

  useEffect(() => {
    const now = new Date();
    const key = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}`;
    setMonthKey(key);
    const q = query(collectionGroup(db, "months"), where("projectId", "==", projectId), where("month", "==", key));
    return safeOnSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => {
        const userId = d.ref.parent.parent?.id ?? "";
        return { id: d.id, userId, ...(d.data() as any) };
      });
      setItems(list);
    });
  }, [projectId]);

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => Number(b.totalMinutes ?? 0) - Number(a.totalMinutes ?? 0));
  }, [items]);

  return (
    <div className="panel motion p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Часы</h2>
          <p className="mt-1 text-sm text-muted">Текущий месяц: {monthKey || "—"}</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3">
        {sorted.length === 0 && <div className="text-sm text-muted">Нет данных по часам.</div>}
        {sorted.map((item) => {
          const minutes = Number(item.totalMinutes ?? 0);
          const isMe = item.userId === currentUserId;
          return (
            <div key={`${item.userId}-${item.id}`} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div>
                <div className="font-semibold">
                  <UserName userId={item.userId} />
                </div>
                <div className="text-xs text-muted">{isMe ? "Это вы" : "Участник проекта"}</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-semibold">{formatHours(minutes)} ч</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ScheduleWorkedMinutes({
  projectId,
  userId,
  plannedStart,
}: {
  projectId: string;
  userId: string;
  plannedStart: Date;
}) {
  const [minutes, setMinutes] = useState<number>(0);

  useEffect(() => {
    if (!userId) return;
    const startWindow = new Date(plannedStart.getTime() - 12 * 60 * 60 * 1000);
    const endWindow = new Date(plannedStart.getTime() + 12 * 60 * 60 * 1000);
    const q = query(
      collection(db, "work_shifts", userId, "shifts"),
      where("projectId", "==", projectId),
      where("source", "==", "schedule")
    );
    return safeOnSnapshot(q, (snap) => {
      let total = 0;
      snap.forEach((d) => {
        const data = d.data() as any;
        if (!data?.start || !data?.end) return;
        const s = data.start.toDate ? data.start.toDate() : new Date(data.start);
        const e = data.end.toDate ? data.end.toDate() : new Date(data.end);
        if (s < startWindow || s > endWindow) return;
        total += Math.max(0, Math.floor((e.getTime() - s.getTime()) / 60000));
      });
      setMinutes(total);
    });
  }, [projectId, userId, plannedStart]);

  if (minutes <= 0) return null;
  const label = minutes >= 60 ? `${Math.floor(minutes / 60)} ч ${minutes % 60 ? `${minutes % 60} мин` : ""}` : `${minutes} мин`;

  return <div className="mt-2 text-sm font-semibold text-emerald-300">Отработано: {label}</div>;
}
function ProjectRules() {
  return (
    <div className="panel motion p-6">
      <h1 className="text-2xl font-semibold">Правила проекта</h1>
      <p className="mt-2 text-sm text-muted">Перед подключением ознакомьтесь с правилами работы в проекте.</p>
      <div className="mt-4 text-sm">
        • Своевременно подтверждайте смены<br />
        • Сообщайте об изменениях заранее<br />
        • Соблюдайте требования по безопасности<br />
        • Все вопросы — через руководителя
      </div>
    </div>
  );
}

function UserName({ userId }: { userId: string }) {
  const [name, setName] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!userId) {
      setName(null);
      setLoaded(true);
      return;
    }
    return safeOnSnapshot(doc(db, "users_public", userId), (snap) => {
      if (!snap.exists()) {
        setName(null);
        setLoaded(true);
        return;
      }
      const data = snap.data() as any;
      setName(data?.name ?? data?.email ?? null);
      setLoaded(true);
    });
  }, [userId]);

  if (!loaded) return <span />;
  return <span>{name ?? "Нет имени"}</span>;
}
async function updateOrCreateMember(projectId: string, userId: string) {
  const memberId = `${projectId}_${userId}`;
  const memberRef = doc(db, "project_members", memberId);
  await setDoc(
    memberRef,
    {
      projectId,
      userId,
      role: "pending",
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
}

async function getProjectAdmins(projectId: string) {
  const adminIds = new Set<string>();

  const projectDoc = await getDoc(doc(db, "projects", projectId));
  if (projectDoc.exists()) {
    const ownerId = (projectDoc.data() as any)?.ownerId;
    if (ownerId) adminIds.add(ownerId);
  }

  const adminsSnap = await getDocs(
    query(
      collection(db, "project_members"),
      where("projectId", "==", projectId),
      where("role", "==", "admin")
    )
  );

  adminsSnap.forEach((d) => {
    const data = d.data() as any;
    if (data?.userId) adminIds.add(data.userId);
  });

  return Array.from(adminIds);
}

function formatDate(d: Date) {
  return `${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1)
    .toString()
    .padStart(2, "0")}.${d.getFullYear()}`;
}

function formatTime(d: Date) {
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

function formatHours(totalMinutes: number) {
  const hours = totalMinutes / 60;
  if (Number.isInteger(hours)) return String(hours);
  return hours.toFixed(1);
}

async function addWorkDayToAccounting({
  userId,
  projectId,
  start,
  end,
  breakMinutes,
}: {
  userId: string;
  projectId: string;
  start: Date;
  end: Date;
  breakMinutes: number;
}) {
  const minutes = Math.floor((end.getTime() - start.getTime()) / 60000) - breakMinutes;
  if (minutes <= 0) return;

  const monthKey = `${start.getFullYear()}-${(start.getMonth() + 1).toString().padStart(2, "0")}`;
  const dayKey = `${start.getFullYear()}-${(start.getMonth() + 1).toString().padStart(2, "0")}-${start
    .getDate()
    .toString()
    .padStart(2, "0")}`;

  const ref = doc(db, "accounting_hours", userId, "months", monthKey);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);

    if (!snap.exists()) {
      tx.set(ref, {
        month: monthKey,
        projectId,
        userId,
        totalMinutes: minutes,
        days: {
          [dayKey]: minutes,
        },
        updatedAt: serverTimestamp(),
      });
      return;
    }

    const data = snap.data() as any;
    const days = { ...(data?.days ?? {}) };
    const prevDay = Number(days[dayKey] ?? 0);
    const prevTotal = Number(data?.totalMinutes ?? 0);

    days[dayKey] = prevDay + minutes;

    tx.update(ref, {
      days,
      totalMinutes: prevTotal + minutes,
      updatedAt: serverTimestamp(),
    });
  });
}
