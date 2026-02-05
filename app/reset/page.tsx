"use client";

import { useState } from "react";
import Link from "next/link";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../../lib/firebase";

export default function ResetPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleReset() {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setMessage("Письмо для сброса отправлено.");
    } catch (e: any) {
      setError("Не удалось отправить письмо.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center px-6">
      <div className="glass w-full max-w-md rounded-3xl p-8 card-hover">
        <h1 className="text-2xl font-semibold">Восстановление пароля</h1>
        <p className="mt-2 text-sm text-muted">Введите email, и мы отправим ссылку для сброса пароля.</p>

        <label className="mt-6 grid gap-2">
          <span className="text-xs text-muted">Email</span>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
          />
        </label>

        {message && <p className="mt-4 text-sm text-green-300">{message}</p>}
        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        <button className="btn btn-primary mt-6 w-full" onClick={handleReset} disabled={loading}>
          {loading ? "Отправка..." : "Отправить"}
        </button>

        <div className="mt-6 text-center text-sm text-muted">
          <Link className="text-[#7dd3a7]" href="/login">Вернуться ко входу</Link>
        </div>
      </div>
    </div>
  );
}