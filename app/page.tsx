import Link from "next/link";

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="orb orb--a" />
      <div className="orb orb--b" />
      <div className="orb orb--c" />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 pb-12 pt-8">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#7dd3a7] text-[#0b1412] shadow-[0_10px_30px_rgba(125,211,167,0.35)]">
            TF
          </div>
          <div>
            <p className="text-lg font-semibold">Timeflow</p>
            <p className="text-sm text-muted">ops time OS</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            className="hidden rounded-full border border-soft px-4 py-2 text-sm font-medium text-white/80 transition hover:border-white/30 lg:inline-flex"
            href="/login"
          >
            
          </Link>
          <Link
            className="rounded-full bg-[#7dd3a7] px-4 py-2 text-sm font-semibold text-[#0b1412] shadow-[0_12px_30px_rgba(125,211,167,0.25)] transition hover:bg-[#59c48f]"
            href="/register"
          >
             
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-20 px-6 pb-24">
        <section className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="reveal">
            <span className="badge inline-flex rounded-full px-3 py-1 text-xs font-semibold">Операционный контроль</span>
            <h1 className="mt-6 text-[clamp(2.6rem,4vw,4.1rem)] leading-[1.05]">Управляйте сменами, проектами и производством.</h1>
            <p className="mt-6 text-lg leading-8 text-muted">
              Timeflow   ,    .
              ,    ,    .
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                className="rounded-full bg-[#7dd3a7] px-6 py-3 text-sm font-semibold text-[#0b1412] shadow-[0_12px_30px_rgba(125,211,167,0.25)] transition hover:bg-[#59c48f]"
                href="/register"
              >
                
              </Link>
              <Link
                className="rounded-full border border-soft px-6 py-3 text-sm font-semibold text-white/90 transition hover:border-white/30"
                href="/login"
              >
                
              </Link>
            </div>
          </div>

          <div className="animate-float-slow lg:sticky lg:top-24 self-start">
            <div className="glass card-hover rounded-[32px] p-6 ring-1 ring-white/5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-muted">Ops Pulse</p>
                  <p className="mt-2 text-xl font-semibold">Warehouse A</p>
                </div>
                <span className="rounded-full bg-[#7dd3a7]/15 px-3 py-1 text-xs font-semibold text-[#b8f0cf]">
                  Live
                </span>
              </div>
              <div className="mt-6 grid gap-4">
                <div className="rounded-2xl border border-soft bg-panel p-4">
                  <div className="flex items-center justify-between text-sm font-medium">
                    <span>Загрузка</span>
                    <span>86%</span>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-[#1f2429]">
                    <div className="h-2 w-[86%] rounded-full bg-[#7dd3a7]" />
                  </div>
                </div>
                <div className="rounded-2xl border border-soft bg-panel p-4">
                  <div className="flex items-center justify-between text-sm font-medium">
                    <span>Загрузка</span>
                    <span>62%</span>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-[#1f2429]">
                    <div className="h-2 w-[62%] rounded-full bg-[#e5e7eb]" />
                  </div>
                </div>
                <div className="rounded-2xl border border-soft bg-panel p-4">
                  <p className="text-sm text-muted">План / Факт</p>
                  <p className="mt-1 text-lg font-semibold">1 240 000 / 1 032 000</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-8 lg:grid-cols-3">
          {          [
            {
              title: "Проекты",
              text: "Следите за статусом задач, нагрузкой и участниками.",
            },
            {
              title: "Команда",
              text: "Управляйте сменами, ролями и доступами.",
            },
            {
              title: "Отчёты",
              text: "Экспортируйте часы и аналитику за период.",
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
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-6 px-6 py-10 md:flex-row md:items-center">
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
    </div>
  );
}