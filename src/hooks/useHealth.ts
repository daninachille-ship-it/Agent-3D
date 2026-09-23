import { useEffect, useState } from "react";

export type Health = "checking" | "ok" | "no-server" | "no-key";

/** Vérifie que le serveur tourne et qu'une clé API est configurée. Réessaie tant que ça ne va pas. */
export function useHealth(): Health {
  const [health, setHealth] = useState<Health>("checking");

  useEffect(() => {
    let timer: number | undefined;
    let cancelled = false;
    const check = async () => {
      let next: Health;
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        const data = (await res.json()) as { hasKey?: boolean };
        next = res.ok ? (data.hasKey ? "ok" : "no-key") : "no-server";
      } catch {
        next = "no-server";
      }
      if (cancelled) return;
      setHealth(next);
      if (next !== "ok") timer = window.setTimeout(check, 4000);
    };
    void check();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  return health;
}
