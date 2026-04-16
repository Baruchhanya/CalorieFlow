# CalorieFlow – יומן תזונה אישי מבוסס AI

> הזן אוכל בטקסט, תמונה, או קול – Gemini AI מנתח, מחשב ושומר את הנתונים התזונתיים שלך.  
> גישה מאובטחת עם Google Login + email allowlist.

---

## תכונות

| תכונה | פרטים |
|-------|--------|
| **Google Login** | Supabase Auth – כניסה עם חשבון Google |
| **Email Allowlist** | רק אימייל מורשה יכול לגשת |
| **ניתוח AI** | Gemini 2.0 Flash – תומך בטקסט, תמונה, וקול |
| **3 שיטות קלט** | טקסט / צילום / העלאת תמונה / הקלטת קול |
| **סיכום יומי** | גלגל קלוריות + פסי חלבון/פחמימות/שומן |
| **ניווט תאריכים** | חצי ← → לגלישה בין ימים |
| **היסטוריה** | כל הימים מקובצים לפי חודש עם סטטיסטיקות |
| **עריכה ומחיקה** | עריכת כל ארוחה שמורה |
| **עברית + אנגלית** | מעבר שפה בלחיצה, RTL מלא |
| **RLS** | Row Level Security ב-Supabase – כל משתמש רואה רק את הנתונים שלו |
| **מסד נתונים** | Supabase PostgreSQL |

---

## דרישות מקדימות

