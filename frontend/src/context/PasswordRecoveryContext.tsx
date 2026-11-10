import { createContext, useContext, useState, type ReactNode } from "react";

interface Recovery {
  email: string;
  resendAt: number;
  authorization: { token: string; expiresAt: number } | null;
}
const EMPTY: Recovery = { email: "", resendAt: 0, authorization: null };
const Context = createContext<{
  recovery: Recovery;
  codeSent: (email: string) => void;
  verified: (token: string, expiresIn: number) => void;
  clear: () => void;
} | null>(null);

/** Credentials live only in memory inside the auth stack, never in URLs or device storage. */
export function PasswordRecoveryProvider({ children }: { children: ReactNode }) {
  const [recovery, setRecovery] = useState<Recovery>(EMPTY);
  return (
    <Context.Provider value={{
      recovery,
      codeSent: (email) => setRecovery({ email, resendAt: Date.now() + 60_000, authorization: null }),
      verified: (token, expiresIn) => setRecovery((previous) => ({
        ...previous, authorization: { token, expiresAt: Date.now() + expiresIn * 1000 },
      })),
      clear: () => setRecovery(EMPTY),
    }}>
      {children}
    </Context.Provider>
  );
}

export function usePasswordRecovery() {
  const value = useContext(Context);
  if (!value) throw new Error("Password recovery requires its auth-stack provider.");
  return value;
}
