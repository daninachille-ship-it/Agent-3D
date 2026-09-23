import { useEffect, useState } from "react";
import { Speaker, getVoicePrefs, listFrenchVoices, setVoicePrefs, voice, type VoiceOption } from "../voice/speaker";

/** Réglages de la voix : laquelle, à quelle vitesse, quel ton. Gardés dans ce navigateur. */
export function VoiceSettings({ onClose }: { onClose: () => void }) {
  const [voices, setVoices] = useState<VoiceOption[]>(listFrenchVoices);
  const [prefs, setPrefs] = useState(getVoicePrefs);

  // Chrome livre la liste des voix en retard.
  useEffect(() => {
    const refresh = () => setVoices(listFrenchVoices());
    window.speechSynthesis?.addEventListener?.("voiceschanged", refresh);
    const t = window.setTimeout(refresh, 800);
    return () => {
      window.speechSynthesis?.removeEventListener?.("voiceschanged", refresh);
      window.clearTimeout(t);
    };
  }, []);

  const update = (patch: Partial<typeof prefs>) => {
    setVoicePrefs(patch);
    setPrefs(getVoicePrefs());
  };

  const listen = () => {
    if (voice.status === "muted" || voice.status === "blocked") voice.setMuted(false);
    window.speechSynthesis?.cancel();
    const s = new Speaker(
      () => {},
      () => {},
    );
    s.push("Bonjour Achille. Voici ma voix : dis-moi si elle te plaît. ");
    s.finish();
  };

  const selected = prefs.voiceURI ?? voices[0]?.uri ?? "";

  return (
    <div className="settings" role="dialog" aria-label="Réglages de la voix">
      <div className="settings-head">
        <h2>Voix de Phare</h2>
        <button className="icon-btn" onClick={onClose} aria-label="Fermer les réglages">
          ×
        </button>
      </div>

      {voices.length ? (
        <label className="field" htmlFor="voice-select">
          <span>Voix</span>
          <select id="voice-select" value={selected} onChange={(e) => update({ voiceURI: e.target.value })}>
            {voices.map((v) => (
              <option key={v.uri} value={v.uri}>
                {v.label}
                {v.female ? " · féminine" : ""}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="settings-note">Aucune voix française trouvée sur cet appareil.</p>
      )}

      <label className="field" htmlFor="voice-rate">
        <span>
          Vitesse <output>{prefs.rate.toFixed(2)}×</output>
        </span>
        <input
          id="voice-rate"
          type="range"
          min={0.8}
          max={1.3}
          step={0.05}
          value={prefs.rate}
          onChange={(e) => update({ rate: Number(e.target.value) })}
        />
      </label>

      <label className="field" htmlFor="voice-pitch">
        <span>
          Ton <output>{prefs.pitch.toFixed(2)}</output>
        </span>
        <input
          id="voice-pitch"
          type="range"
          min={0.8}
          max={1.25}
          step={0.05}
          value={prefs.pitch}
          onChange={(e) => update({ pitch: Number(e.target.value) })}
        />
      </label>

      <button className="primary" onClick={listen}>
        ▶ Écouter
      </button>

      <p className="settings-note">
        Les voix viennent de ton appareil. Les plus humaines : Denise ou Vivienne dans Microsoft Edge ; sur iPhone,
        télécharge Audrey (Premium) dans Réglages › Accessibilité › Contenu énoncé › Voix ; sur Android, installe la
        voix française haute qualité dans les réglages de synthèse vocale Google.
      </p>
    </div>
  );
}
