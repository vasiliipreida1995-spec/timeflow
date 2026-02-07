import Link from "next/link";
import { adminDb } from "../lib/firebaseAdmin";




export const revalidate = 60;

async function getOpsStats() {
  const membersSnap = await adminDb.collection("project_members").select("userId").get();
  const memberIds = new Set<string>();
  membersSnap.forEach((docSnap) => {
    const data = docSnap.data() as { userId?: string | null };
    const id = data?.userId ? String(data.userId) : "";
    if (id) memberIds.add(id);
  });

  const monthsSnap = await adminDb.collectionGroup("months").select("totalMinutes").get();
  let totalMinutes = 0;
  monthsSnap.forEach((docSnap) => {
    const data = docSnap.data() as { totalMinutes?: number | null };
    const mins = Number(data?.totalMinutes ?? 0);
    if (!Number.isNaN(mins)) totalMinutes += mins;
  });

  return { participantCount: memberIds.size, totalMinutes };
}

export default async function Home() {
  const { participantCount, totalMinutes } = await getOpsStats();
  const formatNumber = (value: number) => new Intl.NumberFormat("ru-RU").format(value);
  const totalHours = Math.round(totalMinutes / 60);
  const participantTarget = 200;
  const hoursTarget = 10000;
  const participantProgress = Math.min(100, Math.round((participantCount / participantTarget) * 100));
  const hoursProgress = Math.min(100, Math.round((totalHours / hoursTarget) * 100));

  return (
    <>










      <main className="relative z-10 mx-auto flex w-full max-w-[1400px] flex-col gap-20 px-6 pb-24">

        <section className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">

          <div className="reveal">

            <span className="badge inline-flex rounded-full px-3 py-1 text-xs font-semibold">Единый центр управления</span>

            <h1 className="mt-6 text-[clamp(2.6rem,4vw,4.1rem)] leading-[1.05]">Timeflow связывает людей, проекты и часы в одну систему.</h1>

            <p className="mt-6 text-lg leading-8 text-muted">
              Планируйте загрузку, фиксируйте трудозатраты, контролируйте прогресс и формируйте отчёты без ручной рутины.
              От смен и ролей до аналитики по дням — всё в одном интерфейсе.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                className="rounded-full bg-[#7dd3a7] px-6 py-3 text-sm font-semibold text-[#0b1412] shadow-[0_12px_30px_rgba(125,211,167,0.25)] transition hover:bg-[#59c48f]"
                href="/register"
              >
                Начать бесплатно
              </Link>
              <Link
                className="rounded-full border border-soft px-6 py-3 text-sm font-semibold text-white/90 transition hover:border-white/30"
                href="/login"
              >
                Войти
              </Link>
              <Link
                className="rounded-full border border-soft px-6 py-3 text-sm font-semibold text-white/90 transition hover:border-white/30"
                href="/pricing"
              >
                Цены
              </Link>
            </div>

          </div>



          <div className="animate-float-slow lg:sticky lg:top-24 self-start">

            <div className="glass card-hover rounded-[32px] p-6 ring-1 ring-white/5">

              <div className="flex items-center justify-between">

                <div>

                  <p className="text-xs uppercase tracking-[0.24em] text-muted">Ops Pulse</p>

                  <p className="mt-2 text-xl font-semibold">Все проекты</p>

                </div>

                <span className="rounded-full bg-[#7dd3a7]/15 px-3 py-1 text-xs font-semibold text-[#b8f0cf]">

                  Сводка

                </span>

              </div>

              <div className="mt-6 grid gap-4">
                <div className="rounded-2xl border border-soft bg-panel p-4">
                  <p className="text-sm text-muted">Участников</p>
                  <p className="mt-1 text-lg font-semibold">{formatNumber(participantCount)}</p>
                  <div className="mt-3 h-2 rounded-full bg-[#1f2429]">
                    <div className="h-2 rounded-full bg-[#7dd3a7]" style={{ width: `${participantProgress}%` }} />
                  </div>
                  <p className="mt-2 text-xs text-muted">Нагрузка на сервера</p>
                </div>
                <div className="rounded-2xl border border-soft bg-panel p-4">
                  <p className="text-sm text-muted">Часов всего</p>
                  <p className="mt-1 text-lg font-semibold">{formatNumber(totalHours)}</p>
                  <div className="mt-3 h-2 rounded-full bg-[#1f2429]">
                    <div className="h-2 rounded-full bg-[#7dd3a7]" style={{ width: `${hoursProgress}%` }} />
                  </div>
                  <p className="mt-2 text-xs text-muted">Нагрузка на сервера</p>
                </div>
                <div className="rounded-2xl border border-soft bg-panel p-4">
                  <p className="text-sm text-muted">Обновление</p>
                  <p className="mt-1 text-lg font-semibold">каждые 60 мин</p>
                </div>
              </div>

            </div>
          </div>
        </section>


        <section className="grid gap-8 lg:grid-cols-2">
          <div className="glass card-hover rounded-3xl p-8 reveal">
            <p className="text-xs uppercase tracking-[0.24em] text-muted">Как это работает</p>
            <h2 className="mt-4 text-2xl font-semibold">Четыре шага до прозрачной операционной картины</h2>
            <p className="mt-4 text-sm text-muted">Настройка занимает один день и не требует тяжелой интеграции.</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-soft bg-panel p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-muted">Подключение</p>
                <p className="mt-2 text-base font-semibold">15 минут</p>
                <p className="mt-2 text-xs text-muted">Импорт сотрудников и ролей.</p>
              </div>
              <div className="rounded-2xl border border-soft bg-panel p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-muted">Запуск</p>
                <p className="mt-2 text-base font-semibold">1 день</p>
                <p className="mt-2 text-xs text-muted">Проекты, смены и правила учёта.</p>
              </div>
              <div className="rounded-2xl border border-soft bg-panel p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-muted">Отчёты</p>
                <p className="mt-2 text-base font-semibold">PDF/CSV</p>
                <p className="mt-2 text-xs text-muted">Формируйте за секунды.</p>
              </div>
              <div className="rounded-2xl border border-soft bg-panel p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-muted">Прозрачность</p>
                <p className="mt-2 text-base font-semibold">24/7</p>
                <p className="mt-2 text-xs text-muted">Контроль факта и прогресса.</p>
              </div>
            </div>
          </div>
          <div className="grid gap-4">
            <div className="glass card-hover rounded-2xl p-5 reveal">
              <p className="text-sm font-semibold">1. Подключите команду</p>
              <p className="mt-2 text-sm text-muted">Пригласите участников, назначьте роли и доступы.</p>
            </div>
            <div className="glass card-hover rounded-2xl p-5 reveal">
              <p className="text-sm font-semibold">2. Опишите проекты и смены</p>
              <p className="mt-2 text-sm text-muted">Создайте проекты, графики и точки контроля.</p>
            </div>
            <div className="glass card-hover rounded-2xl p-5 reveal">
              <p className="text-sm font-semibold">3. Фиксируйте работу</p>
              <p className="mt-2 text-sm text-muted">Сотрудники отмечают часы и прогресс по дням.</p>
            </div>
            <div className="glass card-hover rounded-2xl p-5 reveal">
              <p className="text-sm font-semibold">4. Получайте отчеты</p>
              <p className="mt-2 text-sm text-muted">PDF/CSV, аналитика и сводки для руководителей.</p>
            </div>
          </div>
        </section>

        <section className="grid gap-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-muted">Модули</p>
              <h2 className="mt-3 text-2xl font-semibold">Все ключевые процессы в одной системе</h2>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-4">
            {[
              { title: "Проекты", text: "Планирование, статусы, риски и состав команды." },
              { title: "Команда", text: "Роли, смены, доступы и загрузка сотрудников." },
              { title: "Отчеты", text: "PDF/CSV по проектам, людям и дням." },
              { title: "Финансы", text: "Часы, ставки, себестоимость и контроль бюджета." },
            ].map((item) => (
              <div key={item.title} className="glass card-hover rounded-3xl p-6 reveal">
                <p className="text-xs uppercase tracking-[0.24em] text-muted">{item.title}</p>
                <p className="mt-4 text-base font-semibold">{item.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-muted">Кейсы</p>
              <h2 className="mt-3 text-2xl font-semibold">Команды, которые уже ускорились</h2>
              <p className="mt-3 text-sm text-muted">Короткие истории с измеримым эффектом.</p>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="glass card-hover rounded-3xl p-6 reveal">
              <p className="text-xs uppercase tracking-[0.24em] text-muted">Логистика</p>
              <p className="mt-4 text-3xl font-semibold">-22% времени</p>
              <p className="mt-3 text-sm text-muted">Сократили ручной сбор табелей и перенесли отчеты в PDF/CSV.</p>
              <p className="mt-4 text-sm font-semibold">Все проекты · 84 сотрудника</p>
            </div>
            <div className="glass card-hover rounded-3xl p-6 reveal">
              <p className="text-xs uppercase tracking-[0.24em] text-muted">Агентство</p>
              <p className="mt-4 text-3xl font-semibold">+31% маржи</p>
              <p className="mt-3 text-sm text-muted">Пересобрали проектные роли и увидели фактическую загрузку по дням.</p>
              <p className="mt-4 text-sm font-semibold">Delta Studio · 26 проектов</p>
            </div>
            <div className="glass card-hover rounded-3xl p-6 reveal">
              <p className="text-xs uppercase tracking-[0.24em] text-muted">Производство</p>
              <p className="mt-4 text-3xl font-semibold">-40% ошибок</p>
              <p className="mt-3 text-sm text-muted">Настроили смены и контроль задач, отчеты стали прозрачными.</p>
              <p className="mt-4 text-sm font-semibold">North Plant · 3 смены</p>
            </div>
          </div>
        </section>
        <section className="glass card-hover rounded-3xl p-8 reveal">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-muted">Готовы начать</p>
              <h2 className="mt-3 text-2xl font-semibold">Подключите Timeflow и получите прозрачность уже в этом месяце</h2>
              <p className="mt-3 text-sm text-muted">Бесплатный старт, далее — под ваши масштабы и процессы.</p>
            </div>
            <div className="flex flex-wrap gap-3 lg:justify-end">
              <a
                className="rounded-full bg-[#7dd3a7] px-6 py-3 text-sm font-semibold text-[#0b1412] shadow-[0_12px_30px_rgba(125,211,167,0.25)] transition hover:bg-[#59c48f]"
                href="/register"
              >
                Начать бесплатно
              </a>
              <a
                className="rounded-full border border-soft px-6 py-3 text-sm font-semibold text-white/90 transition hover:border-white/30"
                href="/login"
              >
                Запросить демо
              </a>
            </div>
          </div>
        </section>
        <section className="grid gap-8 lg:grid-cols-3">

          {          [

            {

              title: "Проекты",

              text: "Статусы, участники, сроки и риски — вся картина по проектам в одном месте.",

            },

            {

              title: "Команда",

              text: "Смены, роли и доступы — прозрачное управление командой и загрузкой.",

            },

            {

              title: "Отчёты",

              text: "PDF и CSV отчёты по проектам, сотрудникам и дням — за секунды.",

            },

          ].map((item) => (

            <div key={item.title} className="glass card-hover rounded-3xl p-6 reveal">

              <p className="text-xs uppercase tracking-[0.24em] text-muted">{item.title}</p>

              <p className="mt-4 text-lg font-semibold">{item.text}</p>

            </div>

          ))}

        </section>

      </main>



      <footer className="relative z-10 border-t border-soft bg-black/30">

        <div className="mx-auto flex w-full max-w-[1400px] flex-col items-start justify-between gap-6 px-6 py-10 md:flex-row md:items-center">

          <div>

            <p className="text-lg font-semibold">Timeflow</p>

            <p className="text-sm text-muted">Work. Time. Flow.</p>

          </div>

          <div className="flex flex-wrap gap-4 text-sm text-muted">

            <span>support@timeflow.app</span>

            <span>+7 495 000-00-00</span>

            <span>  -</span>

          </div>

        </div>

      </footer>


    </>
  );

}

