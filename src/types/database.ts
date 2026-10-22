export type GarmentCategory =
  | "tops"
  | "bottoms"
  | "dresses"
  | "outerwear"
  | "shoes"
  | "underwear"
  | "accessories";

export type GarmentSubtype =
  | "t_shirt"
  | "shirt"
  | "blouse"
  | "tank_top"
  | "sweater"
  | "hoodie"
  | "jeans"
  | "trousers"
  | "shorts"
  | "skirt"
  | "dress"
  | "jumpsuit"
  | "jacket"
  | "coat"
  | "blazer"
  | "vest"
  | "sneakers"
  | "boots"
  | "loafers"
  | "sandals"
  | "heels"
  | "boxers"
  | "briefs"
  | "boxer_briefs"
  | "necklace"
  | "watch"
  | "hat"
  | "beanie"
  | "belt"
  | "bag"
  | "glasses"
  | "bracelet"
  | "ring"
  | "earbuds"
  | "other";

export type MetalTone = "none" | "silver" | "gold" | "rose_gold" | "mixed";

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

export type GarmentProcessingStatus =
  | "pending"
  | "processing"
  | "ready"
  | "failed";

export type GarmentDisplaySide = "front" | "back";

export type ClosetSectionKind = "rail" | "shelf" | "drawer";

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
  subtype: GarmentSubtype | null;
  metal_tone: MetalTone;
  color: GarmentColor;
  secondary_color: GarmentColor | null;
  pattern: GarmentPattern;
  material: GarmentMaterial;
  fit: GarmentFit;
  formality: Formality;
  image_url: string;
  cutout_url: string | null;
  back_image_url: string | null;
  back_cutout_url: string | null;
  embedding: number[] | null;
  tags: string[];
  processing_status: GarmentProcessingStatus;
  processing_attempts: number;
  processing_error: string | null;
  processing_started_at: string | null;
  processing_completed_at: string | null;
  section_id: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface ClosetSection {
  id: string;
  user_id: string;
  name: string;
  kind: ClosetSectionKind;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface Outfit {
  id: string;
  user_id: string;
  name: string | null;
  embedding: number[] | null;
  score: number | null;
  is_saved: boolean;
  created_at: string;
}

export interface OutfitItem {
  id: string;
  outfit_id: string;
  garment_id: string;
  slot: string;
  display_side: GarmentDisplaySide;
  garment?: Garment;
}

export interface OutfitWithItems extends Outfit {
  items: (OutfitItem & { garment: Garment })[];
}

export interface OutfitSchedule {
  id: string;
  user_id: string;
  outfit_id: string;
  scheduled_date: string;
  created_at: string;
  updated_at: string;
  outfit: OutfitWithItems;
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
  interaction_embedding: number[] | null;
  pinterest_embedding: number[] | null;
  interaction_count: number;
  pinterest_pin_count: number;
  pinterest_updated_at: string | null;
  updated_at: string;
}

export interface PinterestBoard {
  pinterest_board_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  selected: boolean;
  last_synced_at: string | null;
}

export interface PinterestStatus {
  connected: boolean;
  connectedAt: string | null;
  expiresAt: string | null;
  boards: PinterestBoard[];
  pinCount: number;
}
