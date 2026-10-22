import { makeRedirectUri } from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "@/lib/supabase";
import { PinterestStatus } from "@/types/database";

WebBrowser.maybeCompleteAuthSession();

export async function getPinterestStatus(): Promise<PinterestStatus> {
  return invokePinterest<PinterestStatus>("pinterest-boards", {
    action: "status",
  });
}

export async function connectPinterest(): Promise<
  "connected" | "cancelled"
> {
  const returnUrl = makeRedirectUri({
    scheme: "clover",
    path: "pinterest",
  });
  const { authorizationUrl } = await invokePinterest<{
    authorizationUrl: string;
  }>("pinterest-oauth", { returnUrl });

  const result = await WebBrowser.openAuthSessionAsync(
    authorizationUrl,
    returnUrl
  );
  if (result.type !== "success") return "cancelled";

  const responseUrl = new URL(result.url);
  if (responseUrl.searchParams.get("pinterest") !== "connected") {
    throw new Error(
      readableOAuthReason(responseUrl.searchParams.get("reason"))
    );
  }
  return "connected";
}

export async function refreshPinterestBoards(): Promise<PinterestStatus> {
  return invokePinterest<PinterestStatus>("pinterest-boards", {
    action: "list",
  });
}

export async function selectPinterestBoards(
  boardIds: string[]
): Promise<PinterestStatus> {
  return invokePinterest<PinterestStatus>("pinterest-boards", {
    action: "select",
    boardIds,
  });
}

export async function syncPinterestPins(): Promise<{
  synced: number;
  pinCount: number;
  pinterestUpdatedAt: string;
  message: string;
}> {
  return invokePinterest("pinterest-sync", { action: "sync" });
}

export async function disconnectPinterest(): Promise<void> {
  await invokePinterest("pinterest-sync", { action: "disconnect" });
}

async function invokePinterest<T>(
  functionName: string,
  body: Record<string, unknown>
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(functionName, {
    body,
  });
  if (error) {
    const context = (error as { context?: Response }).context;
    if (context) {
      try {
        const payload = (await context.json()) as { error?: string };
        if (payload.error) throw new PinterestFunctionError(payload.error);
      } catch (contextError) {
        if (contextError instanceof PinterestFunctionError) throw contextError;
      }
    }
    throw new Error(error.message || "Pinterest request failed.");
  }
  return data as T;
}

function readableOAuthReason(reason: string | null) {
  if (reason === "access_denied" || reason === "authorization_cancelled") {
    return "Pinterest authorization was cancelled.";
  }
  return "Pinterest could not be connected. Check app approval and callback settings.";
}

class PinterestFunctionError extends Error {}
