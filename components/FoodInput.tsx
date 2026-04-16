"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Type, Image as ImageIcon, Mic, Send, X, Plus, AlertCircle,
  Loader2, StopCircle, CheckCircle2, Camera, FolderOpen,
} from "lucide-react";
import { GeminiResponse, FoodItem } from "@/types";
import { useLang } from "@/lib/i18n/context";

type Tab = "text" | "image" | "audio";

interface FoodInputProps {
  onEntriesAdded: () => void;
  currentDate?: string;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

interface ResultPreviewProps {
  result: GeminiResponse;
  onAdd: () => void;
  onDiscard: () => void;
  adding: boolean;
}

function ResultPreview({ result, onAdd, onDiscard, adding }: ResultPreviewProps) {
  const { T } = useLang();
  return (
    <div className="mt-4 flex flex-col gap-3 animate-in slide-in-from-bottom-2 duration-300">
      {result.needs_clarification && result.note && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{result.note}</span>
        </div>
      )}
      <div className="bg-slate-50 rounded-xl p-3 flex flex-col gap-2">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          {T.foundItems(result.items.length)}
        </p>
        {result.items.map((item: FoodItem, i: number) => (
          <div key={i} className="bg-white rounded-lg p-3 border border-slate-100 flex justify-between items-start gap-2">
            <div>
              <p className="font-semibold text-slate-800 text-sm">{item.name}</p>
              {item.quantity && <p className="text-xs text-slate-400">{item.quantity}</p>}
            </div>
            <div className="text-left shrink-0">
              <p className="font-bold text-amber-600 text-sm">{Math.round(item.calories)} {T.kcal}</p>
              <p className="text-xs text-slate-400">
                {T.protein.slice(0, 1)}:{Math.round(item.protein_g)}g {T.carbs.slice(0, 1)}:{Math.round(item.carbs_g)}g {T.fat.slice(0, 1)}:{Math.round(item.fat_g)}g
              </p>
            </div>
          </div>
        ))}
        <div className="flex justify-between items-center pt-1 border-t border-slate-100">
          <span className="text-sm font-semibold text-slate-600">{T.totalCalories}</span>
          <span className="text-lg font-bold text-emerald-600">{Math.round(result.total_calories)} {T.kcal}</span>
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={onDiscard} disabled={adding}
          className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5">
          <X className="w-4 h-4" />{T.discard}
        </button>
        <button onClick={onAdd} disabled={adding}
          className="flex-2 flex-grow-[2] py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60">
          {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          {adding ? T.adding : T.addToDiary}
        </button>
      </div>
    </div>
  );
}

export default function FoodInput({ onEntriesAdded, currentDate }: FoodInputProps) {
  const { T } = useLang();
  const [tab, setTab] = useState<Tab>("text");
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<GeminiResponse | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const reset = useCallback(() => {
    setText(""); setImageFile(null); setImagePreview(null); setAudioBlob(null);
    setRecording(false); setRecordingTime(0); setResult(null); setError(""); setSuccess(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const handleTabChange = (newTab: Tab) => { setTab(newTab); reset(); };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file); setResult(null); setError("");
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const startRecording = async () => {
    try {
      setError("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus" : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        setAudioBlob(new Blob(chunksRef.current, { type: mimeType }));
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start(100);
      setRecording(true); setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } catch { setError(T.micError); }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleAnalyze = async () => {
    setError(""); setResult(null); setAnalyzing(true);
    try {
      let body: Record<string, unknown>;
      if (tab === "text") {
        if (!text.trim()) { setError(T.noTextError); return; }
        body = { type: "text", text };
      } else if (tab === "image") {
        if (!imageFile) { setError(T.noImageError); return; }
        body = { type: "image", data: await blobToBase64(imageFile), mimeType: imageFile.type };
      } else {
        if (!audioBlob) { setError(T.noAudioError); return; }
        body = { type: "audio", data: await blobToBase64(audioBlob), mimeType: audioBlob.type };
      }
      const res = await fetch("/api/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || T.error);
      if (!data.items?.length) throw new Error(T.noFoodError);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : T.unknownError);
    } finally { setAnalyzing(false); }
  };

  const handleAdd = async () => {
    if (!result) return;
    setAdding(true);
    const date = currentDate ?? new Date().toISOString().split("T")[0];
    try {
      await Promise.all(result.items.map((item) =>
        fetch("/api/entries", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date, name: item.name, quantity: item.quantity || null,
            calories: item.calories, protein: item.protein_g,
            carbs: item.carbs_g, fat: item.fat_g, note: result.note || null,
          }),
        })
      ));
      setSuccess(true); onEntriesAdded();
      setTimeout(reset, 1200);
    } catch { setError(T.saveDiaryError); }
    finally { setAdding(false); }
  };

  const canAnalyze =
    (tab === "text" && text.trim().length > 0) ||
    (tab === "image" && imageFile !== null) ||
    (tab === "audio" && audioBlob !== null && !recording);

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const clearImage = () => {
    setImageFile(null); setImagePreview(null); setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
      <h2 className="text-lg font-bold text-slate-800 mb-4">{T.addMeal}</h2>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-4">
        {([
          { key: "text" as Tab, label: T.tabText, icon: <Type className="w-4 h-4" /> },
          { key: "image" as Tab, label: T.tabImage, icon: <ImageIcon className="w-4 h-4" /> },
          { key: "audio" as Tab, label: T.tabAudio, icon: <Mic className="w-4 h-4" /> },
        ]).map(({ key, label, icon }) => (
          <button key={key} onClick={() => handleTabChange(key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${tab === key ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
            {icon}{label}
          </button>
        ))}
      </div>

      {/* Text */}
      {tab === "text" && (
        <textarea value={text}
          onChange={(e) => { setText(e.target.value); setResult(null); setError(""); }}
          placeholder={T.textPlaceholder} rows={4}
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent placeholder:text-slate-400 leading-relaxed"
        />
      )}

      {/* Image */}
      {tab === "image" && (
        <div className="flex flex-col gap-3">
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleImageChange} className="hidden" />
          {imagePreview ? (
            <div className="relative rounded-xl overflow-hidden border border-slate-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagePreview} alt={T.previewImageAlt} className="w-full max-h-64 object-cover" />
              <button onClick={clearImage}
                className="absolute top-2 left-2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <button onClick={() => cameraInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-3 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl py-4 font-semibold text-sm transition-colors">
                <Camera className="w-5 h-5" />{T.takePicture}
              </button>
              <div className="flex items-center gap-3 text-xs text-slate-400 px-1">
                <div className="flex-1 h-px bg-slate-200" />
                <span>{T.or}</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>
              <button onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-3 border-2 border-dashed border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 text-slate-500 hover:text-emerald-600 rounded-xl py-4 text-sm font-medium transition-all duration-200">
                <FolderOpen className="w-5 h-5" />{T.uploadFromGallery}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Audio */}
      {tab === "audio" && (
        <div className="flex flex-col items-center gap-4 py-4">
          {!audioBlob ? (
            <div className="flex flex-col items-center gap-3">
              {recording && (
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-red-500 font-mono font-semibold">{formatTime(recordingTime)}</span>
                </div>
              )}
              {!recording ? (
                <button onClick={startRecording}
                  className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-2xl font-medium transition-colors">
                  <Mic className="w-5 h-5" />{T.startRecording}
                </button>
              ) : (
                <button onClick={stopRecording}
                  className="flex items-center gap-2 bg-slate-700 hover:bg-slate-800 text-white px-6 py-3 rounded-2xl font-medium transition-colors">
                  <StopCircle className="w-5 h-5" />{T.stopRecording}
                </button>
              )}
              {!recording && (
                <p className="text-sm text-slate-400 text-center max-w-xs">{T.voiceHint}</p>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 w-full">
              <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-sm font-medium">{T.recordingComplete(formatTime(recordingTime))}</span>
              </div>
              <button onClick={() => { setAudioBlob(null); setRecordingTime(0); setResult(null); }}
                className="text-sm text-slate-400 hover:text-slate-600 underline">
                {T.recordAgain}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-3 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{error}</span>
        </div>
      )}

      {/* Success */}
      {success && (
        <div className="mt-3 flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-emerald-700">
          <CheckCircle2 className="w-4 h-4 shrink-0" /><span>{T.mealAdded}</span>
        </div>
      )}

      {!result && !success && (
        <button onClick={handleAnalyze} disabled={!canAnalyze || analyzing}
          className="mt-4 w-full py-3 rounded-xl bg-emerald-500 text-white font-bold flex items-center justify-center gap-2 hover:bg-emerald-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          {analyzing ? (
            <><Loader2 className="w-5 h-5 animate-spin" />{T.analyzing}</>
          ) : (
            <><Send className="w-5 h-5" />{T.analyze}</>
          )}
        </button>
      )}

      {result && !success && (
        <ResultPreview result={result} onAdd={handleAdd} onDiscard={() => setResult(null)} adding={adding} />
      )}
    </div>
  );
}
