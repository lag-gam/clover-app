// @ts-nocheck Supabase Edge Runtime supplies Deno and npm import types.
import { createClient } from "npm:@supabase/supabase-js@2";

export const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
export const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
export const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
export const PINTEREST_APP_ID = Deno.env.get("PINTEREST_APP_ID") ?? "";
export const PINTEREST_APP_SECRET =
  Deno.env.get("PINTEREST_APP_SECRET") ?? "";

export const PINTEREST_API_URL = "https://api.pinterest.com/v5";
const PINTEREST_REQUEST_TIMEOUT_MS = 30_000;

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function serviceClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
  timeoutMs = PINTEREST_REQUEST_TIMEOUT_MS,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export async function authenticatedUser(request: Request) {
  const token = request.headers
    .get("Authorization")
    ?.replace(/^Bearer\s+/i, "");
  if (!token) return null;

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
  } = await client.auth.getUser(token);
  return user ?? null;
}

export function assertPinterestConfigured() {
  if (!PINTEREST_APP_ID || !PINTEREST_APP_SECRET) {
    throw new Error("PINTEREST_NOT_CONFIGURED");
  }
}

export function pinterestRedirectUri() {
  return (
    Deno.env.get("PINTEREST_OAUTH_REDIRECT_URI") ||
    `${SUPABASE_URL}/functions/v1/pinterest-oauth/callback`
  );
}

export async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function validAccessToken(userId: string) {
  assertPinterestConfigured();
  const supabase = serviceClient();
  const { data: connection, error } = await supabase
    .from("pinterest_connections")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!connection) throw new Error("PINTEREST_NOT_CONNECTED");

  const expiresAt = connection.expires_at
    ? new Date(connection.expires_at).getTime()
    : Number.POSITIVE_INFINITY;
  if (expiresAt > Date.now() + 5 * 60 * 1000) {
    return connection.access_token;
  }
  if (!connection.refresh_token) {
    throw new Error("PINTEREST_RECONNECT_REQUIRED");
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: connection.refresh_token,
  });
  const response = await fetchWithTimeout(`${PINTEREST_API_URL}/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(
        `${PINTEREST_APP_ID}:${PINTEREST_APP_SECRET}`,
      )}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!response.ok) {
    throw new Error(`PINTEREST_REFRESH_FAILED:${response.status}`);
  }

  const refreshed = await response.json();
  const expiresAtIso = refreshed.expires_in
    ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
    : null;
  const { error: updateError } = await supabase
    .from("pinterest_connections")
    .update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token ?? connection.refresh_token,
      expires_at: expiresAtIso,
      scopes: parseScopes(refreshed.scope),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  if (updateError) throw updateError;

  return refreshed.access_token as string;
}

export async function pinterestApi(
  userId: string,
  path: string,
  init: RequestInit = {},
) {
  const accessToken = await validAccessToken(userId);
  const response = await fetchWithTimeout(`${PINTEREST_API_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error("Pinterest API error", response.status, detail);
    if (response.status === 401) {
      throw new Error("PINTEREST_RECONNECT_REQUIRED");
    }
    if (response.status === 403) {
      throw new Error("PINTEREST_APPROVAL_REQUIRED");
    }
    throw new Error(`PINTEREST_API_FAILED:${response.status}`);
  }
  return response.json();
}

export function parseScopes(scope: unknown): string[] {
  if (Array.isArray(scope)) return scope.filter((item) => typeof item === "string");
  if (typeof scope !== "string") return [];
  return scope.split(/[,\s]+/).filter(Boolean);
}

export function publicPinterestError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "PINTEREST_NOT_CONFIGURED") {
    return {
      status: 503,
      error:
        "Pinterest is not configured yet. Add the Edge Function secrets and callback URL.",
    };
  }
  if (message === "PINTEREST_NOT_CONNECTED") {
    return { status: 409, error: "Connect Pinterest before continuing." };
  }
  if (
    message === "PINTEREST_RECONNECT_REQUIRED" ||
    message.startsWith("PINTEREST_REFRESH_FAILED")
  ) {
    return {
      status: 409,
      error: "Your Pinterest connection expired. Disconnect and reconnect it.",
    };
  }
  if (message === "PINTEREST_APPROVAL_REQUIRED") {
    return {
      status: 403,
      error:
        "Pinterest has not approved the required boards:read and pins:read access for this app.",
    };
  }
  return { status: 500, error: "Pinterest request failed. Please try again." };
}
