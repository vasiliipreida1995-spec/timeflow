"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  documentId,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { auth, db } from "../../../lib/firebase";

type Project = {
  id: string;
  name: string;
};


type ProjectDoc = { name?: string | null };

type MemberDoc = { userId?: string | null; projectId?: string | null };

type UserPublicDoc = {
  name?: string | null;
  email?: string | null;
  photoURL?: string | null;
  avatarUrl?: string | null;
  avatar?: string | null;
};

type TeamMember = {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  role: string;
  projects: string[];
};

function chunk<T>(list: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) {
    out.push(list.slice(i, i + size));
  }
  return out;
}

export default function TeamPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUserId(user?.uid ?? null);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const projectSnap = await getDocs(query(collection(db, "projects"), where("ownerId", "==", userId)));
        if (!active) return;

        const projectList: Project[] = projectSnap.docs.map((docSnap) => {
          const data = docSnap.data() as ProjectDoc;
          return { id: docSnap.id, name: data?.name ?? docSnap.id };
        });
        setProjects(projectList);

        if (projectList.length === 0) {
          setMembers([]);
          return;
        }

        const projectMap = new Map(projectList.map((p) => [p.id, p.name]));
        const adminMap = new Map<string, { role: string; projects: Set<string> }>();

        const ownEntry = adminMap.get(userId) ?? { role: "руководитель", projects: new Set<string>() };
        projectList.forEach((p) => ownEntry.projects.add(p.name));
        adminMap.set(userId, ownEntry);

        const idChunks = chunk(projectList.map((p) => p.id), 10);
        for (const ids of idChunks) {
          const membersSnap = await getDocs(
            query(
              collection(db, "project_members"),
              where("projectId", "in", ids),
              where("role", "==", "admin")
            )
          );
          if (!active) return;
          membersSnap.forEach((docSnap) => {
            const data = docSnap.data() as MemberDoc;
            const memberId = String(data?.userId ?? "");
            const projectId = String(data?.projectId ?? "");
            if (!memberId || !projectId) return;
            const projectName = projectMap.get(projectId) ?? projectId;
            const existing = adminMap.get(memberId) ?? { role: "менеджер", projects: new Set<string>() };
            existing.projects.add(projectName);
            if (existing.role !== "руководитель") {
              existing.role = "менеджер";
            }
            adminMap.set(memberId, existing);
          });
        }

        const userIds = Array.from(adminMap.keys());
        const userInfo = new Map<string, { name: string; email: string; avatar?: string | null }>();

        for (const ids of chunk(userIds, 10)) {
          const usersSnap = await getDocs(
            query(collection(db, "users_public"), where(documentId(), "in", ids))
          );
          if (!active) return;
          usersSnap.forEach((docSnap) => {
            const data = docSnap.data() as UserPublicDoc;
            userInfo.set(docSnap.id, {
              name: data?.name ?? data?.email ?? "Нет имени",
              email: data?.email ?? "Нет данных",
              avatar: data?.photoURL ?? data?.avatarUrl ?? data?.avatar ?? null,
            });
          });
        }

        const list: TeamMember[] = userIds.map((id) => {
          const info = userInfo.get(id);
          const entry = adminMap.get(id)!;
          return {
            id,
            name: info?.name ?? "Нет имени",
            email: info?.email ?? "Нет данных",
            avatar: info?.avatar ?? null,
            role: entry.role,
            projects: Array.from(entry.projects),
          };
        });

        list.sort((a, b) => a.name.localeCompare(b.name));
        setMembers(list);
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [userId]);

  const totalProjects = useMemo(() => projects.length, [projects.length]);

  return (
    <div className="grid gap-6">
      <div className="panel motion p-6">
        <h1 className="text-2xl font-semibold">Команда</h1>
        <p className="mt-2 text-sm text-muted">Руководители и менеджеры ваших проектов.</p>
        <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted">
          <span className="chip">Проектов: {totalProjects}</span>
          <span className="chip">Администраторов: {members.length}</span>
        </div>
      </div>

      {loading && (
        <div className="panel motion p-6 text-sm text-muted">Загрузка...</div>
      )}

      {!loading && members.length === 0 && (
        <div className="panel motion p-6 text-sm text-muted">
          Нет администраторов для ваших проектов.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {members.map((member) => (
          <div key={member.id} className="panel motion p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                {member.avatar ? (
                  <img src={member.avatar} alt="" className="h-12 w-12 rounded-full object-cover" />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-[rgba(125,211,167,0.25)]" />
                )}
                <div>
                  <p className="text-lg font-semibold">{member.name}</p>
                  <p className="text-xs text-muted">{member.email}</p>
                </div>
              </div>
              <span className="pill">{member.role}</span>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
              {member.projects.map((project) => (
                <span key={project} className="chip">{project}</span>
              ))}
            </div>
            <div className="mt-4 text-xs text-muted">Проектов: {member.projects.length}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
