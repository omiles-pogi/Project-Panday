import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { tokenStorage } from "@/utils/tokenStorage";
import { loginRequest, logoutRequest, meRequest, registerRequest } from "@/services/api/auth";
import { ApiError, setAuthToken } from "@/services/api/client";
import type { AuthUser, Role } from "@/types/auth";

const TOKEN_KEY = "buildai_auth_token";

type AuthStatus = "bootstrapping" | "authed" | "guest";

export interface PendingAccount {
  name: string;
  email: string;
  password: string;
}

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  error: string | null;
  /** An account that exists but is waiting for admin approval (drives Pandy's waiting screen). */
  pending: PendingAccount | null;
  /** Leave the waiting screen; pass an email to pre-fill it on the sign-in page. */
  clearPending: (prefillEmail?: string) => void;
  prefillEmail: string;
  login: (email: string, password: string) => Promise<void>;
  register: (fields: {
    name: string;
    email: string;
    password: string;
    password_confirmation: string;
    role: Role;
    business_name?: string;
    license_number?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("bootstrapping");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAccount | null>(null);
  const [prefillEmail, setPrefillEmail] = useState("");
  const clearPending = useCallback((email?: string) => {
    setPending(null);
    setPrefillEmail(email ?? "");
  }, []);

  useEffect(() => {
    (async () => {
      const token = await tokenStorage.getItem(TOKEN_KEY);
      if (!token) {
        setStatus("guest");
        return;
      }
      setAuthToken(token);
      try {
        const me = await meRequest();
        setUser(me);
        setStatus("authed");
      } catch {
        await tokenStorage.deleteItem(TOKEN_KEY);
        setAuthToken(null);
        setStatus("guest");
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      const { user: loggedInUser, token } = await loginRequest({ email, password });
      await tokenStorage.setItem(TOKEN_KEY, token);
      setAuthToken(token);
      setUser(loggedInUser);
      setPending(null);
      setStatus("authed");
    } catch (err) {
      if (err instanceof ApiError && (err.data as { approval_status?: string } | null)?.approval_status === "pending") {
        // Valid credentials but not approved yet: wait here instead of just showing an error.
        setPending({ name: "", email, password });
        return;
      }
      const message = err instanceof Error ? err.message : "Failed to log in.";
      setError(message);
      throw err;
    }
  }, []);

  const register = useCallback(
    async (fields: {
      name: string;
      email: string;
      password: string;
      password_confirmation: string;
      role: Role;
      business_name?: string;
      license_number?: string;
    }) => {
      setError(null);
      try {
        const res = await registerRequest(fields);
        if (!("token" in res)) {
          // Needs admin approval first: hand over to Pandy's waiting screen, which polls
          // for the decision. Credentials stay in memory only.
          setPending({ name: fields.name, email: fields.email, password: fields.password });
          return;
        }
        const { user: newUser, token } = res;
        await tokenStorage.setItem(TOKEN_KEY, token);
        setAuthToken(token);
        setUser(newUser);
        setStatus("authed");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to register.";
        setError(message);
        throw err;
      }
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } catch {
      // best-effort: proceed with local logout even if the request fails
    }
    await tokenStorage.deleteItem(TOKEN_KEY);
    setAuthToken(null);
    setUser(null);
    setStatus("guest");
  }, []);

  return (
    <AuthContext.Provider value={{ status, user, error, pending, clearPending, prefillEmail, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
