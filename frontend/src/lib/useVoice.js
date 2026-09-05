// Modular voice hook: browser Web Speech API for ASR + speechSynthesis for TTS.
// The seam is intentionally small - swap the internals for a server ASR/TTS
// provider later without touching components.
import { useCallback, useEffect, useRef, useState } from "react";
import { bcp47For } from "./i18n";

export function useSpeechRecognition(langCode = "en") {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState(null);
  const recRef = useRef(null);
  const finalRef = useRef("");
  const onFinalRef = useRef(null);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSupported(Boolean(SR));
  }, []);

  const start = useCallback(
    (onFinal) => {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) {
        setError("Speech recognition is not supported in this browser. Please type instead.");
        return;
      }
      setError(null);
      finalRef.current = "";
      onFinalRef.current = onFinal;
      const rec = new SR();
      rec.lang = bcp47For(langCode);
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = (e) => {
        let interimText = "";
        for (let i = e.resultIndex; i < e.results.length; i += 1) {
          const chunk = e.results[i][0].transcript;
          if (e.results[i].isFinal) finalRef.current += chunk + " ";
          else interimText += chunk;
        }
        setInterim(interimText);
      };
      rec.onerror = (e) => {
        setError(e.error === "not-allowed" ? "Microphone permission denied." : `Voice error: ${e.error}`);
        setListening(false);
      };
      rec.onend = () => {
        setListening(false);
        setInterim("");
        const text = finalRef.current.trim();
        if (text && onFinalRef.current) onFinalRef.current(text);
      };
      recRef.current = rec;
      rec.start();
      setListening(true);
    },
    [langCode]
  );

  const stop = useCallback(() => {
    recRef.current?.stop();
  }, []);

  useEffect(() => () => recRef.current?.abort?.(), []);

  return { supported, listening, interim, error, start, stop };
}

export function speak(text, langCode = "en", { rate = 1, pitch = 1 } = {}) {
  if (!("speechSynthesis" in window) || !text) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = bcp47For(langCode);
  u.rate = rate;
  u.pitch = pitch;
  const match = window.speechSynthesis.getVoices().find((v) => v.lang?.startsWith(langCode));
  if (match) u.voice = match;
  window.speechSynthesis.speak(u);
}

export function cancelSpeech() {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

export const ttsSupported = () => "speechSynthesis" in window;
