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
      <div className="min-h-screen grid place-items-center">
        <div className="welcome-loader" aria-label="Загрузка">
          <svg viewBox="0 0 240 160" width="220" height="150" role="img">
            <defs>
              <linearGradient id="box" x1="0" x2="1">
                <stop offset="0%" stopColor="#f2c275" />
                <stop offset="100%" stopColor="#d8923f" />
              </linearGradient>
            </defs>
            <rect x="12" y="110" width="216" height="14" rx="7" fill="rgba(125,211,167,0.25)" />
            <g className="walker" transform="translate(70,20)">
              <g className="leg leg--back" transform="translate(32,86)">
                <rect x="0" y="0" width="10" height="36" rx="5" fill="#2f3a46" />
                <rect x="-6" y="30" width="24" height="10" rx="5" fill="#11181f" />
              </g>
              <g className="leg leg--front" transform="translate(50,86)">
                <rect x="0" y="0" width="10" height="36" rx="5" fill="#1f2a35" />
                <rect x="-6" y="30" width="24" height="10" rx="5" fill="#0f151b" />
              </g>
              <g className="body" transform="translate(28,32)">
                <rect x="0" y="0" width="46" height="50" rx="16" fill="#1d2832" />
                <rect x="6" y="8" width="34" height="18" rx="9" fill="#2b3946" />
              </g>
              <g className="arm arm--back" transform="translate(18,44)">
                <rect x="0" y="0" width="10" height="40" rx="5" fill="#1b242d" />
              </g>
              <g className="arm arm--front" transform="translate(76,44)">
                <rect x="0" y="0" width="10" height="40" rx="5" fill="#273443" />
              </g>
              <g className="box" transform="translate(60,22)">
                <rect x="0" y="0" width="50" height="34" rx="6" fill="url(#box)" />
                <path d="M6 10h38" stroke="#b5762f" strokeWidth="3" />
              </g>
              <g className="head" transform="translate(40,10)">
                <circle cx="16" cy="16" r="14" fill="#f4c9a8" />
                <rect x="4" y="24" width="24" height="10" rx="5" fill="#f4c9a8" />
                <path d="M6 18h6" stroke="#5b3a2b" strokeWidth="2" strokeLinecap="round" />
                <path d="M20 18h6" stroke="#5b3a2b" strokeWidth="2" strokeLinecap="round" />
                <path d="M12 24h8" stroke="#6d4a3a" strokeWidth="2" strokeLinecap="round" />
              </g>
            </g>
          </svg>
          <div className="welcome-text">Загрузка...</div>
        </div>
        <style jsx>{`
          .welcome-loader {
            display: grid;
            place-items: center;
            gap: 10px;
            color: rgba(255,255,255,0.7);
            text-align: center;
          }
          .welcome-text {
            font-size: 12px;
            letter-spacing: 0.18em;
            text-transform: uppercase;
            color: rgba(223,247,236,0.65);
          }
          .walker {
            animation: walk 1.8s ease-in-out infinite;
            transform-origin: 50% 100%;
          }
          .leg--front {
            animation: leg 1.1s ease-in-out infinite;
            transform-origin: 50% 0%;
          }
          .leg--back {
            animation: leg 1.1s ease-in-out infinite reverse;
            transform-origin: 50% 0%;
          }
          .arm--front {
            animation: arm 1.1s ease-in-out infinite;
            transform-origin: 50% 0%;
          }
          .arm--back {
            animation: arm 1.1s ease-in-out infinite reverse;
            transform-origin: 50% 0%;
          }
          .box {
            animation: box 1.1s ease-in-out infinite;
            transform-origin: 0% 100%;
          }
          @keyframes leg {
            0% { transform: translateY(0) rotate(10deg); }
            50% { transform: translateY(-2px) rotate(-12deg); }
            100% { transform: translateY(0) rotate(10deg); }
          }
          @keyframes arm {
            0% { transform: translateY(0) rotate(-6deg); }
            50% { transform: translateY(2px) rotate(10deg); }
            100% { transform: translateY(0) rotate(-6deg); }
          }
          @keyframes box {
            0% { transform: translateY(0) rotate(0deg); }
            50% { transform: translateY(2px) rotate(2deg); }
            100% { transform: translateY(0) rotate(0deg); }
          }
          @keyframes walk {
            0% { transform: translateX(0); }
            50% { transform: translateX(10px); }
            100% { transform: translateX(0); }
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
