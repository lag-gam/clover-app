import {
  GarmentCategory,
  GarmentColor,
  GarmentFit,
  GarmentMaterial,
  GarmentPattern,
  GarmentSubtype,
  MetalTone,
} from "@/types/database";

export const CATEGORIES: { label: string; value: GarmentCategory }[] = [
  { label: "Tops", value: "tops" },
  { label: "Bottoms", value: "bottoms" },
  { label: "Dresses", value: "dresses" },
  { label: "Outerwear", value: "outerwear" },
  { label: "Shoes", value: "shoes" },
  { label: "Underwear", value: "underwear" },
  { label: "Accessories", value: "accessories" },
];

export const SUBTYPES_BY_CATEGORY: Record<
  GarmentCategory,
  GarmentSubtype[]
> = {
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

export const METAL_TONES: MetalTone[] = [
  "none",
  "silver",
  "gold",
  "rose_gold",
  "mixed",
];

export const COLORS: GarmentColor[] = [
  "black", "white", "gray", "navy", "blue", "red", "pink",
  "green", "yellow", "orange", "purple", "brown", "beige", "cream", "multicolor",
];

export const PATTERNS: GarmentPattern[] = [
  "solid", "stripes", "plaid", "floral", "polka dots",
  "geometric", "animal print", "abstract", "other",
];

export const MATERIALS: GarmentMaterial[] = [
  "cotton", "polyester", "silk", "wool", "denim",
  "leather", "linen", "nylon", "cashmere", "synthetic blend", "other",
];

export const FITS: GarmentFit[] = ["slim", "regular", "relaxed", "oversized"];

export const FORMALITY_LABELS: Record<number, string> = {
  1: "Very Casual",
  2: "Casual",
  3: "Smart Casual",
  4: "Semi-Formal",
  5: "Formal",
};

export const OUTFIT_SLOTS = {
  REQUIRED: ["top", "bottom", "shoes"] as const,
  OPTIONAL: ["outerwear", "underwear", "accessory"] as const,
  DRESS_REPLACES: ["top", "bottom"] as const,
};

export const CATEGORY_TO_SLOT: Record<GarmentCategory, string> = {
  tops: "top",
  bottoms: "bottom",
  dresses: "dress",
  outerwear: "outerwear",
  shoes: "shoes",
  underwear: "underwear",
  accessories: "accessory",
};
