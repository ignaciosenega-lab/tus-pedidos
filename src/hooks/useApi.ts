import { useCallback } from "react";
import { useAuth } from "../store/authContext";

interface FetchOptions extends RequestInit {
  skipAuth?: boolean;
}

export function useApi() {
  const { token, logout } = useAuth();

  const apiFetch = useCallback(
    async <T = any>(url: string, options: FetchOptions = {}): Promise<T> => {
      const { skipAuth, ...fetchOptions } = options;

      const headers: HeadersInit = {
        "Content-Type": "application/json",
        ...fetchOptions.headers,
      };

      if (!skipAuth && token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(url, {
        ...fetchOptions,
        headers,
      });

      // Handle 401 Unauthorized - token expired
      if (response.status === 401 && !skipAuth) {
        logout();
        throw new Error("Sesión expirada");
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Error desconocido" }));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      return response.json();
    },
    [token, logout]
  );

  return { apiFetch };
}
