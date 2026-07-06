/**
 * Mi Fitness / Zepp Life (Huami) API client.
 *
 * Reverse-engineered API — not affiliated with Xiaomi or Zepp Health.
 * Reference implementations:
 *   https://github.com/micw/hacking-mifit-api
 *   https://github.com/101mlevydev/pulsebridge (bio-bridge)
 */

const REGISTRATION_HOST = "api-user.huami.com";
const LOGIN_HOST = "account.huami.com";

// Regional API hosts (weight data). "eu" maps to DE2 — there is no api-mifit-eu host.
const MIFIT_HOSTS: Record<string, string> = {
  us: "api-mifit.huami.com",
  eu: "api-mifit-de2.huami.com",
  de: "api-mifit-de2.huami.com",
  cn: "api-mifit-cn2.huami.com",
};

/** Dedicated weight endpoint host (newer Mi Fitness / Zepp apps). */
const WEIGHT_HOSTS = [
  "api-mifit.zepp.com",
  "api-mifit.huami.com",
  "api-mifit-de2.huami.com",
  "api-mifit-de2.zepp.com",
  "api-mifit-cn2.huami.com",
];

export type MiFitRegion = keyof typeof MIFIT_HOSTS;

export interface MiFitCredentials {
  appToken: string;
  userId: string;
}

interface RegistrationTokenResponse {
  token_info: {
    access:       string;
    country_code: string;
  };
  error_info?: string;
}

interface LoginResponse {
  token_info: {
    app_token: string;
    user_id:   string;
    login_token?: string;
  };
  error_code?: number;
  error_info?: string;
}

/**
 * Step 1 — exchange email + password for a short-lived access token.
 */
async function getAccessToken(
  email: string,
  password: string,
): Promise<{ accessToken: string; countryCode: string }> {
  const encoded = encodeURIComponent(email);
  const url = `https://${REGISTRATION_HOST}/registrations/${encoded}/tokens`;

  const body = new URLSearchParams({
    client_id: "HuaMi_phone",
    password,
    redirect_uri: "https://s3-us-west-2.amazonaws.com/hm-registration/successsignin.html",
    token: "access",
  });

  const res = await fetch(url, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    body.toString(),
  });

  if (!res.ok) {
    throw new Error(`Registration request failed: ${res.status}`);
  }

  // The server may respond with a redirect URL containing the token as query params
  // or directly with JSON. Handle both.
  const text = await res.text();
  let data: RegistrationTokenResponse | null = null;

  try {
    data = JSON.parse(text) as RegistrationTokenResponse;
  } catch {
    // Might be a redirect URL
    const urlMatch = /access=([^&]+)/.exec(text);
    const ccMatch  = /country_code=([^&]+)/.exec(text);
    if (urlMatch) {
      return {
        accessToken: decodeURIComponent(urlMatch[1]),
        countryCode: ccMatch ? decodeURIComponent(ccMatch[1]) : "US",
      };
    }
    throw new Error("Unexpected response from Mi Fitness registration endpoint");
  }

  if (data.error_info) throw new Error(data.error_info);
  return {
    accessToken: data.token_info.access,
    countryCode: data.token_info.country_code ?? "US",
  };
}

/**
 * Step 2 — exchange the access token for a long-lived app_token + user_id.
 */
async function loginWithAccessToken(
  accessToken: string,
  countryCode: string,
): Promise<MiFitCredentials> {
  const url = `https://${LOGIN_HOST}/v2/client/login`;

  const body = new URLSearchParams({
    app_name:          "com.xiaomi.hm.health",
    dn:                "account.huami.com,api-user.huami.com,api-watch.huami.com,api-analytics.huami.com,app-analytics.huami.com,api-mifit.huami.com",
    device_id:         "02:00:00:00:00:00",
    device_model:      "android_phone",
    app_version:       "7.24.0",
    allow_registration:"false",
    third_name:        "huami",
    grant_type:        "access_token",
    country_code:      countryCode,
    code:              accessToken,
  });

  const res = await fetch(url, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    body.toString(),
  });

  if (!res.ok) throw new Error(`Login request failed: ${res.status}`);

  const data = await res.json() as LoginResponse;
  if (data.error_code || data.error_info) {
    throw new Error(data.error_info ?? `Login error ${data.error_code}`);
  }

  return {
    appToken: data.token_info.app_token,
    userId:   data.token_info.user_id,
  };
}

/**
 * Authenticate with Mi Fitness / Zepp Life credentials and return
 * a long-lived appToken + userId.
 */
export async function mifitLogin(
  email: string,
  password: string,
): Promise<MiFitCredentials> {
  const { accessToken, countryCode } = await getAccessToken(email, password);
  return loginWithAccessToken(accessToken, countryCode);
}

export interface WeightRecord {
  /** Unix timestamp in seconds */
  measureTime: number;
  /** Weight in kilograms */
  weight_kg: number;
  /** ISO date string YYYY-MM-DD (derived from measureTime, local tz of the server) */
  date: string;
}

