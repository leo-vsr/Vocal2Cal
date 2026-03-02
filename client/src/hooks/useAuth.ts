import { useState, useEffect, useCallback } from "react";
import type { User } from "@/types";

interface AuthState {
  user: User | null;
  status: "loading" | "authenticated" | "unauthenticated";
}

export function useAuth() {
  const [auth, setAuth] = useState<AuthState>({
    user: null,
    status: "loading",
  });

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setAuth({ user: data.user, status: "authenticated" });
      } else {
        setAuth({ user: null, status: "unauthenticated" });
      }
    } catch {
      setAuth({ user: null, status: "unauthenticated" });
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const signIn = () => {
    window.location.href = "/api/auth/google";
  };

  const signOut = async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    setAuth({ user: null, status: "unauthenticated" });
  };

  return {
    user: auth.user,
    status: auth.status,
    signIn,
    signOut,
  };
}
