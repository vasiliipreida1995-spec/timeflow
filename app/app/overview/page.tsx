// @ts-nocheck
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, collectionGroup, query, where, doc, getDoc, getDocs, orderBy, limit } from "firebase/firestore";
import { auth, db } from "../../../lib/firebase";
import { safeOnSnapshot } from "../../../lib/firestoreSafe";

function formatHoursValue(hours: number) {
  if (Number.isInteger(hours)) return String(hours);
  return hours.toFixed(1);
}

function formatIntValue(value: number) {
  return String(Math.round(value));
}

function formatPercent(value: number) {
  const abs = Math.abs(value);
  const str = abs % 1 === 0 ? String(abs) : abs.toFixed(1);
  return `${value >= 0 ? "+" : "-"}${str}%`;
}

function labelFromMonthKey(key: string) {
  const parts = key.split("-");
  if (parts.length !== 2) return key;
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  if (!year || !month) return key;
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString("ru-RU", { month: "long" });
}

function formatDateLabel(date: Date | null) {
  if (!date) return "";
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startYesterday = new Date(startToday);
  startYesterday.setDate(startYesterday.getDate() - 1);
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (dayStart.getTime() === startToday.getTime()) return "Сегодня";
  if (dayStart.getTime() === startYesterday.getTime()) return "Вчера";
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

function formatClock(date: Date | null) {
  if (!date) return "-";
  const h = date.getHours().toString().padStart(2, "0");
  const m = date.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

function useAnimatedNumber(target: number | null, format: (value: number) => string, durationMs: number = 700) {
  const [display, setDisplay] = useState("-");
  const rafRef = useRef<number | null>(null);
  const prevRef = useRef<number>(0);

  useEffect(() => {
    if (target == null || Number.isNaN(target)) {
      setDisplay("-");
      return;
    }

    const startValue = prevRef.current;
    const endValue = target;
    if (startValue === endValue) {
      setDisplay(format(endValue));
      return;
    }

    const startTime = performance.now();

    const step = (now: number) => {
      const t = Math.min(1, (now - startTime) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = startValue + (endValue - startValue) * eased;
      setDisplay(format(current));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        prevRef.current = endValue;
      }
    };

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, format, durationMs]);

  return display;
}

type Project = { id: string; name?: string | null; archived?: boolean | null };

type ProjectSelectProps = {
  value: string;
  projects: Project[];
  onChange: (value: string) => void;
};

type OverdueItem = {
  id: string;
  projectId?: string | null;
  userId?: string | null;
  start?: any;
};

type ChatMessage = {
  id: string;
  tempId?: string | null;
  text?: string | null;
  senderId?: string | null;
  createdAt?: any;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  priority?: "normal" | "important" | "urgent" | null;
};

type ChatReaction = {
  emoji: string;
  count: number;
  mine: boolean;
};

function ProjectSelect({ value, projects, onChange }: ProjectSelectProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selected = projects.find((p: any) => p.id === value);
  const label = value ? (selected?.name ?? value) : "Все проекты";

  return (
    <div className="relative" ref={wrapperRef}>
      <button type="button" className="input input-select max-w-[320px] text-left" onClick={() => setOpen((v: any) => !v)}>
        {label}
      </button>
      {open && (
        <div className="absolute left-0 top-[calc(100%+10px)] z-[999] min-w-[320px] rounded-[18px] border border-[rgba(125,211,167,0.22)] bg-[linear-gradient(180deg,rgba(22,26,32,0.98),rgba(10,12,15,0.96))] p-2 shadow-[0_30px_80px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.04)]">
          <button
            type="button"
            className={`w-full rounded-[12px] px-3 py-2 text-left text-sm transition ${
              value === "" ? "bg-[rgba(125,211,167,0.2)] text-[#0b1412]" : "hover:bg-white/5"
            }`}
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
          >
            Все проекты
          </button>
          <div className="mt-2 max-h-[260px] overflow-y-auto pr-1">
            {projects.map((p: any) => (
              <button
                key={p.id}
                type="button"
                className={`mt-1 w-full rounded-[12px] px-3 py-2 text-left text-sm transition ${
                  value === p.id ? "bg-[rgba(125,211,167,0.2)] text-[#0b1412]" : "hover:bg-white/5"
                }`}
                onClick={() => {
                  onChange(p.id);
                  setOpen(false);
                }}
              >
                {p.name ?? p.id}
              </button>
            ))}
            {projects.length === 0 && (
              <div className="rounded-[12px] px-3 py-2 text-sm text-muted">Нет проектов</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function UserLabel({ userId, userNames }: { userId?: string | null; userNames: Record<string, string> }) {
  if (!userId) return <span>Пользователь</span>;
  return <span>{userNames[userId] ?? "Нет имени"}</span>;
}

export default function OverviewPage() {
  const monthKey = useMemo(() => {
    const d = new Date();
    const m = (d.getMonth() + 1).toString().padStart(2, "0");
    return `${d.getFullYear()}-${m}`;
  }, []);

  const prevMonthKey = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    const m = (d.getMonth() + 1).toString().padStart(2, "0");
    return `${d.getFullYear()}-${m}`;
  }, []);

  const [userId, setUserId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [chatProjectId, setChatProjectId] = useState<string>("");

  useEffect(() => {
    if (selectedProjectId) {
      localStorage.setItem("overviewProjectId", selectedProjectId);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    if (chatProjectId) {
      localStorage.setItem("overviewChatProjectId", chatProjectId);
    }
  }, [chatProjectId]);

  const [monthMinutes, setMonthMinutes] = useState<number | null>(null);
  const [prevMonthMinutes, setPrevMonthMinutes] = useState<number | null>(null);
  const [activeProjects, setActiveProjects] = useState<number | null>(null);
  const [peopleCount, setPeopleCount] = useState<number | null>(null);
  const [overdue, setOverdue] = useState<OverdueItem[]>([]);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [reminded, setReminded] = useState<Record<string, boolean>>({});

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLeaderIds, setChatLeaderIds] = useState<string[]>([]);
  const [chatUserNames, setChatUserNames] = useState<Record<string, string>>({});
  const [chatUserAvatars, setChatUserAvatars] = useState<Record<string, string>>({});
  const [chatText, setChatText] = useState("");
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const isAtBottomRef = useRef(true);
  const initialLoadRef = useRef(true);
  const wsRef = useRef<WebSocket | null>(null);
  const typingTimeoutsRef = useRef<Record<string, number>>({});

  const scrollToBottom = () => {
    const el = chatScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  };

  const [chatReactions, setChatReactions] = useState<Record<string, ChatReaction[]>>({});
  const [readCounts, setReadCounts] = useState<Record<string, number>>({});
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [chatPriority, setChatPriority] = useState<"normal" | "important" | "urgent">("normal");
  const [chatAttachmentUrl, setChatAttachmentUrl] = useState("");
  const [chatAttachmentName, setChatAttachmentName] = useState("");
  const [showAttachment, setShowAttachment] = useState(false);
  const typingTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, (user: any) => {
      setUserId(user?.uid ?? null);
      setAuthReady(true);
    });
  }, []);

  useEffect(() => {
    if (!chatMessages.length) return;
    const last = chatMessages[chatMessages.length - 1];
    if (last && last.senderId !== userId && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "read", projectId: chatProjectId, messageId: last.id }));
    }
    if (last?.senderId === userId || isAtBottomRef.current) {
      requestAnimationFrame(() => {
        scrollToBottom();
      });
    }
  }, [chatMessages.length, chatProjectId, userId]);

  useEffect(() => {
    const savedMain = localStorage.getItem("overviewProjectId") ?? "";
    const savedChat = localStorage.getItem("overviewChatProjectId") ?? "";
    if (savedMain) setSelectedProjectId(savedMain);
    if (savedChat) setChatProjectId(savedChat);
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (!userId) {
      setProjects([]);
      setSelectedProjectId("");
      setChatProjectId("");
      return;
    }

    const q = query(collection(db, "projects"), where("ownerId", "==", userId), where("archived", "==", false));

    return safeOnSnapshot(q, (snap: any) => {
      const list = snap.docs.map((d: any) => ({ id: d.id, ...(d.data() as any) }));
      setProjects(list);
      setActiveProjects(list.length);

      if (list.length === 0) {
        setSelectedProjectId("");
        setChatProjectId("");
        return;
      }

      const savedMain = localStorage.getItem("overviewProjectId") ?? "";
      const savedChat = localStorage.getItem("overviewChatProjectId") ?? "";

      const isMainValid = selectedProjectId && list.some((p: any) => p.id === selectedProjectId);
      const isSavedMainValid = savedMain && list.some((p: any) => p.id === savedMain);
      const nextMain = isMainValid ? selectedProjectId : isSavedMainValid ? savedMain : list[0].id;
      if (nextMain && nextMain !== selectedProjectId) setSelectedProjectId(nextMain);

      const isChatValid = chatProjectId && list.some((p: any) => p.id === chatProjectId);
      const isSavedChatValid = savedChat && list.some((p: any) => p.id === savedChat);
      const nextChat = isChatValid ? chatProjectId : isSavedChatValid ? savedChat : list[0].id;
      if (nextChat && nextChat !== chatProjectId) setChatProjectId(nextChat);
    });
  }, [userId, authReady, selectedProjectId, chatProjectId]);

  useEffect(() => {
    if (selectedProjectId) {
      const q = query(collectionGroup(db, "months"), where("month", "==", monthKey), where("projectId", "==", selectedProjectId));
      return safeOnSnapshot(q, (snap: any) => {
        let total = 0;
        snap.forEach((d: any) => {
          const data = d.data() as any;
          const mins = Number(data?.totalMinutes ?? 0);
          if (!Number.isNaN(mins)) total += mins;
        });
        setMonthMinutes(total);
      });
    }

    if (!projects.length) {
      setMonthMinutes(0);
      return;
    }

    const buckets = new Map<string, number>();
    const unsubs = projects.map((project: any) => {
      const q = query(collectionGroup(db, "months"), where("month", "==", monthKey), where("projectId", "==", project.id));
      return safeOnSnapshot(q, (snap: any) => {
        let subtotal = 0;
        snap.forEach((d: any) => {
          const data = d.data() as any;
          const mins = Number(data?.totalMinutes ?? 0);
          if (!Number.isNaN(mins)) subtotal += mins;
        });
        buckets.set(project.id, subtotal);
        const total = Array.from(buckets.values()).reduce((sum, v) => sum + v, 0);
        setMonthMinutes(total);
      });
    });

    return () => {
      unsubs.forEach((u: any) => u());
    };
  }, [monthKey, selectedProjectId, projects]);

  useEffect(() => {
    if (selectedProjectId) {
      const q = query(collectionGroup(db, "months"), where("month", "==", prevMonthKey), where("projectId", "==", selectedProjectId));
      return safeOnSnapshot(q, (snap: any) => {
        let total = 0;
        snap.forEach((d: any) => {
          const data = d.data() as any;
          const mins = Number(data?.totalMinutes ?? 0);
          if (!Number.isNaN(mins)) total += mins;
        });
        setPrevMonthMinutes(total);
      });
    }

    if (!projects.length) {
      setPrevMonthMinutes(0);
      return;
    }

    const buckets = new Map<string, number>();
    const unsubs = projects.map((project: any) => {
      const q = query(collectionGroup(db, "months"), where("month", "==", prevMonthKey), where("projectId", "==", project.id));
      return safeOnSnapshot(q, (snap: any) => {
        let subtotal = 0;
        snap.forEach((d: any) => {
          const data = d.data() as any;
          const mins = Number(data?.totalMinutes ?? 0);
          if (!Number.isNaN(mins)) subtotal += mins;
        });
        buckets.set(project.id, subtotal);
        const total = Array.from(buckets.values()).reduce((sum, v) => sum + v, 0);
        setPrevMonthMinutes(total);
      });
    });

    return () => {
      unsubs.forEach((u: any) => u());
    };
  }, [prevMonthKey, selectedProjectId, projects]);

  useEffect(() => {
    if (!userId) {
      setPeopleCount(null);
      return;
    }

    if (selectedProjectId) {
      const q = query(collection(db, "project_members"), where("projectId", "==", selectedProjectId), where("role", "in", ["admin", "worker"]));
      return safeOnSnapshot(q, (snap: any) => {
        const ids = new Set<string>();
        snap.forEach((d: any) => {
          const data = d.data() as any;
          if (data?.userId) ids.add(String(data.userId));
        });
        setPeopleCount(ids.size);
      });
    }

    if (!projects.length) {
      setPeopleCount(0);
      return;
    }

    const buckets = new Map<string, Set<string>>();
    const unsubs = projects.map((project: any) => {
      const q = query(collection(db, "project_members"), where("projectId", "==", project.id), where("role", "in", ["admin", "worker"]));
      return safeOnSnapshot(q, (snap: any) => {
        const ids = new Set<string>();
        snap.forEach((d: any) => {
          const data = d.data() as any;
          if (data?.userId) ids.add(String(data.userId));
        });
        buckets.set(project.id, ids);
        const all = new Set<string>();
        buckets.forEach((set: any) => set.forEach((id: any) => all.add(id)));
        setPeopleCount(all.size);
      });
    });

    return () => {
      unsubs.forEach((u: any) => u());
    };
  }, [userId, selectedProjectId, projects]);

  useEffect(() => {
    if (!chatProjectId) {
      setChatLeaderIds([]);
      return;
    }

    const q = query(collection(db, "project_members"), where("projectId", "==", chatProjectId), where("role", "==", "admin"));

    return safeOnSnapshot(q, (snap: any) => {
      const ids: string[] = [];
      snap.forEach((d: any) => {
        const data = d.data() as any;
        if (data?.userId) ids.push(String(data.userId));
      });
      setChatLeaderIds(ids);
    });
  }, [chatProjectId]);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!chatProjectId || !userId) {
        if (active) setChatMessages([]);
        return;
      }

      const token = await auth.currentUser?.getIdToken();
      if (!token) return;

      const res = await fetch(`/api/admin-chat?projectId=${encodeURIComponent(chatProjectId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) return;
      const data = await res.json();
      if (!active) return;
      const list = Array.isArray(data?.messages) ? data.messages : [];
      setChatMessages(
        list.map((msg: any) => ({
          ...msg,
          createdAt: msg.createdAt ? new Date(msg.createdAt) : null,
        }))
      );
      setChatReactions(data?.reactions ?? {});
      setPinnedIds(Array.isArray(data?.pinnedIds) ? data.pinnedIds : []);
      setReadCounts(data?.readCounts ?? {});
      requestAnimationFrame(() => {
        if (initialLoadRef.current) {
          scrollToBottom();
          initialLoadRef.current = false;
        }
      });
    }

    load();

    return () => {
      active = false;
    };
  }, [chatProjectId, userId]);
  const chatLeaderSet = useMemo(() => new Set(chatLeaderIds), [chatLeaderIds]);
  const isChatLeader = !!userId && chatLeaderSet.has(userId);

  useEffect(() => {
    if (!chatProjectId || !userId || !isChatLeader) return;

    let active = true;
    let ws: WebSocket | null = null;

    const connect = async () => {
      const token = await auth.currentUser?.getIdToken();
      if (!token || !active) return;

      const base = process.env.NEXT_PUBLIC_WS_URL || ("ws://" + window.location.hostname + ":3001");
      const url = new URL(base);
      url.searchParams.set("projectId", chatProjectId);
      url.searchParams.set("token", token);

      ws = new WebSocket(url.toString());
      wsRef.current = ws;

      ws.onmessage = (event: any) => {
        let payload: any = null;
        try {
          payload = JSON.parse(event.data);
        } catch {
          return;
        }
        if (!payload) return;

        if (payload.type === "message") {
          const message = payload.message as ChatMessage & { clientId?: string | null };
          setChatMessages((prev: any) => {
            const cleaned = prev.filter((m: any) => {
              if (!message?.clientId) return true;
              return m.id !== message.clientId;
            });
            const merged = [...cleaned, message];
            const seen = new Set<string>();
            return merged.filter((m: any) => {
              const key = (m.id ?? m.tempId) as string | undefined;
              if (!key) return true;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });
          });
          requestAnimationFrame(() => {
            if (message?.senderId === userId || isAtBottomRef.current || initialLoadRef.current) {
              scrollToBottom();
              initialLoadRef.current = false;
            }
          });
        }

        if (payload.type === "reaction") {
          if (payload.userId === userId) return;
          setChatReactions((prev: any) => {
            const current = prev[payload.messageId] ? [...prev[payload.messageId]] : [];
            const idx = current.findIndex((r: any) => r.emoji === payload.emoji);
            if (payload.action === "removed") {
              if (idx >= 0) {
                const item = current[idx];
                const nextCount = Math.max(0, item.count - 1);
                if (nextCount === 0) {
                  current.splice(idx, 1);
                } else {
                  current[idx] = { ...item, count: nextCount, mine: item.mine };
                }
              }
            } else {
              if (idx >= 0) {
                const item = current[idx];
                current[idx] = { ...item, count: item.count + 1, mine: item.mine };
              } else {
                current.push({ emoji: payload.emoji, count: 1, mine: false });
              }
            }
            return { ...prev, [payload.messageId]: current };
          });
        }

        if (payload.type === "pin") {
          setPinnedIds((prev: any) => {
            if (payload.action === "unpinned") {
              return prev.filter((id: any) => id !== payload.messageId);
            }
            if (prev.includes(payload.messageId)) return prev;
            return [...prev, payload.messageId];
          });
        }

        if (payload.type === "read") {
          if (payload.userId === userId) return;
          if (typeof payload.count !== "number") return;
          setReadCounts((prev: any) => ({
            ...prev,
            [payload.messageId]: payload.count,
          }));
        }

        if (payload.type === "typing") {
          if (payload.userId === userId) return;
          setTypingUsers((prev: string[]) => {
            const next = new Set(prev);
            if (payload.isTyping) {
              next.add(payload.userId);
            } else {
              next.delete(payload.userId);
            }
            return Array.from(next) as string[];
          });
          if (payload.isTyping) {
            if (typingTimeoutsRef.current[payload.userId]) {
              clearTimeout(typingTimeoutsRef.current[payload.userId]);
            }
            typingTimeoutsRef.current[payload.userId] = window.setTimeout(() => {
              setTypingUsers((prev: any) => prev.filter((id: any) => id !== payload.userId));
            }, 6000);
          }
        }
      };
    };

    connect();

    return () => {
      active = false;
      if (ws) ws.close();
      wsRef.current = null;
    };
  }, [chatProjectId, userId, isChatLeader]);

  useEffect(() => {
    const ids = new Set<string>();
    chatLeaderIds.forEach((id: any) => ids.add(id));
    chatMessages.forEach((msg: any) => {
      if (msg.senderId) ids.add(String(msg.senderId));
    });

    if (ids.size === 0) {
      setChatUserNames({});
      setChatUserAvatars({});
      return;
    }

    const q = query(collection(db, "users_public"), where("__name__", "in", Array.from(ids).slice(0, 10)));
    return safeOnSnapshot(q, (snap: any) => {
      const map: Record<string, string> = {};
      const avatars: Record<string, string> = {};
      snap.forEach((docSnap: any) => {
        const data = docSnap.data() as any;
        map[docSnap.id] = data?.name ?? data?.email ?? "Нет имени";
        const avatar = data?.photoURL ?? data?.avatarUrl ?? data?.avatar ?? null;
        if (avatar) avatars[docSnap.id] = avatar;
      });
      setChatUserNames(map);
      setChatUserAvatars(avatars);
    });
  }, [chatLeaderIds, chatMessages]);

  useEffect(() => {
    if (!userId) {
      setOverdue([]);
      setUserNames({});
      return;
    }

    const ownedIds = selectedProjectId ? [selectedProjectId] : projects.map((p: any) => p.id);
    if (!ownedIds.length) {
      setOverdue([]);
      setUserNames({});
      return;
    }

    const buckets = new Map<string, OverdueItem[]>();

    const updateAll = () => {
      const items = Array.from(buckets.values()).flat();
      items.sort((a, b) => {
        const at = a.start?.toDate ? a.start.toDate().getTime() : 0;
        const bt = b.start?.toDate ? b.start.toDate().getTime() : 0;
        return at - bt;
      });
      setOverdue(items.slice(0, 5));

      const needed = new Set<string>();
      items.forEach((it: any) => {
        if (it.userId) needed.add(String(it.userId));
      });

      if (needed.size === 0) {
        setUserNames({});
        return;
      }

      const unsubUsers = safeOnSnapshot(
        query(collection(db, "users_public"), where("__name__", "in", Array.from(needed).slice(0, 10))),
        (snap: any) => {
          const map: Record<string, string> = {};
          snap.forEach((docSnap: any) => {
            const data = docSnap.data() as any;
            map[docSnap.id] = data?.name ?? data?.email ?? "Нет имени";
          });
          setUserNames(map);
        }
      );

      return () => {
        unsubUsers();
      };
    };

    const unsubs = ownedIds.map((projectId: any) => {
      const q = query(collection(db, "project_schedules"), where("projectId", "==", projectId), where("scheduleConfirmed", "==", false));
      return safeOnSnapshot(q, (snap: any) => {
        const list: OverdueItem[] = [];
        snap.forEach((d: any) => {
          const data = d.data() as any;
          const start = data?.start?.toDate ? data.start.toDate() : null;
          if (!start) return;
          const hours = (Date.now() - start.getTime()) / 3600000;
          if (hours < 24) return;
          list.push({ id: d.id, ...(data as any) });
        });
        buckets.set(projectId, list);
        updateAll();
      });
    });

    return () => {
      unsubs.forEach((u: any) => u());
    };
  }, [userId, selectedProjectId, projects]);

  function toggleReaction(messageId: string, emoji: string) {
    if (!chatProjectId || !userId || !isChatLeader) return;

    setChatReactions((prev: any) => {
      const current = prev[messageId] ? [...prev[messageId]] : [];
      const mineEmojis = current.filter((r: any) => r.mine).map((r: any) => r.emoji);
      const mineHas = mineEmojis.includes(emoji);

      const next = current
        .map((r: any) => {
          if (!r.mine) return r;
          if (mineHas && r.emoji === emoji) {
            return { ...r, count: Math.max(0, r.count - 1), mine: false };
          }
          if (!mineHas && r.emoji === emoji) {
            return { ...r, count: r.count + 1, mine: true };
          }
          if (mineHas && r.emoji !== emoji) {
            return { ...r, count: Math.max(0, r.count - 1), mine: false };
          }
          return r;
        })
        .filter((r: any) => r.count > 0);

      if (!mineHas) {
        const idx = next.findIndex((r: any) => r.emoji === emoji);
        if (idx >= 0) {
          next[idx] = { ...next[idx], count: next[idx].count + 1, mine: true };
        } else {
          next.push({ emoji, count: 1, mine: true });
        }
      }

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        mineEmojis.forEach((oldEmoji: any) => {
          if (oldEmoji !== emoji) {
            wsRef.current?.send(JSON.stringify({ type: "reaction", projectId: chatProjectId, messageId, emoji: oldEmoji }));
          }
        });
      }

      return { ...prev, [messageId]: next };
    });

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "reaction", projectId: chatProjectId, messageId, emoji }));
    }
  }

  async function togglePin(messageId: string) {
    if (!chatProjectId || !userId || !isChatLeader) return;
    setPinnedIds((prev: any) => (prev.includes(messageId) ? prev.filter((id: any) => id !== messageId) : [...prev, messageId]));
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "pin", projectId: chatProjectId, messageId }));
    }
  }

  async function sendChatMessage() {
    if (!chatProjectId || !userId || !isChatLeader) return;
    const clean = chatText.trim();
    if (!clean) return;

    const clientId = `local-${Date.now()}`;
    const payload = {
      type: "message",
      projectId: chatProjectId,
      text: clean,
      priority: chatPriority,
      attachmentUrl: chatAttachmentUrl.trim() || null,
      attachmentName: chatAttachmentName.trim() || null,
      clientId,
    };

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }

    setChatMessages((prev: any) => [
      ...prev,
      {
        id: clientId,
        tempId: clientId,
        senderId: userId,
        text: clean,
        createdAt: new Date(),
        priority: chatPriority,
        attachmentUrl: chatAttachmentUrl.trim() || null,
        attachmentName: chatAttachmentName.trim() || null,
      },
    ]);

    setChatText("");
  }

  const filteredChatMessages = chatMessages.filter((msg: any) => msg.senderId && chatLeaderSet.has(String(msg.senderId)));
  const pinnedMessages = filteredChatMessages.filter((msg: any) => pinnedIds.includes(msg.id));
  const regularMessages = filteredChatMessages.filter((msg: any) => !pinnedIds.includes(msg.id));

  const currentMinutes = monthMinutes ?? 0;
  const prevMinutes = prevMonthMinutes ?? 0;
  const maxMinutes = Math.max(currentMinutes, prevMinutes, 1);
  const currentBar = Math.round((currentMinutes / maxMinutes) * 100);
  const prevBar = Math.round((prevMinutes / maxMinutes) * 100);

  const monthHoursDisplay = useAnimatedNumber(monthMinutes == null ? null : monthMinutes / 60, formatHoursValue);
  const activeDisplay = useAnimatedNumber(activeProjects, formatIntValue);
  const peopleDisplay = useAnimatedNumber(peopleCount, formatIntValue);

  const deltaPercent = prevMinutes === 0 ? null : ((currentMinutes - prevMinutes) / prevMinutes) * 100;
  const deltaLabel = deltaPercent == null ? "-" : formatPercent(deltaPercent);
  const deltaTone = deltaPercent != null && deltaPercent < 0 ? "down" : "up";

  const cards = [
    { label: "Часы за месяц", value: monthHoursDisplay, note: selectedProjectId ? "по проекту" : "по всем проектам" },
    { label: "Активные проекты", value: activeDisplay, note: selectedProjectId ? "выбранный проект" : "текущий аккаунт" },
    { label: "Людей на проектах", value: peopleDisplay, note: selectedProjectId ? "в проекте" : "ваши проекты" },
  ];

  const chatSelectedProject = projects.find((p: any) => p.id === chatProjectId);
  return (
    <div className="grid gap-6">
      <div className="panel motion p-6 min-h-[320px] max-h-[560px] overflow-hidden">
        <div className="panel-header">
          <div>
            <h2 className="text-lg font-semibold">Командный чат проекта</h2>
            <p className="text-sm text-muted">
              Руководители и менеджеры {chatSelectedProject ? `проекта «${chatSelectedProject.name ?? chatSelectedProject.id}»` : "всех проектов"}.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ProjectSelect value={chatProjectId} projects={projects} onChange={setChatProjectId} />
            <span className="badge chip">{chatProjectId ? chatLeaderIds.length : 0}</span>
          </div>
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
          <div
            className="chat-area rounded-2xl border border-white/10 bg-white/5 p-4 h-[360px] overflow-y-auto hide-scrollbar"
            ref={chatScrollRef}
            onScroll={() => {
              const el = chatScrollRef.current;
              if (!el) return;
              const threshold = 24;
              isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
              if (isAtBottomRef.current) {
                const last = chatMessages[chatMessages.length - 1];
                if (last && last.senderId !== userId && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                  wsRef.current.send(JSON.stringify({ type: "read", projectId: chatProjectId, messageId: last.id }));
                }
              }
            }}
          >
            {!chatProjectId && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-muted">
                Выберите проект, чтобы открыть командный чат.
              </div>
            )}
            {chatProjectId && !isChatLeader && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-muted">
                Чат доступен только руководителям проекта.
              </div>
            )}
            {chatProjectId && isChatLeader && pinnedMessages.length > 0 && (
              <div className="chat-pinned">
                <div className="text-xs text-muted">Закреплённые</div>
                <div className="mt-2 grid gap-2">
                  {pinnedMessages.map((msg, index) => (
                    <div key={`${msg.id ?? msg.tempId ?? index}`} className="chat-pinned-item">
                      <div className="flex items-center justify-between text-xs text-muted">
                        <UserLabel userId={msg.senderId} userNames={chatUserNames} />
                        <button type="button" onClick={() => togglePin(msg.id)} className="chat-pin-action">
                          Открепить
                        </button>
                      </div>
                      <div className="mt-1 text-sm text-white/90">{msg.text ?? ""}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {chatProjectId && isChatLeader && regularMessages.length === 0 && pinnedMessages.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-muted">
                Пока нет сообщений. Начните обсуждение с командой.
              </div>
            )}
            {chatProjectId && isChatLeader && regularMessages.length > 0 && (
              <div className="grid gap-4">
                {regularMessages.map((msg, index) => {
                  const created = msg.createdAt instanceof Date ? msg.createdAt : msg.createdAt ? new Date(msg.createdAt) : null;
                  const reactions = chatReactions[msg.id] ?? [];
                  const isMine = msg.senderId === userId;
                  const prev = index > 0 ? regularMessages[index - 1] : null;
                  const prevSender = prev?.senderId ?? null;
                  const isSameSender = !!prevSender && msg.senderId === prevSender;
                  const prevDate = prev?.createdAt ? (prev.createdAt instanceof Date ? prev.createdAt : new Date(prev.createdAt)) : null;
                  const showDate = !prevDate || !created || prevDate.toDateString() !== created.toDateString();
                  return (
                    <div key={`${msg.id ?? msg.tempId ?? index}`} className={`chat-row group flex items-start gap-3${isMine ? " is-mine" : ""}`}>
                      {!isSameSender && (
                        <>
                          {chatUserAvatars[msg.senderId ?? ""] ? (
                            <img src={chatUserAvatars[msg.senderId ?? ""]} alt="" className="h-9 w-9 rounded-full object-cover" />
                          ) : (
                            <div className="h-9 w-9 rounded-full bg-[rgba(125,211,167,0.25)]" />
                          )}
                        </>
                      )}
                      <div className={`chat-bubble min-w-0${isSameSender ? " chat-bubble-compact" : ""}`}>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                          {!isSameSender && (
                            <span className="text-sm font-semibold text-white/90">
                              <UserLabel userId={msg.senderId} userNames={chatUserNames} />
                            </span>
                          )}
                          <span>{formatClock(created)}</span>
                          {msg.priority && msg.priority !== "normal" && (
                            <span className={`badge chip ${msg.priority === "urgent" ? "bg-rose-400/20 text-rose-200" : "bg-amber-400/20 text-amber-200"}`}>
                              {msg.priority === "urgent" ? "Срочно" : "Важно"}
                            </span>
                          )}
                        </div>
                        <div className="chat-text">{msg.text ?? ""}</div>
                        {msg.attachmentUrl && (
                          <a className="chat-attachment" href={msg.attachmentUrl} target="_blank" rel="noreferrer">
                            {msg.attachmentName ?? "Вложение"}
                          </a>
                        )}
                        {isMine && (readCounts[msg.id] ?? 0) > 0 && (
                          <div className="mt-1 text-[11px] text-white/45">Прочитано {readCounts[msg.id]}</div>
                        )}
                        <div className="chat-reactions">
                          {["👍", "🔥", "✅"].map((emoji: any) => {
                            const item = reactions.find((r: any) => r.emoji === emoji);
                            return (
                              <button key={emoji} type="button" onClick={() => toggleReaction(msg.id, emoji)} className={`chat-reaction ${item?.mine ? "is-active" : ""}`}>
                                {emoji} {item ? item.count : 0}
                              </button>
                            );
                          })}
                          <button type="button" onClick={() => togglePin(msg.id)} className={`chat-pin ${pinnedIds.includes(msg.id) ? "is-active" : ""}`}>
                            {pinnedIds.includes(msg.id) ? "Открепить" : "Закрепить"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-muted">
              Обсуждайте важные изменения, чтобы команда видела общий контекст.
            </div>
            {typingUsers.length > 0 && (
              <div className="chat-typing">Печатает: {typingUsers.map((id: any) => chatUserNames[id] ?? "Пользователь").join(", ")}</div>
            )}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <label className="text-xs text-muted">Сообщение</label>
              <textarea
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/90"
                rows={4}
                placeholder={isChatLeader ? "Напишите короткое обновление для команды" : "Доступ только для руководителей"}
                value={chatText}
                onChange={(e: any) => setChatText(e.target.value)}
                disabled={!chatProjectId || !isChatLeader}
              />
              <div className="chat-controls">
                <select
                  className="input input-select"
                  value={chatPriority}
                  onChange={(e: any) => setChatPriority(e.target.value as any)}
                  disabled={!chatProjectId || !isChatLeader}
                >
                  <option value="normal">Обычное</option>
                  <option value="important">Важно</option>
                  <option value="urgent">Срочно</option>
                </select>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowAttachment((v: any) => !v)}
                  disabled={!chatProjectId || !isChatLeader}
                >
                  Вложение
                </button>
                <button
                  className="btn btn-primary"
                  type="button"
                  onClick={sendChatMessage}
                  disabled={!chatProjectId || !isChatLeader || !chatText.trim()}
                >
                  Отправить
                </button>
              </div>
              {showAttachment && (
                <div className="mt-3 grid gap-2">
                  <input
                    className="input"
                    placeholder="Ссылка на файл"
                    value={chatAttachmentUrl}
                    onChange={(e: any) => setChatAttachmentUrl(e.target.value)}
                  />
                  <input
                    className="input"
                    placeholder="Название (необязательно)"
                    value={chatAttachmentName}
                    onChange={(e: any) => setChatAttachmentName(e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="panel motion p-6 relative z-20 overflow-visible">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Control Room</h1>
            <p className="mt-2 text-sm text-muted">Сводка по ключевым метрикам и людям на проектах.</p>
          </div>
          <div className="flex flex-col items-start gap-3">
            <ProjectSelect value={selectedProjectId} projects={projects} onChange={setSelectedProjectId} />
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-muted">
              {selectedProjectId ? "Фильтр по проекту" : "Все проекты руководителя"}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {cards.map((item: any) => (
          <div key={item.label} className="panel motion p-6">
            <div className="text-sm text-muted">{item.label}</div>
            <div className="mt-3 text-3xl font-semibold tracking-tight">{item.value}</div>
            <div className="mt-2 text-xs text-muted">{item.note}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="panel motion p-6">
          <div className="panel-header">
            <div>
              <h2 className="text-lg font-semibold">Месяц к месяцу</h2>
              <p className="text-sm text-muted">Сравнение часов за {labelFromMonthKey(prevMonthKey)} и {labelFromMonthKey(monthKey)}.</p>
            </div>
            <div className={`badge chip ${deltaTone === "down" ? "bg-rose-400/15 text-rose-200" : "bg-emerald-400/15 text-emerald-200"}`}>{deltaLabel}</div>
          </div>
          <div className="mt-6 grid gap-4">
            <div>
              <div className="flex items-center justify-between text-xs text-muted">
                <span>{labelFromMonthKey(prevMonthKey)}</span>
                <span>{formatHoursValue(prevMinutes / 60)} ч</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-white/10">
                <div className="h-full rounded-full bg-white/40" style={{ width: `${prevBar}%` }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-xs text-muted">
                <span>{labelFromMonthKey(monthKey)}</span>
                <span>{formatHoursValue(currentMinutes / 60)} ч</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-white/10">
                <div className="h-full rounded-full bg-[rgba(125,211,167,0.8)]" style={{ width: `${currentBar}%` }} />
              </div>
            </div>
          </div>
        </div>

        <div className="panel motion p-6">
          <div className="panel-header">
            <div>
              <h2 className="text-lg font-semibold">Важное за 24 часа</h2>
              <p className="text-sm text-muted">Не подтверждают смены более суток.</p>
            </div>
            <span className="badge chip">{overdue.length}</span>
          </div>
          <div className="mt-6 grid gap-3 text-sm">
            {overdue.map((item: any) => {
              const projectName = projects.find((p: any) => p.id === item.projectId)?.name ?? item.projectId ?? "-";
              const start = item.start?.toDate ? item.start.toDate() : null;
              const hours = start ? Math.round((Date.now() - start.getTime()) / 3600000) : null;
              const remindedAlready = reminded[item.id];
              return (
                <div key={item.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">
                      <UserLabel userId={item.userId} userNames={userNames} />
                    </div>
                    <div className="text-xs text-muted">{hours != null ? `${hours} ч` : "-"}</div>
                  </div>
                  <div className="mt-1 text-xs text-muted">Проект: {projectName}</div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-muted">Шаблон: напоминание о подтверждении смены</span>
                    <button
                      type="button"
                      className={`btn btn-outline ${remindedAlready ? "opacity-60" : ""}`}
                      onClick={() => setReminded((prev: any) => ({ ...prev, [item.id]: true }))}
                    >
                      {remindedAlready ? "Запланировано" : "Напомнить"}
                    </button>
                  </div>
                </div>
              );
            })}
            {overdue.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-muted">Нет просроченных подтверждений.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}