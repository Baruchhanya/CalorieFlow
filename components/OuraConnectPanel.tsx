"use client";

import { useState, useEffect, useCallback } from "react";
import { Activity, Loader2 } from "lucide-react";
import { useLang } from "@/lib/i18n/context";
import { useToast } from "@/lib/toast/context";

interface OuraStatus {
  connected: boolean;
  lastSync: string | null;
}

interface Props {
  /** The currently-viewed day (YYYY-MM-DD) — synced value for this date is pushed via onSynced. */
  date: string;
  /** Persist a freshly-synced active-calories value for `date`. */
  onSynced?: (caloriesBurned: number) => void;
}

export default function OuraConnectPanel({ date, onSynced }: Props) {
  const { lang } = useLang();
  const { showToast } = useToast();

  const [status, setStatus] = useState<OuraStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const T = lang === "he" ? {
    title: "Oura Ring",
    connect: "התחבר ל-Oura",
    connected: "מחובר",
    notConnected: "לא מחובר",
    lastSync: (d: string) => `סנכרון אחרון: ${d}`,
    syncBtn: "סנכרן עכשיו",
    syncing: "מסנכרן...",
    disconnectBtn: "נתק",
    syncSuccess: "הקלוריות עודכנו ליום הזה",
    syncNone: "אין נתונים ליום הזה מאורה",
    syncError: "שגיאה בסנכרון",
    disconnectSuccess: "החשבון נותק",
  } : {
    title: "Oura Ring",
    connect: "Connect to Oura",
    connected: "Connected",
    notConnected: "Not connected",
    lastSync: (d: string) => `Last sync: ${d}`,
    syncBtn: "Sync now",
    syncing: "Syncing…",
    disconnectBtn: "Disconnect",
    syncSuccess: "Burn updated for this day",
    syncNone: "No Oura data for this day",
    syncError: "Sync failed",
    disconnectSuccess: "Account disconnected",
  };

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations/oura");
      if (res.ok) setStatus(await res.json());
    } catch {
      // ignore — panel just shows "not connected"
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const handleConnect = () => {
    window.location.href = "/api/integrations/oura/authorize";
  };

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/integrations/oura/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      });
      const json = await res.json();
      if (res.ok) {
        showToast(json.synced ? T.syncSuccess : T.syncNone, "success");
        if (json.matched) onSynced?.(json.matched.calories_burned);
        await fetchStatus();
      } else {
        showToast(json.error ?? T.syncError, "error");
      }
    } catch {
      showToast(T.syncError, "error");
    } finally {
      setSyncing(false);
    }
  }, [date, onSynced, showToast, fetchStatus, T]);

  const handleDisconnect = useCallback(async () => {
    setDisconnecting(true);
    try {
      await fetch("/api/integrations/oura", { method: "DELETE" });
      setStatus({ connected: false, lastSync: null });
      showToast(T.disconnectSuccess, "success");
    } finally {
      setDisconnecting(false);
    }
  }, [showToast, T]);

  if (!status) return null;

  return (
    <div className="flex items-center justify-between gap-2 bg-surface border border-line rounded-xl px-3 py-2 text-xs">
      <div className="flex items-center gap-1.5 min-w-0">
        <Activity className="w-3.5 h-3.5 shrink-0 text-brand-600" />
        <span className="font-semibold text-ink truncate">{T.title}</span>
        {status.connected && status.lastSync && (
          <span className="text-ink-3 truncate hidden sm:inline">
            · {T.lastSync(new Date(status.lastSync).toLocaleString(lang === "he" ? "he-IL" : "en-GB"))}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {status.connected ? (
          <>
            <button
              type="button" onClick={handleSync} disabled={syncing}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand-600 text-white font-bold hover:bg-brand-700 disabled:opacity-50 transition-colors"
            >
              {syncing && <Loader2 className="w-3 h-3 animate-spin" />}
              {syncing ? T.syncing : T.syncBtn}
            </button>
            <button
              type="button" onClick={handleDisconnect} disabled={disconnecting}
              className="px-2.5 py-1 rounded-lg border border-line text-ink-2 hover:bg-canvas disabled:opacity-50 transition-colors"
            >
              {T.disconnectBtn}
            </button>
          </>
        ) : (
          <button
            type="button" onClick={handleConnect}
            className="px-2.5 py-1 rounded-lg bg-brand-600 text-white font-bold hover:bg-brand-700 transition-colors"
          >
            {T.connect}
          </button>
        )}
      </div>
    </div>
  );
}
