"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import dynamic from "next/dynamic";
import { ArrowRight, Scale, TrendingDown, TrendingUp, Plus, Trash2, Calendar, Pencil } from "lucide-react";
import { useLang } from "@/lib/i18n/context";
import { useToast } from "@/lib/toast/context";
import { getToday, offsetDate } from "@/lib/dates";
import {
  computeWeeklyAverages,
  weekStartIso,
  WEIGHT_SOURCE_LABELS,
  type WeightEntry,
  type WeightWeek,
} from "@/lib/weight";
import type { ChartDay } from "@/app/api/weight-chart/route";

const ChartSkeleton = ({ height }: { height: number }) => (
  <div className="rounded-xl bg-line/60 animate-pulse-soft" style={{ height }} />
);

const WeightAreaChart = dynamic(
  () => import("@/components/weight/WeightCharts").then((m) => m.WeightAreaChart),
  { ssr: false, loading: () => <ChartSkeleton height={200} /> }
);
const BalanceBarChart = dynamic(
  () => import("@/components/weight/WeightCharts").then((m) => m.BalanceBarChart),
  { ssr: false, loading: () => <ChartSkeleton height={180} /> }
);

function parseIsoDate(iso: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return { y, m: mo, d };
}

function daysInMonth(y: number, month: number) {
  return new Date(y, month, 0).getDate();
}

