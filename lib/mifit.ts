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

export type MiFitRegion = keyof typeof MIFIT_HOSTS;

const REGION_FALLBACK_ORDER: MiFitRegion[] = ["us", "de", "eu", "cn"];

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
  /** Some implementations return grams (int), others return kg (float) — handle both */
  weight:      number;
  measureTime: number;
  bmi?:        number;
  fat?:        number;
  /** Member/user ID — present on multi-profile accounts. Used to filter to the owner only. */
  memberId?:   number | string;
  userId?:     number | string;
}

interface WeightApiResponse {
  code?:    number;
  message?: string;
  data?:    RawWeightRecord[] | { weightRecords?: RawWeightRecord[] };
}

/**
 * Fetch weight records from Mi Fitness / Zepp Life API.
 *
 * @param fromTime  Unix timestamp (seconds) — inclusive lower bound.
 * @param toTime    Unix timestamp (seconds) — inclusive upper bound.
 * @param region    API region key (default "eu").
 */
async function fetchWeightFromHost(
  host: string,
  appToken: string,
  userId: string,
  fromTime: number,
  toTime: number,
): Promise<WeightApiResponse> {
  const params = new URLSearchParams({
    fromTime:  String(fromTime),
    toTime:    String(toTime),
    limit:     "500",
    isForward: "0",
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
  toTime:   number,
  region:   MiFitRegion = "us",
): Promise<WeightRecord[]> {
  const preferred = MIFIT_HOSTS[region] ?? MIFIT_HOSTS.us;
  const hosts = [
    preferred,
    ...REGION_FALLBACK_ORDER
      .map((r) => MIFIT_HOSTS[r])
      .filter((h) => h !== preferred),
  ];

  let json: WeightApiResponse | null = null;
  let lastError: Error | null = null;

  for (const host of hosts) {
    try {
      json = await fetchWeightFromHost(host, appToken, userId, fromTime, toTime);
      lastError = null;
      break;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // Retry on network/DNS failures; stop on auth errors.
      if (lastError.message.includes("token expired")) throw lastError;
    }
  }

  if (!json) {
    throw lastError ?? new Error("Mi Fitness API unreachable");
  }

  // Normalise the two possible shapes: array or { weightRecords: [] }
  let raw: RawWeightRecord[] = [];
  if (Array.isArray(json.data)) {
    raw = json.data;
  } else if (json.data && "weightRecords" in json.data && Array.isArray(json.data.weightRecords)) {
    raw = json.data.weightRecords;
  }

  const userIdStr = String(userId);

  return raw
    // Filter to the account owner only — skip family-member records if present.
    .filter((r) => {
      if (r.memberId != null)  return String(r.memberId) === userIdStr;
      if (r.userId   != null)  return String(r.userId)   === userIdStr;
      return true; // single-user account — no member field present
    })
    .filter((r) => r.weight > 0 && r.measureTime > 0)
    .map((r): WeightRecord => {
      // The API may return weight in grams (e.g. 75300) or kg (e.g. 75.3).
      // Heuristic: values > 500 are almost certainly grams.
      const weight_kg = r.weight > 500 ? r.weight / 1000 : r.weight;
      const d = new Date(r.measureTime * 1000);
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return { measureTime: r.measureTime, weight_kg: Math.round(weight_kg * 10) / 10, date };
    });
}
