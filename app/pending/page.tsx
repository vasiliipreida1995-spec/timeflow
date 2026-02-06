"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "../../lib/firebase";
import { logoutUser } from "../../lib/userAccess";
import { subscribeWebUser } from "../../lib/webUser";

export default function PendingPage() {
  const router = useRouter();
  const [, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let unsubUser: (() => void) | null = null;
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }
      setEmail(user.email);
      unsubUser = subscribeWebUser(user.uid, (webUser) => {
        if (webUser?.approved) {
          router.replace("/app");
        }
      });
    });

    return () => {
      unsubAuth();
      if (unsubUser) unsubUser();
    };
  }, [router]);

  return (
    <div className="min-h-screen grid place-items-center px-6">
      <div className="glass w-full max-w-md rounded-3xl p-8">
        <h1 className="text-2xl font-semibold">Ожидание подтверждения</h1>
        <p className="mt-3 text-sm text-muted">Мы уведомим вас, как только доступ будет открыт.</p>
        <p className="mt-3 text-sm text-muted">Мы уведомим вас, как только доступ будет открыт.</p>
        <button className="btn btn-outline mt-6 w-full" onClick={logoutUser}>Выйти</button>
      </div>
    </div>
  );
}