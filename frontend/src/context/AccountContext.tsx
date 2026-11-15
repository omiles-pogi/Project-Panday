import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { fetchAccountSettings, updateNotificationPreferences, type AccountSettings, type NotificationPreferences } from "@/services/api/account";

interface AccountValue {
  data: AccountSettings | null; ready: boolean; loading: boolean; saving: boolean; error: string | null;
  refresh: () => Promise<void>; updatePreferences: (changes: Partial<NotificationPreferences>) => Promise<void>;
  acceptPhoto: (data: AccountSettings) => Promise<void>;
}
const AccountContext = createContext<AccountValue | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return <AccountSessionProvider key={user?.id ?? "guest"}>{children}</AccountSessionProvider>;
}

function AccountSessionProvider({ children }: { children: ReactNode }) {
  const { user, syncProfilePhoto } = useAuth();
  const owner = user?.id;
  const supported = !!user && ["homeowner", "contractor", "worker", "supplier"].includes(user.role);
  const [snapshot, setSnapshot] = useState<{ owner: number; data: AccountSettings } | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const epoch = useRef(0);
  const busy = useRef(false);
  const ownerRef = useRef(owner);
  const refresh = useCallback(async () => {
    if (!supported || owner === undefined || busy.current) return;
    const version = ++epoch.current;
    setLoading(true); setError(null);
    try {
      const data = await fetchAccountSettings();
      if (owner === ownerRef.current && data.userId !== owner) throw new Error("Account settings did not match the signed-in account. Try again.");
      if (version === epoch.current && owner === ownerRef.current && data.userId === owner) {
        setSnapshot({ owner, data });
        syncProfilePhoto(owner, data.photoUrl);
      }
    } catch (err) {
      if (version === epoch.current && owner === ownerRef.current) setError(err instanceof Error ? err.message : "Could not load account settings.");
    } finally { if (version === epoch.current && owner === ownerRef.current) setLoading(false); }
  }, [owner, supported, syncProfilePhoto]);
  const invalidate = useCallback(() => { epoch.current++; }, []);
  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => { if (!cancelled) void refresh(); });
    return () => { cancelled = true; invalidate(); };
  }, [refresh, invalidate]);

  const updatePreferences = async (changes: Partial<NotificationPreferences>) => {
    if (busy.current || owner === undefined || snapshot?.owner !== owner) return;
    busy.current = true; const version = ++epoch.current;
    setSaving(true); setError(null);
    try {
      const data = await updateNotificationPreferences(changes);
      if (owner === ownerRef.current && data.userId !== owner) throw new Error("Account settings did not match the signed-in account. Try again.");
      if (version === epoch.current && owner === ownerRef.current) setSnapshot(current => ({ owner, data: { ...data, photoUrl: current?.owner === owner ? current.data.photoUrl : data.photoUrl } }));
    } catch (err) {
      if (version === epoch.current && owner === ownerRef.current) setError(err instanceof Error ? err.message : "Could not save notification preferences.");
    } finally {
      busy.current = false;
      if (version === epoch.current && owner === ownerRef.current) setSaving(false);
    }
  };
  const acceptPhoto = async (data: AccountSettings) => {
    if (owner === undefined || owner !== ownerRef.current || data.userId !== owner) return;
    if (!busy.current) { epoch.current++; setLoading(false); }
    // A concurrent preference save is authoritative for preferences; photo changes update only the photo.
    setSnapshot(current => current?.owner === owner ? { owner, data: { ...current.data, photoUrl: data.photoUrl } } : current);
    syncProfilePhoto(owner, data.photoUrl);
  };
  const data = snapshot && snapshot.owner === owner && supported ? snapshot.data : null;
  return <AccountContext.Provider value={{ data, ready: !!data, loading, saving, error, refresh, updatePreferences, acceptPhoto }}>{children}</AccountContext.Provider>;
}

export function useAccount() {
  const context = useContext(AccountContext);
  if (!context) throw new Error("useAccount must be used within AccountProvider");
  return context;
}
