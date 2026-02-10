"use client";



import { useEffect, useMemo, useState } from "react";

import { onAuthStateChanged } from "firebase/auth";

import { collection, collectionGroup, getDocs, query, where } from "firebase/firestore";
import type { DocumentData, QueryDocumentSnapshot, QuerySnapshot } from "firebase/firestore";

import { auth, db } from "../../../lib/firebase";
import { escapeHtml } from "../../../lib/escapeHtml";

import { safeOnSnapshot } from "../../../lib/firestoreSafe";
import PieChart from "../../../components/PieChart";



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
  const [projectUserDayMinutes, setProjectUserDayMinutes] = useState<
    Record<string, Record<string, Record<string, number>>>
  >({});
  const [userDayMinutesTotals, setUserDayMinutesTotals] = useState<Record<string, Record<string, number>>>({});

  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  const [selectedUserId, setSelectedUserId] = useState<string>("");

  const [companyName, setCompanyName] = useState("Timeflow Ops");
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [prevMonthMinutes, setPrevMonthMinutes] = useState<number>(0);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);



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
    setIsLoading(true);

    if (!projects.length) {

      setTimeout(() => setProjectStats([]), 0);

      setTimeout(() => setUserTotals([]), 0);

      setTimeout(() => setProjectUserMinutes({}), 0);
      setTimeout(() => setProjectDayMinutes({}), 0);
      setTimeout(() => setProjectUserDayMinutes({}), 0);
      setTimeout(() => setUserDayMinutesTotals({}), 0);
      setIsLoading(false);

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
        userDayMinutes: Map<string, Map<string, number>>;

      }

    >();



    const update = () => {

      const list: ProjectStat[] = [];

      const userAgg = new Map<string, number>();

      const perProjectUsers: Record<string, Record<string, number>> = {};
      const perProjectUserDays: Record<string, Record<string, Record<string, number>>> = {};
      const perUserDayTotals: Record<string, Record<string, number>> = {};



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
        const userDays: Record<string, Record<string, number>> = {};
        entry.userDayMinutes.forEach((days, uid) => {
          const dayMap: Record<string, number> = {};
          days.forEach((mins, day) => {
            dayMap[day] = mins;
          });
          userDays[uid] = dayMap;
        });
        perProjectUserDays[entry.project.id] = userDays;

        entry.userDayMinutes.forEach((days, uid) => {
          let userDayMap = perUserDayTotals[uid];
          if (!userDayMap) {
            userDayMap = {};
            perUserDayTotals[uid] = userDayMap;
          }
          days.forEach((mins, day) => {
            userDayMap[day] = (userDayMap[day] ?? 0) + mins;
          });
        });

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
      setProjectUserDayMinutes(perProjectUserDays);
      setUserDayMinutesTotals(perUserDayTotals);
      setIsLoading(false);

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
        const userDayMinutes = new Map<string, Map<string, number>>();



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
            let userDayMap = userDayMinutes.get(uid);
            if (!userDayMap) {
              userDayMap = new Map<string, number>();
              userDayMinutes.set(uid, userDayMap);
            }
            Object.entries(days as Record<string, number>).forEach(([day, value]) => {
              const dayMinutesValue = Number(value ?? 0);
              if (Number.isNaN(dayMinutesValue)) return;
              dayMinutes.set(day, (dayMinutes.get(day) ?? 0) + dayMinutesValue);
              userDayMap!.set(day, (userDayMap!.get(day) ?? 0) + dayMinutesValue);
            });
          }

        });



        buckets.set(project.id, { project, totalMinutes: total, users, userMinutes, dayMinutes, userDayMinutes });

        update();

      });

    });



    return () => {

      unsubs.forEach((u) => u());

    };

  }, [projects, monthKey]);

  useEffect(() => {
    if (!projects.length || !monthKey) {
      setPrevMonthMinutes(0);
      return;
    }

    const parts = monthKey.split("-");
    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const prevDate = new Date(year, month - 2, 1);
    const prevKey = monthKeyFromDate(prevDate);

    const unsubs = projects.map((project) => {
      const q = query(
        collectionGroup(db, "months"),
        where("projectId", "==", project.id),
        where("month", "==", prevKey)
      );

      return safeOnSnapshot(q, (snap) => {
        if (!("forEach" in snap)) return;
        let total = 0;
        snap.forEach((docSnap: QueryDocumentSnapshot<DocumentData>) => {
          const data = docSnap.data() as MonthDoc;
          const mins = Number(data?.totalMinutes ?? 0);
          if (!Number.isNaN(mins)) total += mins;
        });
        setPrevMonthMinutes((prev) => prev + total);
      });
    });

    return () => {
      setPrevMonthMinutes(0);
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

  const monthChange = prevMonthMinutes > 0 ? ((filteredTotalMinutes - prevMonthMinutes) / prevMonthMinutes) * 100 : null;
  const monthChangeTone = monthChange !== null && monthChange < 0 ? "down" : "up";

  const colors = [
    "rgba(125, 211, 167, 0.9)",
    "rgba(120, 170, 255, 0.9)",
    "rgba(251, 191, 36, 0.9)",
    "rgba(244, 114, 182, 0.9)",
    "rgba(139, 92, 246, 0.9)",
  ];

  const chartData = projectStats.slice(0, 5).map((p, i) => ({
    label: p.name,
    value: p.minutes,
    color: colors[i % colors.length],
  }));

  const top3Projects = projectStats.slice(0, 3);
  const top3Users = filteredUserTotals.slice(0, 3);

  function generatePdfHtml() {
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

      const companyLabel = companyName || "Timeflow Ops";
      const personLabel = selectedUser?.name ?? (selectedUserId ? selectedUserId : "");
      const projectLabel = selectedProject?.name ?? (selectedProjectId ? selectedProjectId : (personLabel || companyLabel));
      const documentNumber = `TF-${monthKey.replace("-", "")}-${(selectedProjectId || "ALL").slice(0, 6).toUpperCase()}-${new Date().getDate().toString().padStart(2, "0")}`;

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
              <div class="header-sub">Документ № ${documentNumber}</div>
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

      const nameMap = new Map<string, string>();
      userTotals.forEach((u) => nameMap.set(u.userId, u.name));
      filteredUserTotals.forEach((u) => nameMap.set(u.userId, u.name));

      const dailyDetails = selectedProjectId
        ? Object.entries(projectUserDayMinutes[selectedProjectId] ?? {}).map(([uid, days]) => ({
            uid,
            name: nameMap.get(uid) ?? uid,
            days,
          }))
        : selectedUserId
          ? [
              {
                uid: selectedUserId,
                name: personLabel || selectedUserId,
                days: userDayMinutesTotals[selectedUserId] ?? {},
              },
            ]
          : [];

      const detailsBlocks = dailyDetails
        .map((detail) => {
          const dayRows = Object.entries(detail.days)
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
            .join("");

          return `
            <div class="details-person">
              <div class="details-person__name">${escapeHtml(String(detail.name))}</div>
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
            </div>
          `;
        })
        .join("");

      const dayHtml = selectedProjectId || selectedUserId
        ? `
      <div class="page page--details">
        <div class="details-title">Детализация по дням</div>
        ${selectedProjectId ? `<div class="details-meta">Проект: ${escapeHtml(String(projectLabel))}</div>` : personLabel ? `<div class="details-meta">Сотрудник: ${escapeHtml(String(personLabel))}</div>` : ""}
        <div class="details-meta">Документ № ${documentNumber}</div>
        <div class="details-meta">${escapeHtml(monthLabelFromKey(monthKey))}</div>
        <div class="details-gap"></div>
        ${detailsBlocks || `<div class="details-empty">Нет данных по дням</div>`}
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
  @page { size: A4; margin: 0; }
  body {
    font-family: "Inter", "Segoe UI", "Roboto", system-ui, sans-serif;
    margin: 0;
    color: #0f172a;
    background: #ffffff;
  }
  .page {
    position: relative;
    width: 210mm;
    min-height: 297mm;
    background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  }
  .page + .page { page-break-before: always; }
  .header-band {
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
    color: #ffffff;
    padding: 40px 44px;
    position: relative;
    overflow: hidden;
  }
  .header-band::before {
    content: "";
    position: absolute;
    top: -50%;
    right: -20%;
    width: 400px;
    height: 400px;
    background: radial-gradient(circle, rgba(125, 211, 167, 0.15), transparent 70%);
    border-radius: 50%;
  }
  .header-row {
    display: flex;
    align-items: flex-start;
    gap: 28px;
    position: relative;
    z-index: 1;
  }
  .logo {
    width: 140px;
    height: 140px;
    border-radius: 20px;
    background: linear-gradient(135deg, rgba(125, 211, 167, 0.2), rgba(125, 211, 167, 0.05));
    border: 2px solid rgba(125, 211, 167, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 11px;
    line-height: 1.3;
    text-align: center;
    padding: 12px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
    flex-shrink: 0;
  }
  .header-copy { display: flex; flex-direction: column; gap: 4px; }
  .header-title {
    font-size: 28px;
    font-weight: 800;
    letter-spacing: -0.02em;
    margin-bottom: 4px;
  }
  .header-sub {
    font-size: 13px;
    color: #cbd5e1;
    line-height: 1.6;
  }
  .content { padding: 40px 44px; }
  .kpi-row {
    display: flex;
    justify-content: space-between;
    gap: 20px;
    margin-bottom: 40px;
  }
  .kpi {
    flex: 1;
    padding: 24px;
    border-radius: 16px;
    background: linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%);
    border: 2px solid #e2e8f0;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  }
  .kpi-label {
    font-size: 10px;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-weight: 600;
  }
  .kpi-value {
    margin-top: 12px;
    font-size: 32px;
    font-weight: 800;
    background: linear-gradient(135deg, #7dd3a7 0%, #5acb95 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .table-title {
    font-size: 18px;
    font-weight: 700;
    color: #1f2937;
    margin-bottom: 16px;
    letter-spacing: -0.01em;
  }
  .table-wrap {
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  thead th {
    text-align: left;
    background: linear-gradient(135deg, #334155 0%, #1e293b 100%);
    color: #ffffff;
    font-weight: 700;
    padding: 14px 16px;
    text-transform: uppercase;
    font-size: 10px;
    letter-spacing: 0.08em;
  }
  tbody td {
    padding: 14px 16px;
    border-bottom: 1px solid #e2e8f0;
    background: #ffffff;
  }
  tbody tr:nth-child(even) td { background: #f8fafc; }
  tbody tr:last-child td { border-bottom: none; }
  tbody tr:hover td { background: #f1f5f9; }
  td.value { width: 120px; text-align: right; font-weight: 700; color: #7dd3a7; }
  td.num { width: 44px; text-align: right; color: #94a3b8; font-weight: 600; }
  .page--details { padding: 36px; }
  .details-title { font-size: 18px; font-weight: 700; color: #1f2937; }
  .details-meta { margin-top: 6px; font-size: 12px; color: #475569; }
  .details-gap { height: 24px; }
  .details-spacer { height: 48px; }
  .details-empty { color: #64748b; font-size: 12px; }
  .details-person { margin-bottom: 24px; }
  .details-person__name { font-weight: 700; color: #4b5563; margin-bottom: 8px; }
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
      </body>
      </html>
    `;

    return { html, documentNumber };
  }

  function showPreview() {
    const { html } = generatePdfHtml();
    setPreviewHtml(html);
  }

  function downloadPdf() {
    if (isPdfLoading) return;
    setIsPdfLoading(true);
    return (async () => {
      const { html, documentNumber } = generatePdfHtml();

      const token = await auth.currentUser?.getIdToken();
      if (!token) return;

      const filename = `report_${documentNumber}_${monthKey.replace("-", "_")}.pdf`;
      const res = await fetch("/api/reports/pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ html, filename }),
      });
      if (!res.ok) return;

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    })().finally(() => setIsPdfLoading(false));
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

          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.25em] text-muted">Производство</p>
            {monthChange !== null && (
              <span className={`chip text-xs ${monthChangeTone === "down" ? "bg-rose-400/15 text-rose-200" : "bg-emerald-400/15 text-emerald-200"}`}>
                {monthChange >= 0 ? "+" : ""}{monthChange.toFixed(1)}%
              </span>
            )}
          </div>

          <h3 className="mt-3 text-lg font-semibold">Часы по проектам</h3>

          <p className="mt-2 text-sm text-muted">За {monthLabelFromKey(monthKey)}.</p>

          {isLoading ? (
            <div className="mt-4 text-sm text-muted">Загрузка...</div>
          ) : (
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
          )}

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

            <button className="btn btn-outline w-full" onClick={showPreview} disabled={projectStats.length === 0 && userTotals.length === 0}>

             Предпросмотр PDF

            </button>

            <button className="btn btn-outline w-full" onClick={downloadPdf} disabled={(projectStats.length === 0 && userTotals.length === 0) || isPdfLoading}>

             {isPdfLoading ? "Генерация..." : "Скачать PDF"}

            </button>

          </div>

        </div>

      </div>



      {!isLoading && chartData.length > 0 && (
        <div className="panel motion p-6">
          <div className="panel-header">
            <h2 className="text-lg font-semibold">Распределение часов</h2>
            <span className="pill">Топ-5</span>
          </div>
          <div className="mt-6">
            <PieChart data={chartData} />
          </div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        {!selectedUserId && top3Projects.length > 0 && (
          <div className="panel motion p-6">
            <div className="panel-header">
              <h2 className="text-lg font-semibold">Топ-3 проектов</h2>
              <span className="pill">🏆</span>
            </div>
            <div className="mt-6 grid gap-3">
              {top3Projects.map((p, index) => (
                <div
                  key={p.id}
                  className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                  style={{ animation: `slide-in-left 0.4s ease-out ${index * 0.1}s both` }}
                >
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand/20 to-brand/5 text-lg font-bold">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{p.name}</div>
                    <div className="text-xs text-muted">Участников: {p.members}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-semibold">{formatHours(p.minutes)} ч</div>
                    <div className="text-xs text-muted">
                      {((p.minutes / filteredTotalMinutes) * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!selectedProjectId && top3Users.length > 0 && (
          <div className="panel motion p-6">
            <div className="panel-header">
              <h2 className="text-lg font-semibold">Топ-3 сотрудников</h2>
              <span className="pill">⭐</span>
            </div>
            <div className="mt-6 grid gap-3">
              {top3Users.map((u, index) => (
                <div
                  key={u.userId}
                  className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                  style={{ animation: `slide-in-right 0.4s ease-out ${index * 0.1}s both` }}
                >
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent/20 to-accent/5 text-lg font-bold">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0 truncate">
                    <div className="font-semibold truncate">{u.name}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-semibold">{formatHours(u.minutes)} ч</div>
                    <div className="text-xs text-muted">
                      {filteredUserTotals.length > 0 ? ((u.minutes / userTotals.reduce((sum, user) => sum + user.minutes, 0)) * 100).toFixed(1) : "0"}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">

        <div className="panel motion p-6">

          <div className="panel-header">
            <h2 className="text-lg font-semibold">Часы по проектам</h2>
            <span className="pill">{projectStats.length} проектов</span>
          </div>

          {isLoading ? (
            <div className="mt-6 text-sm text-muted">Загрузка...</div>
          ) : (
            <div className="mt-6 grid gap-3 text-sm">
              {projectStats.length === 0 && <div className="text-muted">Нет данных за выбранный месяц.</div>}
              {(selectedUserId ? perUserProjectRows : projectStats).map((p, index) => {
                const percentage = filteredTotalMinutes > 0 ? ((p.minutes / filteredTotalMinutes) * 100).toFixed(1) : "0";
                return (
                  <div key={p.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{p.name}</div>
                      <div className="text-xs text-muted">Участников: {p.members} • {percentage}%</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-semibold">{formatHours(p.minutes)} ч</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="panel motion p-6">
          <div className="panel-header">
            <h2 className="text-lg font-semibold">Часы по сотрудникам</h2>
            <span className="pill">{filteredUserTotals.length} человек</span>
          </div>

          {isLoading ? (
            <div className="mt-6 text-sm text-muted">Загрузка...</div>
          ) : (
            <div className="mt-6 grid gap-3 text-sm">
              {filteredUserTotals.length === 0 && <div className="text-muted">Нет данных за выбранный месяц.</div>}
              {filteredUserTotals.map((u, index) => {
                const totalUserMinutes = userTotals.reduce((sum, user) => sum + user.minutes, 0);
                const percentage = totalUserMinutes > 0 ? ((u.minutes / totalUserMinutes) * 100).toFixed(1) : "0";
                return (
                  <div key={u.userId} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{u.name}</div>
                      <div className="text-xs text-muted">{percentage}%</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-semibold">{formatHours(u.minutes)} ч</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {previewHtml && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreviewHtml(null)}
        >
          <div
            className="relative h-full w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white p-4">
              <h3 className="text-lg font-semibold text-gray-900">Предпросмотр PDF</h3>
              <div className="flex gap-2">
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setPreviewHtml(null);
                    downloadPdf();
                  }}
                >
                  Скачать PDF
                </button>
                <button
                  className="btn btn-outline"
                  onClick={() => setPreviewHtml(null)}
                >
                  Закрыть
                </button>
              </div>
            </div>
            <div className="h-[calc(100%-4rem)] overflow-auto bg-gray-100 p-8">
              <iframe
                srcDoc={previewHtml}
                className="mx-auto h-full w-full rounded-lg bg-white shadow-lg"
                style={{ minHeight: "1000px" }}
                title="PDF Preview"
              />
            </div>
          </div>
        </div>
      )}

    </div>

  );

}















