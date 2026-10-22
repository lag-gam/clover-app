import { Garment, Outfit, OutfitItem } from "@/types/database";
import { averageVectors, cosineSimilarity } from "@/utils/math";

export interface OutfitCandidate {
  garments: { garment: Garment; slot: string }[];
  embedding: number[];
  score: number;
  pinterestInformed: boolean;
  pinterestScore: number;
}

export interface OutfitGenerationOptions {
  sagMode?: boolean;
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

function isPantsGarment(garment: Garment): boolean {
  if (garment.category !== "bottoms") return false;
  if (garment.subtype === "skirt") return false;
  const descriptors = `${garment.name} ${garment.tags.join(" ")}`.toLowerCase();
  return !descriptors.includes("skirt");
}

export function generateOutfitCandidates(
  allGarments: Garment[],
  count: number = 10,
  styleEmbedding?: number[] | null,
  requiredGarment?: Garment,
  pinterestEmbedding?: number[] | null,
  options: OutfitGenerationOptions = {}
): OutfitCandidate[] {
  if (requiredGarment && requiredGarment.processing_status !== "ready") {
    return [];
  }

  const readyGarments = allGarments.filter(
    (garment) => garment.processing_status === "ready"
  );
  if (
    requiredGarment &&
    !readyGarments.some((garment) => garment.id === requiredGarment.id)
  ) {
    readyGarments.push(requiredGarment);
  }

  const byCategory: Record<string, Garment[]> = {};
  for (const g of readyGarments) {
    const cat = g.category;
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(g);
  }

  const candidates: OutfitCandidate[] = [];
  const maxAttempts = count * 20;
  let attempts = 0;
  const sagMode = options.sagMode ?? false;

  if (requiredGarment?.category === "underwear" && !sagMode) {
    return [];
  }
  if (sagMode && requiredGarment?.category === "dresses") {
    return [];
  }
  if (
    sagMode &&
    requiredGarment?.category === "bottoms" &&
    !isPantsGarment(requiredGarment)
  ) {
    return [];
  }

  while (candidates.length < count && attempts < maxAttempts) {
    attempts++;
    const items: { garment: Garment; slot: string }[] = [];

    // Decide: dress or top+bottom, while preserving the selected garment.
    const useDress = sagMode || requiredGarment?.category === "underwear"
      ? false
      : requiredGarment?.category === "dresses"
      ? true
      : requiredGarment?.category === "tops" ||
          requiredGarment?.category === "bottoms"
        ? false
        : Boolean(byCategory["dresses"]?.length && Math.random() < 0.3);

    if (useDress) {
      const dress =
        requiredGarment?.category === "dresses"
          ? requiredGarment
          : pickRandom(byCategory["dresses"]);
      items.push({ garment: dress, slot: "dress" });
    } else {
      const bottoms = sagMode
        ? (byCategory["bottoms"] ?? []).filter(isPantsGarment)
        : byCategory["bottoms"];
      if (!byCategory["tops"]?.length || !bottoms?.length)
        continue;
      items.push({
        garment:
          requiredGarment?.category === "tops"
            ? requiredGarment
            : pickRandom(byCategory["tops"]),
        slot: "top",
      });
      items.push({
        garment:
          requiredGarment?.category === "bottoms"
            ? requiredGarment
            : pickRandom(bottoms),
        slot: "bottom",
      });
    }

    // Sag mode is pants-only and always exposes one compatible underwear item.
    if (!useDress && sagMode) {
      if (!byCategory["underwear"]?.length) continue;
      items.push({
        garment:
          requiredGarment?.category === "underwear"
            ? requiredGarment
            : pickRandom(byCategory["underwear"]),
        slot: "underwear",
      });
    }

    // Shoes (required)
    if (!byCategory["shoes"]?.length) continue;
    items.push({
      garment:
        requiredGarment?.category === "shoes"
          ? requiredGarment
          : pickRandom(byCategory["shoes"]),
      slot: "shoes",
    });

    // Optional outerwear (30% chance)
    if (
      byCategory["outerwear"]?.length &&
      (requiredGarment?.category === "outerwear" || Math.random() < 0.3)
    ) {
      items.push({
        garment:
          requiredGarment?.category === "outerwear"
            ? requiredGarment
            : pickRandom(byCategory["outerwear"]),
        slot: "outerwear",
      });
    }

    // Editorial flat lays may include several accessories, but never repeat a
    // subtype (for example, two watches).
    const accessoryPool = byCategory["accessories"] ?? [];
    if (
      accessoryPool.length &&
      (requiredGarment?.category === "accessories" || Math.random() < 0.65)
    ) {
      const selectedAccessories: Garment[] = [];
      const usedSubtypes = new Set<string>();
      if (requiredGarment?.category === "accessories") {
        selectedAccessories.push(requiredGarment);
        usedSubtypes.add(requiredGarment.subtype ?? "other");
      }

      const targetCount = Math.min(
        accessoryPool.length,
        1 + Math.floor(Math.random() * 3)
      );
      for (const accessory of shuffle(accessoryPool)) {
        const subtype = accessory.subtype ?? "other";
        if (
          selectedAccessories.some((item) => item.id === accessory.id) ||
          usedSubtypes.has(subtype)
        ) {
          continue;
        }
        selectedAccessories.push(accessory);
        usedSubtypes.add(subtype);
        if (selectedAccessories.length >= targetCount) break;
      }

      for (const accessory of selectedAccessories) {
        items.push({
          garment: accessory,
          slot: `accessory:${accessory.subtype ?? "other"}`,
        });
      }
    }

    const garments = items.map((i) => i.garment);
    if (
      requiredGarment &&
      !garments.some((garment) => garment.id === requiredGarment.id)
    ) {
      continue;
    }
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
    let styleScore = 0;
    if (styleEmbedding && embedding.length > 0) {
      styleScore = cosineSimilarity(embedding, styleEmbedding);
    }
    const pinterestScore =
      pinterestEmbedding && embedding.length > 0
        ? cosineSimilarity(embedding, pinterestEmbedding)
        : 0;
    const score =
      styleEmbedding && pinterestEmbedding
        ? styleScore * 0.65 + pinterestScore * 0.35
        : styleEmbedding
          ? styleScore
          : pinterestScore;

    candidates.push({
      garments: items,
      embedding,
      score,
      pinterestInformed: Boolean(pinterestEmbedding),
      pinterestScore,
    });
  }

  // Sort by score (highest first)
  candidates.sort((a, b) => b.score - a.score);

  return candidates;
}

export async function saveOutfit(
  userId: string,
  candidate: OutfitCandidate
): Promise<Outfit> {
  const { supabase } = await import("@/lib/supabase");
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
  const { supabase } = await import("@/lib/supabase");
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
    if (
      g.category === "accessories" &&
      otherGarments.some(
        (other) =>
          other.category === "accessories" &&
          (other.subtype ?? "other") === (g.subtype ?? "other")
      )
    ) {
      return false;
    }
    return isCompatible([...otherGarments, g]);
  });
}
