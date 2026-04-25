"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Shield, ShieldCheck, UserPlus, Trash2, Loader2, ArrowLeft,
  AlertCircle, Crown, Mail,
} from "lucide-react";
import { useLang } from "@/lib/i18n/context";
import { useToast } from "@/lib/toast/context";

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
