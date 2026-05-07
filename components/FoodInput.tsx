"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Type, Image as ImageIcon, Mic, Send, X, Plus, AlertCircle,
  Loader2, StopCircle, CheckCircle2, Camera, FolderOpen, PenLine,
  PencilLine, Trash2,
} from "lucide-react";
import { GeminiResponse, FoodItem } from "@/types";
import { useLang } from "@/lib/i18n/context";
import { useToast } from "@/lib/toast/context";
import MealPresets from "@/components/MealPresets";

type Tab = "text" | "image" | "audio" | "manual";

interface FoodInputProps {
  onEntriesAdded: () => void;
  currentDate?: string;
}

const MAX_IMAGES = 5;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB per file

interface SelectedImage {
  file: File;
  preview: string;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function compressImage(file: File, maxWidth = 1024, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(dataUrl.split(",")[1]);
      };
      img.onerror = reject;
      img.src = event.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function localDateStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
}

// ─── Selective Result Preview ────────────────────────────────────────────────

interface EditableItem extends FoodItem {
  selected: boolean;
  editedCalories: string;
}

interface ResultPreviewProps {
  result: GeminiResponse;
  onAdd: (items: FoodItem[]) => void;
  onDiscard: () => void;
  adding: boolean;
}

function ResultPreview({ result, onAdd, onDiscard, adding }: ResultPreviewProps) {
  const { T, lang } = useLang();
  const [items, setItems] = useState<EditableItem[]>(() =>
    result.items.map((item) => ({
      ...item,
      selected: true,
      editedCalories: String(Math.round(item.calories)),
    }))
  );

  const toggleItem = (i: number) =>
    setItems((prev) => prev.map((it, idx) => idx === i ? { ...it, selected: !it.selected } : it));

  const updateCalories = (i: number, val: string) =>
    setItems((prev) => prev.map((it, idx) => idx === i ? { ...it, editedCalories: val } : it));

  const removeItem = (i: number) =>
    setItems((prev) => prev.filter((_, idx) => idx !== i));

  const selectedItems = items.filter((it) => it.selected);
  const totalCal = selectedItems.reduce((s, it) => s + (Number(it.editedCalories) || it.calories), 0);

  const handleAdd = () => {
    const toAdd = selectedItems.map((it) => ({
      ...it,
      calories: Number(it.editedCalories) || it.calories,
    }));
    onAdd(toAdd);
  };

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
          {T.foundItems(items.length)}
        </p>

        {items.length === 0 && (
          <p className="text-xs text-slate-400 text-center py-2">
            {lang === "he" ? "כל הפריטים הוסרו — לחץ בטל כדי לנתח מחדש" : "All items removed — press Discard to start over"}
          </p>
        )}

        {items.map((item, i) => (
          <div key={i}
            className={`bg-white rounded-lg p-3 border transition-all duration-150 ${item.selected ? "border-emerald-200" : "border-slate-100 opacity-50"}`}>
            <div className="flex items-start gap-2">
              {/* Checkbox */}
              <button type="button" onClick={() => toggleItem(i)}
                className={`mt-0.5 min-w-[44px] min-h-[44px] -ms-2 -mt-1 flex items-center justify-center rounded-xl touch-manipulation active:scale-95 transition-transform shrink-0`}
                aria-pressed={item.selected}>
                <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${item.selected ? "bg-emerald-500 border-emerald-500" : "border-slate-300"}`}>
                  {item.selected && <CheckCircle2 className="w-3 h-3 text-white" />}
                </span>
              </button>

              {/* Name */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 text-sm truncate">{item.name}</p>
                {item.quantity && <p className="text-xs text-slate-400">{item.quantity}</p>}
                <p className="text-xs text-slate-400 mt-0.5">
                  {T.protein.slice(0,1)}:{Math.round(item.protein_g)}g {T.carbs.slice(0,1)}:{Math.round(item.carbs_g)}g {T.fat.slice(0,1)}:{Math.round(item.fat_g)}g
                </p>
              </div>

              {/* Editable calories */}
              <div className="flex items-center gap-1 shrink-0">
                <input
                  type="number"
                  value={item.editedCalories}
                  onChange={(e) => updateCalories(i, e.target.value)}
                  disabled={!item.selected}
                  className="w-16 text-center text-sm font-bold text-amber-600 border border-slate-200 rounded-lg px-1 py-1 focus:outline-none focus:ring-2 focus:ring-amber-300 disabled:opacity-40"
                />
                <span className="text-xs text-slate-400">{T.kcal}</span>
              </div>

              {/* Delete item */}
              <button
                type="button"
                onClick={() => removeItem(i)}
                aria-label={T.delete}
                className="min-w-[36px] min-h-[36px] -me-1 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-400 hover:bg-red-50 active:scale-95 touch-manipulation transition-all shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        <div className="flex justify-between items-center pt-1 border-t border-slate-100">
          <span className="text-sm font-semibold text-slate-600">{T.totalCalories}</span>
          <span className="text-lg font-bold text-emerald-600">{Math.round(totalCal)} {T.kcal}</span>
        </div>
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={onDiscard} disabled={adding}
          className="flex-1 min-h-[48px] py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 active:scale-[0.98] touch-manipulation transition-all flex items-center justify-center gap-1.5">
          <X className="w-4 h-4" />{T.discard}
        </button>
        <button type="button" onClick={handleAdd} disabled={adding || selectedItems.length === 0}
          className="flex-2 flex-grow-[2] min-h-[48px] py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 active:scale-[0.98] touch-manipulation transition-all flex items-center justify-center gap-1.5 disabled:opacity-60">
          {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          {adding ? T.adding : `${T.addToDiary} (${selectedItems.length})`}
        </button>
      </div>
    </div>
  );
}

// ─── Manual Entry Form ────────────────────────────────────────────────────────

interface ManualFormProps {
  onAdd: (item: FoodItem) => void;
  adding: boolean;
}

function ManualForm({ onAdd, adding }: ManualFormProps) {
  const { T } = useLang();
  const [name, setName] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    if (!name.trim()) { setError(T.manualNameRequired); return; }
    if (!calories || isNaN(Number(calories))) { setError(T.manualCaloriesRequired); return; }
    setError("");
    onAdd({
      name: name.trim(),
      quantity: "",
      calories: Number(calories),
      protein_g: Number(protein) || 0,
      carbs_g: Number(carbs) || 0,
      fat_g: Number(fat) || 0,
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">
          <AlertCircle className="w-4 h-4 shrink-0" />{error}
        </div>
      )}

      <input
        value={name} onChange={(e) => setName(e.target.value)}
        placeholder={T.manualName}
        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
      />

      {/* Calories – large & prominent */}
      <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <input
          type="number" value={calories} onChange={(e) => setCalories(e.target.value)}
          placeholder={T.manualCalories}
          className="flex-1 bg-transparent text-2xl font-black text-amber-600 focus:outline-none placeholder:text-amber-300"
          min={0}
        />
        <span className="text-amber-500 font-semibold text-sm">{T.kcal}</span>
      </div>

      {/* Optional macros */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { val: protein, set: setProtein, label: T.manualProtein },
          { val: carbs, set: setCarbs, label: T.manualCarbs },
          { val: fat, set: setFat, label: T.manualFat },
        ].map(({ val, set, label }) => (
          <div key={label} className="flex flex-col gap-1">
            <label className="text-[10px] text-slate-400 font-medium px-1">{label}</label>
            <input
              type="number" value={val} onChange={(e) => set(e.target.value)}
              placeholder="0"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-emerald-300"
              min={0}
            />
          </div>
        ))}
      </div>

      <button type="button" onClick={handleSubmit} disabled={adding}
        className="w-full min-h-[52px] py-3 rounded-xl bg-emerald-500 text-white font-bold flex items-center justify-center gap-2 hover:bg-emerald-600 active:scale-[0.98] touch-manipulation transition-all disabled:opacity-50">
        {adding ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
        {adding ? T.adding : T.manualAdd}
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FoodInput({ onEntriesAdded, currentDate }: FoodInputProps) {
  const { T, lang } = useLang();
  const { showToast } = useToast();
  const [tab, setTab] = useState<Tab>("text");
  const [text, setText] = useState("");
  const [images, setImages] = useState<SelectedImage[]>([]);
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [extraNote, setExtraNote] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<GeminiResponse | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const resultAnchorRef = useRef<HTMLDivElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const reset = useCallback(() => {
    setText(""); setImages([]); setAudioBlob(null);
    setRecording(false); setRecordingTime(0); setResult(null); setError("");
    setExtraNote("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  useEffect(() => {
    if (!result) return;
    requestAnimationFrame(() => {
      resultAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, [result]);

  const handleTabChange = (newTab: Tab) => { setTab(newTab); reset(); };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const incoming = Array.from(fileList);
    const remainingSlots = Math.max(0, MAX_IMAGES - images.length);

    if (remainingSlots === 0) {
      setError(T.maxImagesReached(MAX_IMAGES));
      e.target.value = "";
      return;
    }

    const accepted: File[] = [];
    let oversizedName: string | null = null;
    for (const file of incoming.slice(0, remainingSlots)) {
      if (file.size > MAX_IMAGE_BYTES) {
        oversizedName = file.name;
        continue;
      }
      accepted.push(file);
    }

    if (accepted.length === 0) {
      if (oversizedName) setError(T.imageTooLarge(oversizedName));
      e.target.value = "";
      return;
    }

    setResult(null);
    setError(oversizedName ? T.imageTooLarge(oversizedName) : "");

    Promise.all(
      accepted.map(
        (file) =>
          new Promise<SelectedImage>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve({ file, preview: reader.result as string });
            reader.onerror = reject;
            reader.readAsDataURL(file);
          })
      )
    )
      .then((next) => setImages((prev) => [...prev, ...next].slice(0, MAX_IMAGES)))
      .catch(() => setError(T.unknownError));

    e.target.value = "";
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setResult(null);
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
        if (images.length === 0) { setError(T.noImageError); return; }
        const encoded = await Promise.all(
          images.map(async (img) => ({
            data: await compressImage(img.file),
            mimeType: "image/jpeg",
          }))
        );
        body = {
          type: "image",
          images: encoded,
          note: extraNote.trim() || undefined,
        };
      } else {
        if (!audioBlob) { setError(T.noAudioError); return; }
        body = {
          type: "audio",
          data: await blobToBase64(audioBlob),
          mimeType: audioBlob.type,
          note: extraNote.trim() || undefined,
        };
      }
      // Tell Gemini which language to respond in for name/quantity/note
      body.lang = lang;
      const res = await fetch("/api/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await res.text();
        console.error("Non-JSON response:", text);
        throw new Error(res.status === 413 ? "התמונות גדולות מדי. נסה שוב." : T.error);
      }
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || T.error);
      if (!data.items?.length) throw new Error(T.noFoodError);
      setResult(data);
      showToast(
        lang === "he" ? "הניתוח מוכן — בחר מה להוסיף ליומן" : "Analysis ready — pick items to log",
        "success"
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : T.unknownError;
      showToast(msg, "error");
    } finally { setAnalyzing(false); }
  };

  const saveItems = async (items: FoodItem[]) => {
    setAdding(true);
    const date = currentDate ?? localDateStr();
    try {
      await Promise.all(items.map((item) =>
        fetch("/api/entries", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date, name: item.name, quantity: item.quantity || null,
            calories: item.calories, protein: item.protein_g,
            carbs: item.carbs_g, fat: item.fat_g,
            note: result?.note || null,
          }),
        })
      ));
      showToast(T.mealAdded, "success");
      onEntriesAdded();
      setTimeout(reset, 650);
    } catch {
      showToast(T.saveDiaryError, "error");
    }
    finally { setAdding(false); }
  };

  const canAnalyze =
    (tab === "text" && text.trim().length > 0) ||
    (tab === "image" && images.length > 0) ||
    (tab === "audio" && audioBlob !== null && !recording);

  const canAddMoreImages = images.length < MAX_IMAGES;

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const tabs = [
    { key: "text" as Tab, label: T.tabText, icon: <Type className="w-4 h-4" /> },
    { key: "image" as Tab, label: T.tabImage, icon: <ImageIcon className="w-4 h-4" /> },
    { key: "audio" as Tab, label: T.tabAudio, icon: <Mic className="w-4 h-4" /> },
    { key: "manual" as Tab, label: T.tabManual, icon: <PenLine className="w-4 h-4" /> },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
      <div className="mb-3">
        <h2 className="text-lg font-bold text-slate-800">{T.addMeal}</h2>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">{T.addMealQuickIntro}</p>
      </div>

      <div className="mb-4 -mx-1">
        <MealPresets currentDate={currentDate ?? localDateStr()} onAdded={onEntriesAdded} />
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-4 gap-1 bg-slate-100 rounded-xl p-1 mb-4">
        {tabs.map(({ key, label, icon }) => (
          <button key={key} type="button" onClick={() => handleTabChange(key)}
            className={`flex items-center justify-center gap-1.5 min-h-[44px] py-2 rounded-lg text-xs font-medium touch-manipulation active:scale-[0.97] transition-all duration-200 ${tab === key ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
            {icon}<span className="hidden sm:inline">{label}</span>
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
          <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageChange} className="hidden" />
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleImageChange} className="hidden" />

          {images.length > 0 ? (
            <>
              <div className="grid grid-cols-3 gap-2">
                {images.map((img, idx) => (
                  <div
                    key={`${img.file.name}-${idx}`}
                    className="relative rounded-xl overflow-hidden border border-slate-200 aspect-square bg-slate-50"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.preview}
                      alt={`${T.previewImageAlt} ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      aria-label={T.delete}
                      className="absolute top-1.5 left-1.5 bg-black/55 hover:bg-black/75 text-white rounded-full p-1.5 transition-colors touch-manipulation"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <span className="absolute bottom-1.5 end-1.5 bg-black/55 text-white text-[10px] leading-none px-1.5 py-1 rounded-md font-bold">
                      {idx + 1}/{images.length}
                    </span>
                  </div>
                ))}
              </div>

              <p className="text-xs text-slate-500 px-1">
                {images.length === 1 ? T.imageSelectedSingle : T.imagesSelected(images.length)}
              </p>

              {canAddMoreImages ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex-1 min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors active:scale-[0.98] touch-manipulation"
                  >
                    <Camera className="w-4 h-4" />{T.addMorePhoto}
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 text-slate-600 hover:text-emerald-600 text-sm font-medium transition-colors active:scale-[0.98] touch-manipulation"
                  >
                    <FolderOpen className="w-4 h-4" />{T.addMoreFromGallery}
                  </button>
                </div>
              ) : (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  {T.maxImagesReached(MAX_IMAGES)}
                </p>
              )}
            </>
          ) : (
            <div className="flex flex-col gap-2">
              <button onClick={() => cameraInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl py-4 font-semibold text-sm transition-colors">
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
              {!recording && <p className="text-sm text-slate-400 text-center max-w-xs">{T.voiceHint}</p>}
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

      {/* Manual */}
      {tab === "manual" && (
        <ManualForm onAdd={(item) => saveItems([item])} adding={adding} />
      )}

      {/* Optional extra context (image / audio) — helps Gemini refine the analysis */}
      {!result &&
        ((tab === "image" && images.length > 0) ||
          (tab === "audio" && audioBlob && !recording)) && (
          <div className="mt-3 flex flex-col gap-1.5 animate-in fade-in slide-in-from-bottom-1 duration-200">
            <label
              htmlFor="extra-context-note"
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 px-1"
            >
              <PencilLine className="w-3.5 h-3.5 text-emerald-500" />
              {T.extraNoteLabel}
            </label>
            <textarea
              id="extra-context-note"
              value={extraNote}
              onChange={(e) => setExtraNote(e.target.value)}
              placeholder={
                tab === "image"
                  ? T.extraNotePlaceholderImage
                  : T.extraNotePlaceholderAudio
              }
              rows={2}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent placeholder:text-slate-400 leading-relaxed"
            />
            <p className="text-[11px] text-slate-400 px-1">{T.extraNoteHint}</p>
          </div>
        )}

      {/* Error */}
      {error && tab !== "manual" && (
        <div className="mt-3 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{error}</span>
        </div>
      )}

      {/* Analyze button (non-manual tabs) */}
      {tab !== "manual" && !result && (
        <>
          <button type="button" onClick={handleAnalyze} disabled={!canAnalyze || analyzing}
            className="mt-4 w-full min-h-[52px] py-3.5 rounded-xl bg-emerald-500 text-white font-bold flex items-center justify-center gap-2 hover:bg-emerald-600 active:scale-[0.98] touch-manipulation transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100">
            {analyzing ? (
              <><Loader2 className="w-5 h-5 animate-spin" />{T.analyzing}</>
            ) : (
              <><Send className="w-5 h-5" />{T.analyze}</>
            )}
          </button>

          {/* Non-blocking hourglass overlay inside the card */}
          {analyzing && (
            <div className="mt-3 flex flex-col items-center gap-3 bg-emerald-50 border border-emerald-100 rounded-2xl p-5 animate-in fade-in duration-300">
              <div className="relative">
                <div className="w-14 h-14 rounded-full border-4 border-emerald-200 border-t-emerald-500 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center text-xl">⏳</div>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-emerald-700">{T.analyzing}</p>
                <p className="text-xs text-emerald-500 mt-0.5">
                  {tab === "image"
                    ? (lang === "he"
                        ? (images.length > 1
                            ? `Gemini מנתח ${images.length} תמונות יחד...`
                            : "Gemini מנתח את התמונה שלך...")
                        : (images.length > 1
                            ? `Gemini is analyzing ${images.length} photos together...`
                            : "Gemini is analyzing your image..."))
                    : (lang === "he" ? "Gemini מנתח את הארוחה שלך..." : "Gemini is analyzing your meal...")}
                </p>
              </div>
              <div className="flex gap-1">
                {[0,1,2,3,4].map(i => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {result && (
        <div ref={resultAnchorRef} className="scroll-mt-24">
          <ResultPreview
            result={result}
            onAdd={saveItems}
            onDiscard={() => setResult(null)}
            adding={adding}
          />
        </div>
      )}
    </div>
  );
}
