import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  serverTimestamp,
  updateDoc,
  addDoc,
} from "firebase/firestore";
import { db } from "./firebase";

export type WebRole = "admin" | "manager" | "worker";

export type WebUser = {
  role?: WebRole | null;
  approved?: boolean;
  email?: string | null;
  defaultProjectId?: string | null;
  createdAt?: unknown;
};

export type WebInvite = {
  email: string;
  role: WebRole;
  createdAt?: unknown;
};

export type WebUserDoc = WebUser & { id: string };

export async function getOrCreateWebUser(uid: string, email?: string | null) {
  const ref = doc(db, "web_users", uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    return snap.data() as WebUser;
  }

  // Client-side bootstrap: keep rules strict by only touching the current user's doc.
  const role: WebRole | null = null;

  const payload: WebUser = {
    role,
    approved: true,
    email: email ?? null,
    createdAt: serverTimestamp(),
  };

  await setDoc(ref, payload, { merge: true });
  return payload;
}

export function subscribeWebUser(uid: string, cb: (user: WebUser | null) => void) {
  return onSnapshot(doc(db, "web_users", uid), (snap) => {
    cb(snap.exists() ? (snap.data() as WebUser) : null);
  });
}

export async function updateWebUser(uid: string, patch: Partial<WebUser>) {
  await updateDoc(doc(db, "web_users", uid), patch);
}

export async function listWebUsers(): Promise<WebUserDoc[]> {
  const snap = await getDocs(collection(db, "web_users"));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as WebUser) }));
}

export async function createInvite(email: string, role: WebRole) {
  await addDoc(collection(db, "web_invites"), {
    email,
    role,
    createdAt: serverTimestamp(),
  } satisfies WebInvite);
}

export async function listInvites(): Promise<(WebInvite & { id: string })[]> {
  const snap = await getDocs(collection(db, "web_invites"));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as WebInvite) }));
}

export async function deleteInvite(id: string) {
  await deleteDoc(doc(db, "web_invites", id));
}