/** Build ISO date; clamps day to valid day-of-month. */
function toIso(y: number, m: number, d: number): string {
  const dim = daysInMonth(y, m);
  const dd = Math.min(Math.max(1, d), dim);
  return `${y}-${String(m).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

function todayParts() {
  const n = new Date();
  return { y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate() };
}

const MONTH_NAMES_HE = ["ינו׳", "פבר׳", "מרץ", "אפר׳", "מאי", "יוני", "יולי", "אוג׳", "ספט׳", "אוק׳", "נוב׳", "דצמ׳"] as const;
const MONTH_NAMES_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

function formatDayLabel(dateStr: string, lang: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString(lang === "he" ? "he-IL" : "en-US", { month: "short", day: "numeric" });
}

const CHART_DAY_WIDTH = 44;
const CHART_WEEK_WIDTH = 64;

type ChartPeriod = "1m" | "2m" | "max";

const PERIOD_DAYS: Record<Exclude<ChartPeriod, "max">, number> = {
  "1m": 30,
  "2m": 60,
};

function filterChartByPeriod(days: ChartDay[], period: ChartPeriod): ChartDay[] {
  if (period === "max" || days.length === 0) return days;
  const cutoff = offsetDate(getToday(), -(PERIOD_DAYS[period] - 1));
  return days.filter((d) => d.date >= cutoff);
}

function filterWeeksByPeriod(weeks: WeightWeek[], period: ChartPeriod): WeightWeek[] {
  if (period === "max" || weeks.length === 0) return weeks;
  const cutoffDay = offsetDate(getToday(), -(PERIOD_DAYS[period] - 1));
  const cutoffWeek = weekStartIso(cutoffDay);
  return weeks.filter((w) => w.weekStart >= cutoffWeek);
}

function useChartScrollWidth(pointCount: number, pointWidth: number, period: ChartPeriod) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(320);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setContainerWidth(el.clientWidth));
    ro.observe(el);
    setContainerWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const chartWidth = period === "max"
    ? Math.max(containerWidth, pointCount * pointWidth)
    : containerWidth;
  const isScrollable = period === "max" && chartWidth > containerWidth;

  return { containerRef, chartWidth, isScrollable };
}

// Custom tooltips live in components/weight/WeightCharts.tsx (lazy-loaded with recharts).

export function WeightTrackerPage() {
  const router = useRouter();
  const { lang } = useLang();
  const { showToast } = useToast();
  const [chartData, setChartData] = useState<ChartDay[]>([]);
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [weightInput, setWeightInput] = useState("");
  const [logDate, setLogDate] = useState(getToday);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>("2m");

  // Mi Fitness integration state
  const [mifitStatus, setMifitStatus] = useState<{ connected: boolean; lastSync: string | null } | null>(null);
  const [mifitEmail, setMifitEmail] = useState("");
  const [mifitPassword, setMifitPassword] = useState("");
  const [mifitRegion, setMifitRegion] = useState<"eu" | "us" | "de" | "cn">("us");
  const [mifitConnecting, setMifitConnecting] = useState(false);
  const [mifitSyncing, setMifitSyncing] = useState(false);
  const [mifitDisconnecting, setMifitDisconnecting] = useState(false);
  const [mifitManualMode, setMifitManualMode] = useState(false);
  const [mifitManualToken, setMifitManualToken] = useState("");
  const [mifitManualUserId, setMifitManualUserId] = useState("");
  const [mifitApiError, setMifitApiError] = useState<string | null>(null);

  const T = lang === "he" ? {
    title: "מעקב משקל",
    subtitle: "כל התצוגות הן ממוצע שבועי (לפי שבוע קלנדרי)",
    logWeight: "הזן משקל",
    weightLabel: "משקל (ק״ג)",
    save: "שמור",
    saving: "שומר...",
    weightChart: "ממוצע משקל שבועי",
    balanceChart: "מאזן קלורי יומי",
    deficit: "גרעון",
    surplus: "עודף",
    kg: "ק״ג",
    kcal: 'קק"ל',
    noData: "אין נתונים עדיין",
    noDataDesc: "הזן את המשקל הראשון שלך למעלה",
    current: "נוכחי",
    min: "מינימום",
    max: "מקסימום",
    change: "שינוי",
    history: "יומן שקילות (כניסות בודדות)",
    today: "היום",
    avgBalance: "מאזן ממוצע",
    trend: "מגמה",
    trendDown: "ירידה ↓",
    trendUp: "עלייה ↑",
    trendFlat: "יציב ↔",
    placeholder: "75.3",
    deleteConfirm: "למחוק שקילה זו?",
    logDateLabel: "תאריך השקילה",
    onePerDayHint: "משקל אחד לכל יום — שמירה חוזרת באותו תאריך מחליפה את הערך",
    editThisDay: "ערוך יום זה",
    dateDay: "יום",
    dateMonth: "חודש",
    dateYear: "שנה",
    dateOrderHint: "סדר אירופי: יום · חודש · שנה (משמאל לימין)",
    weightSection: "משקל",
    saveWeighIn: "שמור שקילה",
    scrollChartsHint: "גלול ימינה ושמאלה לראות את כל ההיסטוריה",
    period1m: "חודש",
    period2m: "חודשיים",
    periodMax: "מקסימום",
    mifitTitle: "Mi Fitness / Zepp Life",
    mifitDesc: "התחבר למשקל שיאומי שלך לסנכרון אוטומטי.",
    mifitEmailLabel: "אימייל Mi Fitness",
    mifitPasswordLabel: "סיסמה",
    mifitConnectBtn: "התחבר",
    mifitConnecting: "מתחבר...",
    mifitDisconnectBtn: "נתק חשבון",
    mifitSyncBtn: "סנכרן עכשיו",
    mifitSyncing: "מסנכרן...",
    mifitConnected: "מחובר",
    mifitNotConnected: "לא מחובר",
    mifitLastSync: (d: string) => `סנכרון אחרון: ${d}`,
    mifitSyncSuccess: (n: number) => `סונכרנו ${n} שקילות`,
    mifitSyncNone: "אין שקילות חדשות",
    mifitConnectError: "שגיאה בהתחברות",
    mifitConnectSuccess: "החשבון חובר",
    mifitDisconnectSuccess: "החשבון נותק",
    mifitRegionLabel: "אזור שרת",
    mifitManualMode: "הזנה ידנית (apptoken)",
    mifitAutoMode: "אימייל וסיסמה",
    mifitTokenLabel: "apptoken",
    mifitUserIdLabel: "userId",
    mifitTokenHint: "מופק מ-user.huami.com/privacy2 (ראה הוראות)",
  } : {
    title: "Weight Tracking",
    subtitle: "All values are weekly averages (calendar week)",
    logWeight: "Log Weight",
    weightLabel: "Weight (kg)",
    save: "Save",
    saving: "Saving...",
    weightChart: "Weekly Weight Average",
    balanceChart: "Daily Caloric Balance",
    deficit: "Deficit",
    surplus: "Surplus",
    kg: "kg",
    kcal: "kcal",
    noData: "No data yet",
    noDataDesc: "Enter your first weight above",
    current: "Current",
    min: "Min",
    max: "Max",
    change: "Change",
    history: "Weigh-in Log (raw)",
    today: "Today",
    avgBalance: "Avg. Balance",
    trend: "Trend",
    trendDown: "Losing ↓",
    trendUp: "Gaining ↑",
    trendFlat: "Stable ↔",
    placeholder: "75.3",
    deleteConfirm: "Delete this weigh-in?",
    logDateLabel: "Weigh-in date",
    onePerDayHint: "One weight per day — saving again for the same date replaces it",
    editThisDay: "Edit this day",
    dateDay: "Day",
    dateMonth: "Month",
    dateYear: "Year",
    dateOrderHint: "European order: day · month · year (left to right)",
    weightSection: "Weight",
    saveWeighIn: "Save weigh-in",
    scrollChartsHint: "Scroll left and right to see full history",
    period1m: "1 Month",
    period2m: "2 Months",
    periodMax: "Max",
    mifitTitle: "Mi Fitness / Zepp Life",
    mifitDesc: "Connect your Xiaomi scale for automatic sync.",
    mifitEmailLabel: "Mi Fitness email",
    mifitPasswordLabel: "Password",
    mifitConnectBtn: "Connect",
    mifitConnecting: "Connecting…",
    mifitDisconnectBtn: "Disconnect account",
    mifitSyncBtn: "Sync now",
    mifitSyncing: "Syncing…",
    mifitConnected: "Connected",
    mifitNotConnected: "Not connected",
    mifitLastSync: (d: string) => `Last sync: ${d}`,
    mifitSyncSuccess: (n: number) => `${n} weigh-in${n === 1 ? "" : "s"} synced`,
    mifitSyncNone: "No new weigh-ins",
    mifitConnectError: "Connection failed",
    mifitConnectSuccess: "Account connected",
    mifitDisconnectSuccess: "Account disconnected",
    mifitRegionLabel: "Server region",
    mifitManualMode: "Enter token manually",
    mifitAutoMode: "Email & password",
    mifitTokenLabel: "apptoken",
    mifitUserIdLabel: "userId",
    mifitTokenHint: "From user.huami.com/privacy2 (see instructions)",
  };

  const periodLabels: Record<ChartPeriod, string> = {
    "1m": T.period1m,
    "2m": T.period2m,
    max: T.periodMax,
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [chartRes, entriesRes] = await Promise.all([
        fetch("/api/weight-chart", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/weight", { cache: "no-store" }).then((r) => r.json()),
      ]);
      setChartData(chartRes.days ?? []);
      setEntries(Array.isArray(entriesRes) ? entriesRes : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Load Mi Fitness connection status
  useEffect(() => {
    fetch("/api/integrations/mifit")
      .then((r) => r.json())
      .then((d) => setMifitStatus({ connected: !!d.connected, lastSync: d.lastSync ?? null }))
      .catch(() => {});
  }, []);

  const handleMifitConnect = useCallback(async () => {
    if (!mifitEmail || !mifitPassword) return;
    setMifitConnecting(true);
    setMifitApiError(null);
    try {
      const res = await fetch("/api/integrations/mifit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: mifitEmail, password: mifitPassword }),
      });
      const json = await res.json() as { connected?: boolean; error?: string };
      if (res.ok) {
        setMifitStatus({ connected: true, lastSync: null });
        setMifitEmail("");
        setMifitPassword("");
        showToast(T.mifitConnectSuccess, "success");
      } else {
        setMifitApiError(json.error ?? T.mifitConnectError);
      }
    } finally {
      setMifitConnecting(false);
    }
  }, [mifitEmail, mifitPassword, showToast, T]);

  const handleMifitConnectManual = useCallback(async () => {
    if (!mifitManualToken || !mifitManualUserId) return;
    setMifitConnecting(true);
    setMifitApiError(null);
    try {
      const res = await fetch("/api/integrations/mifit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appToken: mifitManualToken, userId: mifitManualUserId }),
      });
      const json = await res.json() as { connected?: boolean; error?: string };
      if (res.ok) {
        setMifitStatus({ connected: true, lastSync: null });
        setMifitManualToken("");
        setMifitManualUserId("");
        setMifitManualMode(false);
        showToast(T.mifitConnectSuccess, "success");
      } else {
        setMifitApiError(json.error ?? T.mifitConnectError);
      }
    } finally {
      setMifitConnecting(false);
    }
  }, [mifitManualToken, mifitManualUserId, showToast, T]);

  const handleMifitDisconnect = useCallback(async () => {
    setMifitDisconnecting(true);
    try {
      await fetch("/api/integrations/mifit", { method: "DELETE" });
      setMifitStatus({ connected: false, lastSync: null });
      showToast(T.mifitDisconnectSuccess, "success");
    } finally {
      setMifitDisconnecting(false);
    }
  }, [showToast, T]);

  const handleMifitSync = useCallback(async () => {
    setMifitSyncing(true);
    try {
      const res = await fetch("/api/integrations/mifit/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ region: mifitRegion, days: 90 }),
      });
      const json = await res.json() as { synced?: number; error?: string };
      if (res.ok) {
        const now = new Date().toISOString();
        setMifitStatus((prev) => prev ? { ...prev, lastSync: now } : { connected: true, lastSync: now });
        showToast(json.synced ? T.mifitSyncSuccess(json.synced) : T.mifitSyncNone, "success");
        if (json.synced) fetchData();
      } else {
        showToast(json.error ?? T.mifitConnectError, "error");
      }
    } finally {
      setMifitSyncing(false);
    }
  }, [mifitRegion, showToast, T, fetchData]);

  /* מילוי/ניקוי לפי תאריך: אם יש רשומה ליום — מציגים אותה; אם כבר יש נתונים בשרת אבל לא ליום הזה — שדה ריק; לא מאפסים כש-entries עדיין [] לפני טעינה ראשונה */
  useEffect(() => {
    const ex = entries.find((e) => e.date === logDate);
    if (ex) {
      setWeightInput(String(Number(ex.weight_kg).toFixed(1)));
    } else if (entries.length > 0) {
      setWeightInput("");
    }
  }, [logDate, entries]);

  const handleSave = async () => {
    const val = parseFloat(weightInput);
    if (isNaN(val) || val < 20 || val > 300) return;
    setSaving(true);
    try {
      await fetch("/api/weight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weight_kg: val, date: logDate }),
      });
      await fetchData();
      const dLabel = formatDayLabel(logDate, lang);
      showToast(
        lang === "he" ? `נשמר: ${dLabel}` : `Saved: ${dLabel}`,
        "success"
      );
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(T.deleteConfirm)) return;
    setDeleting(id);
    await fetch(`/api/weight?id=${id}`, { method: "DELETE" });
    await fetchData();
    setDeleting(null);
    showToast(lang === "he" ? "השקילה נמחקה" : "Weigh-in removed", "info");
  };

  // Weekly averages: calendar week (Sun-Sat), one point per week that has entries
  const weeklyWeights = useMemo(() => computeWeeklyAverages(entries), [entries]);

  // Stats (based on weekly averages, matching the chart)
  const weeklyAvgs = weeklyWeights.map((w) => w.avg_kg);
  const currentWeight = weeklyAvgs.at(-1) ?? null;
  const firstWeight = weeklyAvgs.at(0) ?? null;
  const minWeight = weeklyAvgs.length ? Math.min(...weeklyAvgs) : null;
  const maxWeight = weeklyAvgs.length ? Math.max(...weeklyAvgs) : null;
  const totalChange = currentWeight != null && firstWeight != null ? currentWeight - firstWeight : null;

  const filteredChartData = useMemo(
    () => filterChartByPeriod(chartData, chartPeriod),
    [chartData, chartPeriod]
  );
  const filteredWeeklyWeights = useMemo(
    () => filterWeeksByPeriod(weeklyWeights, chartPeriod),
    [weeklyWeights, chartPeriod]
  );

  const periodWeightValues = filteredWeeklyWeights.map((w) => w.avg_kg);
  const periodTrend = periodWeightValues.length >= 2
    ? periodWeightValues.at(-1)! - periodWeightValues.at(0)!
    : 0;
  const trendLabel = Math.abs(periodTrend) < 0.3 ? T.trendFlat : periodTrend < 0 ? T.trendDown : T.trendUp;

  // Balance stats for selected period (still per-day)
  const balanceDays = filteredChartData.filter((d) => d.balance != null);
  const avgBalance = balanceDays.length
    ? Math.round(balanceDays.reduce((s, d) => s + d.balance!, 0) / balanceDays.length)
    : null;

  // Y-axis domain for weekly weight chart (tight zoom)
  const weightMin = periodWeightValues.length ? Math.floor(Math.min(...periodWeightValues) - 1) : 50;
  const weightMax = periodWeightValues.length ? Math.ceil(Math.max(...periodWeightValues) + 1) : 100;

  const hasWeightData = weeklyWeights.length > 0;
  const hasChartData = chartData.length > 0 || weeklyWeights.length > 0;
  const hasPeriodChartData = filteredChartData.length > 0;
  const hasPeriodWeeklyData = filteredWeeklyWeights.length > 0;

  const {
    containerRef: weightChartContainerRef,
    chartWidth: weightChartWidth,
    isScrollable: isWeightScrollable,
  } = useChartScrollWidth(filteredWeeklyWeights.length, CHART_WEEK_WIDTH, chartPeriod);
  const {
    containerRef: balanceChartContainerRef,
    chartWidth: balanceChartWidth,
    isScrollable: isBalanceScrollable,
  } = useChartScrollWidth(filteredChartData.length, CHART_DAY_WIDTH, chartPeriod);
  const isScrollable = isWeightScrollable || isBalanceScrollable;
  const weightScrollRef = useRef<HTMLDivElement>(null);
  const balanceScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = weightScrollRef.current;
    if (el && isWeightScrollable) el.scrollLeft = el.scrollWidth - el.clientWidth;
  }, [filteredWeeklyWeights, chartPeriod, isWeightScrollable]);

  useEffect(() => {
    const el = balanceScrollRef.current;
    if (el && isBalanceScrollable) el.scrollLeft = el.scrollWidth - el.clientWidth;
  }, [filteredChartData, chartPeriod, isBalanceScrollable]);

  const tp = todayParts();
  const dm = parseIsoDate(logDate) ?? parseIsoDate(getToday())!;
  const monthNames = lang === "he" ? MONTH_NAMES_HE : MONTH_NAMES_EN;
  const yMin = Math.min(tp.y - 15, dm.y);
  const years: number[] = [];
  for (let y = tp.y; y >= yMin; y--) years.push(y);

  const maxMonthForYear = (y: number) => (y < tp.y ? 12 : tp.m);
  const maxDayForMonth = (y: number, m: number) => {
    const dim = daysInMonth(y, m);
    if (y < tp.y || (y === tp.y && m < tp.m)) return dim;
    if (y === tp.y && m === tp.m) return Math.min(dim, tp.d);
    return 1;
  };

  const setDateFromParts = (y: number, m: number, d: number) => {
    const yClamped = Math.min(y, tp.y);
    const mMax = maxMonthForYear(yClamped);
    const mClamped = Math.min(Math.max(1, m), mMax);
    const dMax = maxDayForMonth(yClamped, mClamped);
    const dClamped = Math.min(Math.max(1, d), dMax);
    const iso = toIso(yClamped, mClamped, dClamped);
    const t = getToday();
    setLogDate(iso > t ? t : iso);
  };

  const maxDayCurrent = maxDayForMonth(dm.y, dm.m);
  const monthOptions = Array.from({ length: maxMonthForYear(dm.y) }, (_, i) => i + 1);

  // Current-week hero: this-week avg + delta from previous week
  const thisWeekStart = weekStartIso(getToday());
  const thisWeek = weeklyWeights.find((w) => w.weekStart === thisWeekStart);
  const prevWeek = thisWeek
    ? [...weeklyWeights].reverse().find((w) => w.weekStart < thisWeek.weekStart)
    : null;
  const thisWeekDelta = thisWeek && prevWeek ? thisWeek.avg_kg - prevWeek.avg_kg : null;
  const thisWeekRangeLabel = thisWeek
    ? (() => {
        const [, mS, dS] = thisWeek.weekStart.split("-");
        const [, mE, dE] = thisWeek.weekEnd.split("-");
        return `${dS}/${mS}–${dE}/${mE}`;
      })()
    : (() => {
        const start = thisWeekStart;
        const end = offsetDate(start, 6);
        const [, mS, dS] = start.split("-");
        const [, mE, dE] = end.split("-");
        return `${dS}/${mS}–${dE}/${mE}`;
      })();
  const thisWeekCountLabel = thisWeek
    ? (lang === "he"
        ? `ממוצע של ${thisWeek.count} ${thisWeek.count === 1 ? "שקילה" : "שקילות"}`
        : `avg of ${thisWeek.count} weigh-in${thisWeek.count === 1 ? "" : "s"}`)
    : (lang === "he" ? "אין שקילות השבוע — הוסף אחת למטה" : "No weigh-ins this week — add one below");

  return (
    <div className="min-h-screen bg-canvas">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-surface border-b border-line">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.push("/")}
            className="p-2 rounded-xl bg-canvas hover:bg-line/60 text-ink-2 transition-colors">
            <ArrowRight className="w-5 h-5" />
          </button>
          <Image src="/logo.png" alt="CalorieFlow" width={36} height={36} className="rounded-xl shrink-0" />
          <div>
            <h1 className="text-xl font-bold text-ink leading-tight">{T.title}</h1>
            <p className="text-ink-3 text-xs">{T.subtitle}</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 flex flex-col gap-5 pb-12">
        {/* Weekly average hero */}
        <div className="rounded-(--radius-card) p-5 shadow-(--shadow-card) border border-brand-100 bg-brand-50">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-surface flex items-center justify-center shrink-0">
              <Scale className="w-4 h-4 text-brand-600" />
            </div>
            <h2 className="text-[11px] font-semibold text-ink-3 uppercase tracking-widest">
              {lang === "he" ? "ממוצע שבועי — השבוע" : "Weekly average — this week"}
            </h2>
          </div>
          <div className="flex items-end gap-3 flex-wrap">
            <p className="text-5xl font-bold leading-none text-ink tabular-nums">
              {thisWeek ? thisWeek.avg_kg.toFixed(1) : "–"}
              <span className="text-lg font-semibold text-ink-3 ms-1.5">{T.kg}</span>
            </p>
            {thisWeekDelta != null && (
              <span
                className={`text-xs font-bold px-2 py-1 rounded-full tabular-nums ${
                  Math.abs(thisWeekDelta) < 0.05
                    ? "bg-canvas text-ink-2"
                    : thisWeekDelta < 0
                    ? "bg-good/10 text-good"
                    : "bg-over/10 text-over"
                }`}
              >
                {thisWeekDelta > 0 ? "+" : ""}
                {thisWeekDelta.toFixed(1)} {T.kg}{" "}
                <span className="font-medium opacity-75">
                  {lang === "he" ? "מהשבוע הקודם" : "vs last week"}
                </span>
              </span>
            )}
          </div>
          <p className="mt-2 text-xs text-ink-2">
            <span className="font-semibold text-ink-2 tabular-nums">{thisWeekRangeLabel}</span>
            <span className="mx-1.5 text-ink-3/60">·</span>
            <span>{thisWeekCountLabel}</span>
          </p>
        </div>

        {/* Input card */}
        <div className="bg-surface rounded-(--radius-card) shadow-(--shadow-card) border border-line p-5 space-y-6">
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-brand-600 shrink-0" />
            <h2 className="text-[11px] font-semibold text-ink-3 uppercase tracking-widest">{T.logWeight}</h2>
          </div>

          {/* Date: native selects = always correct DD / MM / YYYY order, no RTL quirks */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-bold text-ink-2 uppercase tracking-wide">
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              {T.logDateLabel}
            </label>
            <div
              dir="ltr"
              className="rounded-xl border-2 border-line bg-canvas p-3 sm:p-4 transition-colors focus-within:border-brand-500 focus-within:bg-surface focus-within:ring-2 focus-within:ring-brand-500/25"
              style={{ unicodeBidi: "isolate" }}
            >
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <div className="min-w-0">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-ink-3">
                    {T.dateDay}
                  </span>
                  <select
                    aria-label={T.dateDay}
                    value={dm.d}
                    onChange={(e) => setDateFromParts(dm.y, dm.m, Number(e.target.value))}
                    className="h-11 w-full min-w-0 cursor-pointer rounded-xl border border-line bg-surface px-2 text-center text-base font-bold tabular-nums text-ink focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
                  >
                    {Array.from({ length: maxDayCurrent }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>
                        {String(d).padStart(2, "0")}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="min-w-0">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-ink-3">
                    {T.dateMonth}
                  </span>
                  <select
                    aria-label={T.dateMonth}
                    value={dm.m}
                    onChange={(e) => setDateFromParts(dm.y, Number(e.target.value), dm.d)}
                    className="h-11 w-full min-w-0 cursor-pointer rounded-xl border border-line bg-surface px-2 text-center text-sm font-semibold text-ink focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25 sm:text-base"
                  >
                    {monthOptions.map((m) => (
                      <option key={m} value={m}>
                        {String(m).padStart(2, "0")} — {monthNames[m - 1]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="min-w-0">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-ink-3">
                    {T.dateYear}
                  </span>
                  <select
                    aria-label={T.dateYear}
                    value={dm.y}
                    onChange={(e) => setDateFromParts(Number(e.target.value), dm.m, dm.d)}
                    className="h-11 w-full min-w-0 cursor-pointer rounded-xl border border-line bg-surface px-2 text-center text-base font-bold tabular-nums text-ink focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
                  >
                    {years.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="mt-2 text-center text-xs font-medium tabular-nums text-ink-2">
                {String(dm.d).padStart(2, "0")}/{String(dm.m).padStart(2, "0")}/{dm.y}
              </p>
            </div>
            <p className="text-[11px] text-ink-3 leading-relaxed">
              <span className="text-ink-2">{T.dateOrderHint}</span>
              <span className="mx-1.5 text-ink-3/60">·</span>
              <span>{T.onePerDayHint}</span>
            </p>
          </div>

          {/* Weight + save: numeric LTR island; full-width CTA */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-ink-2 uppercase tracking-wide block">
              {T.weightSection}
            </label>
            <div
              dir="ltr"
              className="flex min-h-[3.5rem] items-stretch rounded-xl border-2 border-line bg-canvas overflow-hidden transition-colors focus-within:border-brand-500 focus-within:bg-surface focus-within:ring-2 focus-within:ring-brand-500/25"
              style={{ unicodeBidi: "isolate" }}
            >
              <input
                type="number"
                step="0.1"
                min="20"
                max="300"
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                placeholder={T.placeholder}
                className="min-w-0 flex-1 border-0 bg-transparent px-4 py-3 text-2xl font-bold tabular-nums text-ink placeholder:text-ink-3/50 focus:outline-none focus:ring-0 text-start"
              />
              <span className="flex shrink-0 items-center border-s-2 border-line bg-line/40 px-4 text-sm font-bold text-ink-2">
                {T.kg}
              </span>
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !weightInput}
              dir="ltr"
              className="w-full min-h-[3.25rem] rounded-xl bg-brand-600 py-3.5 text-base font-bold text-white transition-colors hover:bg-brand-700 active:scale-[0.99] touch-manipulation disabled:opacity-40 disabled:active:scale-100 flex flex-row items-center justify-center gap-2"
            >
              {saving ? <Scale className="w-5 h-5 shrink-0 animate-pulse" /> : <Plus className="w-5 h-5 shrink-0" />}
              <span className="text-center" dir="auto">
                {saving ? T.saving : T.saveWeighIn}
              </span>
            </button>
          </div>
        </div>

        {/* Stats row */}
        {hasWeightData && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: T.current, value: currentWeight?.toFixed(1) ?? "–", unit: T.kg, color: "text-ink", bg: "bg-brand-50 text-brand-600", icon: <Scale className="w-4 h-4" /> },
              { label: T.change, value: totalChange != null ? `${totalChange > 0 ? "+" : ""}${totalChange.toFixed(1)}` : "–", unit: T.kg, color: totalChange! < 0 ? "text-good" : "text-over", bg: totalChange! < 0 ? "bg-good/10 text-good" : "bg-over/10 text-over", icon: totalChange! < 0 ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" /> },
              { label: T.min, value: minWeight?.toFixed(1) ?? "–", unit: T.kg, color: "text-ink", bg: "bg-good/10 text-good", icon: <TrendingDown className="w-4 h-4" /> },
              { label: T.max, value: maxWeight?.toFixed(1) ?? "–", unit: T.kg, color: "text-ink", bg: "bg-canvas text-ink-2", icon: <TrendingUp className="w-4 h-4" /> },
            ].map(s => (
              <div key={s.label} className="bg-surface rounded-(--radius-card) border border-line shadow-(--shadow-card) p-4">
                <div className={`w-8 h-8 rounded-xl ${s.bg} flex items-center justify-center mb-2`}>{s.icon}</div>
                <p className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.value}<span className="text-sm font-normal text-ink-3 ms-1">{s.unit}</span></p>
                <p className="text-xs text-ink-3 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Charts */}
        {hasChartData ? (
          <div className="flex flex-col gap-4">
            <div className="flex rounded-xl bg-line/50 p-1 gap-1" dir="ltr">
              {(["1m", "2m", "max"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setChartPeriod(p)}
                  className={`flex-1 min-h-[2.5rem] rounded-lg text-xs font-bold transition-colors touch-manipulation ${
                    chartPeriod === p
                      ? "bg-surface text-brand-700 shadow-(--shadow-card)"
                      : "text-ink-2 hover:text-ink"
                  }`}
                >
                  {periodLabels[p]}
                </button>
              ))}
            </div>
            {isScrollable && (
              <p className="text-xs text-ink-3 text-center px-2">{T.scrollChartsHint}</p>
            )}
            {/* Weight chart */}
            <div className="bg-surface rounded-(--radius-card) shadow-(--shadow-card) border border-line p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[11px] font-semibold text-ink-3 uppercase tracking-widest">{T.weightChart}</h3>
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${Math.abs(periodTrend) < 0.3 ? "bg-canvas text-ink-2" : periodTrend < 0 ? "bg-good/10 text-good" : "bg-over/10 text-over"}`}>
                  {trendLabel}
                </span>
              </div>
              {hasPeriodWeeklyData ? (
              <div ref={weightChartContainerRef}>
                <div
                  ref={weightScrollRef}
                  className="overflow-x-auto overflow-y-hidden -mx-1 px-1 overscroll-x-contain"
                  style={{ WebkitOverflowScrolling: "touch" }}
                  dir="ltr"
                >
                  <div style={{ width: weightChartWidth, minWidth: weightChartWidth }}>
                    <WeightAreaChart
                      width={weightChartWidth}
                      data={filteredWeeklyWeights}
                      yMin={weightMin}
                      yMax={weightMax}
                      lang={lang}
                    />
                  </div>
                </div>
              </div>
              ) : (
                <p className="text-sm text-ink-3 text-center py-8">{T.noData}</p>
              )}
            </div>

            {/* Balance chart */}
            <div className="bg-surface rounded-(--radius-card) shadow-(--shadow-card) border border-line p-5">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-[11px] font-semibold text-ink-3 uppercase tracking-widest">{T.balanceChart}</h3>
                {avgBalance !== null && (
                  <span className={`text-xs font-bold px-2 py-1 rounded-full tabular-nums ${avgBalance < 0 ? "bg-good/10 text-good" : "bg-over/10 text-over"}`}>
                    {T.avgBalance}: {avgBalance > 0 ? "+" : ""}{avgBalance.toLocaleString()} {T.kcal}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 mb-3 text-xs text-ink-3">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-good inline-block" /> {T.deficit}</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-over inline-block" /> {T.surplus}</span>
              </div>
              {hasPeriodChartData ? (
              <div ref={balanceChartContainerRef}>
              <div
                ref={balanceScrollRef}
                className="overflow-x-auto overflow-y-hidden -mx-1 px-1 overscroll-x-contain"
                style={{ WebkitOverflowScrolling: "touch" }}
                dir="ltr"
              >
                <div style={{ width: balanceChartWidth, minWidth: balanceChartWidth }}>
                <BalanceBarChart width={balanceChartWidth} data={filteredChartData} lang={lang} />
                </div>
              </div>
              </div>
              ) : (
                <p className="text-sm text-ink-3 text-center py-8">{T.noData}</p>
              )}
            </div>
          </div>
        ) : loading ? (
          <div className="bg-surface rounded-(--radius-card) border border-line shadow-(--shadow-card) p-12 text-center">
            <div className="w-8 h-8 border-4 border-brand-100 border-t-brand-600 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-ink-3 text-sm">טוען נתונים...</p>
          </div>
        ) : (
          <div className="bg-surface rounded-(--radius-card) border border-line shadow-(--shadow-card) p-12 text-center">
            <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Scale className="w-8 h-8 text-brand-500" />
            </div>
            <p className="text-ink font-bold">{T.noData}</p>
            <p className="text-ink-3 text-sm mt-1">{T.noDataDesc}</p>
          </div>
        )}

        {/* Weigh-in history log */}
        {entries.length > 0 && (
          <div className="bg-surface rounded-(--radius-card) shadow-(--shadow-card) border border-line overflow-hidden">
            <div className="px-5 py-4 border-b border-line">
              <h3 className="text-[11px] font-semibold text-ink-3 uppercase tracking-widest">{T.history}</h3>
            </div>
            <div className="divide-y divide-line/60 max-h-[28rem] overflow-y-auto">
              {[...entries].reverse().map((e) => {
                const idx = entries.findIndex(x => x.id === e.id);
                const prev = idx > 0 ? entries[idx - 1].weight_kg : null;
                const diff = prev != null ? e.weight_kg - prev : null;
                const isToday = e.date === getToday();
                return (
                  <div key={e.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="text-xs text-ink-3 w-20 shrink-0 tabular-nums">
                      {formatDayLabel(e.date, lang)}
                      {isToday && <span className="ms-1 text-brand-600 font-bold">·{lang === "he" ? "היום" : "today"}</span>}
                    </div>
                    <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                      e.source === "mifit"
                        ? "bg-warn/10 text-warn"
                        : "bg-canvas text-ink-3"
                    }`}>
                      {WEIGHT_SOURCE_LABELS[e.source === "mifit" ? "mifit" : "manual"][lang === "he" ? "he" : "en"]}
                    </span>
                    <p className="flex-1 font-bold text-ink min-w-0 tabular-nums">{Number(e.weight_kg).toFixed(1)}<span className="text-xs text-ink-3 font-normal ms-1">{T.kg}</span></p>
                    {diff != null && (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full tabular-nums ${Math.abs(diff) < 0.05 ? "bg-canvas text-ink-2" : diff < 0 ? "bg-good/10 text-good" : "bg-over/10 text-over"}`}>
                        {diff > 0 ? "+" : ""}{diff.toFixed(1)}
                      </span>
                    )}
                    <button type="button" title={T.editThisDay}
                      onClick={() => { setLogDate(e.date); setWeightInput(String(Number(e.weight_kg).toFixed(1))); }}
                      className="p-1.5 rounded-xl hover:bg-brand-50 text-ink-3 hover:text-brand-600 transition-colors touch-manipulation">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" onClick={() => handleDelete(e.id)} disabled={deleting === e.id}
                      className="p-1.5 rounded-xl hover:bg-over/10 text-ink-3 hover:text-over transition-colors touch-manipulation">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Mi Fitness / Zepp Life integration */}
        <div className="bg-surface rounded-(--radius-card) shadow-(--shadow-card) border border-line overflow-hidden">
          <div className="px-5 py-4 border-b border-line flex items-center gap-2">
            <Scale className="w-4 h-4 text-ink-3" />
            <h3 className="text-[11px] font-semibold text-ink-3 uppercase tracking-widest">{T.mifitTitle}</h3>
            <span className={`ms-auto text-xs font-semibold px-2 py-0.5 rounded-full ${mifitStatus?.connected ? "bg-brand-50 text-brand-700" : "bg-canvas text-ink-3"}`}>
              {mifitStatus?.connected ? T.mifitConnected : T.mifitNotConnected}
            </span>
          </div>

          <div className="p-5 space-y-4">
            <p className="text-sm text-ink-2">{T.mifitDesc}</p>

            {mifitStatus?.connected ? (
              <div className="space-y-3">
                {mifitStatus.lastSync && (
                  <p className="text-xs text-ink-3">
                    {T.mifitLastSync(new Date(mifitStatus.lastSync).toLocaleString(lang === "he" ? "he-IL" : "en-GB"))}
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-ink-2 whitespace-nowrap">{T.mifitRegionLabel}:</label>
                  <select
                    value={mifitRegion}
                    onChange={(e) => setMifitRegion(e.target.value as "eu" | "us" | "de" | "cn")}
                    className="text-xs border border-line rounded-lg px-2 py-1 text-ink bg-surface"
                  >
                    <option value="us">US (ברירת מחדל)</option>
                    <option value="eu">Europe (DE)</option>
                    <option value="de">Germany</option>
                    <option value="cn">China</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={handleMifitSync} disabled={mifitSyncing}
                    className="flex-1 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
                    {mifitSyncing ? T.mifitSyncing : T.mifitSyncBtn}
                  </button>
                  <button type="button" onClick={handleMifitDisconnect} disabled={mifitDisconnecting}
                    className="px-4 py-2.5 bg-canvas hover:bg-over/10 hover:text-over text-ink-2 text-sm font-semibold rounded-xl transition-colors">
                    {mifitDisconnecting ? "..." : T.mifitDisconnectBtn}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Toggle between auto (email/password) and manual (apptoken) */}
                <div className="flex rounded-xl border border-line overflow-hidden text-xs font-semibold">
                  <button type="button"
                    onClick={() => { setMifitManualMode(false); setMifitApiError(null); }}
                    className={`flex-1 py-2 transition-colors ${!mifitManualMode ? "bg-brand-600 text-white" : "text-ink-2 hover:bg-canvas"}`}>
                    {T.mifitAutoMode}
                  </button>
                  <button type="button"
                    onClick={() => { setMifitManualMode(true); setMifitApiError(null); }}
                    className={`flex-1 py-2 border-s border-line transition-colors ${mifitManualMode ? "bg-brand-600 text-white" : "text-ink-2 hover:bg-canvas"}`}>
                    {T.mifitManualMode}
                  </button>
                </div>

                {mifitApiError && (
                  <div className="rounded-xl bg-over/10 border border-over/20 px-4 py-2.5 text-xs text-over break-all">
                    {mifitApiError}
                  </div>
                )}

                {!mifitManualMode ? (
                  <>
                    <input type="email" value={mifitEmail} onChange={(e) => setMifitEmail(e.target.value)}
                      placeholder={T.mifitEmailLabel}
                      className="w-full border border-line rounded-xl px-4 py-2.5 text-sm text-ink placeholder:text-ink-3/50 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                      dir="ltr" />
                    <input type="password" value={mifitPassword} onChange={(e) => setMifitPassword(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleMifitConnect(); }}
                      placeholder={T.mifitPasswordLabel}
                      className="w-full border border-line rounded-xl px-4 py-2.5 text-sm text-ink placeholder:text-ink-3/50 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                      dir="ltr" />
                    <button type="button" onClick={handleMifitConnect}
                      disabled={mifitConnecting || !mifitEmail || !mifitPassword}
                      className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
                      {mifitConnecting ? T.mifitConnecting : T.mifitConnectBtn}
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-ink-3">{T.mifitTokenHint}</p>
                    <input type="text" value={mifitManualToken} onChange={(e) => setMifitManualToken(e.target.value)}
                      placeholder={T.mifitTokenLabel}
                      className="w-full border border-line rounded-xl px-4 py-2.5 text-xs text-ink placeholder:text-ink-3/50 focus:outline-none focus:ring-2 focus:ring-brand-500/40 font-mono"
                      dir="ltr" />
                    <input type="text" value={mifitManualUserId} onChange={(e) => setMifitManualUserId(e.target.value)}
                      placeholder={T.mifitUserIdLabel}
                      className="w-full border border-line rounded-xl px-4 py-2.5 text-sm text-ink placeholder:text-ink-3/50 focus:outline-none focus:ring-2 focus:ring-brand-500/40 font-mono"
                      dir="ltr" />
                    <button type="button" onClick={handleMifitConnectManual}
                      disabled={mifitConnecting || !mifitManualToken || !mifitManualUserId}
                      className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
                      {mifitConnecting ? T.mifitConnecting : T.mifitConnectBtn}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
