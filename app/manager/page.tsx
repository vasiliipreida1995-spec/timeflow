"use client";

import Link from "next/link";

export default function ManagerHome() {
  return (
    <div className="min-h-screen bg-[#0f1113] text-[#e5e7eb] px-6 py-10">
      <div className="mx-auto grid w-full max-w-6xl gap-6">
        <div className="panel motion p-6">
          <h1 className="text-2xl font-semibold">Панель менеджера</h1>
          <p className="mt-2 text-sm text-muted">Управляйте пользователями и доступами.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Link className="panel motion p-6" href="/manager/users">
            <h2 className="text-lg font-semibold">Пользователи</h2><p className="mt-2 text-sm text-muted">Список и роли сотрудников.</p>
          </Link>
          <div className="panel motion p-6">
            <h2 className="text-lg font-semibold">Пользователи</h2><p className="mt-2 text-sm text-muted">Список и роли сотрудников.</p>
          </div>
        </div>
      </div>
    </div>
  );
}