"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../../lib/firebase";


type SettingsPayload = {
  company_name?: string | null;
  timezone?: string | null;
  currency?: string | null;
  language?: string | null;
  max_shift_hours?: number | null;
  min_break_minutes?: number | null;
  confirm_hours?: number | null;
  overtime_policy?: string | null;
  email_sender?: string | null;
  copy_lead?: string | null;
  slack_channel?: string | null;
  telegram_channel?: string | null;
};

const SECTIONS = [
  { id: "org", label: "Организация" },
  { id: "limits", label: "Лимиты" },
  { id: "templates", label: "Шаблоны" },
  { id: "communications", label: "Коммуникации" },
  { id: "integrations", label: "Интеграции" },
];

async function fetchSettings() {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch("/api/settings", {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    throw new Error(`Request failed (${res.status})`);
  }
  return res.json();
}

async function saveSettings(payload: SettingsPayload) {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch("/api/settings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Request failed (${res.status})`);
  }
  return res.json();
}

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const [activeSection, setActiveSection] = useState("org");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [companyName, setCompanyName] = useState("Timeflow Ops");
  const [timezone, setTimezone] = useState("Europe/Warsaw");
  const [currency, setCurrency] = useState("PLN");
  const [language, setLanguage] = useState("ru");
  const [maxShift, setMaxShift] = useState("12");
  const [minBreak, setMinBreak] = useState("30");
  const [confirmHours, setConfirmHours] = useState("24");
  const [overtimePolicy, setOvertimePolicy] = useState("Переработки оплачиваются отдельно");
  const [emailSender, setEmailSender] = useState("ops@timeflow.io");
  const [copyLead, setCopyLead] = useState("lead@timeflow.io");
  const [slackChannel, setSlackChannel] = useState("#ops-alerts");
  const [telegramChannel, setTelegramChannel] = useState("@timeflow_ops");

  useEffect(() => {
    const section = searchParams.get("section");
    if (section && SECTIONS.some((s) => s.id === section)) {
      setActiveSection(section);
    }
  }, [searchParams]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setLoading(false);
        return;
      }
      fetchSettings()
        .then((data) => {
          const s = data?.settings;
          if (!s) return;
          if (s.company_name) setCompanyName(s.company_name);
          if (s.timezone) setTimezone(s.timezone);
          if (s.currency) setCurrency(s.currency);
          if (s.language) setLanguage(s.language);
          if (s.max_shift_hours != null) setMaxShift(String(s.max_shift_hours));
          if (s.min_break_minutes != null) setMinBreak(String(s.min_break_minutes));
          if (s.confirm_hours != null) setConfirmHours(String(s.confirm_hours));
          if (s.overtime_policy) setOvertimePolicy(s.overtime_policy);
          if (s.email_sender) setEmailSender(s.email_sender);
          if (s.copy_lead) setCopyLead(s.copy_lead);
          if (s.slack_channel) setSlackChannel(s.slack_channel);
          if (s.telegram_channel) setTelegramChannel(s.telegram_channel);
        })
        .catch((e: unknown) => {
          const msg = typeof e === "object" && e && "message" in e ? String((e as { message?: unknown }).message ?? "") : "";
          setError(msg || "Ошибка загрузки настроек");
        })
        .finally(() => setLoading(false));
    });
    return () => unsub();
  }, []);

  const title = useMemo(() => {
    return SECTIONS.find((s) => s.id === activeSection)?.label ?? "";
  }, [activeSection]);

  async function handleSave() {
    setError(null);
    setSuccess(false);
    setSaving(true);
    try {
      await saveSettings({
        company_name: companyName,
        timezone,
        currency,
        language,
        max_shift_hours: Number(maxShift) || 0,
        min_break_minutes: Number(minBreak) || 0,
        confirm_hours: Number(confirmHours) || 0,
        overtime_policy: overtimePolicy,
        email_sender: emailSender,
        copy_lead: copyLead,
        slack_channel: slackChannel,
        telegram_channel: telegramChannel,
      });
      setSuccess(true);
    } catch (e: unknown) {
      const msg = typeof e === "object" && e && "message" in e ? String((e as { message?: unknown }).message ?? "") : "";
      setError(msg || "Ошибка сохранения");
    } finally {
      setSaving(false);
      setTimeout(() => setSuccess(false), 2000);
    }
  }

  return (
    <div className="grid gap-6">
      <div className="panel motion p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Настройки · {title}</h1>
            <p className="mt-2 text-sm text-muted">
              Управляйте организацией, лимитами и коммуникациями.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {success && <span className="pill">Сохранено</span>}
            <button className="btn btn-primary" onClick={handleSave} disabled={saving || loading}>
              {saving ? "Сохранение..." : "Сохранить"}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="panel motion p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {loading && (
        <div className="panel motion p-4 text-sm text-muted">Загрузка настроек...</div>
      )}

      <div className={`panel motion p-6 ${activeSection === "org" ? "block" : "hidden"}`}>
        <h2 className="text-lg font-semibold">Организация</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm">
            Название компании
            <input className="input" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
          </label>
          <label className="grid gap-2 text-sm">
            Часовой пояс
            <input className="input" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
          </label>
          <label className="grid gap-2 text-sm">
            Валюта
            <input className="input" value={currency} onChange={(e) => setCurrency(e.target.value)} />
          </label>
          <label className="grid gap-2 text-sm">
            Язык
            <input className="input" value={language} onChange={(e) => setLanguage(e.target.value)} />
          </label>
        </div>
      </div>

      <div className={`panel motion p-6 ${activeSection === "limits" ? "block" : "hidden"}`}>
        <h2 className="text-lg font-semibold">Лимиты и правила</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm">
            Максимум часов в смене (ч)
            <input className="input" value={maxShift} onChange={(e) => setMaxShift(e.target.value)} />
          </label>
          <label className="grid gap-2 text-sm">
            Минимальный перерыв (мин)
            <input className="input" value={minBreak} onChange={(e) => setMinBreak(e.target.value)} />
          </label>
          <label className="grid gap-2 text-sm">
            Окно подтверждения (ч)
            <input className="input" value={confirmHours} onChange={(e) => setConfirmHours(e.target.value)} />
          </label>
          <label className="grid gap-2 text-sm">
            Политика переработок
            <input className="input" value={overtimePolicy} onChange={(e) => setOvertimePolicy(e.target.value)} />
          </label>
        </div>
      </div>

      <div className={`panel motion p-6 ${activeSection === "templates" ? "block" : "hidden"}`}>
        <div className="panel-header">
          <h2 className="text-lg font-semibold">Шаблоны писем</h2>
          <span className="pill">4 шаблона</span>
        </div>
        <p className="mt-2 text-sm text-muted">
          Используйте переменные: {"{"}имя{"}"}, {"{"}проект{"}"}, {"{"}дата{"}"}.
        </p>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold">Приглашение в проект</p>
              <span className="chip">Email</span>
            </div>
            <label className="mt-4 grid gap-2 text-sm">
              Тема
              <input className="input" defaultValue="Приглашение в проект" />
            </label>
            <label className="mt-4 grid gap-2 text-sm">
              Текст
              <textarea
                className="input min-h-[140px]"
                defaultValue="{имя}, привет!\n\nВы приглашены в проект {проект}. Пожалуйста, подтвердите участие.\n\nДата: {дата}\n\nКоманда Timeflow."
              />
            </label>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold">Напоминание о подтверждении</p>
              <span className="chip">Email</span>
            </div>
            <label className="mt-4 grid gap-2 text-sm">
              Тема
              <input className="input" defaultValue="Напоминание о подтверждении" />
            </label>
            <label className="mt-4 grid gap-2 text-sm">
              Текст
              <textarea
                className="input min-h-[140px]"
                defaultValue="{имя}, пожалуйста подтвердите смену в проекте {проект}.\n\nСпасибо, команда Timeflow."
              />
            </label>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold">Смена подтверждена</p>
              <span className="chip">Email</span>
            </div>
            <label className="mt-4 grid gap-2 text-sm">
              Тема
              <input className="input" defaultValue="Смена подтверждена" />
            </label>
            <label className="mt-4 grid gap-2 text-sm">
              Текст
              <textarea
                className="input min-h-[140px]"
                defaultValue="{имя}, ваша смена по проекту {проект} подтверждена.\n\nКоманда Timeflow."
              />
            </label>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold">Отчёт готов</p>
              <span className="chip">Email</span>
            </div>
            <label className="mt-4 grid gap-2 text-sm">
              Тема
              <input className="input" defaultValue="Отчёт по часам готов" />
            </label>
            <label className="mt-4 grid gap-2 text-sm">
              Текст
              <textarea
                className="input min-h-[140px]"
                defaultValue="{имя}, отчёт по проекту {проект} готов.\n\nС уважением, Timeflow."
              />
            </label>
          </div>
        </div>
      </div>

      <div className={`panel motion p-6 ${activeSection === "communications" ? "block" : "hidden"}`}>
        <h2 className="text-lg font-semibold">Коммуникации</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm">
            Email отправителя
            <input className="input" value={emailSender} onChange={(e) => setEmailSender(e.target.value)} />
          </label>
          <label className="grid gap-2 text-sm">
            Копия руководителю
            <input className="input" value={copyLead} onChange={(e) => setCopyLead(e.target.value)} />
          </label>
          <label className="grid gap-2 text-sm">
            Канал уведомлений (Slack)
            <input className="input" value={slackChannel} onChange={(e) => setSlackChannel(e.target.value)} />
          </label>
          <label className="grid gap-2 text-sm">
            Канал уведомлений (Telegram)
            <input className="input" value={telegramChannel} onChange={(e) => setTelegramChannel(e.target.value)} />
          </label>
        </div>
      </div>

      <div className={`panel motion p-6 ${activeSection === "integrations" ? "block" : "hidden"}`}>
        <div className="panel-header">
          <h2 className="text-lg font-semibold">Интеграции</h2>
          <span className="pill">Скоро</span>
        </div>
        <div className="mt-6 grid gap-3 text-sm">
          {["Slack / Telegram", "BI-аналитика", "Экспорт в Excel"].map((item) => (
            <div key={item} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
