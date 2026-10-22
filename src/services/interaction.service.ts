import { supabase } from "@/lib/supabase";
import { Interaction, InteractionType } from "@/types/database";

export async function logInteraction(
  userId: string,
  outfitId: string,
  type: InteractionType,
  swappedGarmentId?: string,
  replacementGarmentId?: string
): Promise<Interaction> {
  const { data, error } = await supabase
    .from("interactions")
    .insert({
      user_id: userId,
      outfit_id: outfitId,
      interaction_type: type,
      swapped_garment_id: swappedGarmentId ?? null,
      replacement_garment_id: replacementGarmentId ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`Interaction error: ${error.message}`);
  return data as Interaction;
}

export async function fetchInteractions(userId: string): Promise<Interaction[]> {
  const { data, error } = await supabase
    .from("interactions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Fetch interactions error: ${error.message}`);
  return (data ?? []) as Interaction[];
}

export async function getInteractionCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("interactions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("interaction_type", [
      "liked",
      "disliked",
      "selected",
      "worn",
      "repeated",
      "skipped",
      "item_swapped",
    ]);

  if (error) return 0;
  return count ?? 0;
}
