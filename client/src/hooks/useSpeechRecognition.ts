import { useState, useRef, useCallback, useEffect } from "react";

type SpeechMode = "native" | "recording" | "unsupported";

const FALLBACK_MIME_TYPES = [
  "audio/ogg;codecs=opus",
  "audio/ogg",
  "audio/mp3",
  "audio/mpeg",
  "audio/wav",
] as const;

function getSpeechMode(): SpeechMode {
  if (typeof window === "undefined") {
    return "unsupported";
  }

  if ("SpeechRecognition" in window || "webkitSpeechRecognition" in window) {
    return "native";
  }

  const hasAudioRecorder =
    "MediaRecorder" in window &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia;

  if (!hasAudioRecorder) {
    return "unsupported";
  }

  const supportsFallbackMimeType = FALLBACK_MIME_TYPES.some((mimeType) =>
    typeof MediaRecorder.isTypeSupported === "function" ? MediaRecorder.isTypeSupported(mimeType) : false
  );

  return supportsFallbackMimeType ? "recording" : "unsupported";
}

function getRecordingMimeType() {
  if (typeof window === "undefined" || !("MediaRecorder" in window)) {
    return null;
  }

  return (
    FALLBACK_MIME_TYPES.find((mimeType) =>
      typeof MediaRecorder.isTypeSupported === "function" ? MediaRecorder.isTypeSupported(mimeType) : false
    ) || null
  );
}

async function blobToBase64(blob: Blob) {
  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";

  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }

  return btoa(binary);
}

export function useSpeechRecognition() {
  const [transcript, setTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const mode = getSpeechMode();
  const isSupported = mode !== "unsupported";

  const cleanupMediaStream = useCallback(() => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  }, []);

  const transcribeRecordedAudio = useCallback(async (audioBlob: Blob) => {
    if (!audioBlob.size) {
      setError("Aucun audio détecté. Réessayez.");
      return;
    }

    try {
      setIsTranscribing(true);
      setError(null);

      const audioBase64 = await blobToBase64(audioBlob);
      const response = await fetch("/api/transcribe-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          audioBase64,
          mimeType: audioBlob.type,
        }),
      });

      const text = await response.text();
      let data: { transcript?: string; error?: string } = {};

      try {
        data = JSON.parse(text);
      } catch {
        setError("Réponse invalide du serveur de transcription.");
        return;
      }

      if (response.status === 401 && data.error === "SESSION_EXPIRED") {
        window.location.href = "/api/auth/google";
        return;
      }

      if (!response.ok) {
        setError(data.error || "Impossible de transcrire l'audio.");
        return;
      }

      const nextTranscript = data.transcript?.trim() || "";
      if (!nextTranscript) {
        setError("Aucune voix exploitable détectée. Réessayez.");
        return;
      }

      setTranscript(nextTranscript);
    } catch {
      setError("Impossible de transcrire l'audio.");
    } finally {
      setIsTranscribing(false);
    }
  }, []);

  const startListening = useCallback(async () => {
    if (mode === "unsupported") {
      setError(
        "La dictée n'est pas disponible sur ce navigateur. Utilisez un navigateur compatible avec le micro."
      );
      return;
    }

    setTranscript("");
    setError(null);

    if (mode === "native") {
      const SpeechRecognitionAPI =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognitionAPI();
      recognition.lang = "fr-FR";
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = "";
        for (let i = 0; i < event.results.length; i++) {
          finalTranscript += event.results[i][0].transcript;
        }
        setTranscript(finalTranscript);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (event.error === "not-allowed") {
          setError("Accès au microphone refusé. Vérifiez les permissions.");
        } else if (event.error === "no-speech") {
          setError("Aucune voix détectée. Réessayez.");
        } else {
          setError(`Erreur : ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
      return;
    }

    const mimeType = getRecordingMimeType();
    if (!mimeType) {
      setError("Ce navigateur ne propose pas un format audio compatible pour la dictée.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType });

      audioChunksRef.current = [];
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.onstart = () => {
        setIsListening(true);
      };

      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onerror = () => {
        setError("Erreur pendant l'enregistrement audio.");
        setIsListening(false);
        cleanupMediaStream();
      };

      mediaRecorder.onstop = async () => {
        setIsListening(false);

        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        audioChunksRef.current = [];
        cleanupMediaStream();
        await transcribeRecordedAudio(audioBlob);
      };

      mediaRecorder.start();
    } catch {
      setError("Impossible d'accéder au microphone. Vérifiez les permissions.");
      cleanupMediaStream();
    }
  }, [cleanupMediaStream, mode, transcribeRecordedAudio]);

  const stopListening = useCallback(() => {
    if (mode === "native") {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    if (mode === "recording") {
      const mediaRecorder = mediaRecorderRef.current;
      if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
      } else {
        cleanupMediaStream();
        setIsListening(false);
      }
    }
  }, [cleanupMediaStream, mode]);

  const resetTranscript = useCallback(() => {
    setTranscript("");
    setError(null);
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      const mediaRecorder = mediaRecorderRef.current;
      if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
      }
      cleanupMediaStream();
    };
  }, [cleanupMediaStream]);

  return {
    transcript,
    isListening,
    isTranscribing,
    error,
    isSupported,
    mode,
    startListening,
    stopListening,
    resetTranscript,
  };
}
