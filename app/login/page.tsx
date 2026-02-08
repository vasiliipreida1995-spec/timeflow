"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { loginUser } from "../../lib/userAccess";
import { auth, db } from "../../lib/firebase";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from "firebase/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) router.replace("/app");
    });
    return () => unsub();
  }, [router]);

  async function handleLogin() {
    setLoading(true);
    setError(null);
    const res = await loginUser(email.trim(), password.trim());
    if (res) {
      setError(res);
      setLoading(false);
      return;
    }
    router.replace("/app");
  }

  async function handleGoogle() {
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      await setDoc(
        doc(db, "users", user.uid),
        {
          approved: true,
          createdAt: serverTimestamp(),
          email: user.email ?? null,
          name: user.displayName ?? user.email ?? "Пользователь",
          role: "worker",
        },
        { merge: true }
      );
      await setDoc(
        doc(db, "users_public", user.uid),
        {
          avatarUrl: user.photoURL ?? null,
          createdAt: serverTimestamp(),
          email: user.email ?? null,
          name: user.displayName ?? user.email ?? "Пользователь",
        },
        { merge: true }
      );
      router.replace("/app");
    } catch {
      setError("Ошибка входа через Google");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center px-6">
      <div className="glass w-full max-w-md rounded-3xl p-8 card-hover">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#7dd3a7]/15 text-[#7dd3a7] font-semibold">
          TF
        </div>
        <h1 className="mt-6 text-center text-2xl font-semibold">Вход в Timeflow</h1>
        <p className="mt-2 text-center text-sm text-muted">Войдите, чтобы продолжить работу.</p>

        <div className="mt-6 grid gap-4">
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
          <label className="grid gap-2">
            <span className="text-xs text-muted">Пароль</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Минимум 6 символов"
            />
          </label>
        </div>

        <div className="mt-2 text-right">
          <Link className="text-xs text-[#7dd3a7]" href="/reset">Забыли пароль?</Link>
        </div>

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        <button className="btn btn-primary mt-6 w-full" onClick={handleLogin} disabled={loading}>
          {loading ? "Вход..." : "Войти"}
        </button>

        <div className="divider mt-6"></div>

        <button className="btn btn-outline w-full" onClick={handleGoogle}>Войти через Google</button>

        <div className="mt-6 text-center text-sm text-muted">Еще нет аккаунта? <Link className="text-[#7dd3a7]" href="/register">Создать</Link></div>
      </div>
    </div>
  );
}
