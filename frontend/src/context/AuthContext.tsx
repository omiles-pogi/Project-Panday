import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import { loginRequest, logoutRequest, meRequest, registerRequest } from "@/services/api/auth";
import { setAuthToken } from "@/services/api/client";
import type { AuthUser, Role } from "@/types/auth";

const TOKEN_KEY = "buildai_auth_token";

type AuthStatus = "bootstrapping" | "authed" | "guest";

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (fields: {
    name: string;
    email: string;
    password: string;
    password_confirmation: string;
    role: Role;
  }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("bootstrapping");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
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
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        setAuthToken(null);
        setStatus("guest");
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      const { user: loggedInUser, token } = await loginRequest({ email, password });
      await SecureStore.setItemAsync(TOKEN_KEY, token);
      setAuthToken(token);
      setUser(loggedInUser);
      setStatus("authed");
    } catch (err) {
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
    }) => {
      setError(null);
      try {
        const res = await registerRequest(fields);
        if (!("token" in res)) {
          // Needs admin approval first; surfaced to the user via the form's error line.
          throw new Error(res.message);
        }
        const { user: newUser, token } = res;
        await SecureStore.setItemAsync(TOKEN_KEY, token);
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
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setAuthToken(null);
    setUser(null);
    setStatus("guest");
  }, []);

  return (
    <AuthContext.Provider value={{ status, user, error, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
