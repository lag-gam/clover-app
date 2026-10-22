// @ts-nocheck Deno/Supabase Edge Runtime types are supplied during deployment.
import {
  authenticatedUser,
  corsHeaders,
  json,
  pinterestApi,
  publicPinterestError,
  serviceClient,
} from "../_shared/pinterest.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const user = await authenticatedUser(request);
  if (!user) return json({ error: "Unauthorized" }, 401);

  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action ?? "status";
    if (action === "status") return getStatus(user.id);
    if (action === "list") return listBoards(user.id);
    if (action === "select") return selectBoards(user.id, body.boardIds);
    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error("Pinterest boards request failed", error);
    const publicError = publicPinterestError(error);
    return json({ error: publicError.error }, publicError.status);
  }
});

async function getStatus(userId: string) {
  const supabase = serviceClient();
  const [
    { data: connection, error: connectionError },
    { data: boards, error: boardsError },
    { data: profile, error: profileError },
  ] =
    await Promise.all([
      supabase
        .from("pinterest_connections")
        .select("connected_at, expires_at")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("pinterest_boards")
        .select(
          "pinterest_board_id, name, description, image_url, selected, last_synced_at",
        )
        .eq("user_id", userId)
        .order("name"),
      supabase
        .from("style_profiles")
        .select("pinterest_pin_count")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);
  if (connectionError) throw connectionError;
  if (boardsError) throw boardsError;
  if (profileError) throw profileError;

  return json({
    connected: Boolean(connection),
    connectedAt: connection?.connected_at ?? null,
    expiresAt: connection?.expires_at ?? null,
    boards: boards ?? [],
    pinCount: profile?.pinterest_pin_count ?? 0,
  });
}

async function listBoards(userId: string) {
  const supabase = serviceClient();
  let bookmark: string | undefined;
  let pages = 0;
  const boards: Record<string, unknown>[] = [];

  do {
    const query = new URLSearchParams({ page_size: "100" });
    if (bookmark) query.set("bookmark", bookmark);
    const payload = await pinterestApi(userId, `/boards?${query}`);
    boards.push(...(Array.isArray(payload.items) ? payload.items : []));
    bookmark =
      typeof payload.bookmark === "string" && payload.bookmark
        ? payload.bookmark
        : undefined;
    pages++;
  } while (bookmark && pages < 3);

  if (boards.length > 0) {
    const rows = boards
      .filter((board) => typeof board.id === "string")
      .map((board) => ({
        user_id: userId,
        pinterest_board_id: board.id,
        name: typeof board.name === "string" ? board.name : "Untitled board",
        description:
          typeof board.description === "string" ? board.description : null,
        privacy: typeof board.privacy === "string" ? board.privacy : null,
        image_url: board.media?.image_cover_url ?? null,
        updated_at: new Date().toISOString(),
      }));
    const { error } = await supabase
      .from("pinterest_boards")
      .upsert(rows, { onConflict: "user_id,pinterest_board_id" });
    if (error) throw error;
  }

  return getStatus(userId);
}

async function selectBoards(userId: string, boardIds: unknown) {
  if (
    !Array.isArray(boardIds) ||
    boardIds.length > 10 ||
    !boardIds.every((id) => typeof id === "string")
  ) {
    return json({ error: "Select up to 10 valid boards." }, 400);
  }

  const supabase = serviceClient();
  if (boardIds.length > 0) {
    const { count } = await supabase
      .from("pinterest_boards")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("pinterest_board_id", boardIds);
    if (count !== new Set(boardIds).size) {
      return json({ error: "One or more boards are unavailable." }, 400);
    }
  }

  const { error: clearError } = await supabase
    .from("pinterest_boards")
    .update({ selected: false, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (clearError) throw clearError;

  if (boardIds.length > 0) {
    const { error: selectError } = await supabase
      .from("pinterest_boards")
      .update({ selected: true, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .in("pinterest_board_id", boardIds);
    if (selectError) throw selectError;
  }

  return getStatus(userId);
}
