import { onSnapshot } from "firebase/firestore";
import type { DocumentData, DocumentReference, DocumentSnapshot, Query, QuerySnapshot } from "firebase/firestore";

export function safeOnSnapshot<T = DocumentData>(
  ref: Query<T> | DocumentReference<T>,
  onNext: (snap: QuerySnapshot<T> | DocumentSnapshot<T>) => void
) {
  return onSnapshot(
    ref as unknown as Query<T>,
    onNext as unknown as (snap: QuerySnapshot<T>) => void,
    (err: unknown) => {
      const code = (err as { code?: string } | null)?.code;
      if (code === "permission-denied") {
        return;
      }
      console.error(err);
    }
  );
}
