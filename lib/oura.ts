/**
 * Oura Ring API v2 client (OAuth2).
 * Docs: https://cloud.ouraring.com/v2/docs
 */

const AUTHORIZE_URL = "https://cloud.ouraring.com/oauth/authorize";
const TOKEN_URL = "https://api.ouraring.com/oauth/token";
const DAILY_ACTIVITY_URL = "https://api.ouraring.com/v2/usercollection/daily_activity";

export interface OuraTokens {
  accessToken: string;
  refreshToken: string;
  /** ISO timestamp */
  expiresAt: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  error?: string;
  error_description?: string;
}

export function buildOuraAuthorizeUrl(clientId: string, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "daily",
    state,
  });
  return `${AUTHORIZE_URL}?${params}`;
}

function tokensFromResponse(data: TokenResponse): OuraTokens {
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  };
}

export async function exchangeOuraCode(
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string,
): Promise<OuraTokens> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const data = await res.json() as TokenResponse;
  if (!res.ok || data.error) {
    throw new Error(data.error_description ?? data.error ?? `Oura token exchange failed: ${res.status}`);
  }
  return tokensFromResponse(data);
}

export async function refreshOuraTokens(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<OuraTokens> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const data = await res.json() as TokenResponse;
  if (!res.ok || data.error) {
    throw new Error(data.error_description ?? data.error ?? `Oura token refresh failed: ${res.status}`);
  }
  return tokensFromResponse(data);
}

/**
 * Returns tokens guaranteed valid for immediate use, refreshing (and rotating the
 * single-use refresh token) if the access token is at or near expiry.
 */
export async function ensureValidOuraTokens(
  clientId: string,
  clientSecret: string,
  current: OuraTokens,
): Promise<{ tokens: OuraTokens; refreshed: boolean }> {
  const expiresInMs = new Date(current.expiresAt).getTime() - Date.now();
  const FIVE_MIN_MS = 5 * 60 * 1000;
  if (expiresInMs > FIVE_MIN_MS) {
    return { tokens: current, refreshed: false };
  }
  const tokens = await refreshOuraTokens(clientId, clientSecret, current.refreshToken);
  return { tokens, refreshed: true };
}

export interface OuraActivityRecord {
  /** ISO date string YYYY-MM-DD */
  date: string;
  activeCalories: number;
  totalCalories: number;
}

interface DailyActivityItem {
  day?: string;
  active_calories?: number;
  total_calories?: number;
}

interface DailyActivityResponse {
  data?: DailyActivityItem[];
  next_token?: string | null;
}

export async function fetchOuraDailyActivity(
  accessToken: string,
  fromDate: string,
  toDate: string,
): Promise<OuraActivityRecord[]> {
  const records: OuraActivityRecord[] = [];
  let nextToken: string | null = null;

  do {
    const params = new URLSearchParams({ start_date: fromDate, end_date: toDate });
    if (nextToken) params.set("next_token", nextToken);

    const res = await fetch(`${DAILY_ACTIVITY_URL}?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.status === 401) {
      throw new Error("Oura token expired or invalid — reconnect the account");
    }
    if (!res.ok) throw new Error(`Oura daily_activity API error: ${res.status}`);

    const json = await res.json() as DailyActivityResponse;
    for (const item of json.data ?? []) {
      if (!item.day || item.active_calories == null || item.total_calories == null) continue;
      records.push({
        date: item.day,
        activeCalories: Math.round(item.active_calories),
        totalCalories: Math.round(item.total_calories),
      });
    }
    nextToken = json.next_token ?? null;
  } while (nextToken);

  return records;
}
