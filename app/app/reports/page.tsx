"use client";



import { useEffect, useMemo, useState } from "react";

import { onAuthStateChanged } from "firebase/auth";

import { collection, collectionGroup, getDocs, query, where } from "firebase/firestore";
import type { DocumentData, QueryDocumentSnapshot, QuerySnapshot } from "firebase/firestore";

import { auth, db } from "../../../lib/firebase";
import { escapeHtml } from "../../../lib/escapeHtml";

import { safeOnSnapshot } from "../../../lib/firestoreSafe";



type Project = { id: string; name?: string | null };

type ProjectDoc = { name?: string | null };

type SettingsDoc = { settings?: { company_name?: string | null } };

type UserPublicDoc = { name?: string | null; email?: string | null };

type MonthDoc = {
  totalMinutes?: number | null;
  userId?: string | null;
  days?: Record<string, number> | null;
};



type ProjectStat = {

  id: string;

  name: string;

  minutes: number;

  members: number;

};



type UserTotal = {

  userId: string;

  name: string;

  minutes: number;

};



function formatHours(minutes: number) {

  const hours = minutes / 60;

  if (Number.isInteger(hours)) return String(hours);

  return hours.toFixed(2);

}



function monthKeyFromDate(d: Date) {

  const m = (d.getMonth() + 1).toString().padStart(2, "0");

  return `${d.getFullYear()}-${m}`;

}



function monthLabelFromKey(key: string) {

  const parts = key.split("-");

  if (parts.length !== 2) return key;

  const year = Number(parts[0]);

  const month = Number(parts[1]);

  if (!year || !month) return key;

  return new Date(year, month - 1, 1).toLocaleDateString("ru-RU", { month: "long", year: "numeric" });

}



