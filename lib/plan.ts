import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

export type UserPlan = "free" | "pro";

export async function getUserPlan(uid: string): Promise<UserPlan> {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return "free";
  const data = snap.data() as any;
  const plan = data.plan;
  const proUntil = data.proUntil?.toDate ? data.proUntil.toDate() : null;
  if (plan === "pro" && proUntil && proUntil > new Date()) return "pro";
  return plan === "pro" ? "pro" : "free";
}

export function canHaveMultipleShiftsPerDay(plan: UserPlan) {
  return plan === "pro";
}
