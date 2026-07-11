"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Flame, Send, Mic, StopCircle, CheckCircle2, ChevronRight, CalendarDays } from "lucide-react";
import Link from "next/link";
import { useLang } from "@/lib/i18n/context";
import { useToast } from "@/lib/toast/context";
import { getToday, formatDate } from "@/lib/dates";

interface ChatMessage {
  role: "user" | "model";
  text: string;
}

type DayKind = "today" | "past" | "future";

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function formatTime(s: number) {
  return `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}

export default function BurnPredictorPage() {
  const { lang } = useLang();
  const { showToast } = useToast();

  const [date, setDate] = useState(getToday());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const dateInFlightRef = useRef<string | null>(null);

  const today = getToday();
  const dayKind: DayKind = date === today ? "today" : date < today ? "past" : "future";
  const formattedDate = useMemo(() => formatDate(date, lang), [date, lang]);
  const targetDay = useMemo(() => ({ formatted: formattedDate, kind: dayKind }), [formattedDate, dayKind]);

  const T = {
    title: lang === "he" ? "תחזית שריפת קלוריות" : "Burn Predictor",
    placeholder: lang === "he" ? "כתוב תשובה..." : "Type a reply...",
    transcribing: lang === "he" ? "מתמלל..." : "Transcribing...",
    predictionReady: lang === "he" ? "התחזית שלך מוכנה" : "Your prediction is ready",
    updateBurn: lang === "he" ? "עדכן קלוריות שרופות ביומן ←" : "Update burned calories in diary →",
    geminiError: lang === "he" ? "שגיאה בחיבור לג'מיניי" : "Error connecting to Gemini",
    micError: lang === "he" ? "לא ניתן לגשת למיקרופון" : "Cannot access microphone",
    transcribeError: lang === "he" ? "שגיאה בתמלול" : "Transcription error",
    forDay: lang === "he" ? "תחזית עבור" : "Prediction for",
    plannedBadge: lang === "he" ? "מתוכנן" : "planned",
    pastBadge: lang === "he" ? "עבר" : "past",
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const fetchReply = useCallback(async (msgs: ChatMessage[]) => {
    setLoading(true);
    try {
      const res = await fetch("/api/burn-predictor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: msgs, lang, targetDay }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setMessages(prev => [...prev, { role: "model" as const, text: data.reply }]);
      if (data.isDone) setIsDone(true);
    } catch {
      showToast(T.geminiError, "error");
    } finally {
      setLoading(false);
    }
  }, [lang, showToast, T.geminiError, targetDay]);

  // Fetch first question whenever date changes (and on mount)
  useEffect(() => {
    if (dateInFlightRef.current === date) return;
    dateInFlightRef.current = date;
    setMessages([]);
    setInputText("");
    setIsDone(false);
    fetchReply([]);
  }, [date, fetchReply]);

  const sendMessage = useCallback(async () => {
    const text = inputText.trim();
    if (!text || loading || isDone) return;
    const userMsg: ChatMessage = { role: "user", text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInputText("");
    await fetchReply(next);
  }, [inputText, loading, isDone, messages, fetchReply]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus" : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setTranscribing(true);
        try {
          const data = await blobToBase64(blob);
          const res = await fetch("/api/burn-predictor", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "transcribe", audio: { data, mimeType }, lang }),
          });
          const json = await res.json();
          setInputText(json.text ?? "");
        } catch {
          showToast(T.transcribeError, "error");
        } finally {
          setTranscribing(false);
        }
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch {
      showToast(T.micError, "error");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  return (
    <div className="min-h-dvh bg-canvas flex flex-col">
      {/* Header */}
      <div className="bg-surface border-b border-line px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-1.5 rounded-lg hover:bg-canvas text-ink-2 transition-colors">
            <ChevronRight className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 bg-brand-50 rounded-full flex items-center justify-center shrink-0">
              <Flame className="w-4.5 h-4.5 text-brand-600" />
            </div>
            <p className="text-sm font-bold text-ink leading-tight truncate">{T.title}</p>
          </div>
        </div>

        {/* Day selector — tap to change target day */}
        <label className="relative mt-2 flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg bg-canvas cursor-pointer select-none">
          <CalendarDays className="w-4 h-4 shrink-0 text-brand-600" />
          <span className="text-xs text-ink-3 shrink-0">{T.forDay}</span>
          <span className="font-bold text-sm text-ink tabular-nums">{formattedDate}</span>
          {dayKind === "future" && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase shrink-0 bg-brand-50 text-brand-700">
              {T.plannedBadge}
            </span>
          )}
          {dayKind === "past" && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase shrink-0 bg-warn/10 text-warn">
              {T.pastBadge}
            </span>
          )}
          <input
            type="date"
            value={date}
            onChange={(e) => { if (e.target.value) setDate(e.target.value); }}
            className="absolute inset-0 opacity-0 cursor-pointer w-full"
            aria-label={T.forDay}
          />
        </label>
      </div>

      {/* Chat */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 pb-6">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-start" : "justify-end"}`}>
            <div className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
              msg.role === "user"
                ? "bg-brand-500 text-white rounded-tr-sm"
                : "bg-surface border border-line text-ink rounded-tl-sm shadow-sm"
            }`}>
              {msg.text}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div className="flex justify-end">
            <div className="bg-surface border border-line rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1 items-center h-4">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Prediction done card */}
        {isDone && (
          <div className="mt-3 bg-brand-50 border border-brand-100 rounded-2xl p-4 flex flex-col gap-3 animate-slide-up">
            <div className="flex items-center gap-2 text-brand-700">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span className="text-sm font-bold">{T.predictionReady}</span>
            </div>
            <Link
              href={date === today ? "/" : `/?date=${date}`}
              className="bg-brand-600 hover:bg-brand-700 active:scale-95 text-white text-sm font-bold px-4 py-3 rounded-xl text-center transition-all"
            >
              {T.updateBurn}
            </Link>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      {!isDone && (
        <div className="bg-surface border-t border-line px-3 py-3 flex items-end gap-2 sticky bottom-0">
          <button
            type="button"
            onClick={recording ? stopRecording : startRecording}
            disabled={loading || transcribing}
            className={`shrink-0 w-10 h-10 flex items-center justify-center rounded-full transition-colors disabled:opacity-40 ${
              recording
                ? "bg-over text-white"
                : "bg-canvas text-ink-2 hover:bg-brand-50 hover:text-brand-600"
            }`}
            aria-label={recording ? "עצור הקלטה" : "הקלט"}
          >
            {recording ? <StopCircle className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          <div className="flex-1 min-w-0">
            {recording ? (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-canvas rounded-xl">
                <div className="w-2 h-2 bg-over rounded-full animate-pulse" />
                <span className="text-sm text-over font-mono font-semibold">{formatTime(recordingTime)}</span>
              </div>
            ) : transcribing ? (
              <div className="px-3 py-2.5 bg-canvas rounded-xl text-sm text-ink-3 animate-pulse-soft">
                {T.transcribing}
              </div>
            ) : (
              <textarea
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder={T.placeholder}
                rows={1}
                disabled={loading}
                className="w-full bg-canvas rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500/40 placeholder:text-ink-3/60 disabled:opacity-50"
                style={{ minHeight: "42px", maxHeight: "120px" }}
              />
            )}
          </div>

          <button
            type="button"
            onClick={sendMessage}
            disabled={!inputText.trim() || loading || recording || transcribing}
            className="shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-brand-600 hover:bg-brand-700 active:scale-95 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            aria-label="שלח"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
