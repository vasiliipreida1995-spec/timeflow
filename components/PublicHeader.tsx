import Link from "next/link";

export default function PublicHeader() {
  return (
    <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 pb-12 pt-8">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#7dd3a7] text-[#0b1412] shadow-[0_10px_30px_rgba(125,211,167,0.35)]">
          TF
        </div>
        <div>
          <p className="text-lg font-semibold">Timeflow</p>
          <p className="text-sm text-muted">Операционная платформа для управления временем и проектами</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Link
          className="rounded-full border border-soft px-4 py-2 text-sm font-medium text-white/80 transition hover:border-white/30"
          href="/"
        >
          Главная
        </Link>
        <Link
          className="hidden rounded-full border border-soft px-4 py-2 text-sm font-medium text-white/80 transition hover:border-white/30 lg:inline-flex"
          href="/login"
        >
          Войти
        </Link>
        <Link
          className="rounded-full border border-soft px-4 py-2 text-sm font-medium text-white/80 transition hover:border-white/30"
          href="/pricing"
        >
          Цены
        </Link>
        <Link
          className="rounded-full bg-[#7dd3a7] px-4 py-2 text-sm font-semibold text-[#0b1412] shadow-[0_12px_30px_rgba(125,211,167,0.25)] transition hover:bg-[#59c48f]"
          href="/register"
        >
          Регистрация
        </Link>
      </div>
    </header>
  );
}
