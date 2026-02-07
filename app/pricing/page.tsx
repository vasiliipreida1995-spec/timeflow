import Link from "next/link";

const plans = [
  {
    title: "Start",
    price: "0 ₽",
    period: "в месяц",
    subtitle: "Для небольших команд и пилота",
    cta: "Начать бесплатно",
    href: "/register",
    highlight: false,
    features: [
      "До 10 пользователей",
      "Проекты и задачи",
      "Учет часов",
      "Базовые отчеты (PDF/CSV)",
      "Поддержка по email",
    ],
  },
  {
    title: "Team",
    price: "990 ₽",
    period: "за пользователя в месяц",
    subtitle: "Для операционных команд",
    cta: "Подключить команду",
    href: "/register",
    highlight: true,
    features: [
      "Все из Start",
      "Смены, роли и доступы",
      "Детализация по дням",
      "Экспорт по проектам и людям",
      "Интеграции через API",
    ],
  },
  {
    title: "Business",
    price: "по запросу",
    period: "индивидуально",
    subtitle: "Для компаний с процессами",
    cta: "Запросить демо",
    href: "/login",
    highlight: false,
    features: [
      "Все из Team",
      "Финансовые отчеты и ставки",
      "SLA и выделенный менеджер",
      "Аудит действий",
      "Онбординг и миграция данных",
    ],
  },
];

const included = [
  "Единый кабинет проектов, команды и отчетов",
  "Гибкие роли: руководитель, менеджер, участник",
  "Экспорт в PDF и CSV в один клик",
  "План/факт и аналитика по нагрузке",
  "Безопасность: защищенные сессии и контроль доступа",
];

const faqs = [
  {
    q: "Можно ли начать бесплатно и перейти позже?",
    a: "Да. Start можно использовать без оплаты, а при росте команды перейти на Team без потери данных.",
  },
  {
    q: "Как считается стоимость?",
    a: "В тарифе Team стоимость рассчитывается за активного пользователя в месяц.",
  },
  {
    q: "Можно ли получить демо?",
    a: "Да, оставьте запрос, и мы покажем сценарии под ваши процессы.",
  },
];

export default function PricingPage() {
  return (
    <>


      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 pb-24">
        <section className="grid gap-6">
          <span className="badge inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold">Прозрачные тарифы</span>
          <h1 className="text-[clamp(2.2rem,4vw,3.6rem)] leading-[1.05]">Выберите план под размер команды</h1>
          <p className="text-lg text-muted">
            Без скрытых платежей. Масштабируйтесь, когда готовы. Все планы включают безопасность и экспорт отчетов.
          </p>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.title}
              className={`glass card-hover rounded-3xl p-6 ring-1 ${
                plan.highlight ? "ring-[#7dd3a7]/50" : "ring-white/5"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-muted">{plan.title}</p>
                  <p className="mt-3 text-3xl font-semibold">{plan.price}</p>
                  <p className="text-xs text-muted">{plan.period}</p>
                </div>
                {plan.highlight && (
                  <span className="rounded-full bg-[#7dd3a7]/15 px-3 py-1 text-xs font-semibold text-[#b8f0cf]">Рекомендуем</span>
                )}
              </div>
              <p className="mt-4 text-sm text-muted">{plan.subtitle}</p>
              <ul className="mt-6 space-y-2 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <span className="mt-1 h-2 w-2 rounded-full bg-[#7dd3a7]" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Link
                className={`mt-6 inline-flex w-full items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition ${
                  plan.highlight
                    ? "bg-[#7dd3a7] text-[#0b1412] hover:bg-[#59c48f]"
                    : "border border-soft text-white/90 hover:border-white/30"
                }`}
                href={plan.href}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="glass card-hover rounded-3xl p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-muted">Что входит</p>
            <h2 className="mt-4 text-2xl font-semibold">Подписка включает все базовые инструменты</h2>
            <ul className="mt-6 space-y-3 text-sm">
              {included.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-[#7dd3a7]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="glass card-hover rounded-3xl p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-muted">Нужен кастом?</p>
            <h2 className="mt-4 text-2xl font-semibold">Соберем план под процессы компании</h2>
            <p className="mt-4 text-sm text-muted">
              Настроим роли, отчеты, интеграции и SLA. Подойдет для крупных команд и распределенных офисов.
            </p>
            <Link
              className="mt-6 inline-flex w-full items-center justify-center rounded-full border border-soft px-4 py-2 text-sm font-semibold text-white/90 transition hover:border-white/30"
              href="/login"
            >
              Запросить демо
            </Link>
          </div>
        </section>

        <section className="grid gap-6">
          <p className="text-xs uppercase tracking-[0.24em] text-muted">FAQ</p>
          <div className="grid gap-4 lg:grid-cols-3">
            {faqs.map((faq) => (
              <div key={faq.q} className="glass card-hover rounded-3xl p-6">
                <p className="text-sm font-semibold">{faq.q}</p>
                <p className="mt-3 text-sm text-muted">{faq.a}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
