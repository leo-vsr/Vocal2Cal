import { useState, useRef, useCallback, useEffect } from "react";

type SpeechMode = "recording" | "unsupported";

const FALLBACK_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/ogg",
  "audio/mp3",
  "audio/mpeg",
  "audio/wav",
] as const;

function audioBufferToWavBlob(audioBuffer: AudioBuffer) {
  const channelCount = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const bitsPerSample = 16;
  const blockAlign = channelCount * bitsPerSample / 8;
  const byteRate = sampleRate * blockAlign;
  const dataLength = audioBuffer.length * blockAlign;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);
  let offset = 0;

  const writeString = (value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset, value.charCodeAt(index));
      offset += 1;
    }
  };

  writeString("RIFF");
  view.setUint32(offset, 36 + dataLength, true);
  offset += 4;
  writeString("WAVE");
  writeString("fmt ");
  view.setUint32(offset, 16, true);
  offset += 4;
  view.setUint16(offset, 1, true);
  offset += 2;
  view.setUint16(offset, channelCount, true);
  offset += 2;
  view.setUint32(offset, sampleRate, true);
  offset += 4;
  view.setUint32(offset, byteRate, true);
  offset += 4;
  view.setUint16(offset, blockAlign, true);
  offset += 2;
  view.setUint16(offset, bitsPerSample, true);
  offset += 2;
  writeString("data");
  view.setUint32(offset, dataLength, true);
  offset += 4;

  const channels = Array.from({ length: channelCount }, (_, index) => audioBuffer.getChannelData(index));

  for (let frame = 0; frame < audioBuffer.length; frame += 1) {
    for (let channel = 0; channel < channelCount; channel += 1) {
      const sample = Math.max(-1, Math.min(1, channels[channel][frame]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: "audio/wav" });
}

async function convertToGeminiCompatibleAudio(audioBlob: Blob) {
  if (!audioBlob.type.startsWith("audio/webm")) {
    return audioBlob;
  }

  const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) {
    throw new Error("Impossible de convertir l'audio WebM sur ce navigateur.");
  }

  const audioContext = new AudioContextCtor();

  try {
    const arrayBuffer = await audioBlob.arrayBuffer();
    const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    return audioBufferToWavBlob(decodedBuffer);
  } finally {
    await audioContext.close().catch(() => undefined);
  }
}

function getSpeechMode(): SpeechMode {
  if (typeof window === "undefined") {
    return "unsupported";
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

      const normalizedBlob = await convertToGeminiCompatibleAudio(audioBlob);
      const audioBase64 = await blobToBase64(normalizedBlob);
      const response = await fetch("/api/transcribe-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          audioBase64,
          mimeType: normalizedBlob.type,
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
        "La dictée n'est pas disponible sur ce navigateur. Vérifiez l'accès au micro ou utilisez un navigateur plus récent."
      );
      return;
    }

    const mimeType = getRecordingMimeType();
    if (!mimeType) {
      setError("Ce navigateur ne propose pas un format audio compatible pour la dictée.");
      return;
    }

    setTranscript("");
    setError(null);

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
    const mediaRecorder = mediaRecorderRef.current;
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    } else {
      cleanupMediaStream();
      setIsListening(false);
    }
  }, [cleanupMediaStream]);

  const resetTranscript = useCallback(() => {
    setTranscript("");
    setError(null);
  }, []);

  useEffect(() => {
    return () => {
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
