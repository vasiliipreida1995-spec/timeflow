import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

export type BreakEntry = {
  subtract?: boolean;
  durationMinutes?: number;
};

export type AppSettings = {
  hourlyRate: number;
  currency: string;
  monthlyExpenses: number;
  pinEnabled: boolean;
  pinHash?: string | null;
  biometricsEnabled: boolean;
  breakEnabled: boolean;
  breaks: BreakEntry[];
  dayTargetHours: number;
  monthTargetHours: number;
  themeMode: "dark" | "light";
  activeProjectId?: string | null;
  activeShiftStart?: string | null;
};

export const defaultSettings: AppSettings = {
  hourlyRate: 25,
  currency: "zl",
  monthlyExpenses: 0,
  pinEnabled: false,
  pinHash: null,
  biometricsEnabled: false,
  breakEnabled: false,
  breaks: [],
  dayTargetHours: 8,
  monthTargetHours: 160,
  themeMode: "dark",
  activeProjectId: null,
  activeShiftStart: null,
};

type SettingsDoc = Partial<AppSettings>;

export async function getOrCreateSettings(uid: string): Promise<AppSettings> {
  const ref = doc(db, "users_private", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, defaultSettings, { merge: true });
    return { ...defaultSettings };
  }
  const data = snap.data() as SettingsDoc;
  return { ...defaultSettings, ...data } as AppSettings;
}

export async function updateSettings(uid: string, patch: Partial<AppSettings>) {
  const ref = doc(db, "users_private", uid);
  await updateDoc(ref, patch);
}

export function totalBreakMinutes(settings: AppSettings) {
  if (!settings.breakEnabled) return 0;
  return settings.breaks
    .filter((b) => b?.subtract)
    .reduce((sum, b) => sum + (b?.durationMinutes ?? 0), 0);
}
