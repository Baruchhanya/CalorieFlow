import { Resend } from "resend";

export function getResend() {
  return new Resend(process.env.RESEND_API_KEY ?? "placeholder");
}

interface DailyReportData {
  toEmail: string;
  date: string;
  consumed: number;
  burned: number;
  goalCalories: number;
  meals: { name: string; calories: number }[];
}

export function buildDailyReportEmail(data: DailyReportData) {
  const { toEmail, date, consumed, burned, goalCalories, meals } = data;
  const net = consumed - burned;
  const diff = goalCalories - net;
  const isDeficit = diff > 0;
  const diffAbs = Math.abs(Math.round(diff));
  const balanceLabel = isDeficit ? "גרעון קלורי" : "עודף קלורי";
  const balanceColor = isDeficit ? "#10b981" : "#ef4444";
  const emoji = isDeficit ? "✅" : "⚠️";

  const dateObj = new Date(date + "T12:00:00");
  const dateHe = dateObj.toLocaleDateString("he-IL", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const mealsRows = meals.length > 0
    ? meals.map(m => `
        <tr>
          <td style="padding:6px 12px;border-bottom:1px solid #f1f5f9;color:#475569;">${m.name}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #f1f5f9;color:#64748b;text-align:center;">${Math.round(m.calories)}</td>
        </tr>`).join("")
    : `<tr><td colspan="2" style="padding:12px;color:#94a3b8;text-align:center;">לא נרשמו ארוחות</td></tr>`;

  const html = `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#059669,#0d9488);padding:28px 32px;text-align:center;">
      <div style="display:inline-block;background:rgba(255,255,255,0.2);border-radius:14px;padding:10px 18px;margin-bottom:12px;">
        <span style="color:#fff;font-size:22px;font-weight:900;letter-spacing:-0.5px;">CF</span>
      </div>
      <h1 style="margin:0;color:#fff;font-size:20px;font-weight:800;">דוח יומי – CalorieFlow</h1>
      <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">${dateHe}</p>
    </div>

    <!-- Balance banner -->
    <div style="background:${isDeficit ? "#f0fdf4" : "#fef2f2"};border-bottom:1px solid ${isDeficit ? "#bbf7d0" : "#fecaca"};padding:20px 32px;text-align:center;">
      <div style="font-size:36px;margin-bottom:6px;">${emoji}</div>
      <p style="margin:0;font-size:14px;color:#64748b;">${balanceLabel}</p>
      <p style="margin:4px 0 0;font-size:32px;font-weight:900;color:${balanceColor};">${diffAbs.toLocaleString()} <span style="font-size:16px;font-weight:600;">קק"ל</span></p>
    </div>

    <!-- Stats grid -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0;border-bottom:1px solid #f1f5f9;">
      ${[
        { label: "צרכת", value: Math.round(consumed), color: "#0f172a" },
        { label: "שרפת", value: Math.round(burned), color: "#f59e0b" },
        { label: "נטו", value: Math.round(net), color: "#6366f1" },
      ].map(s => `
        <div style="padding:16px 12px;text-align:center;border-left:1px solid #f1f5f9;">
          <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">${s.label}</p>
          <p style="margin:4px 0 0;font-size:22px;font-weight:800;color:${s.color};">${s.value.toLocaleString()}</p>
          <p style="margin:2px 0 0;font-size:10px;color:#cbd5e1;">קק"ל</p>
        </div>`).join("")}
    </div>

    <!-- Goal bar -->
    <div style="padding:20px 32px;border-bottom:1px solid #f1f5f9;">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
        <span style="font-size:13px;color:#64748b;">יעד יומי</span>
        <span style="font-size:13px;font-weight:700;color:#0f172a;">${goalCalories.toLocaleString()} קק"ל</span>
      </div>
      <div style="background:#e2e8f0;border-radius:99px;height:8px;overflow:hidden;">
        <div style="background:${isDeficit ? "#10b981" : "#ef4444"};height:100%;border-radius:99px;width:${Math.min((net / goalCalories) * 100, 100)}%;"></div>
      </div>
      <p style="margin:6px 0 0;font-size:11px;color:#94a3b8;text-align:left;">${Math.round((net / goalCalories) * 100)}% מהיעד</p>
    </div>

    <!-- Meals table -->
    <div style="padding:20px 32px;">
      <h3 style="margin:0 0 12px;font-size:14px;font-weight:700;color:#334155;">ארוחות היום</h3>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr>
            <th style="padding:6px 12px;text-align:right;font-size:12px;color:#94a3b8;font-weight:600;border-bottom:2px solid #f1f5f9;">שם</th>
            <th style="padding:6px 12px;text-align:center;font-size:12px;color:#94a3b8;font-weight:600;border-bottom:2px solid #f1f5f9;">קק"ל</th>
          </tr>
        </thead>
        <tbody>${mealsRows}</tbody>
      </table>
    </div>

    <!-- CTA -->
    <div style="padding:0 32px 28px;text-align:center;">
      <a href="${process.env.NEXT_PUBLIC_SUPABASE_URL ? "https://calorieflow-one.vercel.app" : "http://localhost:3000"}"
        style="display:inline-block;background:linear-gradient(135deg,#059669,#0d9488);color:#fff;text-decoration:none;padding:12px 28px;border-radius:12px;font-weight:700;font-size:14px;">
        פתח את CalorieFlow →
      </a>
    </div>

    <div style="background:#f8fafc;padding:14px 32px;text-align:center;border-top:1px solid #f1f5f9;">
      <p style="margin:0;font-size:11px;color:#cbd5e1;">CalorieFlow · Powered by Gemini AI</p>
    </div>
  </div>
</body>
</html>`;

  return { to: toEmail, subject: `${emoji} דוח קלורי יומי – ${dateHe}`, html };
}

export interface PeriodReportDay {
  date: string;
  balance: number;          // (consumed - burned) - goal, or acknowledgment value
  estimated?: boolean;      // true if from a day_acknowledgment rather than meal data
}

export interface PeriodReportData {
  toEmail: string;
  periodLabel: string;      // e.g. "שבועי", "חודשי"
  periodStart: string;      // YYYY-MM-DD
  periodEnd: string;        // YYYY-MM-DD (inclusive)
  days: PeriodReportDay[];
}

function formatDateHe(dateStr: string, withWeekday = false) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("he-IL", withWeekday
    ? { weekday: "short", day: "numeric", month: "long" }
    : { day: "numeric", month: "long", year: "numeric" });
}

