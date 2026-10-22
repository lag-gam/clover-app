// @ts-nocheck Deno/Supabase Edge Runtime types are supplied during deployment.
import {
  authenticatedUser,
  assertPinterestConfigured,
  corsHeaders,
  fetchWithTimeout,
  json,
  parseScopes,
  PINTEREST_API_URL,
  PINTEREST_APP_ID,
  PINTEREST_APP_SECRET,
  pinterestRedirectUri,
  serviceClient,
  sha256,
} from "../_shared/pinterest.ts";

const OAUTH_SCOPES = ["boards:read", "pins:read", "user_accounts:read"];

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname.endsWith("/callback")) {
    return handleCallback(url);
  }
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const user = await authenticatedUser(request);
  if (!user) return json({ error: "Unauthorized" }, 401);

  try {
    assertPinterestConfigured();
    const { returnUrl } = await request.json();
    if (!isAllowedReturnUrl(returnUrl)) {
      return json({ error: "A valid app returnUrl is required" }, 400);
    }

    const stateBytes = crypto.getRandomValues(new Uint8Array(32));
    const state = Array.from(stateBytes)
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    const stateHash = await sha256(state);
    const supabase = serviceClient();

    await supabase
      .from("pinterest_oauth_states")
      .delete()
      .lt("expires_at", new Date().toISOString());
    const { error } = await supabase.from("pinterest_oauth_states").insert({
      state_hash: stateHash,
      user_id: user.id,
      return_url: returnUrl,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
    if (error) throw error;

    const authorizationUrl = new URL("https://www.pinterest.com/oauth/");
    authorizationUrl.searchParams.set("client_id", PINTEREST_APP_ID);
    authorizationUrl.searchParams.set("redirect_uri", pinterestRedirectUri());
    authorizationUrl.searchParams.set("response_type", "code");
    authorizationUrl.searchParams.set("scope", OAUTH_SCOPES.join(","));
    authorizationUrl.searchParams.set("state", state);

    return json({ authorizationUrl: authorizationUrl.toString() });
  } catch (error) {
    console.error("Pinterest OAuth start failed", error);
    const notConfigured =
      error instanceof Error && error.message === "PINTEREST_NOT_CONFIGURED";
    return json(
      {
        error: notConfigured
          ? "Pinterest is not configured yet. Add the Edge Function secrets."
          : "Could not start Pinterest authorization.",
      },
      notConfigured ? 503 : 500,
    );
  }
});

async function handleCallback(url: URL) {
  const state = url.searchParams.get("state");
  if (!state) return json({ error: "Missing OAuth state" }, 400);

  const supabase = serviceClient();
  const stateHash = await sha256(state);
  const { data: oauthState } = await supabase
    .from("pinterest_oauth_states")
    .select("user_id, return_url, expires_at")
    .eq("state_hash", stateHash)
    .maybeSingle();

  if (
    !oauthState ||
    new Date(oauthState.expires_at).getTime() <= Date.now() ||
    !isAllowedReturnUrl(oauthState.return_url)
  ) {
    return json({ error: "OAuth state is invalid or expired" }, 400);
  }

  await supabase
    .from("pinterest_oauth_states")
    .delete()
    .eq("state_hash", stateHash);

  const providerError = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  if (providerError || !code) {
    return redirectToApp(oauthState.return_url, {
      pinterest: "error",
      reason: providerError ?? "authorization_cancelled",
    });
  }

  try {
    assertPinterestConfigured();
    const response = await fetchWithTimeout(`${PINTEREST_API_URL}/oauth/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(
          `${PINTEREST_APP_ID}:${PINTEREST_APP_SECRET}`,
        )}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: pinterestRedirectUri(),
      }),
    });
    if (!response.ok) {
      console.error("Pinterest token exchange failed", response.status);
      throw new Error("TOKEN_EXCHANGE_FAILED");
    }

    const token = await response.json();
    const pinterestUserId = token.access_token
      ? await fetchPinterestUserId(token.access_token)
      : null;
    const expiresAt = token.expires_in
      ? new Date(Date.now() + token.expires_in * 1000).toISOString()
      : null;
    const { error } = await supabase.from("pinterest_connections").upsert({
      user_id: oauthState.user_id,
      pinterest_user_id: pinterestUserId,
      access_token: token.access_token,
      refresh_token: token.refresh_token ?? null,
      scopes: parseScopes(token.scope),
      expires_at: expiresAt,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;

    return redirectToApp(oauthState.return_url, { pinterest: "connected" });
  } catch (error) {
    console.error("Pinterest OAuth callback failed", error);
    return redirectToApp(oauthState.return_url, {
      pinterest: "error",
      reason: "token_exchange_failed",
    });
  }
}

async function fetchPinterestUserId(accessToken: string) {
  const response = await fetchWithTimeout(`${PINTEREST_API_URL}/user_account`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return null;
  const account = await response.json();
  return typeof account.id === "string" ? account.id : null;
}

function isAllowedReturnUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    if (["clover:", "exp:", "exps:"].includes(url.protocol)) return true;
    const allowedOrigin = Deno.env.get("PINTEREST_ALLOWED_RETURN_ORIGIN");
    return Boolean(allowedOrigin && url.origin === allowedOrigin);
  } catch {
    return false;
  }
}

function redirectToApp(returnUrl: string, params: Record<string, string>) {
  const target = new URL(returnUrl);
  for (const [key, value] of Object.entries(params)) {
    target.searchParams.set(key, value);
  }
  return Response.redirect(target.toString(), 302);
}
