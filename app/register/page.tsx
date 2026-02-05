"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { registerUser } from "../../lib/userAccess";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRegister() {
    setLoading(true);
    setError(null);
    const res = await registerUser({
      name: name.trim(),
      email: email.trim(),
      password: password.trim(),
    });
    if (res) {
      setError(res);
      setLoading(false);
      return;
    }
    router.replace("/app");
  }

  return (
    <div className="min-h-screen grid place-items-center px-6">
      <div className="glass w-full max-w-md rounded-3xl p-8 card-hover">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#7dd3a7]/15 text-[#7dd3a7] font-semibold">
          TF
        </div>
        <h1 className="mt-6 text-center text-2xl font-semibold">Создать аккаунт</h1>
        <p className="mt-2 text-center text-sm text-muted">Быстрая регистрация для доступа к проектам.</p>

        <div className="mt-6 grid gap-4">
          <label className="grid gap-2">
            <span className="text-xs text-muted">Имя</span>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ваше имя"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-xs text-muted">Email</span>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
            />
          </label>
          <label className="grid gap-2">\n            <span className="text-xs text-muted">Пароль</span>\n            <input\n              className="input"\n              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Минимум 6 символов"
            />
          </label>
        </div>

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        <button className="btn btn-primary mt-6 w-full" onClick={handleRegister} disabled={loading}>
          {loading ? "Создание..." : "Создать аккаунт"}
        </button>

        <div className="mt-6 text-center text-sm text-muted">Уже есть аккаунт? <Link className="text-[#7dd3a7]" href="/login">Войти</Link></div>
      </div>
    </div>
  );
}