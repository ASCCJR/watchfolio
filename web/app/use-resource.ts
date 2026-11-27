"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export class RequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function request<T>(url: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store", ...options });
  } catch (error) {
    if (options?.signal?.aborted) throw error;
    throw new RequestError("Falha na conexão. Confira sua internet e tente novamente.", 0);
  }
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const message = body && typeof body === "object" && "error" in body && typeof body.error === "string"
      ? body.error
      : "Não foi possível concluir a solicitação.";
    throw new RequestError(message, response.status);
  }
  return response.json() as Promise<T>;
}

export function useResource<T>(url: string | null, refreshOnReturn = false) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<RequestError | null>(null);
  const controller = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    controller.current?.abort();
    if (!url) return;
    const current = new AbortController();
    controller.current = current;
    try {
      const result = await request<T>(url, { signal: current.signal });
      if (!current.signal.aborted) {
        setData(result);
        setError(null);
      }
    } catch (reason) {
      if (!current.signal.aborted) {
        const failure = reason instanceof RequestError ? reason : new RequestError("A resposta não pôde ser lida.", 0);
        setError(failure);
        if (failure.status === 401 || failure.status === 403) setData(null);
      }
    }
  }, [url]);

  useEffect(() => {
    setData(null);
    setError(null);
    void refresh();
    const visible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const restored = (event: PageTransitionEvent) => {
      if (event.persisted) void refresh();
    };
    if (refreshOnReturn) {
      document.addEventListener("visibilitychange", visible);
      window.addEventListener("pageshow", restored);
      window.addEventListener("online", visible);
    }
    return () => {
      controller.current?.abort();
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("pageshow", restored);
      window.removeEventListener("online", visible);
    };
  }, [refresh, refreshOnReturn]);

  return { data, error, refresh };
}
