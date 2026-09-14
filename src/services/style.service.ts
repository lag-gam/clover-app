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
): Promise<{ embedding: number[]; interactionCount: number } | null> {
  // Fetch all meaningful interactions with their outfit embeddings
  const { data: interactions, error } = await supabase
    .from("interactions")
    .select("interaction_type, outfit:outfits(embedding)")
    .eq("user_id", userId)
    .in("interaction_type", ["worn", "repeated", "selected", "liked", "disliked"]);

  if (error || !interactions || interactions.length === 0) return null;

  const vectors: number[][] = [];
  const weights: number[] = [];

  for (const interaction of interactions) {
    const outfit = interaction.outfit as unknown as { embedding: number[] | null };
    if (!outfit?.embedding) continue;

    const weight = INTERACTION_WEIGHTS[interaction.interaction_type as InteractionType] ?? 0;
    if (weight === 0) continue;

    vectors.push(outfit.embedding);
    weights.push(weight);
  }

  if (vectors.length === 0) return null;

  const embedding = weightedAverageVectors(vectors, weights);

  return { embedding, interactionCount: interactions.length };
}

export async function updateStyleProfile(userId: string): Promise<StyleProfile | null> {
  const result = await computeStyleProfile(userId);
  if (!result) return null;

  const { data, error } = await supabase
    .from("style_profiles")
    .upsert(
      {
        user_id: userId,
        style_embedding: result.embedding,
        interaction_count: result.interactionCount,
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
