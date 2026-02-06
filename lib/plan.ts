import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

export type UserPlan = "free" | "pro";

type PlanDoc = {
  plan?: UserPlan;
  proUntil?: { toDate?: () => Date } | Date | null;
};

export async function getUserPlan(uid: string): Promise<UserPlan> {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return "free";
  const data = snap.data() as PlanDoc;
  const plan = data.plan;
  const raw = data.proUntil;
  const proUntil = raw && typeof (raw as { toDate?: () => Date }).toDate === "function" ? (raw as { toDate: () => Date }).toDate() : raw instanceof Date ? raw : null;
  if (plan === "pro" && proUntil && proUntil > new Date()) return "pro";
  return plan === "pro" ? "pro" : "free";
}

export function canHaveMultipleShiftsPerDay(plan: UserPlan) {
  return plan === "pro";
}