interface RawWeightRecord {
  weight?:           number;
  measureTime?:      number;
  generateTime?:     number;
  generatedTime?:    number;
  createTime?:       number;
  bmi?:              number;
  fat?:              number;
  memberId?:         number | string;
  userId?:           number | string;
  summary?:          { weight?: number; bmi?: number; fatRate?: number };
}

type WeightApiResponse = Record<string, unknown>;

function normalizeTimestamp(ts: number): number {
  // API may return seconds (10 digits) or milliseconds (13 digits).
  return ts > 1_000_000_000_000 ? Math.floor(ts / 1000) : ts;
}

function extractWeightKg(raw: number | undefined, summaryWeight?: number): number | null {
  const w = summaryWeight ?? raw;
  if (w == null || w <= 0) return null;
  // Values > 500 are almost certainly grams.
  return w > 500 ? Math.round((w / 1000) * 10) / 10 : Math.round(w * 10) / 10;
}

function timestampToDate(tsSec: number): string {
  const d = new Date(tsSec * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Parse all known weightRecords response shapes into a flat list. */
function parseWeightApiResponse(json: WeightApiResponse, accountUserId: string): WeightRecord[] {
  const userIdStr = String(accountUserId);
  const candidates: Array<{ ts: number; weight_kg: number; memberId?: string; userId?: string }> = [];

  const push = (item: RawWeightRecord) => {
    const tsRaw =
      item.generatedTime ?? item.generateTime ?? item.measureTime ?? item.createTime ?? 0;
    const ts = normalizeTimestamp(Number(tsRaw));
    const weight_kg = extractWeightKg(item.weight, item.summary?.weight);
    if (!ts || weight_kg == null) return;
    candidates.push({
      ts,
      weight_kg,
      memberId: item.memberId != null ? String(item.memberId) : undefined,
      userId:   item.userId   != null ? String(item.userId)   : undefined,
    });
  };

  // New format: { items: [{ generatedTime, summary: { weight } }] }
  const items = json.items;
  if (Array.isArray(items)) {
    for (const item of items) push(item as RawWeightRecord);
  }

  // Legacy: { data: [...] } or { data: { weightRecords: [...] } }
  const data = json.data;
  if (Array.isArray(data)) {
    for (const item of data) push(item as RawWeightRecord);
  } else if (data && typeof data === "object" && "weightRecords" in data) {
    const wr = (data as { weightRecords?: unknown }).weightRecords;
    if (Array.isArray(wr)) {
      for (const item of wr) push(item as RawWeightRecord);
    }
  }

  // Filter family members only when memberId is present and differs from account.
  const filtered = candidates.filter((r) => {
    if (r.memberId && r.memberId !== userIdStr && r.memberId !== "-1") return false;
    if (r.userId   && r.userId   !== userIdStr && r.userId   !== "-1") return false;
    return true;
  });

  // Deduplicate: one entry per calendar day — keep the latest reading.
  const byDate = new Map<string, WeightRecord>();
  for (const r of filtered) {
    const date = timestampToDate(r.ts);
    const existing = byDate.get(date);
    if (!existing || r.ts > existing.measureTime) {
      byDate.set(date, { measureTime: r.ts, weight_kg: r.weight_kg, date });
    }
  }

  return [...byDate.values()].sort((a, b) => a.measureTime - b.measureTime);
}

async function fetchWeightFromHost(
  host: string,
  appToken: string,
  userId: string,
  fromTime: number,
): Promise<WeightApiResponse> {
  const params = new URLSearchParams({
    fromTime: String(fromTime),
    limit:    "500",
  });

  const url = `https://${host}/users/${userId}/members/-1/weightRecords?${params}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        apptoken:    appToken,
        appPlatform: "web",
        appname:     "com.xiaomi.hm.health",
        accept:      "application/json",
      },
    });
  } catch (err) {
    const cause = err instanceof Error ? err.message : String(err);
    throw new Error(`Network error reaching ${host}: ${cause}`);
  }

  if (res.status === 401) {
    throw new Error("Mi Fitness token expired — reconnect with a fresh apptoken from user.huami.com");
  }
  if (!res.ok) throw new Error(`Mi Fitness weight API error (${host}): ${res.status}`);

  return res.json() as Promise<WeightApiResponse>;
}

export async function fetchMiFitWeightRecords(
  appToken: string,
  userId:   string,
  fromTime: number,
  _toTime:  number,
  region:   MiFitRegion = "us",
): Promise<WeightRecord[]> {
  const preferred = MIFIT_HOSTS[region] ?? MIFIT_HOSTS.us;
  const hosts = [
    "api-mifit.zepp.com",
    preferred,
    ...WEIGHT_HOSTS.filter((h) => h !== preferred && h !== "api-mifit.zepp.com"),
  ];

  let lastError: Error | null = null;

  for (const host of hosts) {
    try {
      const json = await fetchWeightFromHost(host, appToken, userId, fromTime);
      const records = parseWeightApiResponse(json, userId);
      if (records.length > 0) return records;
      // Empty but valid — try next host in case data lives elsewhere.
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (lastError.message.includes("token expired")) throw lastError;
    }
  }

  // All hosts returned empty — not an error, just no data in range.
  if (!lastError) return [];
  throw lastError;
}
