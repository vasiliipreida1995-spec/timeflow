import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "./firebase";

export type Shift = {
  id: string;
  start: string;
  end: string;
  hourlyRate: number;
  breakMinutes: number;
  projectId?: string | null;
  workedMinutes?: number;
  createdAt?: unknown;
};

type ShiftDoc = Omit<Shift, "id">;

export async function loadShifts(uid: string): Promise<Shift[]> {
  const ref = collection(db, "work_shifts", uid, "shifts");
  const snap = await getDocs(query(ref, orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as ShiftDoc) }));
}

export async function addShift(uid: string, shift: Omit<Shift, "id">) {
  const ref = collection(db, "work_shifts", uid, "shifts");
  await addDoc(ref, {
    ...shift,
    workedMinutes:
      shift.workedMinutes ?? Math.max(0, minutesBetween(shift.start, shift.end) - shift.breakMinutes),
    createdAt: serverTimestamp(),
    uid,
  });
}

export async function updateShift(uid: string, id: string, patch: Partial<Shift>) {
  const ref = doc(db, "work_shifts", uid, "shifts", id);
  await updateDoc(ref, patch);
}

export async function removeShift(uid: string, id: string) {
  const ref = doc(db, "work_shifts", uid, "shifts", id);
  await deleteDoc(ref);
}

export function minutesBetween(startIso: string, endIso: string) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const diff = Math.round((end.getTime() - start.getTime()) / 60000);
  return diff > 0 ? diff : 0;
}

export function shiftHoursWorked(shift: Shift) {
  const minutes = minutesBetween(shift.start, shift.end) - (shift.breakMinutes || 0);
  return minutes > 0 ? minutes / 60 : 0;
}
