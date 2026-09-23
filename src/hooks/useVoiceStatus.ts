import { useEffect, useState } from "react";
import { voice, type VoiceStatus } from "../voice/speaker";

/** État de la voix de Phare : entendue, bloquée par le navigateur, ou coupée. */
export function useVoiceStatus(): VoiceStatus {
  const [status, setStatus] = useState(voice.status);
  useEffect(() => {
    setStatus(voice.status);
    const off = voice.subscribe(setStatus);
    return () => {
      off();
    };
  }, []);
  return status;
}
