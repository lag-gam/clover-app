import type { GarmentDisplaySide } from "../types/database";

export interface SidedGarmentImage {
  image_url: string;
  cutout_url: string | null;
  back_image_url: string | null;
  back_cutout_url: string | null;
}

export function resolveGarmentImage(
  garment: SidedGarmentImage,
  side: GarmentDisplaySide = "front"
): string {
  if (side === "back" && garment.back_image_url) {
    return garment.back_cutout_url ?? garment.back_image_url;
  }
  return garment.cutout_url ?? garment.image_url;
}

export function persistedDisplaySide(
  side: GarmentDisplaySide | undefined
): GarmentDisplaySide {
  return side ?? "front";
}

export function filterSaved<T extends { is_saved: boolean }>(
  outfits: T[]
): T[] {
  return outfits.filter((outfit) => outfit.is_saved);
}

export function replaceDisplayedItem<
  T extends {
    garment: { id: string };
    display_side?: GarmentDisplaySide;
  },
  G extends { id: string },
>(items: T[], removedGarmentId: string, replacement: G): (Omit<T, "garment"> & {
  garment: G | T["garment"];
  display_side: GarmentDisplaySide;
})[] {
  return items.map((item) =>
    item.garment.id === removedGarmentId
      ? { ...item, garment: replacement, display_side: "front" }
      : { ...item, display_side: persistedDisplaySide(item.display_side) }
  );
}
