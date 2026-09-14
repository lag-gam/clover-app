import { useState, useEffect, useCallback } from "react";
import { getStyleProfile, updateStyleProfile } from "@/services/style.service";
import { getInteractionCount } from "@/services/interaction.service";
import { useAuth } from "@/hooks/useAuth";
import { StyleProfile } from "@/types/database";

const RECALC_INTERVAL = 5; // Recalculate after every N new interactions

export function useStyleProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<StyleProfile | null>(null);
  const [interactionCount, setInteractionCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastCalcCount, setLastCalcCount] = useState(0);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [p, count] = await Promise.all([
        getStyleProfile(user.id),
        getInteractionCount(user.id),
      ]);
      setProfile(p);
      setInteractionCount(count);
      setLastCalcCount(p?.interaction_count ?? 0);
    } catch (e) {
      console.error("Failed to load style profile:", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  // Auto-recalculate when enough new interactions have happened
  const maybeRecalculate = useCallback(async () => {
    if (!user) return;

    const currentCount = await getInteractionCount(user.id);
    setInteractionCount(currentCount);

    if (currentCount - lastCalcCount >= RECALC_INTERVAL) {
      const updated = await updateStyleProfile(user.id);
      if (updated) {
        setProfile(updated);
        setLastCalcCount(updated.interaction_count);
      }
    }
  }, [user, lastCalcCount]);

  return {
    profile,
    interactionCount,
    loading,
    refresh: load,
    maybeRecalculate,
    isColdStart: interactionCount < RECALC_INTERVAL,
  };
}
