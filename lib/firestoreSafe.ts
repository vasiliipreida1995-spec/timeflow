import { onSnapshot } from "firebase/firestore";

export function safeOnSnapshot(ref: any, onNext: (snap: any) => void) {
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
