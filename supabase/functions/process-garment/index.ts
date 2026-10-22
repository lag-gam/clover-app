// @ts-nocheck Deno/Supabase Edge Runtime types are supplied during function deployment.
import { createClient } from "npm:@supabase/supabase-js@2";

declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const REMOVEBG_API_KEY = Deno.env.get("REMOVEBG_API_KEY")!;

const VISION_MODEL = "gpt-4o";
const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 256;
const PROVIDER_TIMEOUT_MS = 45_000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GARMENT_ANALYSIS_PROMPT = `You are a fashion analysis AI. Analyze this garment image and return a JSON object with the following fields:

{
  "name": "Brief descriptive name (e.g. 'Navy Striped Oxford Shirt')",
  "category": one of ["tops", "bottoms", "dresses", "outerwear", "shoes", "underwear", "accessories"],
  "subtype": choose the closest valid subtype for the category:
    tops ["t_shirt", "shirt", "blouse", "tank_top", "sweater", "hoodie", "other"],
    bottoms ["jeans", "trousers", "shorts", "skirt", "other"],
    dresses ["dress", "jumpsuit", "other"],
    outerwear ["jacket", "coat", "blazer", "vest", "other"],
    shoes ["sneakers", "boots", "loafers", "sandals", "heels", "other"],
    underwear ["boxers", "briefs", "boxer_briefs", "other"],
    accessories ["necklace", "watch", "hat", "beanie", "belt", "bag", "glasses", "bracelet", "ring", "earbuds", "other"],
  "metal_tone": dominant visible metal/hardware tone, one of ["none", "silver", "gold", "rose_gold", "mixed"],
  "color": primary color, one of ["black", "white", "gray", "navy", "blue", "red", "pink", "green", "yellow", "orange", "purple", "brown", "beige", "cream", "multicolor"],
  "secondary_color": secondary color if present (same options as color), or null,
  "pattern": one of ["solid", "stripes", "plaid", "floral", "polka dots", "geometric", "animal print", "abstract", "other"],
  "material": best guess, one of ["cotton", "polyester", "silk", "wool", "denim", "leather", "linen", "nylon", "cashmere", "synthetic blend", "other"],
  "fit": one of ["slim", "regular", "relaxed", "oversized"],
  "formality": integer 1-5,
  "tags": array of 3-8 useful styling tags covering silhouette, season, aesthetic, and notable details
}

Return ONLY the JSON object, no markdown formatting or explanation.`;

const categories = [
  "tops",
  "bottoms",
  "dresses",
  "outerwear",
  "shoes",
  "underwear",
  "accessories",
];
const subtypesByCategory: Record<string, string[]> = {
  tops: ["t_shirt", "shirt", "blouse", "tank_top", "sweater", "hoodie", "other"],
  bottoms: ["jeans", "trousers", "shorts", "skirt", "other"],
  dresses: ["dress", "jumpsuit", "other"],
  outerwear: ["jacket", "coat", "blazer", "vest", "other"],
  shoes: ["sneakers", "boots", "loafers", "sandals", "heels", "other"],
  underwear: ["boxers", "briefs", "boxer_briefs", "other"],
  accessories: [
    "necklace",
    "watch",
    "hat",
    "beanie",
    "belt",
    "bag",
    "glasses",
    "bracelet",
    "ring",
    "earbuds",
    "other",
  ],
};
const metalTones = ["none", "silver", "gold", "rose_gold", "mixed"];
const colors = [
  "black",
  "white",
  "gray",
  "navy",
  "blue",
  "red",
  "pink",
  "green",
  "yellow",
  "orange",
  "purple",
  "brown",
  "beige",
  "cream",
  "multicolor",
];
const patterns = [
  "solid",
  "stripes",
  "plaid",
  "floral",
  "polka dots",
  "geometric",
  "animal print",
  "abstract",
  "other",
];
const materials = [
  "cotton",
  "polyester",
  "silk",
  "wool",
  "denim",
  "leather",
  "linen",
  "nylon",
  "cashmere",
  "synthetic blend",
  "other",
];
const fits = ["slim", "regular", "relaxed", "oversized"];

