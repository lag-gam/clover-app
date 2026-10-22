// @ts-nocheck Deno/Supabase Edge Runtime types are supplied during deployment.
import {
  authenticatedUser,
  corsHeaders,
  fetchWithTimeout,
  json,
  pinterestApi,
  publicPinterestError,
  serviceClient,
} from "../_shared/pinterest.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const MAX_PINS_PER_SYNC = 50;
const MAX_PROFILE_PINS = 200;
const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 256;

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
    if (body.action === "disconnect") {
      return disconnect(user.id);
    }
    return syncSelectedBoards(user.id);
  } catch (error) {
    console.error("Pinterest sync failed", error);
    if (
      error instanceof Error &&
      error.message === "EMBEDDING_NOT_CONFIGURED"
    ) {
      return json(
        {
          error:
            "Pin embedding is not configured. Add OPENAI_API_KEY to Edge Function secrets.",
        },
        503,
      );
    }
    const publicError = publicPinterestError(error);
    return json({ error: publicError.error }, publicError.status);
  }
});

async function syncSelectedBoards(userId: string) {
  if (!OPENAI_API_KEY) throw new Error("EMBEDDING_NOT_CONFIGURED");

  const supabase = serviceClient();
  const { data: boards, error: boardsError } = await supabase
    .from("pinterest_boards")
    .select("pinterest_board_id, name, sync_bookmark")
    .eq("user_id", userId)
    .eq("selected", true)
    .order("last_synced_at", { ascending: true, nullsFirst: true })
    .limit(10);
  if (boardsError) throw boardsError;
  if (!boards?.length) {
    return json({ error: "Choose at least one Pinterest board first." }, 400);
  }

  const fetchedPins: {
    pin: Record<string, unknown>;
    boardId: string;
    boardName: string;
  }[] = [];
  let remaining = MAX_PINS_PER_SYNC;

  for (let index = 0; index < boards.length && remaining > 0; index++) {
    const board = boards[index];
    const boardsLeft = boards.length - index;
    const pageSize = Math.max(1, Math.min(25, Math.floor(remaining / boardsLeft)));
    const query = new URLSearchParams({ page_size: String(pageSize) });
    if (board.sync_bookmark) query.set("bookmark", board.sync_bookmark);

    const payload = await pinterestApi(
      userId,
      `/boards/${encodeURIComponent(board.pinterest_board_id)}/pins?${query}`,
    );
    const items = Array.isArray(payload.items) ? payload.items : [];
    for (const pin of items.slice(0, remaining)) {
      if (typeof pin.id === "string") {
        fetchedPins.push({
          pin,
          boardId: board.pinterest_board_id,
          boardName: board.name,
        });
      }
    }
    remaining -= Math.min(items.length, remaining);

    const { error: cursorError } = await supabase
      .from("pinterest_boards")
      .update({
        sync_bookmark:
          typeof payload.bookmark === "string" && payload.bookmark
            ? payload.bookmark
            : null,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("pinterest_board_id", board.pinterest_board_id);
    if (cursorError) throw cursorError;
  }

  if (fetchedPins.length > 0) {
    const inputs = fetchedPins.map(({ pin, boardName }) =>
      pinEmbeddingText(pin, boardName)
    );
    const embeddings = await generateEmbeddings(inputs);
    const rows = fetchedPins.map(({ pin, boardId }, index) => ({
      user_id: userId,
      pinterest_pin_id: pin.id,
      pinterest_board_id: boardId,
      title: textOrNull(pin.title),
      description: textOrNull(pin.description),
      alt_text: textOrNull(pin.alt_text),
      link: textOrNull(pin.link),
      image_url: pinImageUrl(pin),
      pinterest_created_at: textOrNull(pin.created_at),
      embedding: embeddings[index],
      synced_at: new Date().toISOString(),
    }));
    const { error: upsertError } = await supabase
      .from("pinterest_pins")
      .upsert(rows, { onConflict: "user_id,pinterest_pin_id" });
    if (upsertError) throw upsertError;
  }

  const profile = await updatePinterestProfile(
    userId,
    boards.map((board) => board.pinterest_board_id),
  );
  return json({
    synced: fetchedPins.length,
    pinCount: profile.pinCount,
    pinterestUpdatedAt: profile.updatedAt,
    message:
      fetchedPins.length > 0
        ? `Synced ${fetchedPins.length} Pins.`
        : "Boards are up to date.",
  });
}

async function updatePinterestProfile(
  userId: string,
  selectedBoardIds: string[],
) {
  const supabase = serviceClient();
  const [{ data: pins, error }, { count }] = await Promise.all([
    supabase
      .from("pinterest_pins")
      .select("embedding")
      .eq("user_id", userId)
      .in("pinterest_board_id", selectedBoardIds)
      .order("pinterest_created_at", { ascending: false, nullsFirst: false })
      .limit(MAX_PROFILE_PINS),
    supabase
      .from("pinterest_pins")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("pinterest_board_id", selectedBoardIds),
  ]);
  if (error) throw error;

  const vectors = (pins ?? [])
    .map((pin) => pin.embedding)
    .filter(
      (embedding) =>
        Array.isArray(embedding) && embedding.length === EMBEDDING_DIMENSIONS,
    );
  const pinterestEmbedding = averageVectors(vectors);
  const { data: existing } = await supabase
    .from("style_profiles")
    .select("interaction_embedding, interaction_count")
    .eq("user_id", userId)
    .maybeSingle();
  const interactionEmbedding = validVector(existing?.interaction_embedding);
  const blended = blendTaste(interactionEmbedding, pinterestEmbedding);
  const updatedAt = new Date().toISOString();

  const { error: profileError } = await supabase.from("style_profiles").upsert(
    {
      user_id: userId,
      style_embedding: blended,
      interaction_embedding: interactionEmbedding,
      interaction_count: existing?.interaction_count ?? 0,
      pinterest_embedding: pinterestEmbedding,
      pinterest_pin_count: count ?? 0,
      pinterest_updated_at: updatedAt,
      updated_at: updatedAt,
    },
    { onConflict: "user_id" },
  );
  if (profileError) throw profileError;

  return { pinCount: count ?? 0, updatedAt };
}

async function disconnect(userId: string) {
  const supabase = serviceClient();
  const { data: profile } = await supabase
    .from("style_profiles")
    .select("interaction_embedding")
    .eq("user_id", userId)
    .maybeSingle();

  const tables = [
    "pinterest_oauth_states",
    "pinterest_pins",
    "pinterest_boards",
    "pinterest_connections",
  ];
  for (const table of tables) {
    const { error } = await supabase.from(table).delete().eq("user_id", userId);
    if (error) throw error;
  }

  const { error: profileError } = await supabase
    .from("style_profiles")
    .update({
      style_embedding: validVector(profile?.interaction_embedding),
      pinterest_embedding: null,
      pinterest_pin_count: 0,
      pinterest_updated_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  if (profileError) throw profileError;

  return json({ disconnected: true });
}

async function generateEmbeddings(inputs: string[]) {
  const response = await fetchWithTimeout(
    "https://api.openai.com/v1/embeddings",
    {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: inputs,
      dimensions: EMBEDDING_DIMENSIONS,
    }),
    },
    45_000,
  );
  if (!response.ok) {
    console.error("Pin embedding failed", response.status);
    throw new Error("PIN_EMBEDDING_FAILED");
  }
  const payload = await response.json();
  const ordered = [...(payload.data ?? [])].sort(
    (a, b) => Number(a.index) - Number(b.index),
  );
  if (
    ordered.length !== inputs.length ||
    ordered.some((item) => !validVector(item.embedding))
  ) {
    throw new Error("PIN_EMBEDDING_INVALID");
  }
  return ordered.map((item) => item.embedding);
}

function pinEmbeddingText(pin: Record<string, unknown>, boardName: string) {
  return [
    `Pinterest board: ${boardName}`,
    textOrNull(pin.title),
    textOrNull(pin.description),
    textOrNull(pin.alt_text),
    "fashion style inspiration",
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 8000);
}

function pinImageUrl(pin: Record<string, unknown>) {
  const images = pin.media?.images;
  return (
    images?.["600x"]?.url ??
    images?.["400x300"]?.url ??
    images?.["1200x"]?.url ??
    null
  );
}

function textOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function validVector(value: unknown): number[] | null {
  return Array.isArray(value) &&
      value.length === EMBEDDING_DIMENSIONS &&
      value.every((number) => typeof number === "number")
    ? value
    : null;
}

function averageVectors(vectors: number[][]) {
  if (vectors.length === 0) return null;
  const result = new Array(EMBEDDING_DIMENSIONS).fill(0);
  for (const vector of vectors) {
    for (let index = 0; index < result.length; index++) {
      result[index] += vector[index];
    }
  }
  return result.map((value) => value / vectors.length);
}

function blendTaste(
  interactionEmbedding: number[] | null,
  pinterestEmbedding: number[] | null,
) {
  if (!interactionEmbedding) return pinterestEmbedding;
  if (!pinterestEmbedding) return interactionEmbedding;
  return interactionEmbedding.map(
    (value, index) => value * 0.65 + pinterestEmbedding[index] * 0.35,
  );
}
