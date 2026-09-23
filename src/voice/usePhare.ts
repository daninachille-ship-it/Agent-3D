import { useCallback, useEffect, useRef, useState } from "react";
import { audioBus } from "./audioBus";
import { canAnalyseMic, startMic, stopMic } from "./mic";
import { Speaker } from "./speaker";
import { backend } from "../backend";
import {
  afterWakeWord,
  createRecognition,
  recognitionErrorMessage,
  recognitionSupported,
  type Recognition,
} from "./recognition";

export type PhareState = "idle" | "listening" | "thinking" | "speaking";

/** Au-delà de cette durée d'appui, relâcher le bouton arrête l'écoute (mode "talkie-walkie"). */
const HOLD_MS = 350;
/** Après "Phare", délai pour dire sa demande. */
const WAKE_TIMEOUT_MS = 8000;

export function usePhare() {
  const [state, setStateRaw] = useState<PhareState>("idle");
  const [userText, setUserText] = useState("");
  const [answerText, setAnswerText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [wakeEnabled, setWakeEnabledRaw] = useState(false);

  const stateRef = useRef<PhareState>("idle");
  const wakeRef = useRef(false);
  const recRef = useRef<Recognition | null>(null);
  const recModeRef = useRef<"ptt" | "wake" | null>(null);
  const speakerRef = useRef<Speaker | null>(null);
  const fetchRef = useRef<AbortController | null>(null);
  const pressAtRef = useRef(0);
  const wakeRestartRef = useRef<number | undefined>(undefined);

  const setState = useCallback((s: PhareState) => {
    stateRef.current = s;
    setStateRaw(s);
    if (s === "listening") void startMic();
    else stopMic();
  }, []);

  /** Coupe la reconnaissance en cours sans déclencher son traitement de fin. */
  const dropRecognition = useCallback(() => {
    const rec = recRef.current;
    recRef.current = null;
    recModeRef.current = null;
    if (rec) {
      rec.onresult = rec.onend = rec.onerror = null;
      try {
        rec.abort();
      } catch {
        /* déjà arrêtée */
      }
    }
  }, []);

  // --- Mode mot d'activation -------------------------------------------------

  const startWakeRef = useRef<() => void>(() => {});

  const scheduleWake = useCallback((delay = 300) => {
    window.clearTimeout(wakeRestartRef.current);
    wakeRestartRef.current = window.setTimeout(() => {
      if (wakeRef.current && stateRef.current === "idle" && !recRef.current) startWakeRef.current();
    }, delay);
  }, []);

  // --- Envoi d'une question et lecture de la réponse -------------------------

  const stop = useCallback(() => {
    fetchRef.current?.abort();
    fetchRef.current = null;
    speakerRef.current?.cancel();
    speakerRef.current = null;
    if (recModeRef.current === "ptt") dropRecognition();
    setState("idle");
    scheduleWake();
  }, [dropRecognition, scheduleWake, setState]);

  const ask = useCallback(
    async (text: string) => {
      dropRecognition();
      setError(null);
      setUserText(text);
      setAnswerText("");
      setState("thinking");

      const controller = new AbortController();
      fetchRef.current = controller;

      const finishSpeaking = () => {
        if (speakerRef.current !== speaker) return;
        speakerRef.current = null;
        setState("idle");
        scheduleWake();
      };
      const speaker = new Speaker(() => {
        if (speakerRef.current === speaker && stateRef.current === "thinking") setState("speaking");
      }, finishSpeaking);
      speakerRef.current = speaker;

      try {
        let full = "";
        await backend.chat(text, {
          signal: controller.signal,
          onDelta: (delta) => {
            full += delta;
            setAnswerText(full);
            speaker.push(delta);
          },
        });
        speaker.finish();
        if (!Speaker.supported) finishSpeaking();
      } catch (err) {
        if (controller.signal.aborted) return;
        const msg = err instanceof Error ? err.message : "Erreur inconnue.";
        setError(msg);
        speaker.push(msg + " ");
        speaker.finish();
      } finally {
        if (fetchRef.current === controller) fetchRef.current = null;
      }
    },
    [dropRecognition, scheduleWake, setState],
  );

  // --- Appuyer pour parler ---------------------------------------------------

  const pressStart = useCallback(() => {
    if (!recognitionSupported || !backend.voiceInput) return;
    // Interrompre Phare s'il parle ou réfléchit.
    fetchRef.current?.abort();
    speakerRef.current?.cancel();
    speakerRef.current = null;
    dropRecognition();
    window.clearTimeout(wakeRestartRef.current);

    setError(null);
    setUserText("");
    setAnswerText("");
    pressAtRef.current = performance.now();

    const rec = createRecognition(false);
    recRef.current = rec;
    recModeRef.current = "ptt";
    let finals = "";
    let interim = "";

    rec.onresult = (e) => {
      interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finals += r[0].transcript;
        else interim += r[0].transcript;
      }
      setUserText((finals + interim).trim());
      if (!canAnalyseMic) audioBus.fakeMicKick = 1;
    };
    rec.onerror = (e) => {
      const msg = recognitionErrorMessage(e.error);
      if (msg) setError(msg);
    };
    rec.onend = () => {
      if (recRef.current !== rec) return;
      recRef.current = null;
      recModeRef.current = null;
      const text = (finals || interim).trim();
      if (text) void ask(text);
      else {
        setState("idle");
        scheduleWake();
      }
    };

    setState("listening");
    try {
      rec.start();
    } catch {
      setState("idle");
    }
  }, [ask, dropRecognition, scheduleWake, setState]);

  const pressEnd = useCallback(() => {
    const held = performance.now() - pressAtRef.current;
    // Appui long : relâcher = fin de la phrase. Appui court : Chrome s'arrête seul au silence.
    if (recModeRef.current === "ptt" && held > HOLD_MS) recRef.current?.stop();
  }, []);

  // --- Mot d'activation "Phare" -----------------------------------------------

  startWakeRef.current = () => {
    if (!recognitionSupported) return;
    const rec = createRecognition(true);
    recRef.current = rec;
    recModeRef.current = "wake";

    let armedAt = -1; // index du résultat contenant "Phare"
    let timer: number | undefined;

    const disarm = () => {
      armedAt = -1;
      window.clearTimeout(timer);
      if (stateRef.current === "listening") {
        setUserText("");
        setState("idle");
      }
    };

    rec.onresult = (e) => {
      const last = e.results[e.results.length - 1];

      if (armedAt < 0) {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (afterWakeWord(e.results[i][0].transcript) !== null) {
            armedAt = i;
            setError(null);
            setAnswerText("");
            setState("listening");
            break;
          }
        }
        if (armedAt < 0) return;
      }

      if (!canAnalyseMic) audioBus.fakeMicKick = 1;
      window.clearTimeout(timer);
      timer = window.setTimeout(disarm, WAKE_TIMEOUT_MS);

      let command = afterWakeWord(e.results[armedAt][0].transcript) ?? "";
      for (let i = armedAt + 1; i < e.results.length; i++) command += " " + e.results[i][0].transcript;
      command = command.trim();
      setUserText(command);

      if (last.isFinal && command.length > 1) {
        window.clearTimeout(timer);
        void ask(command);
      }
    };
    rec.onerror = (e) => {
      const msg = recognitionErrorMessage(e.error);
      if (msg) setError(msg);
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        wakeRef.current = false;
        setWakeEnabledRaw(false);
      }
    };
    rec.onend = () => {
      window.clearTimeout(timer);
      if (recRef.current !== rec) return;
      recRef.current = null;
      recModeRef.current = null;
      if (stateRef.current === "listening") setState("idle");
      // Chrome coupe l'écoute continue régulièrement : on la relance.
      scheduleWake(400);
    };

    try {
      rec.start();
    } catch {
      scheduleWake(1000);
    }
  };

  const setWakeEnabled = useCallback(
    (on: boolean) => {
      wakeRef.current = on;
      setWakeEnabledRaw(on);
      if (on) scheduleWake(0);
      else if (recModeRef.current === "wake") {
        dropRecognition();
        if (stateRef.current === "listening") setState("idle");
      }
    },
    [dropRecognition, scheduleWake, setState],
  );

  const newConversation = useCallback(async () => {
    stop();
    setUserText("");
    setAnswerText("");
    try {
      await backend.newConversation();
      setAnswerText("Nouvelle conversation. Je t'écoute.");
    } catch {
      setError("Impossible de joindre le serveur.");
    }
  }, [stop]);

  const resumeConversation = useCallback(
    async (id: string) => {
      stop();
      setUserText("");
      setError(null);
      try {
        const conv = await backend.resumeConversation(id);
        if (!conv) throw new Error();
        const lastAnswer = [...conv.messages].reverse().find((m) => m.role === "assistant")?.content;
        const lastQuestion = [...conv.messages].reverse().find((m) => m.role === "user")?.content;
        setUserText(lastQuestion ?? "");
        setAnswerText(lastAnswer ? `On reprend. ${lastAnswer}` : "On reprend cette conversation.");
      } catch {
        setError("Impossible de reprendre cette conversation.");
      }
    },
    [stop],
  );

  // Nettoyage au démontage.
  useEffect(
    () => () => {
      window.clearTimeout(wakeRestartRef.current);
      dropRecognition();
      speakerRef.current?.cancel();
      fetchRef.current?.abort();
      stopMic();
    },
    [dropRecognition],
  );

  return {
    state,
    userText,
    answerText,
    error,
    wakeEnabled,
    setWakeEnabled,
    pressStart,
    pressEnd,
    stop,
    ask,
    newConversation,
    resumeConversation,
    supported: recognitionSupported && backend.voiceInput,
  };
}
