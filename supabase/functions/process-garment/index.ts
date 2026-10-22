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
  try {
    garmentId = (await request.json()).garmentId;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (!garmentId || !/^[0-9a-f-]{36}$/i.test(garmentId)) {
    return json({ error: "A valid garmentId is required" }, 400);
  }

  const serviceClient = createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data: garment } = await serviceClient
    .from("garments")
    .select("id")
    .eq("id", garmentId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!garment) {
    return json({ error: "Garment not found" }, 404);
  }

  EdgeRuntime.waitUntil(processGarment(serviceClient, garmentId, user.id));
  return json({ accepted: true }, 202);
});

async function processGarment(
  supabase: ReturnType<typeof createClient>,
  garmentId: string,
  userId: string,
) {
  const { data: claimedRows, error: claimError } = await supabase.rpc(
    "claim_garment_processing",
    { p_garment_id: garmentId, p_user_id: userId },
  );
  const garment = claimedRows?.[0];

  if (claimError) {
    console.error("Could not claim garment", garmentId, claimError);
    return;
  }
  if (!garment) {
    return;
  }

  try {
    assertSecrets();

    const [cutoutBytes, metadata] = await Promise.all([
      removeBackground(garment.image_url),
      analyzeGarment(garment.image_url),
    ]);

    const cutoutPath = `${userId}/${garmentId}_cutout.png`;
    const { error: cutoutError } = await supabase.storage
      .from("garment-images")
      .upload(cutoutPath, cutoutBytes, {
        contentType: "image/png",
        upsert: true,
      });
    if (cutoutError) {
      throw new Error(`Cutout upload failed: ${cutoutError.message}`);
    }

    const {
      data: { publicUrl: cutoutUrl },
    } = supabase.storage.from("garment-images").getPublicUrl(cutoutPath);
    const embedding = await generateEmbedding(metadata);

    const { error: updateError } = await supabase
      .from("garments")
      .update({
        ...metadata,
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
    if (updateError) {
      throw new Error(`Garment update failed: ${updateError.message}`);
    }
  } catch (error) {
    console.error("Garment processing failed", garmentId, error);
    const { error: failureUpdateError } = await supabase
      .from("garments")
      .update({
        processing_status: "failed",
        processing_error: publicProcessingError(error),
        processing_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", garmentId)
      .eq("user_id", userId)
      .eq("processing_status", "processing")
      .eq("processing_attempts", garment.processing_attempts);

    if (failureUpdateError) {
      console.error(
        "Could not persist garment processing failure",
        garmentId,
        failureUpdateError,
      );
    }
  }
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
    throw new Error(`remove.bg returned ${response.status}`);
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
    throw new Error(`OpenAI vision returned ${response.status}`);
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("OpenAI vision returned no metadata");
  }
  return validateMetadata(JSON.parse(content));
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
    throw new Error(`OpenAI embeddings returned ${response.status}`);
  }

  const payload = await response.json();
  const embedding = payload.data?.[0]?.embedding;
  if (!Array.isArray(embedding)) {
    throw new Error("OpenAI embeddings returned no vector");
  }
  return embedding;
}

function validateMetadata(value: Record<string, unknown>) {
  if (
    typeof value?.name !== "string" ||
    !categories.includes(value.category) ||
    !subtypesByCategory[value.category as string]?.includes(value.subtype) ||
    !metalTones.includes(value.metal_tone) ||
    !colors.includes(value.color) ||
    (value.secondary_color !== null &&
      !colors.includes(value.secondary_color)) ||
    !patterns.includes(value.pattern) ||
    !materials.includes(value.material) ||
    !fits.includes(value.fit) ||
    !Number.isInteger(value.formality) ||
    value.formality < 1 ||
    value.formality > 5 ||
    !Array.isArray(value.tags) ||
    !value.tags.every((tag) => typeof tag === "string")
  ) {
    throw new Error("OpenAI vision returned invalid garment metadata");
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
  if (!OPENAI_API_KEY || !REMOVEBG_API_KEY) {
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

function publicProcessingError(error: unknown) {
  if (
    error instanceof Error &&
    error.message === "Provider secrets are not configured"
  ) {
    return "Garment analysis is not configured. Please try again later.";
  }
  return "Garment analysis failed. Please retry.";
}

function json(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