- **Node.js 18+**
- **חשבון Supabase** (חינמי) – [supabase.com](https://supabase.com)
- **מפתח Gemini API** (חינמי) – [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
- **Google Cloud Project** (להגדרת OAuth)

---

## הקמה מקומית (Step by Step)

### 1. שכפל והתקן

```bash
git clone https://github.com/YOUR_USERNAME/CalorieFlow.git
cd CalorieFlow
npm install
```

### 2. הגדרת Supabase

#### א. צור פרויקט חדש
1. לך ל-[supabase.com](https://supabase.com) → **New Project**
2. בחר שם, סיסמה למסד הנתונים, ואזור גיאוגרפי
3. המתן לסיום יצירת הפרויקט (~2 דקות)

#### ב. הרץ את ה-Schema
1. **Supabase Dashboard** → **SQL Editor** → **New Query**
2. העתק את תוכן `supabase-schema.sql` (בשורש הפרויקט)
3. לחץ **Run**

```sql
-- מה ה-schema יוצר:
-- ✓ טבלת meals עם כל השדות
-- ✓ Row Level Security (RLS)
-- ✓ פוליסות: כל משתמש רואה/עורך רק את הנתונים שלו
-- ✓ אינדקס לחיפוש מהיר לפי תאריך
-- ✓ Trigger לעדכון updated_at אוטומטי
```

#### ג. הפעל Google OAuth
1. **Supabase Dashboard** → **Authentication** → **Providers** → **Google**
2. הפעל (Enable)
3. קבל Client ID ו-Client Secret מ-[Google Cloud Console](https://console.cloud.google.com):
   - **APIs & Services** → **Credentials** → **Create OAuth 2.0 Client**
   - Application type: **Web application**
   - Authorized redirect URIs: הוסף:
     - `https://your-project-id.supabase.co/auth/v1/callback`
4. הכנס את ה-Client ID ו-Secret ב-Supabase

#### ד. הוסף Redirect URL
**Supabase** → **Authentication** → **URL Configuration** → **Redirect URLs**:
```
http://localhost:3000/auth/callback
https://your-app.vercel.app/auth/callback
```

#### ה. קבל את מפתחות ה-API
**Supabase Dashboard** → **Project Settings** → **API**:
- `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
- `anon / public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 3. הגדר משתני סביבה

```bash
cp .env.example .env.local
```

ערוך `.env.local`:

```env
# Gemini – חובה, שרת בלבד
GEMINI_API_KEY=AIza...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...

# האימייל היחיד שמורשה להיכנס
NEXT_PUBLIC_ALLOWED_EMAIL=your@gmail.com
```

### 4. הרץ

```bash
npm run dev
```

פתח [http://localhost:3000](http://localhost:3000) → לחץ "כניסה עם Google" 🎉

---

## מבנה הפרויקט

```
CalorieFlow/
├── app/
│   ├── api/
│   │   ├── analyze/route.ts        ← POST: Gemini (server-side only, auth protected)
│   │   ├── entries/
│   │   │   ├── route.ts            ← GET list | POST create (Supabase)
│   │   │   └── [id]/route.ts       ← PUT update | DELETE (Supabase)
│   │   └── history/route.ts        ← GET aggregated history
│   ├── auth/callback/route.ts      ← Google OAuth callback
│   ├── history/page.tsx            ← History page
│   ├── login/page.tsx              ← Login page
│   ├── globals.css                 ← Tailwind + RTL
│   ├── layout.tsx                  ← Root layout with LangProvider
│   └── page.tsx                    ← Server component (reads searchParams)
│
├── components/
│   ├── HomeClient.tsx              ← Main page client (date nav, sign-out, lang)
│   ├── DailySummary.tsx            ← Calorie ring + macro bars
│   ├── FoodInput.tsx               ← Tabs: text / image / voice
│   ├── MealCard.tsx                ← Meal card with edit/delete
│   └── EditModal.tsx               ← Edit modal
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts               ← Browser Supabase client
│   │   └── server.ts               ← Server Supabase client (cookies)
│   ├── i18n/
│   │   ├── translations.ts         ← Hebrew + English strings
│   │   └── context.tsx             ← LangContext + useLang() hook
│   └── gemini.ts                   ← analyzeText / analyzeImage / analyzeAudio
│
├── types/index.ts                  ← TypeScript interfaces
├── proxy.ts                        ← Next.js 16 proxy (auth + email check)
├── supabase-schema.sql             ← Run in Supabase SQL Editor
├── .env.example                    ← Template for env vars
├── vercel.json                     ← Vercel config
└── README.md
```

---

## משתני סביבה

| שם | היכן | תיאור |
|----|------|--------|
| `GEMINI_API_KEY` | שרת בלבד | מפתח Gemini – לא נחשף ללקוח |
| `NEXT_PUBLIC_SUPABASE_URL` | לקוח + שרת | כתובת פרויקט Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | לקוח + שרת | מפתח ציבורי של Supabase (בטוח עם RLS) |
| `NEXT_PUBLIC_ALLOWED_EMAIL` | לקוח + שרת | האימייל היחיד המורשה (השאר ריק לכולם) |

---

## פריסה ל-Vercel

### אפשרות א׳ – Dashboard (מומלץ)

1. דחוף לגיטהאב:
```bash
git init
git add .
git commit -m "feat: initial CalorieFlow setup"
git remote add origin https://github.com/YOUR_USERNAME/CalorieFlow.git
git push -u origin main
```

2. לך ל-[vercel.com](https://vercel.com) → **Add New Project** → בחר repo

3. הוסף Environment Variables בהגדרות Vercel:

| שם | ערך |
|----|-----|
| `GEMINI_API_KEY` | המפתח מ-aistudio.google.com |
| `NEXT_PUBLIC_SUPABASE_URL` | מ-Supabase Project Settings |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | מ-Supabase Project Settings |
| `NEXT_PUBLIC_ALLOWED_EMAIL` | האימייל שלך |

4. לחץ **Deploy** ✅

5. אחרי ה-deploy, הוסף את ה-URL של Vercel ל-Supabase Redirect URLs:
   ```
   https://your-app.vercel.app/auth/callback
   ```

### אפשרות ב׳ – Vercel CLI

```bash
npx vercel
npx vercel env add GEMINI_API_KEY
npx vercel env add NEXT_PUBLIC_SUPABASE_URL
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
npx vercel env add NEXT_PUBLIC_ALLOWED_EMAIL
npx vercel --prod
```

---

## אבטחה

| שכבה | מנגנון |
|-------|--------|
| **Auth** | Supabase OAuth – Google Login בלבד |
| **Email Allowlist** | `proxy.ts` בודק כל request ומבלוק משתמשים לא מורשים |
| **RLS** | PostgreSQL Row Level Security – כל משתמש רואה רק את הנתונים שלו |
| **Gemini API** | נמצא בשרת בלבד, לא ב-client bundle |
| **Anon Key** | בטוח לחשיפה ציבורית – RLS מגן על הנתונים |

---

## Gemini API – פירוט

**מה נשלח (שרת בלבד):**
```json
{
  "type": "text" | "image" | "audio",
  "text": "...",
  "data": "base64...",
  "mimeType": "image/jpeg"
}
```

**מה Gemini מחזיר:**
```json
{
  "items": [
    { "name": "שם", "quantity": "200g", "calories": 350, "protein_g": 25, "carbs_g": 40, "fat_g": 12 }
  ],
  "total_calories": 350,
  "needs_clarification": false,
  "note": "הערות"
}
```

---

## מגבלות ודרכי עקיפה

| מגבלה | פתרון |
|--------|--------|
| הקלטת קול דורשת HTTPS | Chrome עובד על localhost; Vercel מספק HTTPS אוטומטי |
| Gemini rate limit (חינמי) | ~15 req/min – מספיק לשימוש אישי |
| צילום מצלמה במובייל | עובד מהקופסה דרך `capture="environment"` |

---

## טכנולוגיות

| שכבה | טכנולוגיה |
|------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS 4 |
| Auth | Supabase Auth (Google OAuth) |
| Database | Supabase PostgreSQL + RLS |
| AI | Google Gemini 2.0 Flash |
| Icons | Lucide React |
| Deploy | Vercel |

---

## רישיון

MIT