function logProcess(
  level: "info" | "warn" | "error",
  garmentId: string,
  step: string,
  details?: Record<string, unknown>,
) {
  const payload = {
    fn: "process-garment",
    garmentId,
    step,
    ...details,
  };
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const authorization = request.headers.get("Authorization");
  const token = authorization?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return json({ error: "Unauthorized" }, 401);
  }

  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser(token);
  if (authError || !user) {
    return json({ error: "Unauthorized" }, 401);
  }

  let garmentId: string | undefined;
  let mode: "front" | "back" = "front";
  try {
    const body = await request.json();
    garmentId = body.garmentId;
    mode = body.mode ?? "front";
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (!garmentId || !/^[0-9a-f-]{36}$/i.test(garmentId)) {
    return json({ error: "A valid garmentId is required" }, 400);
  }
  if (mode !== "front" && mode !== "back") {
    return json({ error: "mode must be front or back" }, 400);
  }

  logProcess("info", garmentId, "accepted", {
    mode,
    userId: user.id,
    openaiConfigured: Boolean(OPENAI_API_KEY),
    removeBgConfigured: Boolean(REMOVEBG_API_KEY),
  });

  const serviceClient = createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data: garment } = await serviceClient
    .from("garments")
    .select("id, back_image_url")
    .eq("id", garmentId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!garment) {
    logProcess("warn", garmentId, "not_found", { userId: user.id });
    return json({ error: "Garment not found" }, 404);
  }

  if (mode === "back") {
    if (!garment.back_image_url) {
      return json({ error: "Back image not found" }, 409);
    }
    EdgeRuntime.waitUntil(
      processBackImage(
        serviceClient,
        garmentId,
        user.id,
        garment.back_image_url,
      ),
    );
  } else {
    EdgeRuntime.waitUntil(processGarment(serviceClient, garmentId, user.id));
  }
  return json({ accepted: true }, 202);
});

