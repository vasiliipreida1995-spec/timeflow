// @ts-nocheck
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "../../../lib/firebase";
import { safeOnSnapshot } from "../../../lib/firestoreSafe";

type Project = {
  id: string;
  name?: string | null;
  password?: string | null;
  ownerId?: string | null;
  archived?: boolean | null;
  createdAt?: any;
};

type ProjectMember = {
  id: string;
  projectId?: string | null;
  userId?: string | null;
  role?: string | null;
  joinedAt?: any;
};

export default function ProjectsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setUserId(user?.uid ?? null);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!userId) {
      setProjects([]);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, "projects"),
      where("ownerId", "==", userId),
      where("archived", "==", false),
      orderBy("createdAt", "desc")
    );

    return safeOnSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));
        setProjects(items);
        if (!selectedProjectId && items.length > 0) {
          setSelectedProjectId(items[0].id);
        }
        setLoading(false);
      },
      (err) => {
        setError(err?.message ?? "Ошибка загрузки проектов");
        setLoading(false);
      }
    );
  }, [userId, selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId) {
      setMembers([]);
      return;
    }

    setMembersLoading(true);
    const q = query(
      collection(db, "project_members"),
      where("projectId", "==", selectedProjectId)
    );

    return safeOnSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));
        setMembers(items);
        setMembersLoading(false);
      },
      (err) => {
        setError(err?.message ?? "Ошибка загрузки участников");
        setMembersLoading(false);
      }
    );
  }, [selectedProjectId]);

  async function createProject() {
    const cleanName = name.trim();
    const cleanPassword = password.trim();

    if (!cleanName || cleanPassword.length < 4) {
      setError("Название и пароль (минимум 4 символа) обязательны");
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      setError("Нужно войти в аккаунт");
      return;
    }

    setError(null);
    try {
      const ref = await addDoc(collection(db, "projects"), {
        name: cleanName,
        password: cleanPassword,
        ownerId: user.uid,
        createdAt: serverTimestamp(),
        archived: false,
      });

      await setDoc(doc(db, "project_members", `${ref.id}_${user.uid}`), {
        projectId: ref.id,
        userId: user.uid,
        role: "admin",
        joinedAt: serverTimestamp(),
      });

      setName("");
      setPassword("");
    } catch (e: any) {
      setError(e?.message ?? "Ошибка при создании проекта");
    }
  }

  async function renameProject(project: Project) {
    const currentName = project.name ?? "";
    const next = window.prompt("Переименовать проект", currentName);
    if (!next) return;
    const clean = next.trim();
    if (!clean) return;

    setError(null);
    setBusyId(project.id);
    try {
      await updateDoc(doc(db, "projects", project.id), { name: clean });
    } catch (e: any) {
      setError(e?.message ?? "Ошибка при переименовании");
    } finally {
      setBusyId(null);
    }
  }

  async function archiveProject(project: Project) {
    const ok = window.confirm(`Архивировать проект "${project.name ?? "Без названия"}"?`);
    if (!ok) return;

    setError(null);
    setBusyId(project.id);
    try {
      await updateDoc(doc(db, "projects", project.id), {
        archived: true,
        archivedAt: serverTimestamp(),
      });
    } catch (e: any) {
      setError(e?.message ?? "Ошибка при архивировании");
    } finally {
      setBusyId(null);
    }
  }

  if (!userId && !loading) {
    return (
      <div className="panel motion p-6">
        <h1 className="text-2xl font-semibold">Проекты</h1>
        <p className="mt-2 text-sm text-muted">Войдите, чтобы видеть проекты.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="panel motion p-6">
        <h1 className="text-2xl font-semibold">Проекты</h1>
        <p className="mt-2 text-sm text-muted">
          Создавайте проекты, приглашайте людей и управляйте доступами.
        </p>
      </div>

      <div className="panel motion p-6">
        <h2 className="text-lg font-semibold">Создать проект</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <input
            className="input"
            placeholder="Название проекта"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="input"
            placeholder="Пароль проекта (мин. 4 символа)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
          />
          <button className="btn btn-primary" onClick={createProject}>
            Создать
          </button>
        </div>
        {error && <div className="mt-3 text-sm text-red-400">{error}</div>}
      </div>

      <div className="panel motion p-6">
        <div className="panel-header">
          <h2 className="text-lg font-semibold">Все проекты</h2>
          <span className="chip">{projects.length}</span>
        </div>

        {loading && <div className="mt-4 text-sm text-muted">Загрузка...</div>}

        {!loading && projects.length === 0 && (
          <div className="mt-4 text-sm text-muted">Пока нет проектов.</div>
        )}

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {projects.map((project) => (
            <div key={project.id} className="panel motion p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-lg font-semibold">{project.name ?? "Без названия"}</p>
                  <p className="text-xs text-muted">ID: {project.id}</p>
                </div>
                <span className="pill">active</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link className="btn btn-primary" href={`/app/projects/${project.id}`}>
                  Открыть
                </Link>
                <button
                  className="btn btn-outline"
                  onClick={() => renameProject(project)}
                  disabled={busyId === project.id}
                >
                  Переименовать
                </button>
                <button
                  className="btn btn-outline"
                  onClick={() => archiveProject(project)}
                  disabled={busyId === project.id}
                >
                  Архивировать
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel motion p-6">
        <div className="panel-header">
          <h2 className="text-lg font-semibold">Участники проекта</h2>
          <span className="chip">{members.length}</span>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <select
            className="input"
            value={selectedProjectId ?? ""}
            onChange={(e) => setSelectedProjectId(e.target.value || null)}
          >
            <option value="">Выберите проект</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name ?? "Без названия"}
              </option>
            ))}
          </select>
        </div>

        {membersLoading && <div className="mt-4 text-sm text-muted">Загрузка...</div>}

        {!membersLoading && selectedProjectId && members.length === 0 && (
          <div className="mt-4 text-sm text-muted">В проекте нет участников.</div>
        )}

        <div className="mt-4 grid gap-3">
          {members.map((m) => (
            <MemberRow key={m.id} member={m} />
          ))}
        </div>
      </div>
    </div>
  );
}

function MemberRow({ member }: { member: ProjectMember }) {
  const [label, setLabel] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!member.userId) {
      setLabel(null);
      setEmail(null);
      setLoaded(true);
      return;
    }

    return safeOnSnapshot(doc(db, "users_public", member.userId), (snap) => {
      if (!snap.exists()) {
        setLabel(null);
        setEmail(null);
        setLoaded(true);
        return;
      }
      const data = snap.data() as any;
      setLabel(data?.name ?? data?.email ?? null);
      setEmail(data?.email ?? null);
      setLoaded(true);
    });
  }, [member.userId]);

  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
      <div>
        <p className="font-semibold">{loaded ? label ?? "Нет имени" : ""}</p>
        <p className="text-xs text-muted">{email ?? "Нет данных"}</p>
      </div>
      <span className="pill">{member.role ?? "member"}</span>
    </div>
  );
}