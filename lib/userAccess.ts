import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  signOut,
} from "firebase/auth";
import { auth } from "./firebase";
import { getOrCreateWebUser } from "./webUser";

function getErrorCode(err: unknown): string | undefined {
  if (typeof err === "object" && err && "code" in err) {
    return String((err as { code?: unknown }).code ?? "");
  }
  return undefined;
}

export async function registerUser({
  name,
  email,
  password,
}: {
  name: string;
  email: string;
  password: string;
}): Promise<string | null> {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    await getOrCreateWebUser(cred.user.uid, email);
    return null;
  } catch (e: unknown) {
    const code = getErrorCode(e);
    switch (code) {
      case "auth/email-already-in-use":
        return "Email уже используется.";
      case "auth/weak-password":
        return "Слишком простой пароль.";
      case "auth/invalid-email":
        return "Некорректный email.";
      case "auth/network-request-failed":
        return "Ошибка сети при подключении к Firebase.";
      default:
        return code ? `Ошибка входа (${code})` : "Ошибка входа.";
    }
  }
}

export async function loginUser(email: string, password: string) {
  try {
    await signInWithEmailAndPassword(auth, email, password);
    return null;
  } catch (e: unknown) {
    const code = getErrorCode(e);
    return code ? `Ошибка входа (${code})` : "Ошибка входа.";
  }
}

export async function logoutUser() {
  await signOut(auth);
}