function dayLabelFromKey(key: string) {
  const parts = key.split("-");
  if (parts.length !== 3) return key;
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!year || !month || !day) return key;
  return new Date(year, month - 1, day).toLocaleDateString("ru-RU", { day: "2-digit", month: "long" });
}
export default function ReportsPage() {

  const [userId, setUserId] = useState<string | null>(null);

  const [authReady, setAuthReady] = useState(false);

  const [projects, setProjects] = useState<Project[]>([]);



  const monthOptions = useMemo(() => {

    const list: string[] = [];

    const base = new Date();

    for (let i = 0; i < 6; i += 1) {

      const d = new Date(base.getFullYear(), base.getMonth() - i, 1);

      list.push(monthKeyFromDate(d));

    }

    return list;

  }, []);



  const [monthKey, setMonthKey] = useState(monthOptions[0] ?? monthKeyFromDate(new Date()));

  const [projectStats, setProjectStats] = useState<ProjectStat[]>([]);

  const [userTotals, setUserTotals] = useState<UserTotal[]>([]);
  const userIdsKey = useMemo(() => userTotals.map((u) => u.userId).join("|"), [userTotals]);

  const [projectUserMinutes, setProjectUserMinutes] = useState<Record<string, Record<string, number>>>({});
  const [projectDayMinutes, setProjectDayMinutes] = useState<Record<string, Record<string, number>>>({});

  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  const [selectedUserId, setSelectedUserId] = useState<string>("");

  const [companyName, setCompanyName] = useState("Timeflow Ops");



  useEffect(() => {

    const load = async () => {

      const token = await auth.currentUser?.getIdToken();

      if (!token) return;

      const res = await fetch("/api/settings", {

        headers: { Authorization: `Bearer ${token}` },

      });

      if (!res.ok) return;

      const data = await res.json();

      const name = (data as SettingsDoc)?.settings?.company_name;

      if (name) setCompanyName(name);

    };

    load();

  }, []);



  useEffect(() => {

    return onAuthStateChanged(auth, (user) => {

      setUserId(user?.uid ?? null);

      setAuthReady(true);

    });

  }, []);



  useEffect(() => {

    if (!authReady || !userId) {

      setTimeout(() => setProjects([]), 0);

      return;

    }

    const q = query(collection(db, "projects"), where("ownerId", "==", userId), where("archived", "==", false));

    return safeOnSnapshot(q, (snap) => {
      if (!("docs" in snap)) return;
      const list = (snap as QuerySnapshot<DocumentData>).docs.map((d: QueryDocumentSnapshot<DocumentData>) => ({ id: d.id, ...(d.data() as ProjectDoc) }));

      setProjects(list);

    });

  }, [authReady, userId]);



  useEffect(() => {

    if (!projects.length) {

      setTimeout(() => setProjectStats([]), 0);

      setTimeout(() => setUserTotals([]), 0);

      setTimeout(() => setProjectUserMinutes({}), 0);
      setTimeout(() => setProjectDayMinutes({}), 0);

      return;

    }



    const buckets = new Map<

      string,

      {

        project: Project;

        totalMinutes: number;

        users: Set<string>;

        userMinutes: Map<string, number>;
        dayMinutes: Map<string, number>;

      }

    >();



    const update = () => {

      const list: ProjectStat[] = [];

      const userAgg = new Map<string, number>();

      const perProjectUsers: Record<string, Record<string, number>> = {};



      buckets.forEach((entry) => {

        list.push({

          id: entry.project.id,

          name: entry.project.name ?? entry.project.id,

          minutes: entry.totalMinutes,

          members: entry.users.size,

        });



        const localMap: Record<string, number> = {};

        entry.userMinutes.forEach((mins, uid) => {

          localMap[uid] = mins;

          userAgg.set(uid, (userAgg.get(uid) ?? 0) + mins);

        });

        perProjectUsers[entry.project.id] = localMap;

      });



      list.sort((a, b) => b.minutes - a.minutes);

      setProjectStats(list);



      const totals = Array.from(userAgg.entries()).map(([uid, minutes]) => ({

        userId: uid,

        name: uid,

        minutes,

      }));

      totals.sort((a, b) => b.minutes - a.minutes);

      setUserTotals(totals);

      setProjectUserMinutes(perProjectUsers);
      const perProjectDays: Record<string, Record<string, number>> = {};
      buckets.forEach((entry) => {
        const dayMap: Record<string, number> = {};
        entry.dayMinutes.forEach((mins, day) => {
          dayMap[day] = mins;
        });
        perProjectDays[entry.project.id] = dayMap;
      });
      setProjectDayMinutes(perProjectDays);

    };



    const unsubs = projects.map((project) => {

      const q = query(

        collectionGroup(db, "months"),

        where("projectId", "==", project.id),

        where("month", "==", monthKey)

      );

      return safeOnSnapshot(q, (snap) => {
        if (!("forEach" in snap)) return;
        let total = 0;

        const users = new Set<string>();

        const userMinutes = new Map<string, number>();
        const dayMinutes = new Map<string, number>();



        snap.forEach((docSnap: QueryDocumentSnapshot<DocumentData>) => {

          const data = docSnap.data() as MonthDoc;

          const mins = Number(data?.totalMinutes ?? 0);

          const uid = (data?.userId as string | undefined) ?? docSnap.ref.parent.parent?.id ?? "";

          if (!uid || Number.isNaN(mins)) return;

          total += mins;

          users.add(uid);

          userMinutes.set(uid, (userMinutes.get(uid) ?? 0) + mins);

          const days = data?.days ?? {};
          if (days && typeof days === "object") {
            Object.entries(days as Record<string, number>).forEach(([day, value]) => {
              const dayMinutesValue = Number(value ?? 0);
              if (Number.isNaN(dayMinutesValue)) return;
              dayMinutes.set(day, (dayMinutes.get(day) ?? 0) + dayMinutesValue);
            });
          }

        });



        buckets.set(project.id, { project, totalMinutes: total, users, userMinutes, dayMinutes });

        update();

      });

    });



    return () => {

      unsubs.forEach((u) => u());

    };

  }, [projects, monthKey]);



  useEffect(() => {

    const ids = userIdsKey ? userIdsKey.split("|") : [];

    if (!ids.length) return;



    let cancelled = false;

    const load = async () => {

      const map = new Map<string, string>();

      for (let i = 0; i < ids.length; i += 10) {

        const chunk = ids.slice(i, i + 10);

        const snap = await getDocs(query(collection(db, "users_public"), where("__name__", "in", chunk)));

        snap.forEach((docSnap: QueryDocumentSnapshot<DocumentData>) => {

          const data = docSnap.data() as UserPublicDoc;

          map.set(docSnap.id, data?.name ?? data?.email ?? "Нет имени");

        });

      }

      if (cancelled) return;

      setUserTotals((prev) => prev.map((u) => ({ ...u, name: map.get(u.userId) ?? "Нет имени" })));

    };



    load();

    return () => {

      cancelled = true;

    };

  }, [userIdsKey]);

  const selectedProject = selectedProjectId ? projects.find((p) => p.id === selectedProjectId) : null;

  const selectedUser = selectedUserId ? userTotals.find((u) => u.userId === selectedUserId) : null;



  const totalMinutes = projectStats.reduce((sum, p) => sum + p.minutes, 0);



  const projectMinutesForUser = (projectId: string, uid: string) => projectUserMinutes[projectId]?.[uid] ?? 0;



  const filteredUserTotals = selectedProjectId

    ? Object.entries(projectUserMinutes[selectedProjectId] ?? {}).map(([uid, minutes]) => {

        const name = userTotals.find((u) => u.userId === uid)?.name ?? "Нет имени";

        return { userId: uid, name, minutes };

      })

    : userTotals;



  const perUserProjectRows = selectedUserId

    ? projectStats

        .map((p) => ({

          id: p.id,

          name: p.name,

          minutes: projectMinutesForUser(p.id, selectedUserId),

          members: p.members,

        }))

        .filter((p) => p.minutes > 0)

    : projectStats;



  const filteredTotalMinutes = selectedProjectId && selectedUserId

    ? projectMinutesForUser(selectedProjectId, selectedUserId)

    : selectedProjectId

      ? projectStats.find((p) => p.id === selectedProjectId)?.minutes ?? 0

      : selectedUserId

        ? perUserProjectRows.reduce((sum, p) => sum + p.minutes, 0)

        : totalMinutes;



  const filteredProjectCount = selectedProjectId ? 1 : projectStats.length;

  const filteredPeopleCount = selectedProjectId

    ? Object.keys(projectUserMinutes[selectedProjectId] ?? {}).length

    : selectedUserId

      ? 1

      : userTotals.length;



  const filteredAvgPerUser = filteredPeopleCount ? filteredTotalMinutes / filteredPeopleCount : 0;

  const filteredAvgPerProject = filteredProjectCount ? filteredTotalMinutes / filteredProjectCount : 0;



    function downloadPdf() {
    const totalHours = formatHours(filteredTotalMinutes);
    const peopleCount = filteredPeopleCount;

    const projectRows = (selectedUserId
      ? perUserProjectRows
      : selectedProjectId
        ? projectStats.filter((p) => p.id === selectedProjectId)
        : projectStats
    )
      .map(
        (p, index) => `
          <tr>
            <td class="num">${index + 1}</td>
            <td class="name">${escapeHtml(String(p.name))}</td>
            <td class="value">${formatHours(p.minutes)} </td>
          </tr>
        `
      )
      .join("");

    const peopleRows = (selectedProjectId
      ? filteredUserTotals
      : selectedUserId
        ? (selectedUser ? [selectedUser] : [])
        : userTotals
    )
      .map(
        (u, index) => `
          <tr>
            <td class="num">${index + 1}</td>
            <td class="name">${escapeHtml(String(u.name))}</td>
            <td class="value">${formatHours(u.minutes)} </td>
          </tr>
        `
      )
      .join("");

    const dayRows = selectedProjectId
      ? Object.entries(projectDayMinutes[selectedProjectId] ?? {})
          .sort(([a], [b]) => a.localeCompare(b))
          .map(
            ([day, minutes], index) => `
              <tr>
                <td class="num">${index + 1}</td>
                <td class="name">${escapeHtml(dayLabelFromKey(day))}</td>
                <td class="value">${formatHours(minutes)} </td>
              </tr>
            `
          )
          .join("")
      : "";

    const projectLabel = selectedProject?.name ?? (selectedProjectId ? selectedProjectId : "Timeflow Ops");
    const personLabel = selectedUser?.name ?? (selectedUserId ? selectedUserId : "");
    const docNumber = `TF-${monthKey.replace("-", "")}-${(selectedProjectId || "ALL").slice(0, 6).toUpperCase()}-${new Date().getDate().toString().padStart(2, "0")}`;
    const companyLabel = companyName || "Timeflow Ops";

    const isUserReport = Boolean(selectedUserId);
    const tableTitle = isUserReport ? "Проекты" : "Сотрудники";
    const tableRows = isUserReport ? projectRows : peopleRows;

        const pageHtml = `
      <div class="page">
        <div class="header-band">
          <div class="header-row">
            <div class="logo">${escapeHtml(String(companyLabel)).slice(0, 24)}</div>
            <div class="header-copy">
              <div class="header-title">${escapeHtml(String(projectLabel))}</div>
              <div class="header-sub">Отчёт по рабочим часам</div>
              <div class="header-sub">Документ № ${docNumber}</div>
              <div class="header-sub">${escapeHtml(monthLabelFromKey(monthKey))}</div>
              ${personLabel ? `<div class="header-sub">Сотрудник: ${escapeHtml(String(personLabel))}</div>` : ""}
            </div>
          </div>
        </div>
        <div class="content">
          <div class="kpi-row">
            <div class="kpi">
              <div class="kpi-label">Сотрудников</div>
              <div class="kpi-value">${peopleCount}</div>
            </div>
            <div class="kpi">
              <div class="kpi-label">Всего часов</div>
              <div class="kpi-value">${totalHours}</div>
            </div>
          </div>

          <div class="table-title">${escapeHtml(String(tableTitle))}</div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>${tableTitle === "Проекты" ? "Проект" : "Сотрудник"}</th>
                  <th class="value">Часы</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows || `<tr><td colspan="2">Нет данных</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    const dayHtml = selectedProjectId
      ? `
      <div class="page page--details">
        <div class="details-title">Детализация по дням</div>
        <div class="details-meta">Проект: ${escapeHtml(String(projectLabel))}</div>
        <div class="details-meta">Документ № ${docNumber}</div>
        <div class="details-meta">${escapeHtml(monthLabelFromKey(monthKey))}</div>
        <div class="details-gap"></div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Дата</th>
                <th class="value">Часы</th>
              </tr>
            </thead>
            <tbody>
              ${dayRows || `<tr><td colspan="2">Нет данных по дням</td></tr>`}
            </tbody>
          </table>
        </div>
        <div class="details-spacer"></div>
        <div class="sign-row">
          <div>
            <div>Руководитель проекта</div>
            <div class="sign-name">${escapeHtml(String(companyLabel))}</div>
          </div>
          <div class="stamp">М.П.</div>
        </div>
      </div>
      `
      : "";
const html = `
      <!doctype html>
      <html lang="ru">
      <head>
        <meta charset="utf-8" />
        <title>Timeflow Report</title>
        <style>  :root { color-scheme: light; }
  body {
    font-family: "Roboto", "Segoe UI", "Inter", Tahoma, sans-serif;
    margin: 0;
    color: #0f172a;
    background: #ffffff;
  }
  .page {
    position: relative;
    min-height: 100vh;
    background: #ffffff;
  }
  .page + .page { page-break-before: always; }
  .header-band {
    background: #1f2937;
    color: #ffffff;
    padding: 36px 40px;
  }
  .header-row {
    display: flex;
    align-items: flex-start;
    gap: 24px;
  }
  .logo {
    width: 160px;
    height: 160px;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.18);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 12px;
    line-height: 1.2;
    text-align: center;
    padding: 8px;
  }
  .header-copy { display: flex; flex-direction: column; }
  .header-title { font-size: 22px; font-weight: 700; }
  .header-sub { margin-top: 6px; font-size: 13px; color: #cbd5f5; }
  .content { padding: 36px 40px; }
  .kpi-row {
    display: flex;
    justify-content: space-between;
    gap: 24px;
    margin-bottom: 36px;
  }
  .kpi {
    width: 200px;
    padding: 18px;
    border-radius: 14px;
    border: 1px solid #e2e8f0;
    background: #f8fafc;
  }
  .kpi-label { font-size: 9px; color: #64748b; text-transform: uppercase; letter-spacing: 0.14em; }
  .kpi-value { margin-top: 10px; font-size: 20px; font-weight: 700; color: #1f2937; }
  .table-title { font-size: 16px; font-weight: 700; color: #1f2937; margin-bottom: 12px; }
  .table-wrap { border: 1px solid #d8dee8; border-radius: 12px; overflow: hidden; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  thead th {
    text-align: left;
    background: #4b5563;
    color: #ffffff;
    font-weight: 600;
    padding: 10px 12px;
  }
  tbody td { padding: 10px 12px; border-bottom: 1px solid #eef2f7; }
  tbody tr:last-child td { border-bottom: none; }
  td.value { width: 120px; text-align: right; font-weight: 600; }
  .page--details { padding: 36px; }
  .details-title { font-size: 18px; font-weight: 700; color: #1f2937; }
  .details-meta { margin-top: 6px; font-size: 12px; color: #475569; }
  .details-gap { height: 24px; }
  .details-spacer { height: 48px; }
  .sign-row {
    margin-top: 24px;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
  }
  .sign-name { margin-top: 32px; font-weight: 700; }
  .stamp {
    width: 120px;
    height: 120px;
    border: 1px solid #e2e8f0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #94a3b8;
    font-size: 24px;
  }</style>
      </head>
      <body>
        ${pageHtml}
        ${dayHtml}
        <script>window.print();</script>
      </body>
      </html>
    `;

    const w = window.open("", "_blank", "width=1200,height=900");
    if (!w) return;
    w.document.write(html);
    w.document.close();
  }

  function downloadCsv() {

    const people = selectedProjectId ? filteredUserTotals : selectedUserId ? (selectedUser ? [selectedUser] : []) : userTotals;

    const header = ["name", "hours"].join(",");

    const rows = people.map((u) => [u.name.replace(/,/g, " "), formatHours(u.minutes)].join(","));

    const csv = [header, ...rows].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");

    a.href = url;

    a.download = `timeflow-report-${monthKey}.csv`;

    a.click();

    URL.revokeObjectURL(url);

  }



  return (

    <div className="grid gap-6">

      <div className="panel motion p-6">

        <div className="flex flex-wrap items-center justify-between gap-3">

          <div>

            <h1 className="text-2xl font-semibold">Отчёты</h1>

            <p className="mt-2 text-sm text-muted">Скачайте отчёт по выбранному проекту или сотруднику.</p>

          </div>

          <div className="flex flex-wrap items-center gap-3">

            <select className="input" value={monthKey} onChange={(e) => setMonthKey(e.target.value)}>

              {monthOptions.map((m) => (

                <option key={m} value={m}>

                  {monthLabelFromKey(m)}

                </option>

              ))}

            </select>

            <select className="input" value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)}>

              <option value="">Все проекты</option>

              {projects.map((p) => (

                <option key={p.id} value={p.id}>

                  {p.name ?? p.id}

                </option>

              ))}

            </select>

            <select className="input" value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}>

              <option value="">Все сотрудники</option>

              {filteredUserTotals.map((u) => (

                <option key={u.userId} value={u.userId}>

                  {u.name}

                </option>

              ))}

            </select>

          </div>

        </div>

      </div>



      <div className="grid gap-4 lg:grid-cols-3">

        <div className="panel motion p-5">

          <p className="text-xs uppercase tracking-[0.25em] text-muted">Производство</p>

          <h3 className="mt-3 text-lg font-semibold">Часы по проектам</h3>

          <p className="mt-2 text-sm text-muted">За {monthLabelFromKey(monthKey)}.</p>

          <div className="mt-4 grid gap-2 text-sm">

            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">

              <div className="flex items-center justify-between">

                <span>Всего часов</span>

                <span className="font-semibold">{formatHours(filteredTotalMinutes)} </span>

              </div>

            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">

              <div className="flex items-center justify-between">

                <span>Проектов</span>

                <span className="font-semibold">{filteredProjectCount}</span>

              </div>

            </div>

          </div>

        </div>

        <div className="panel motion p-5">

          <p className="text-xs uppercase tracking-[0.25em] text-muted">Эффективность</p>

          <h3 className="mt-3 text-lg font-semibold">Производительность</h3>

          <p className="mt-2 text-sm text-muted">Средние показатели за месяц.</p>

          <div className="mt-4 grid gap-2 text-sm">

            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">

              <div className="flex items-center justify-between">

                 <span>Среднее на человека</span>

                <span className="font-semibold">{formatHours(filteredAvgPerUser)} </span>

              </div>

            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">

              <div className="flex items-center justify-between">

                 <span>Среднее на проект</span>

                <span className="font-semibold">{formatHours(filteredAvgPerProject)} </span>

              </div>

            </div>

          </div>

        </div>

        <div className="panel motion p-5">

          <p className="text-xs uppercase tracking-[0.25em] text-muted">Экспорт</p>

          <h3 className="mt-3 text-lg font-semibold">Экспорт</h3>

          <p className="mt-2 text-sm text-muted">CSV и PDF по выбранным фильтрам.</p>

          <div className="mt-6 grid gap-2">

            <button className="btn btn-primary w-full" onClick={downloadCsv} disabled={filteredUserTotals.length === 0 && !selectedUserId}>

             Скачать CSV

            </button>

            <button className="btn btn-outline w-full" onClick={downloadPdf} disabled={projectStats.length === 0 && userTotals.length === 0}>

             Скачать PDF

            </button>

          </div>

        </div>

      </div>



      <div className="grid gap-6 xl:grid-cols-2">

        <div className="panel motion p-6">

          <div className="panel-header">
            <h2 className="text-lg font-semibold">Часы по проектам</h2>
            <span className="pill">{projectStats.length} проектов</span>
          </div>

                    <div className="mt-6 grid gap-3 text-sm">
            {projectStats.length === 0 && <div className="text-muted">Нет данных за выбранный месяц.</div>}
            {(selectedUserId ? perUserProjectRows : projectStats).map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div>
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-xs text-muted">Участников: {p.members}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{formatHours(p.minutes)} ч</div>
                </div>
              </div>
            ))}
          </div>        </div>
      </div>

    </div>

  );

}







