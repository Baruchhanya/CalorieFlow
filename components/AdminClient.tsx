"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Shield, ShieldCheck, UserPlus, Trash2, Loader2, ArrowLeft,
  AlertCircle, Crown, Mail, BarChart3, RefreshCw, Sparkles,
} from "lucide-react";
import { useLang } from "@/lib/i18n/context";
import { useToast } from "@/lib/toast/context";
import type { AdminStatsResponse, UserStat } from "@/app/api/admin/stats/route";

interface AllowedUser {
  id: string;
  email: string;
  is_admin: boolean;
  is_env_admin: boolean;
  added_by: string | null;
  created_at: string;
}

interface ListResponse {
  envAdmins: string[];
  users: AllowedUser[];
  me: { email: string; is_admin: boolean };
}

interface AdminClientProps {
  meEmail: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AdminClient({ meEmail }: AdminClientProps) {
  const { T, lang } = useLang();
  const { showToast } = useToast();

  const [users, setUsers] = useState<AllowedUser[]>([]);
  const [envAdmins, setEnvAdmins] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [error, setError] = useState("");

  const [stats, setStats] = useState<AdminStatsResponse | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState("");

  const isHe = lang === "he";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        showToast(body.error || (isHe ? "שגיאה בטעינת משתמשים" : "Failed to load users"), "error");
        return;
      }
      const data: ListResponse = await res.json();
      setUsers(data.users);
      setEnvAdmins(data.envAdmins);
    } finally {
      setLoading(false);
    }
  }, [showToast, isHe]);

  useEffect(() => { load(); }, [load]);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError("");
    try {
      const res = await fetch("/api/admin/stats");
      if (!res.ok) {
        setStatsError(T.adminStatsError);
        return;
      }
      setStats(await res.json());
    } catch {
      setStatsError(T.adminStatsError);
    } finally {
      setStatsLoading(false);
    }
  }, [T]);

  useEffect(() => { loadStats(); }, [loadStats]);

  const addUser = async () => {
    setError("");
    const email = newEmail.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      setError(T.adminInvalidEmail);
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, is_admin: newIsAdmin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || T.adminAddFailed);
        return;
      }
      setUsers((prev) => [...prev, data]);
      setNewEmail("");
      setNewIsAdmin(false);
      showToast(T.adminUserAdded(email), "success");
    } finally {
      setAdding(false);
    }
  };

  const removeUser = async (u: AllowedUser) => {
    if (!confirm(T.adminConfirmRemove(u.email))) return;
    setBusyId(u.id);
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        showToast(body.error || T.adminRemoveFailed, "error");
        return;
      }
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
      showToast(T.adminUserRemoved(u.email), "info");
    } finally {
      setBusyId(null);
    }
  };

  const toggleAdmin = async (u: AllowedUser) => {
    setBusyId(u.id);
    try {
      const desired = !u.is_admin;
      // Env super-admins without a DB row: create a row so the DB can override
      // their admin flag (env still keeps them allowed).
      if (u.id.startsWith("env:")) {
        const res = await fetch("/api/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: u.email, is_admin: desired }),
        });
        const data = await res.json();
        if (!res.ok) {
          showToast(data.error || T.adminUpdateFailed, "error");
          return;
        }
        setUsers((prev) => [...prev, data]);
        return;
      }

      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_admin: desired }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || T.adminUpdateFailed, "error");
        return;
      }
      setUsers((prev) => prev.map((x) => (x.id === u.id ? data : x)));
    } finally {
      setBusyId(null);
    }
  };

  const fmtCost = (usd: number) =>
    usd >= 1
      ? `$${usd.toFixed(2)}`
      : usd >= 0.01
      ? `$${usd.toFixed(3)}`
      : usd > 0
      ? `<$0.01`
      : `$0`;

  const fmtNum = (n: number) => n.toLocaleString();

  const fmtRelative = (iso: string | null): string => {
    if (!iso) return T.adminStatsNever;
    const ms = Date.now() - new Date(iso).getTime();
    const m = Math.round(ms / 60000);
    if (m < 1) return isHe ? "עכשיו" : "now";
    if (m < 60) return isHe ? `לפני ${m} דק׳` : `${m}m ago`;
    const h = Math.round(m / 60);
    if (h < 24) return isHe ? `לפני ${h} שע׳` : `${h}h ago`;
    const d = Math.round(h / 24);
    if (d < 30) return isHe ? `לפני ${d} ימים` : `${d}d ago`;
    const mo = Math.round(d / 30);
    return isHe ? `לפני ${mo} חוד׳` : `${mo}mo ago`;
  };

  const userLastActive = (u: UserStat) => {
    const candidates = [u.last_gemini_at, u.last_meal_at, u.last_sign_in].filter(Boolean) as string[];
    if (candidates.length === 0) return null;
    return candidates.reduce((a, b) => (a > b ? a : b));
  };

  const allRows = [
    // env super-admins that don't have a DB row — show them as locked rows on top
    ...envAdmins
      .filter((e) => !users.some((u) => u.email.toLowerCase() === e))
      .map<AllowedUser>((email) => ({
        id: `env:${email}`,
        email,
        is_admin: true,
        is_env_admin: true,
        added_by: null,
        created_at: "",
      })),
    ...users,
  ];

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <header className="sticky top-0 z-40 bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <a
            href="/"
            className="p-1.5 rounded-xl hover:bg-white/15 transition-colors"
            aria-label={isHe ? "חזרה לבית" : "Back to home"}
          >
            <ArrowLeft className="w-5 h-5 rtl:scale-x-[-1]" />
          </a>
          <div className="flex items-center gap-2 min-w-0">
            <Shield className="w-5 h-5 shrink-0" />
            <div className="min-w-0">
              <h1 className="text-base font-black leading-tight truncate">{T.adminPageTitle}</h1>
              <p className="text-[11px] text-emerald-100 truncate">{T.adminPageSubtitle}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 flex flex-col gap-4">
        {/* Add new user */}
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-3">
            <UserPlus className="w-4 h-4 text-emerald-500" />
            {T.adminAddTitle}
          </h2>
          <p className="text-xs text-slate-500 mb-3 leading-relaxed">{T.adminAddHint}</p>

          {error && (
            <div className="mb-3 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{error}</span>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <div className="relative">
              <Mail className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 text-slate-400 pointer-events-none" />
              <input
                value={newEmail}
                onChange={(e) => { setNewEmail(e.target.value); setError(""); }}
                onKeyDown={(e) => { if (e.key === "Enter" && !adding) addUser(); }}
                type="email"
                inputMode="email"
                autoComplete="off"
                placeholder={T.adminEmailPlaceholder}
                disabled={adding}
                dir="ltr"
                className="w-full rounded-xl border border-slate-200 ps-10 pe-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:opacity-50"
              />
            </div>

            <label className="flex items-center gap-2 px-1 select-none cursor-pointer">
              <input
                type="checkbox"
                checked={newIsAdmin}
                onChange={(e) => setNewIsAdmin(e.target.checked)}
                disabled={adding}
                className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-400"
              />
              <span className="text-sm text-slate-600 flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5 text-amber-500" />
                {T.adminGrantAdmin}
              </span>
            </label>

            <button
              type="button"
              onClick={addUser}
              disabled={adding || !newEmail.trim()}
              className="mt-1 w-full min-h-[48px] py-3 rounded-xl bg-emerald-500 text-white font-bold flex items-center justify-center gap-2 hover:bg-emerald-600 active:scale-[0.98] touch-manipulation transition-all disabled:opacity-50"
            >
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              {adding ? T.adminAdding : T.adminAddButton}
            </button>
          </div>
        </section>

        {/* Usage Statistics */}
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="px-5 pt-5 pb-3 border-b border-slate-100 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-500" />
                {T.adminStatsTitle}
              </h2>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">{T.adminStatsSubtitle}</p>
            </div>
            <button
              type="button"
              onClick={loadStats}
              disabled={statsLoading}
              title={T.adminStatsRefresh}
              className="shrink-0 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition-colors"
            >
              {statsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </button>
          </div>

          {statsError ? (
            <div className="p-5 text-sm text-red-600 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> {statsError}
            </div>
          ) : statsLoading && !stats ? (
            <div className="p-5 flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" style={{ opacity: 1 - i * 0.15 }} />
                ))}
              </div>
              <div className="h-32 bg-slate-100 rounded-xl animate-pulse opacity-40 mt-2" />
            </div>
          ) : stats ? (
            <>
              {/* Global summary tiles */}
              <div className="px-5 pt-4 pb-2 grid grid-cols-2 gap-2">
                <div className="bg-indigo-50 rounded-xl p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-700/70">{T.adminStatsCallsToday}</p>
                  <p className="text-lg font-black text-indigo-900 mt-0.5">{fmtNum(stats.global.gemini_calls_today)}</p>
                </div>
                <div className="bg-emerald-50 rounded-xl p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700/70">{T.adminStatsCostToday}</p>
                  <p className="text-lg font-black text-emerald-900 mt-0.5">{fmtCost(stats.global.gemini_cost_usd_today)}</p>
                </div>
                <div className="bg-violet-50 rounded-xl p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-violet-700/70">{T.adminStatsCalls30d}</p>
                  <p className="text-lg font-black text-violet-900 mt-0.5">{fmtNum(stats.global.gemini_calls_30d)}</p>
                </div>
                <div className="bg-amber-50 rounded-xl p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700/80">{T.adminStatsCost30d}</p>
                  <p className="text-lg font-black text-amber-900 mt-0.5">{fmtCost(stats.global.gemini_cost_usd_30d)}</p>
                </div>
              </div>

              {/* Secondary line */}
              <div className="px-5 pb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                <span>{T.adminStatsCallsTotal}: <span className="font-bold text-slate-700">{fmtNum(stats.global.gemini_calls_total)}</span></span>
                <span>·</span>
                <span>{T.adminStatsCostTotal}: <span className="font-bold text-slate-700">{fmtCost(stats.global.gemini_cost_usd_total)}</span></span>
                {stats.global.gemini_errors_30d > 0 && (
                  <>
                    <span>·</span>
                    <span className="text-red-600">{T.adminStatsErrors30d}: <span className="font-bold">{fmtNum(stats.global.gemini_errors_30d)}</span></span>
                  </>
                )}
                {stats.global.gemini_avg_duration_ms_30d !== null && (
                  <>
                    <span>·</span>
                    <span>{T.adminStatsAvgDuration}: <span className="font-bold text-slate-700">{(stats.global.gemini_avg_duration_ms_30d / 1000).toFixed(1)}s</span></span>
                  </>
                )}
              </div>

              {/* Per-user table */}
              <div className="border-t border-slate-100 px-2 sm:px-5 py-3">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 px-3 mb-2">{T.adminStatsPerUserTitle}</h3>
                {stats.users.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">{T.adminStatsNoUsers}</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {stats.users.map((u) => {
                      const lastActive = userLastActive(u);
                      const hasGemini = u.gemini_calls_total > 0;
                      return (
                        <li key={u.email} className="bg-slate-50 rounded-xl p-3 flex flex-col gap-2">
                          <div className="flex items-center justify-between gap-2 min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate min-w-0" dir="ltr">{u.email}</p>
                            <span className="text-[10px] text-slate-400 shrink-0">{fmtRelative(lastActive)}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-[11px]">
                            <div>
                              <p className="text-slate-400">{T.adminStatsColMeals}</p>
                              <p className="font-bold text-slate-800">{fmtNum(u.meals_total)}<span className="text-slate-400 font-normal text-[10px]"> ({fmtNum(u.meals_30d)}/30י)</span></p>
                            </div>
                            <div>
                              <p className="text-slate-400">{T.adminStatsColDays}</p>
                              <p className="font-bold text-slate-800">{fmtNum(u.days_tracked)}</p>
                            </div>
                            <div>
                              <p className="text-slate-400 flex items-center gap-1"><Sparkles className="w-3 h-3 text-violet-400" />{T.adminStatsColGeminiCalls}</p>
                              <p className={`font-bold ${hasGemini ? "text-violet-700" : "text-slate-400"}`}>
                                {fmtNum(u.gemini_calls_total)}
                                <span className="text-slate-400 font-normal text-[10px]"> ({fmtNum(u.gemini_calls_30d)}/30י)</span>
                              </p>
                            </div>
                          </div>
                          {hasGemini && (
                            <div className="flex items-center justify-between gap-2 text-[11px] pt-1 border-t border-slate-200">
                              <span className="text-slate-500">{T.adminStatsColTokens}: <span className="font-bold text-slate-700">{fmtNum(u.gemini_tokens_30d)}</span></span>
                              <span className="text-slate-500">{T.adminStatsColCost}: <span className="font-bold text-emerald-700">{fmtCost(u.gemini_cost_usd_30d)}</span></span>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </>
          ) : null}
        </section>

        {/* Users list */}
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="px-5 pt-5 pb-3 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-800">
              {T.adminListTitle}{" "}
              <span className="text-slate-400 font-medium">({allRows.length})</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{T.adminListHint}</p>
          </div>

          {loading ? (
            <div className="p-5 flex flex-col gap-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" style={{ opacity: 1 - i * 0.2 }} />
              ))}
            </div>
          ) : allRows.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">{T.adminEmpty}</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {allRows.map((u) => {
                const isMe = u.email.toLowerCase() === meEmail.toLowerCase();
                const isEnvListed = u.is_env_admin;
                const busy = busyId === u.id;
                // Self-demote protection mirrors the server side.
                const disableToggle = busy || (isMe && u.is_admin);

                return (
                  <li key={u.id} className="px-5 py-3 flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      u.is_admin ? "bg-gradient-to-br from-amber-400 to-orange-500 text-white" : "bg-slate-100 text-slate-500"
                    }`}>
                      {u.email.slice(0, 2).toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate flex items-center gap-1.5" dir="ltr">
                        {u.email}
                        {isMe && (
                          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                            {isHe ? "אתה" : "you"}
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                        {u.is_admin ? (
                          <span className="inline-flex items-center gap-1 text-amber-600 font-semibold">
                            <ShieldCheck className="w-3 h-3" />
                            {T.adminRoleAdmin}
                          </span>
                        ) : (
                          <span className="text-slate-500 font-medium">{T.adminRoleUser}</span>
                        )}
                        {isEnvListed && (
                          <span
                            title={T.adminEnvHint}
                            className="inline-flex items-center gap-0.5 text-[10px] font-bold uppercase text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded"
                          >
                            <Crown className="w-3 h-3" /> {isHe ? "מהגדרות שרת" : "env"}
                          </span>
                        )}
                        {!isEnvListed && u.added_by && (
                          <span className="text-slate-400">· {isHe ? `נוסף ע״י ${u.added_by}` : `by ${u.added_by}`}</span>
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleAdmin(u)}
                        disabled={disableToggle}
                        title={u.is_admin ? T.adminDemote : T.adminPromote}
                        className={`min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl border text-xs font-bold transition-colors disabled:opacity-40 ${
                          u.is_admin
                            ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                            : "border-slate-200 text-slate-500 hover:bg-slate-50"
                        }`}
                      >
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crown className="w-4 h-4" />}
                      </button>
                      {!isEnvListed && !isMe && (
                        <button
                          type="button"
                          onClick={() => removeUser(u)}
                          disabled={busy}
                          title={T.adminRemove}
                          className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-colors disabled:opacity-40"
                        >
                          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <p className="text-[11px] text-slate-400 text-center px-4 leading-relaxed">
          {T.adminFooter}
        </p>
      </main>
    </div>
  );
}
