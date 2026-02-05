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
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!authUser) {
      setWebUser(undefined);
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
      <div className="min-h-screen grid place-items-center text-muted">
        ...
      </div>
    );
  }

  if (status !== "ok") {
    return null;
  }

  return <>{children}</>;
}
