import { onSnapshot } from "firebase/firestore";

export function safeOnSnapshot<T>(ref: any, onNext: (snap: T) => void) {
  return onSnapshot(
    ref,
    onNext,
    (err) => {
      if ((err as any)?.code === "permission-denied") {
        return;
      }
      console.error(err);
    }
  );
}
