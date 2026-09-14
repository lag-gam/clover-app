import { supabase } from "@/lib/supabase";
import { Garment, Outfit, OutfitItem } from "@/types/database";
import { averageVectors, cosineSimilarity } from "@/utils/math";

interface OutfitCandidate {
  garments: { garment: Garment; slot: string }[];
  embedding: number[];
  score: number;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getUniqueColors(garments: Garment[]): Set<string> {
  const colors = new Set<string>();
  for (const g of garments) {
    colors.add(g.color);
    if (g.secondary_color) colors.add(g.secondary_color);
  }
  return colors;
}

function hasPatternClash(garments: Garment[]): boolean {
  const boldPatterns = garments.filter(
    (g) => g.pattern !== "solid" && g.pattern !== "other"
  );
  return boldPatterns.length > 1;
}

function formalitySpread(garments: Garment[]): number {
  const vals = garments.map((g) => g.formality);
  return Math.max(...vals) - Math.min(...vals);
}

function isCompatible(garments: Garment[]): boolean {
  if (getUniqueColors(garments).size > 3) return false;
  if (hasPatternClash(garments)) return false;
  if (formalitySpread(garments) > 2) return false;
  return true;
}

export function generateOutfitCandidates(
  allGarments: Garment[],
  count: number = 10,
  styleEmbedding?: number[] | null
): OutfitCandidate[] {
  const byCategory: Record<string, Garment[]> = {};
  for (const g of allGarments) {
    const cat = g.category;
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(g);
  }

  const candidates: OutfitCandidate[] = [];
  const maxAttempts = count * 20;
  let attempts = 0;

  while (candidates.length < count && attempts < maxAttempts) {
    attempts++;
    const items: { garment: Garment; slot: string }[] = [];

    // Decide: dress or top+bottom
    const useDress =
      byCategory["dresses"]?.length && Math.random() < 0.3;

    if (useDress) {
      items.push({ garment: pickRandom(byCategory["dresses"]), slot: "dress" });
    } else {
      if (!byCategory["tops"]?.length || !byCategory["bottoms"]?.length)
        continue;
      items.push({ garment: pickRandom(byCategory["tops"]), slot: "top" });
      items.push({
        garment: pickRandom(byCategory["bottoms"]),
        slot: "bottom",
      });
    }

    // Shoes (required)
    if (!byCategory["shoes"]?.length) continue;
    items.push({ garment: pickRandom(byCategory["shoes"]), slot: "shoes" });

    // Optional outerwear (30% chance)
    if (byCategory["outerwear"]?.length && Math.random() < 0.3) {
      items.push({
        garment: pickRandom(byCategory["outerwear"]),
        slot: "outerwear",
      });
    }

    // Optional accessory (30% chance)
    if (byCategory["accessories"]?.length && Math.random() < 0.3) {
      items.push({
        garment: pickRandom(byCategory["accessories"]),
        slot: "accessory",
      });
    }

    const garments = items.map((i) => i.garment);
    if (!isCompatible(garments)) continue;

    // Check for duplicate outfit
    const garmentIds = new Set(garments.map((g) => g.id));
    const isDuplicate = candidates.some((c) => {
      const cIds = new Set(c.garments.map((g) => g.garment.id));
      return (
        cIds.size === garmentIds.size &&
        [...garmentIds].every((id) => cIds.has(id))
      );
    });
    if (isDuplicate) continue;

    // Compute outfit embedding
    const embeddings = garments
      .map((g) => g.embedding)
      .filter((e): e is number[] => e !== null);

    const embedding =
      embeddings.length > 0 ? averageVectors(embeddings) : [];

    // Score by style similarity if we have a style profile
    let score = 0;
    if (styleEmbedding && embedding.length > 0) {
      score = cosineSimilarity(embedding, styleEmbedding);
    }

    candidates.push({ garments: items, embedding, score });
  }

  // Sort by score (highest first)
  candidates.sort((a, b) => b.score - a.score);

  return candidates;
}

export async function saveOutfit(
  userId: string,
  candidate: OutfitCandidate
): Promise<Outfit> {
  const { data: outfit, error: outfitError } = await supabase
    .from("outfits")
    .insert({
      user_id: userId,
      embedding: candidate.embedding.length > 0 ? candidate.embedding : null,
      score: candidate.score,
    })
    .select()
    .single();

  if (outfitError) throw new Error(`Save outfit error: ${outfitError.message}`);

  const outfitItems = candidate.garments.map((item) => ({
    outfit_id: outfit.id,
    garment_id: item.garment.id,
    slot: item.slot,
  }));

  const { error: itemsError } = await supabase
    .from("outfit_items")
    .insert(outfitItems);

  if (itemsError)
    throw new Error(`Save outfit items error: ${itemsError.message}`);

  return outfit as Outfit;
}

export async function fetchOutfitWithItems(
  outfitId: string
): Promise<{ outfit: Outfit; items: (OutfitItem & { garment: Garment })[] }> {
  const { data: outfit, error: outfitError } = await supabase
    .from("outfits")
    .select("*")
    .eq("id", outfitId)
    .single();

  if (outfitError) throw new Error(`Fetch outfit error: ${outfitError.message}`);

  const { data: items, error: itemsError } = await supabase
    .from("outfit_items")
    .select("*, garment:garments(*)")
    .eq("outfit_id", outfitId);

  if (itemsError) throw new Error(`Fetch items error: ${itemsError.message}`);

  return {
    outfit: outfit as Outfit,
    items: items as (OutfitItem & { garment: Garment })[],
  };
}

export function getAlternatives(
  allGarments: Garment[],
  currentGarment: Garment,
  outfitGarments: Garment[]
): Garment[] {
  return allGarments.filter((g) => {
    if (g.id === currentGarment.id) return false;
    if (g.category !== currentGarment.category) return false;
    // Check compatibility with rest of outfit
    const otherGarments = outfitGarments.filter(
      (og) => og.id !== currentGarment.id
    );
    return isCompatible([...otherGarments, g]);
  });
}
