import { useEffect, useState } from "react";
import { backend, type Health } from "../backend";

export type { Health };

/** Vérifie que Phare peut répondre (serveur + clé, ou Claude sur claude.ai). Réessaie tant que ça ne va pas. */
export function useHealth(): Health {
  const [health, setHealth] = useState<Health>("checking");

  useEffect(() => {
    let timer: number | undefined;
    let cancelled = false;
    const check = async () => {
      const next = await backend.health();
      if (cancelled) return;
      setHealth(next);
      if (next !== "ok" && backend.kind === "server") timer = window.setTimeout(check, 4000);
    };
    void check();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  return health;
}
