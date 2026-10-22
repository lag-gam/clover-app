import { supabase } from "@/lib/supabase";
import { weightedAverageVectors } from "@/utils/math";
import { InteractionType, StyleProfile } from "@/types/database";

const INTERACTION_WEIGHTS: Partial<Record<InteractionType, number>> = {
  worn: 2.0,
  repeated: 2.0,
  selected: 1.5,
  liked: 1.0,
  disliked: -1.0,
  skipped: 0,
  shown: 0,
  item_swapped: 0,
};

export async function computeStyleProfile(
  userId: string
): Promise<{
  embedding: number[];
  interactionEmbedding: number[] | null;
  interactionCount: number;
  pinterestEmbedding: number[] | null;
  pinterestPinCount: number;
} | null> {
  const [{ data: interactions, error }, { data: existing }] = await Promise.all([
    supabase
      .from("interactions")
      .select(
        "interaction_type, outfit:outfits(embedding), swapped:garments!interactions_swapped_garment_id_fkey(embedding), replacement:garments!interactions_replacement_garment_id_fkey(embedding)"
      )
      .eq("user_id", userId)
      .in("interaction_type", [
        "worn",
        "repeated",
        "selected",
        "liked",
        "disliked",
        "skipped",
        "item_swapped",
      ]),
    supabase
      .from("style_profiles")
      .select("pinterest_embedding, pinterest_pin_count")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (error) throw new Error(`Style interactions error: ${error.message}`);

  const vectors: number[][] = [];
  const weights: number[] = [];

  for (const interaction of interactions ?? []) {
    if (interaction.interaction_type === "item_swapped") {
      const swapped = interaction.swapped as unknown as {
        embedding: number[] | null;
      } | null;
      const replacement = interaction.replacement as unknown as {
        embedding: number[] | null;
      } | null;
      if (replacement?.embedding) {
        vectors.push(replacement.embedding);
        weights.push(1);
      }
      if (swapped?.embedding) {
        vectors.push(swapped.embedding);
        weights.push(-1);
      }
      continue;
    }

    const outfit = interaction.outfit as unknown as {
      embedding: number[] | null;
    };
    if (!outfit?.embedding) continue;

    const weight =
      INTERACTION_WEIGHTS[
        interaction.interaction_type as InteractionType
      ] ?? 0;
    if (weight === 0) continue;

    vectors.push(outfit.embedding);
    weights.push(weight);
  }

  const interactionEmbedding =
    vectors.length > 0 ? weightedAverageVectors(vectors, weights) : null;
  const pinterestEmbedding = Array.isArray(existing?.pinterest_embedding)
    ? (existing.pinterest_embedding as number[])
    : null;
  const embedding = blendTasteEmbeddings(
    interactionEmbedding,
    pinterestEmbedding
  );
  if (!embedding) return null;

  return {
    embedding,
    interactionEmbedding,
    interactionCount: interactions?.length ?? 0,
    pinterestEmbedding,
    pinterestPinCount: existing?.pinterest_pin_count ?? 0,
  };
}

export function blendTasteEmbeddings(
  interactionEmbedding: number[] | null,
  pinterestEmbedding: number[] | null
): number[] | null {
  if (!interactionEmbedding) return pinterestEmbedding;
  if (!pinterestEmbedding) return interactionEmbedding;
  if (interactionEmbedding.length !== pinterestEmbedding.length) {
    return interactionEmbedding;
  }
  return interactionEmbedding.map(
    (value, index) => value * 0.65 + pinterestEmbedding[index] * 0.35
  );
}

export async function updateStyleProfile(
  userId: string
): Promise<StyleProfile | null> {
  const result = await computeStyleProfile(userId);
  if (!result) return null;

  const { data, error } = await supabase
    .from("style_profiles")
    .upsert(
      {
        user_id: userId,
        style_embedding: result.embedding,
        interaction_embedding: result.interactionEmbedding,
        interaction_count: result.interactionCount,
        pinterest_embedding: result.pinterestEmbedding,
        pinterest_pin_count: result.pinterestPinCount,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )
    .select()
    .single();

  if (error) throw new Error(`Style profile error: ${error.message}`);
  return data as StyleProfile;
}

export async function getStyleProfile(userId: string): Promise<StyleProfile | null> {
  const { data, error } = await supabase
    .from("style_profiles")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error) return null;
  return data as StyleProfile;
}
