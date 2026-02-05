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

  useEffect(() => {
    const q = query(
      collection(db, "project_chats", projectId, "messages"),
      orderBy("createdAt", "asc")
    );
    return safeOnSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
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

  async function sendMessage() {
    const clean = text.trim();
    if (!clean) return;
    setText("");
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
        <div className="panel motion p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Закрепы</p>
            {isManager && (
              <button className="btn btn-outline" onClick={addPinned}>
                Добавить
              </button>
            )}
          </div>
          <div className="mt-3 grid gap-2 text-sm">
            {pinned.map((p) => (
              <div key={p.id} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                {p.text}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="panel motion p-6">
        <div className="grid gap-3 max-h-[420px] overflow-y-auto hide-scrollbar">
          {messages.length === 0 && (
            <div className="text-sm text-muted">Пока нет сообщений в этом чате.</div>
          )}
          {messages.map((m) => {
            const isMe = m.senderId === currentUserId;
            return (
              <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[70%] rounded-2xl px-4 py-3 text-sm ${isMe ? "bg-[#7dd3a7] text-black" : "bg-white/5"}`}>
                  {!isMe && (
                    <div className="mb-1 text-xs text-muted">
                      <UserName userId={m.senderId} />
                    </div>
                  )}
                  {m.text}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex gap-3">
          <input
            className="input flex-1"
            placeholder="Введите сообщение"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button className="btn btn-primary" onClick={sendMessage}>
            Отправить
          </button>
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
  const [name, setName] = useState<string>(userId);

  useEffect(() => {
    if (!userId) return;
    return safeOnSnapshot(doc(db, "users_public", userId), (snap) => {
      const data = snap.data() as any;
      setName(data?.name ?? data?.email ?? userId);
    });
  }, [userId]);

  return <span>{name}</span>;
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