async function processBackImage(
  supabase: ReturnType<typeof createClient>,
  garmentId: string,
  userId: string,
  backImageUrl: string,
) {
  let backCutoutUrl = backImageUrl;
  try {
    if (!REMOVEBG_API_KEY) {
      throw new Error("remove.bg is not configured");
    }
    logProcess("info", garmentId, "back.removebg.start");
    const cutoutBytes = await removeBackground(backImageUrl);
    const cutoutPath = `${userId}/${garmentId}_back_cutout.png`;
    const { error: uploadError } = await supabase.storage
      .from("garment-images")
      .upload(cutoutPath, cutoutBytes, {
        contentType: "image/png",
        upsert: true,
      });
    if (uploadError) {
      throw new Error(`Back cutout upload failed: ${uploadError.message}`);
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from("garment-images").getPublicUrl(cutoutPath);
    backCutoutUrl = publicUrl;
    logProcess("info", garmentId, "back.removebg.ok", {
      bytes: cutoutBytes.byteLength,
    });
  } catch (error) {
    // A back photo remains useful if remove.bg is unavailable or times out.
    logProcess("warn", garmentId, "back.removebg.skipped", {
      error: errorMessage(error),
    });
  }

  const { error: updateError } = await supabase
    .from("garments")
    .update({
      back_cutout_url: backCutoutUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", garmentId)
    .eq("user_id", userId)
    .eq("back_image_url", backImageUrl);
  if (updateError) {
    logProcess("error", garmentId, "back.save.failed", {
      error: updateError.message,
    });
  }
}

async function processGarment(
  supabase: ReturnType<typeof createClient>,
  garmentId: string,
  userId: string,
) {
  const startedAt = Date.now();
  const { data: claimedRows, error: claimError } = await supabase.rpc(
    "claim_garment_processing",
    { p_garment_id: garmentId, p_user_id: userId },
  );
  const garment = claimedRows?.[0];

  if (claimError) {
    logProcess("error", garmentId, "claim.failed", {
      error: claimError.message,
    });
    return;
  }
  if (!garment) {
    logProcess("warn", garmentId, "claim.skipped", {
      reason: "already processing, ready, or not owned",
    });
    return;
  }

  logProcess("info", garmentId, "claim.ok", {
    attempt: garment.processing_attempts,
  });

  try {
    assertSecrets();

    // Analyze first so a vision/metadata failure does not spend a remove.bg credit.
    logProcess("info", garmentId, "vision.start");
    const metadata = await analyzeGarment(garment.image_url);
    logProcess("info", garmentId, "vision.ok", {
      category: metadata.category,
      subtype: metadata.subtype,
    });

    logProcess("info", garmentId, "embedding.start");
    const embedding = await generateEmbedding(metadata);
    logProcess("info", garmentId, "embedding.ok", {
      dimensions: embedding.length,
    });

    let cutoutUrl = garment.image_url;
    try {
      if (!REMOVEBG_API_KEY) {
        throw new Error("remove.bg is not configured");
      }
      logProcess("info", garmentId, "removebg.start");
      const cutoutBytes = await removeBackground(garment.image_url);
      const cutoutPath = `${userId}/${garmentId}_cutout.png`;
      const { error: cutoutError } = await supabase.storage
        .from("garment-images")
        .upload(cutoutPath, cutoutBytes, {
          contentType: "image/png",
          upsert: true,
        });
      if (cutoutError) {
        throw new Error(`Front cutout upload failed: ${cutoutError.message}`);
      }
      const {
        data: { publicUrl },
      } = supabase.storage.from("garment-images").getPublicUrl(cutoutPath);
      cutoutUrl = publicUrl;
      logProcess("info", garmentId, "removebg.ok", {
        bytes: cutoutBytes.byteLength,
      });
    } catch (error) {
      logProcess("warn", garmentId, "removebg.skipped", {
        error: errorMessage(error),
      });
    }

    const processingUpdate = {
      ...metadata,
      cutout_url: cutoutUrl,
      embedding,
      processing_status: "ready",
      processing_error: null,
      processing_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    let updateResult = await supabase
      .from("garments")
      .update(processingUpdate)
      .eq("id", garmentId)
      .eq("user_id", userId)
      .eq("processing_status", "processing")
      .eq("processing_attempts", garment.processing_attempts);

    // Migration 007 adds these optional taxonomy columns. Fall back cleanly
    // during a rolling deployment so existing categories can still process.
    if (
      updateResult.error &&
      isMissingTaxonomyColumn(updateResult.error.message)
    ) {
      logProcess("warn", garmentId, "save.legacy_fallback", {
        error: updateResult.error.message,
      });
      const {
        subtype: _subtype,
        metal_tone: _metalTone,
        ...legacyMetadata
      } = metadata;
      updateResult = await supabase
        .from("garments")
        .update({
          ...legacyMetadata,
          cutout_url: cutoutUrl,
          embedding,
          processing_status: "ready",
          processing_error: null,
          processing_completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", garmentId)
        .eq("user_id", userId)
        .eq("processing_status", "processing")
        .eq("processing_attempts", garment.processing_attempts);
    }

    if (updateResult.error) {
      throw new Error(`Garment update failed: ${updateResult.error.message}`);
    }

    logProcess("info", garmentId, "ready", {
      ms: Date.now() - startedAt,
    });
  } catch (error) {
    const publicError = publicProcessingError(error);
    logProcess("error", garmentId, "failed", {
      ms: Date.now() - startedAt,
      error: errorMessage(error),
      publicError,
    });
    const { error: failureUpdateError } = await supabase
      .from("garments")
      .update({
        processing_status: "failed",
        processing_error: publicError,
        processing_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", garmentId)
      .eq("user_id", userId)
      .eq("processing_status", "processing")
      .eq("processing_attempts", garment.processing_attempts);

    if (failureUpdateError) {
      logProcess("error", garmentId, "failed.save_error", {
        error: failureUpdateError.message,
      });
    }
  }
}

function isMissingTaxonomyColumn(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    (normalized.includes("metal_tone") || normalized.includes("subtype")) &&
    (normalized.includes("schema cache") || normalized.includes("column"))
  );
}

async function removeBackground(imageUrl: string): Promise<ArrayBuffer> {
  const formData = new FormData();
  formData.append("image_url", imageUrl);
  formData.append("size", "regular");
  formData.append("format", "png");

  const response = await fetchWithTimeout(
    "https://api.remove.bg/v1.0/removebg",
    {
      method: "POST",
      headers: { "X-Api-Key": REMOVEBG_API_KEY },
      body: formData,
    },
  );
  if (!response.ok) {
    throw new Error(await describeHttpError("remove.bg", response));
  }
  return response.arrayBuffer();
}

async function analyzeGarment(imageUrl: string) {
  const response = await fetchWithTimeout(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: GARMENT_ANALYSIS_PROMPT },
              {
                type: "image_url",
                image_url: { url: imageUrl, detail: "low" },
              },
            ],
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 500,
        temperature: 0.2,
      }),
    },
  );
  if (!response.ok) {
    throw new Error(await describeHttpError("OpenAI vision", response));
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("OpenAI vision returned no metadata");
  }
  try {
    return validateMetadata(JSON.parse(content));
  } catch (error) {
    throw new Error(
      `OpenAI vision returned invalid garment metadata: ${errorMessage(error)}`,
    );
  }
}

async function generateEmbedding(metadata: Record<string, unknown>) {
  const input = [
    metadata.category,
    metadata.subtype,
    metadata.metal_tone,
    metadata.color,
    metadata.secondary_color ?? "",
    metadata.pattern,
    metadata.material,
    metadata.fit,
    `formality:${metadata.formality}`,
    ...(metadata.tags as string[]),
    metadata.name,
  ].join(" ");

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
        input,
        dimensions: EMBEDDING_DIMENSIONS,
      }),
    },
  );
  if (!response.ok) {
    throw new Error(await describeHttpError("OpenAI embeddings", response));
  }

  const payload = await response.json();
  const embedding = payload.data?.[0]?.embedding;
  if (!Array.isArray(embedding)) {
    throw new Error("OpenAI embeddings returned no vector");
  }
  return embedding;
}

