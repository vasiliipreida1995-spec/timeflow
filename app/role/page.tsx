"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import { auth, db } from "../../lib/firebase";
import { subscribeWebUser, updateWebUser, type WebRole } from "../../lib/webUser";
import { logoutUser } from "../../lib/userAccess";

type ProjectDoc = { name?: string | null; archived?: boolean | null };

type ProjectItem = {
  id: string;
  name: string;
};

type MemberDoc = {
  projectId?: string | null;
  role?: string | null;
};

export default function RolePage() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<WebRole | null>(null);
  const [pendingRole, setPendingRole] = useState<WebRole | null>(null);
  const [defaultProjectId, setDefaultProjectId] = useState<string>("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [allProjects, setAllProjects] = useState<ProjectItem[]>([]);
  const [pendingRequests, setPendingRequests] = useState<ProjectItem[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [requestProjectId, setRequestProjectId] = useState<string>("");
  const [requesting, setRequesting] = useState(false);
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
        setCurrentRole((u?.role as WebRole | null) ?? null);
        setPendingRole((u?.role as WebRole | null) ?? null);
        setDefaultProjectId(u?.defaultProjectId ?? "");
        setLoading(false);
      });
    });
    return () => {
      unsubAuth();
      if (unsub) unsub();
    };
  }, [router]);

  useEffect(() => {
    setSelectedProjectId(defaultProjectId || "");
  }, [defaultProjectId]);

  useEffect(() => {
    if (!uid) return;
    if (pendingRole !== "worker" && currentRole !== "worker") return;
    let active = true;

    const load = async () => {
      setProjectsLoading(true);
      setProjectsError(null);
      try {
        const memberSnap = await getDocs(
          query(collection(db, "project_members"), where("userId", "==", uid))
        );
        const projectMap = new Map<string, string>();
        const pendingList: ProjectItem[] = [];

        await Promise.all(
          memberSnap.docs.map(async (docSnap) => {
            const data = docSnap.data() as MemberDoc;
            const projectId = data?.projectId ?? "";
            if (!projectId) return;
            const role = data?.role ?? "";
            const projectSnap = await getDoc(doc(db, "projects", projectId));
            const projectData = projectSnap.exists() ? (projectSnap.data() as ProjectDoc) : null;
            const name = projectData?.name ?? projectId;
            if (role === "pending") {
              pendingList.push({ id: projectId, name });
              return;
            }
            projectMap.set(projectId, name);
          })
        );

        const projectList = Array.from(projectMap, ([id, name]) => ({ id, name }))
          .sort((a, b) => a.name.localeCompare(b.name));

        const projectsSnap = await getDocs(
          query(collection(db, "projects"), where("archived", "==", false))
        );
        const allList = projectsSnap.docs
          .map((docSnap) => {
            const data = docSnap.data() as ProjectDoc;
            return { id: docSnap.id, name: data?.name ?? docSnap.id };
          })
          .sort((a, b) => a.name.localeCompare(b.name));

        if (!active) return;
        setProjects(projectList);
        setPendingRequests(pendingList);
        setAllProjects(allList);
        if (!defaultProjectId && projectList.length === 1) {
          setSelectedProjectId(projectList[0].id);
        }
      } catch (e: unknown) {
        if (!active) return;
        setProjectsError("Не удалось загрузить проекты");
      } finally {
        if (active) setProjectsLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [uid, pendingRole, currentRole, defaultProjectId]);

  async function setRole(role: WebRole) {
    if (!uid) return;
    if (role === "worker") {
      setPendingRole("worker");
      return;
    }
    await updateWebUser(uid, { role: "manager", defaultProjectId: null });
    router.replace("/app");
  }

  async function saveWorkerProject() {
    if (!uid || !selectedProjectId) return;
    setSaving(true);
    await updateWebUser(uid, { role: "worker", defaultProjectId: selectedProjectId });
    router.replace(`/app/projects/${selectedProjectId}`);
  }

  async function requestAccess() {
    if (!uid || !requestProjectId) return;
    setRequesting(true);
    await setDoc(
      doc(db, "project_members", `${requestProjectId}_${uid}`),
      {
        projectId: requestProjectId,
        userId: uid,
        role: "pending",
        requestedAt: serverTimestamp(),
      },
      { merge: true }
    );
    await updateWebUser(uid, { role: "worker", defaultProjectId: requestProjectId });
    setRequesting(false);
    setRequestProjectId("");
    router.replace(`/app/projects/${requestProjectId}`);
  }

  async function cancelRequest(projectId: string) {
    if (!uid || !projectId) return;
    await deleteDoc(doc(db, "project_members", `${projectId}_${uid}`));
  }

  if (loading) {
    return <div className="min-h-screen grid place-items-center">...</div>;
  }

  const showWorkerStep = pendingRole === "worker" || currentRole === "worker";
  const memberIds = new Set(projects.map((p) => p.id));
  const pendingIds = new Set(pendingRequests.map((p) => p.id));
  const availableProjects = allProjects.filter((p) => !memberIds.has(p.id) && !pendingIds.has(p.id));

  return (
    <div className="min-h-screen grid place-items-center px-6">
      <div className="glass w-full max-w-2xl rounded-3xl p-8">
        <h1 className="text-2xl font-semibold">Выберите роль</h1>
        <p className="mt-2 text-sm text-muted">Роль определяет доступ к проектам и отчётам.</p>

        {!showWorkerStep && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <button className="panel p-5 text-left card-hover" onClick={() => setRole("manager")}>
              <p className="text-sm uppercase tracking-[0.25em] text-muted">Manager</p>
              <h2 className="mt-3 text-lg font-semibold">Менеджер</h2>
              <p className="mt-2 text-sm text-muted">Доступ к сменам, отчётам и подтверждениям.</p>
            </button>

            <button className="panel p-5 text-left card-hover" onClick={() => setRole("worker")}>
              <p className="text-sm uppercase tracking-[0.25em] text-muted">Worker</p>
              <h2 className="mt-3 text-lg font-semibold">Работник</h2>
              <p className="mt-2 text-sm text-muted">Доступ к своим проектам и подтверждениям.</p>
            </button>
          </div>
        )}

        {showWorkerStep && (
          <div className="mt-6 grid gap-4">
            <div>
              <h2 className="text-lg font-semibold">Выберите проект</h2>
              <p className="mt-2 text-sm text-muted">Выберите проект, в котором участвуете.</p>
            </div>

            {projectsLoading && <div className="text-sm text-muted">Загрузка проектов...</div>}
            {projectsError && <div className="text-sm text-red-400">{projectsError}</div>}

            {!projectsLoading && projects.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-muted">
                Вы пока не добавлены ни в один проект. Подайте заявку на участие.
              </div>
            )}

            {projects.length > 0 && (
              <div className="grid gap-3">
                <select
                  className="input"
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                >
                  <option value="">Выберите проект</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <button className="btn btn-primary" onClick={saveWorkerProject} disabled={!selectedProjectId || saving}>
                  {saving ? "Сохраняем..." : "Сохранить и перейти"}
                </button>
              </div>
            )}

            {projects.length === 0 && (
              <div className="grid gap-3">
                {pendingRequests.length > 0 && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-muted">
                    <div className="font-semibold text-white">Заявка на рассмотрении</div>
                    <div className="mt-2 grid gap-2">
                      {pendingRequests.map((p) => (
                        <div key={p.id} className="flex flex-wrap items-center justify-between gap-2">
                          <span>{p.name}</span>
                          <button className="btn btn-outline" onClick={() => cancelRequest(p.id)}>
                            Отозвать
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {availableProjects.length > 0 && (
                  <div className="grid gap-2">
                    <select
                      className="input"
                      value={requestProjectId}
                      onChange={(e) => setRequestProjectId(e.target.value)}
                    >
                      <option value="">Выберите проект для заявки</option>
                      {availableProjects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <button className="btn btn-primary" onClick={requestAccess} disabled={!requestProjectId || requesting}>
                      {requesting ? "Отправляем..." : "Подать заявку"}
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              {pendingRole === "worker" && currentRole !== "worker" && (
                <button className="btn btn-outline" onClick={() => setPendingRole(null)}>
                  Назад к ролям
                </button>
              )}
              <button className="btn btn-outline" onClick={() => logoutUser()}>
                Сменить аккаунт
              </button>
            </div>
          </div>
        )}

        {currentRole && !showWorkerStep && (
          <p className="mt-6 text-sm text-muted">
            Текущая роль: <span className="text-[#7dd3a7]">{currentRole}</span>
          </p>
        )}
      </div>
    </div>
  );
}
