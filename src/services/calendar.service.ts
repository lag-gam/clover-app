import { supabase } from "@/lib/supabase";
import { OutfitSchedule, OutfitWithItems } from "@/types/database";

const OUTFIT_WITH_ITEMS =
  "*, items:outfit_items(*, garment:garments(*))";
const SCHEDULE_WITH_OUTFIT =
  `*, outfit:outfits(${OUTFIT_WITH_ITEMS})`;

export async function fetchSavedOutfits(
  userId: string
): Promise<OutfitWithItems[]> {
  const { data, error } = await supabase
    .from("outfits")
    .select(OUTFIT_WITH_ITEMS)
    .eq("user_id", userId)
    .eq("is_saved", true)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Fetch outfits error: ${error.message}`);
  return (data ?? []) as unknown as OutfitWithItems[];
}

export async function fetchOutfitSchedule(
  userId: string,
  startDate: string,
  endDate: string
): Promise<OutfitSchedule[]> {
  const { data, error } = await supabase
    .from("outfit_schedule")
    .select(SCHEDULE_WITH_OUTFIT)
    .eq("user_id", userId)
    .gte("scheduled_date", startDate)
    .lte("scheduled_date", endDate)
    .order("scheduled_date", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Fetch schedule error: ${error.message}`);
  return (data ?? []) as unknown as OutfitSchedule[];
}

export async function scheduleOutfit(
  userId: string,
  outfitId: string,
  scheduledDate: string
): Promise<void> {
  const { error } = await supabase.from("outfit_schedule").insert({
    user_id: userId,
    outfit_id: outfitId,
    scheduled_date: scheduledDate,
  });

  if (error?.code === "23505") {
    throw new Error("This outfit is already scheduled for that day.");
  }
  if (error) throw new Error(`Schedule outfit error: ${error.message}`);
}

export async function removeScheduledOutfit(
  scheduleId: string
): Promise<void> {
  const { error } = await supabase
    .from("outfit_schedule")
    .delete()
    .eq("id", scheduleId);

  if (error) throw new Error(`Remove schedule error: ${error.message}`);
}

export async function rescheduleOutfit(
  scheduleId: string,
  scheduledDate: string
): Promise<void> {
  const { error } = await supabase
    .from("outfit_schedule")
    .update({
      scheduled_date: scheduledDate,
      updated_at: new Date().toISOString(),
    })
    .eq("id", scheduleId);

  if (error?.code === "23505") {
    throw new Error("This outfit is already scheduled for that day.");
  }
  if (error) throw new Error(`Reschedule outfit error: ${error.message}`);
}