function validateMetadata(value: Record<string, unknown>) {
  if (typeof value?.name !== "string" || !value.name.trim()) {
    throw new Error("missing name");
  }
  if (!categories.includes(value.category)) {
    throw new Error(`invalid category ${String(value.category)}`);
  }
  if (
    !subtypesByCategory[value.category as string]?.includes(value.subtype)
  ) {
    throw new Error(
      `invalid subtype ${String(value.subtype)} for ${String(value.category)}`,
    );
  }
  if (!metalTones.includes(value.metal_tone)) {
    throw new Error(`invalid metal_tone ${String(value.metal_tone)}`);
  }
  if (!colors.includes(value.color)) {
    throw new Error(`invalid color ${String(value.color)}`);
  }
  if (
    value.secondary_color !== null &&
    !colors.includes(value.secondary_color)
  ) {
    throw new Error(
      `invalid secondary_color ${String(value.secondary_color)}`,
    );
  }
  if (!patterns.includes(value.pattern)) {
    throw new Error(`invalid pattern ${String(value.pattern)}`);
  }
  if (!materials.includes(value.material)) {
    throw new Error(`invalid material ${String(value.material)}`);
  }
  if (!fits.includes(value.fit)) {
    throw new Error(`invalid fit ${String(value.fit)}`);
  }
  if (
    !Number.isInteger(value.formality) ||
    value.formality < 1 ||
    value.formality > 5
  ) {
    throw new Error(`invalid formality ${String(value.formality)}`);
  }
  if (
    !Array.isArray(value.tags) ||
    !value.tags.every((tag) => typeof tag === "string")
  ) {
    throw new Error("invalid tags");
  }

  return {
    name: value.name.slice(0, 120),
    category: value.category,
    subtype: value.subtype,
    metal_tone: value.metal_tone,
    color: value.color,
    secondary_color: value.secondary_color,
    pattern: value.pattern,
    material: value.material,
    fit: value.fit,
    formality: value.formality,
    tags: value.tags.slice(0, 10),
  };
}

function assertSecrets() {
  if (!OPENAI_API_KEY) {
    throw new Error("Provider secrets are not configured");
  }
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.name === "AbortError") {
    return `Timed out after ${PROVIDER_TIMEOUT_MS / 1000}s`;
  }
  if (error instanceof Error) return error.message;
  return String(error);
}

async function describeHttpError(
  provider: string,
  response: Response,
): Promise<string> {
  const raw = (await response.text()).replace(/\s+/g, " ").trim().slice(0, 280);
  return `${provider} returned ${response.status}${raw ? `: ${raw}` : ""}`;
}

function publicProcessingError(error: unknown) {
  const message = errorMessage(error).slice(0, 280);
  if (message === "Provider secrets are not configured") {
    return "Garment analysis is not configured. Set OPENAI_API_KEY as a Supabase Edge secret, then retry.";
  }
  if (isMissingTaxonomyColumn(message)) {
    return "Database is missing garment columns. Run migration 007_flatlay_outfit_taxonomy.sql, then retry.";
  }
  if (message.startsWith("OpenAI vision")) {
    return `Vision analysis failed. ${message}`;
  }
  if (message.startsWith("OpenAI embeddings")) {
    return `Embedding generation failed. ${message}`;
  }
  if (message.startsWith("Garment update failed")) {
    return message;
  }
  if (message.includes("Timed out")) {
    return `Garment analysis timed out. ${message}`;
  }
  return `Garment analysis failed. ${message}`;
}

function json(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
