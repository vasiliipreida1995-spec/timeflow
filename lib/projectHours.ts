import { doc, updateDoc, increment } from "firebase/firestore";
import { db } from "./firebase";

export async function addMinutesToProjectMember(projectId: string, uid: string, minutes: number) {
  const ref = doc(db, "project_members", `${projectId}_${uid}`);
  await updateDoc(ref, { totalMinutes: increment(minutes) });
}