function buildPeriodReportEmail(data: PeriodReportData, opts: { titleHe: string; subjectPrefix: string }) {
  const { toEmail, periodStart, periodEnd, days } = data;
  const trackedDays = days.length;
  const totalBalance = days.reduce((s, d) => s + d.balance, 0);
  const avgBalance = trackedDays > 0 ? totalBalance / trackedDays : 0;

  const isDeficit = totalBalance < 0;
  const totalAbs = Math.abs(Math.round(totalBalance));
  const avgAbs = Math.abs(Math.round(avgBalance));
  const balanceColor = isDeficit ? "#10b981" : totalBalance > 0 ? "#ef4444" : "#64748b";
  const balanceLabel = isDeficit ? "גרעון כולל" : totalBalance > 0 ? "עודף כולל" : "איזון";
  const avgLabel = avgBalance < 0 ? "גרעון יומי ממוצע" : avgBalance > 0 ? "עודף יומי ממוצע" : "ממוצע יומי";
  const emoji = isDeficit ? "✅" : totalBalance > 0 ? "⚠️" : "⚖️";

  const periodHe = `${formatDateHe(periodStart)} – ${formatDateHe(periodEnd)}`;

  const sortedDays = [...days].sort((a, b) => a.date < b.date ? -1 : 1);
  const rows = sortedDays.length > 0
    ? sortedDays.map(d => {
        const dayLabel = formatDateHe(d.date, true);
        const dayBalance = Math.round(d.balance);
        const dayColor = d.balance < 0 ? "#10b981" : d.balance > 0 ? "#ef4444" : "#64748b";
        const sign = d.balance < 0 ? "-" : d.balance > 0 ? "+" : "";
        const tag = d.estimated ? ` <span style="font-size:10px;color:#94a3b8;">(הערכה)</span>` : "";
        return `
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#475569;font-size:13px;">${dayLabel}${tag}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:${dayColor};text-align:center;font-weight:700;font-size:13px;">${sign}${Math.abs(dayBalance).toLocaleString()} קק"ל</td>
          </tr>`;
      }).join("")
    : `<tr><td colspan="2" style="padding:14px;color:#94a3b8;text-align:center;">אין נתונים לתקופה</td></tr>`;

  const html = `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#059669,#0d9488);padding:28px 32px;text-align:center;">
      <div style="display:inline-block;background:rgba(255,255,255,0.2);border-radius:14px;padding:10px 18px;margin-bottom:12px;">
        <span style="color:#fff;font-size:22px;font-weight:900;letter-spacing:-0.5px;">CF</span>
      </div>
      <h1 style="margin:0;color:#fff;font-size:20px;font-weight:800;">${opts.titleHe} – CalorieFlow</h1>
      <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">${periodHe}</p>
    </div>

    <!-- Balance banner -->
    <div style="background:${isDeficit ? "#f0fdf4" : totalBalance > 0 ? "#fef2f2" : "#f8fafc"};border-bottom:1px solid ${isDeficit ? "#bbf7d0" : totalBalance > 0 ? "#fecaca" : "#e2e8f0"};padding:20px 32px;text-align:center;">
      <div style="font-size:36px;margin-bottom:6px;">${emoji}</div>
      <p style="margin:0;font-size:14px;color:#64748b;">${balanceLabel}</p>
      <p style="margin:4px 0 0;font-size:32px;font-weight:900;color:${balanceColor};">${totalAbs.toLocaleString()} <span style="font-size:16px;font-weight:600;">קק"ל</span></p>
    </div>

    <!-- Stats grid -->
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:0;border-bottom:1px solid #f1f5f9;">
      <div style="padding:18px 12px;text-align:center;border-left:1px solid #f1f5f9;">
        <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">${avgLabel}</p>
        <p style="margin:4px 0 0;font-size:22px;font-weight:800;color:${balanceColor};">${avgAbs.toLocaleString()}</p>
        <p style="margin:2px 0 0;font-size:10px;color:#cbd5e1;">קק"ל / יום</p>
      </div>
      <div style="padding:18px 12px;text-align:center;">
        <p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">ימים נספרו</p>
        <p style="margin:4px 0 0;font-size:22px;font-weight:800;color:#0f172a;">${trackedDays}</p>
        <p style="margin:2px 0 0;font-size:10px;color:#cbd5e1;">ימים</p>
      </div>
    </div>

    <!-- Per-day breakdown -->
    <div style="padding:20px 32px;">
      <h3 style="margin:0 0 12px;font-size:14px;font-weight:700;color:#334155;">פירוט יומי</h3>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr>
            <th style="padding:6px 12px;text-align:right;font-size:12px;color:#94a3b8;font-weight:600;border-bottom:2px solid #f1f5f9;">תאריך</th>
            <th style="padding:6px 12px;text-align:center;font-size:12px;color:#94a3b8;font-weight:600;border-bottom:2px solid #f1f5f9;">גרעון / עודף</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>

    <!-- CTA -->
    <div style="padding:0 32px 28px;text-align:center;">
      <a href="${process.env.NEXT_PUBLIC_SUPABASE_URL ? "https://calorieflow-one.vercel.app" : "http://localhost:3000"}"
        style="display:inline-block;background:linear-gradient(135deg,#059669,#0d9488);color:#fff;text-decoration:none;padding:12px 28px;border-radius:12px;font-weight:700;font-size:14px;">
        פתח את CalorieFlow →
      </a>
    </div>

    <div style="background:#f8fafc;padding:14px 32px;text-align:center;border-top:1px solid #f1f5f9;">
      <p style="margin:0;font-size:11px;color:#cbd5e1;">CalorieFlow · Powered by Gemini AI</p>
    </div>
  </div>
</body>
</html>`;

  return { to: toEmail, subject: `${emoji} ${opts.subjectPrefix} – ${periodHe}`, html };
}

export function buildWeeklyReportEmail(data: PeriodReportData) {
  return buildPeriodReportEmail(data, { titleHe: "דוח שבועי", subjectPrefix: "דוח קלורי שבועי" });
}

export function buildMonthlyReportEmail(data: PeriodReportData) {
  return buildPeriodReportEmail(data, { titleHe: "דוח חודשי", subjectPrefix: "דוח קלורי חודשי" });
}
