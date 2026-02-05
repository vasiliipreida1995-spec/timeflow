import { NextRequest } from "next/server";
import { adminAuth, adminDb } from "../../../lib/firebaseAdmin";

export async function requireAdmin(request: NextRequest) {
  const authHeader = request.headers.get("authorization") ?? "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return { ok: false, status: 401, message: "Missing bearer token" } as const;
  }

  try {
    const token = match[1];
    const decoded = await adminAuth.verifyIdToken(token);
    const userRef = adminDb.collection("web_users").doc(decoded.uid);
    const snap = await userRef.get();
    const role = snap.exists ? (snap.data()?.role as string | undefined) : undefined;
    if (role !== "admin") {
      return { ok: false, status: 403, message: "Admin only" } as const;
    }
    return { ok: true, uid: decoded.uid } as const;
  } catch (e) {
    return { ok: false, status: 401, message: "Invalid token" } as const;
  }
}
