import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "../../../lib/firebaseAdmin";

async function requireAuth(request: NextRequest) {
  const authHeader = request.headers.get("authorization") ?? "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return { ok: false, status: 401, message: "Нет токена" } as const;
  }
  try {
    const token = match[1];
    const decoded = await adminAuth.verifyIdToken(token);
    return { ok: true, uid: decoded.uid } as const;
  } catch {
    return { ok: false, status: 401, message: "Неверный токен" } as const;
  }
}

async function canAccessProfile(uid: string, targetId: string, projectId: string) {
  if (uid === targetId) return true;
  if (!projectId) return false;
  const projectSnap = await adminDb.collection("projects").doc(projectId).get();
  const ownerId = projectSnap.exists ? (projectSnap.data() as any)?.ownerId : null;
  if (ownerId && ownerId === uid) return true;
  const memberId = `${projectId}_${uid}`;
  const memberSnap = await adminDb.collection("project_members").doc(memberId).get();
  const role = memberSnap.exists ? (memberSnap.data() as any)?.role : null;
  return role === "admin";
}

export async function GET(request: NextRequest) {
  const guard = await requireAuth(request);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.message }, { status: guard.status });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId") ?? "";
  const projectId = searchParams.get("projectId") ?? "";
  const mode = (searchParams.get("mode") ?? "month") as "month" | "all";
  const monthKey = searchParams.get("monthKey") ?? "";

  if (!userId) {
    return NextResponse.json({ error: "Не хватает параметров" }, { status: 400 });
  }

  const allowed = await canAccessProfile(guard.uid, userId, projectId);
  if (!allowed) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }

  if (mode === "month" && !monthKey) {
    return NextResponse.json({ error: "Не хватает параметров" }, { status: 400 });
  }

  let queryRef: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> =
    adminDb.collection("accounting_hours").doc(userId).collection("months");

  if (projectId) {
    queryRef = queryRef.where("projectId", "==", projectId);
  }
  if (mode === "month") {
    queryRef = queryRef.where("month", "==", monthKey);
  }

  const snap = await queryRef.get();
  let totalMinutes = 0;
  snap.forEach((docSnap) => {
    const data = docSnap.data() as any;
    totalMinutes += Number(data?.totalMinutes ?? 0);
  });

  return NextResponse.json({ totalMinutes });
}
