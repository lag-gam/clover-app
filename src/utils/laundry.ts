import type {
  Garment,
  GarmentCategory,
  OutfitSchedule,
} from "../types/database";
import { localDateKey } from "./date";

export const LAUNDRY_CATEGORIES = new Set<GarmentCategory>([
  "tops",
  "bottoms",
  "dresses",
  "outerwear",
  "underwear",
]);

export type LaundryItem = {
  garment: Garment;
  lastWornDate: string;
  wearCount: number;
};

function washDateKey(value: string | null | undefined) {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return localDateKey(new Date(parsed));
}

export function isStillDirty(garment: Garment, wornDate: string) {
  const washedOn = washDateKey(garment.last_laundered_at);
  return !washedOn || washedOn <= wornDate;
}

export function buildLaundryItems(
  schedules: OutfitSchedule[],
  today: string
): LaundryItem[] {
  const byGarment = new Map<string, LaundryItem>();

  for (const schedule of schedules) {
    if (schedule.scheduled_date >= today) continue;
    for (const item of schedule.outfit?.items ?? []) {
      const garment = item.garment;
      if (!garment || !LAUNDRY_CATEGORIES.has(garment.category)) continue;
      if (!isStillDirty(garment, schedule.scheduled_date)) continue;

      const existing = byGarment.get(garment.id);
      if (!existing) {
        byGarment.set(garment.id, {
          garment,
          lastWornDate: schedule.scheduled_date,
          wearCount: 1,
        });
        continue;
      }

      existing.wearCount += 1;
      if (schedule.scheduled_date > existing.lastWornDate) {
        existing.lastWornDate = schedule.scheduled_date;
        existing.garment = garment;
      }
    }
  }

  return [...byGarment.values()].sort((a, b) =>
    b.lastWornDate.localeCompare(a.lastWornDate)
  );
}
