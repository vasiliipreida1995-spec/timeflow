const MANAGERS = [
  { name: "Илья П.", role: "Руководитель проекта", status: "Онлайн", projects: 4 },
  { name: "Марина К.", role: "Менеджер смен", status: "В работе", projects: 3 },
  { name: "Алексей Н.", role: "Координатор", status: "Доступен", projects: 2 },
  { name: "Екатерина В.", role: "Руководитель", status: "Онлайн", projects: 5 },
];export default function TeamPage() {
  return (
    <div className="grid gap-6">
      <div className="panel motion p-6">
        <h1 className="text-2xl font-semibold">Команда</h1>
        <p className="mt-2 text-sm text-muted">Роли, смены и доступы по проектам.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {MANAGERS.map((manager) => (
          <div key={manager.name} className="panel motion p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold">{manager.name}</p>
                <p className="text-xs text-muted">{manager.role}</p>
              </div>
              <span className="pill">{manager.status}</span>
            </div>
            <div className="mt-4 flex items-center gap-3 text-sm">
              <span className="chip">Проектов: {manager.projects}</span>
              <span className="chip">Смены: 6</span>
            </div>
            <div className="mt-4 text-xs text-muted">Последняя активность: 12 минут назад</div>
          </div>
        ))}
      </div>

      <div className="panel motion p-6">
        <div className="panel-header">
          <h2 className="text-lg font-semibold">Согласования</h2>
          <span className="chip">2 ожидания</span>
        </div>
        <div className="mt-6 grid gap-3 text-sm">
          {[
            "Запрос доступа в Проект B",
            "Приглашение: Polar Warehouse",
          ].map((item) => (
            <div key={item} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
