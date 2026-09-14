export type GarmentCategory =
  | "tops"
  | "bottoms"
  | "dresses"
  | "outerwear"
  | "shoes"
  | "accessories";

export type GarmentColor =
  | "black"
  | "white"
  | "gray"
  | "navy"
  | "blue"
  | "red"
  | "pink"
  | "green"
  | "yellow"
  | "orange"
  | "purple"
  | "brown"
  | "beige"
  | "cream"
  | "multicolor";

export type GarmentPattern =
  | "solid"
  | "stripes"
  | "plaid"
  | "floral"
  | "polka dots"
  | "geometric"
  | "animal print"
  | "abstract"
  | "other";

export type GarmentMaterial =
  | "cotton"
  | "polyester"
  | "silk"
  | "wool"
  | "denim"
  | "leather"
  | "linen"
  | "nylon"
  | "cashmere"
  | "synthetic blend"
  | "other";

export type GarmentFit = "slim" | "regular" | "relaxed" | "oversized";

export type Formality = 1 | 2 | 3 | 4 | 5; // 1=very casual, 5=very formal

export type InteractionType =
  | "shown"
  | "skipped"
  | "liked"
  | "disliked"
  | "selected"
  | "worn"
  | "repeated"
  | "item_swapped";

export interface Garment {
  id: string;
  user_id: string;
  name: string;
  category: GarmentCategory;
  color: GarmentColor;
  secondary_color: GarmentColor | null;
  pattern: GarmentPattern;
  material: GarmentMaterial;
  fit: GarmentFit;
  formality: Formality;
  image_url: string;
  cutout_url: string | null;
  embedding: number[] | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface Outfit {
  id: string;
  user_id: string;
  name: string | null;
  embedding: number[] | null;
  score: number | null;
  created_at: string;
}

export interface OutfitItem {
  id: string;
  outfit_id: string;
  garment_id: string;
  slot: string;
  garment?: Garment;
}

export interface Interaction {
  id: string;
  user_id: string;
  outfit_id: string;
  interaction_type: InteractionType;
  swapped_garment_id: string | null;
  replacement_garment_id: string | null;
  created_at: string;
}

export interface StyleProfile {
  id: string;
  user_id: string;
  style_embedding: number[] | null;
  interaction_count: number;
  updated_at: string;
}
