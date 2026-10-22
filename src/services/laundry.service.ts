import { supabase } from "@/lib/supabase";
import { OutfitSchedule } from "@/types/database";
import { localDateKey } from "@/utils/date";
import { buildLaundryItems, LaundryItem } from "@/utils/laundry";

export type { LaundryItem };

const OUTFIT_WITH_ITEMS =
  "*, items:outfit_items(*, garment:garments(*))";
const SCHEDULE_WITH_OUTFIT =
  `*, outfit:outfits(${OUTFIT_WITH_ITEMS})`;

export async function fetchLaundryItems(
  userId: string,
  today = localDateKey(new Date())
): Promise<LaundryItem[]> {
  const { data, error } = await supabase
    .from("outfit_schedule")
    .select(SCHEDULE_WITH_OUTFIT)
    .eq("user_id", userId)
    .lt("scheduled_date", today)
    .order("scheduled_date", { ascending: false });

  if (error) throw new Error(`Fetch laundry error: ${error.message}`);
  return buildLaundryItems(
    (data ?? []) as unknown as OutfitSchedule[],
    today
  );
}

export async function washGarments(
  userId: string,
  garmentIds: string[]
): Promise<void> {
  const ids = [...new Set(garmentIds)];
  if (ids.length === 0) return;

  const washedAt = new Date().toISOString();
  const { error } = await supabase
    .from("garments")
    .update({
      last_laundered_at: washedAt,
      updated_at: washedAt,
    })
    .eq("user_id", userId)
    .in("id", ids);

  if (error) throw new Error(`Wash laundry error: ${error.message}`);
}
