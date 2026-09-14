import { GarmentCategory, GarmentColor, GarmentPattern, GarmentMaterial, GarmentFit } from "@/types/database";

export const CATEGORIES: { label: string; value: GarmentCategory }[] = [
  { label: "Tops", value: "tops" },
  { label: "Bottoms", value: "bottoms" },
  { label: "Dresses", value: "dresses" },
  { label: "Outerwear", value: "outerwear" },
  { label: "Shoes", value: "shoes" },
  { label: "Accessories", value: "accessories" },
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
  OPTIONAL: ["outerwear", "accessory"] as const,
  DRESS_REPLACES: ["top", "bottom"] as const,
};

export const CATEGORY_TO_SLOT: Record<GarmentCategory, string> = {
  tops: "top",
  bottoms: "bottom",
  dresses: "dress",
  outerwear: "outerwear",
  shoes: "shoes",
  accessories: "accessory",
};
