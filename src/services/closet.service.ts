import { supabase } from "@/lib/supabase";
import {
  ClosetSection,
  ClosetSectionKind,
  Garment,
} from "@/types/database";
import { fetchGarments } from "@/services/garment.service";

export interface ClosetSnapshot {
  sections: ClosetSection[];
  garments: Garment[];
}

export async function fetchCloset(userId: string): Promise<ClosetSnapshot> {
  const [sectionsResult, garments] = await Promise.all([
    supabase
      .from("closet_sections")
      .select("*")
      .eq("user_id", userId)
      .order("position", { ascending: true })
      .order("id", { ascending: true }),
    fetchGarments(userId, undefined, true),
  ]);

  if (sectionsResult.error) {
    throw new Error(`Closet fetch error: ${sectionsResult.error.message}`);
  }

  return {
    sections: (sectionsResult.data ?? []) as ClosetSection[],
    garments,
  };
}

export async function createClosetSection(
  name: string,
  kind: ClosetSectionKind
): Promise<ClosetSection> {
  const { data, error } = await supabase.rpc("create_closet_section", {
    p_name: name.trim(),
    p_kind: kind,
  });

  if (error) throw new Error(`Create section error: ${error.message}`);

  const section = Array.isArray(data) ? data[0] : data;
  if (!section) throw new Error("Create section error: no section returned");
  return section as ClosetSection;
}

export async function renameClosetSection(
  id: string,
  name: string
): Promise<ClosetSection> {
  const { data, error } = await supabase
    .from("closet_sections")
    .update({ name: name.trim(), updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Rename section error: ${error.message}`);
  return data as ClosetSection;
}

export async function reorderClosetSections(
  orderedIds: string[]
): Promise<void> {
  const { error } = await supabase.rpc("reorder_closet_sections", {
    p_ordered_ids: orderedIds,
  });

  if (error) throw new Error(`Reorder sections error: ${error.message}`);
}

export async function placeGarment(
  garmentId: string,
  sectionId: string,
  position: number
): Promise<void> {
  const { error } = await supabase.rpc("place_garment", {
    p_garment_id: garmentId,
    p_section_id: sectionId,
    p_position: position,
  });

  if (error) throw new Error(`Place garment error: ${error.message}`);
}
