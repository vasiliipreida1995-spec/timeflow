"use client";

import PublicHeader from "./PublicHeader";
import { usePathname } from "next/navigation";

const HIDE_PREFIXES = ["/app"];

export default function PublicShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (HIDE_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return <>{children}</>;
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="orb orb--a" />
      <div className="orb orb--b" />
      <div className="orb orb--c" />
      <PublicHeader />
      {children}
    </div>
  );
}
