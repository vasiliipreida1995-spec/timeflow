"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useRouter, usePathname } from "next/navigation";
import { auth } from "../lib/firebase";
import { getOrCreateWebUser, subscribeWebUser, type WebUser } from "../lib/webUser";

type GateStatus = "loading" | "unauth" | "pending" | "role" | "ok";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authUser, setAuthUser] = useState<User | null | undefined>(undefined);
  const [webUser, setWebUser] = useState<WebUser | null | undefined>(undefined);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      if (!user) {
        setWebUser(undefined);
      }
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!authUser) {
      return;
    }

    let unsubUser: (() => void) | null = null;
    let mounted = true;

    const load = async () => {
      await getOrCreateWebUser(authUser.uid, authUser.email);
      if (!mounted) return;
      unsubUser = subscribeWebUser(authUser.uid, (u) => setWebUser(u));
    };

    load();
    return () => {
      mounted = false;
      if (unsubUser) unsubUser();
    };
  }, [authUser]);

  const status: GateStatus = useMemo(() => {
    if (authUser === undefined) return "loading";
    if (!authUser) return "unauth";
    if (webUser === undefined) return "loading";
    if (webUser?.approved !== true) return "pending";
    if (!webUser?.role) return "role";
    return "ok";
  }, [authUser, webUser]);

  useEffect(() => {
    if (status === "unauth") {
      if (!pathname.startsWith("/login")) router.replace("/login");
      return;
    }
    if (status === "pending") {
      if (!pathname.startsWith("/pending")) router.replace("/pending");
      return;
    }
    if (status === "role") {
      if (!pathname.startsWith("/role")) router.replace("/role");
      return;
    }
    if (status === "ok") {
      if (pathname === "/role" || pathname === "/pending") {
        router.replace("/app");
      }
    }
  }, [status, pathname, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="welcome-text" aria-label="Загрузка">TimeFlow</div>
        <style jsx>{`
          .welcome-text {
            font-size: 28px;
            font-weight: 700;
            letter-spacing: 0.4em;
            text-transform: uppercase;
            color: rgba(223,247,236,0.9);
            animation: pulse 1.6s ease-in-out infinite;
          }
          @keyframes pulse {
            0% { opacity: 0.35; transform: scale(0.98); }
            50% { opacity: 1; transform: scale(1); }
            100% { opacity: 0.35; transform: scale(0.98); }
          }
        `}</style>
      </div>
    );
  }

  if (status !== "ok") {
    return null;
  }

  return <>{children}</>;
}



