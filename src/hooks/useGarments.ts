import { useState, useEffect, useCallback } from "react";
import { fetchGarments } from "@/services/garment.service";
import { useAuth } from "@/hooks/useAuth";
import { Garment, GarmentCategory } from "@/types/database";
import { supabase } from "@/lib/supabase";

export function useGarments() {
  const { user } = useAuth();
  const [garments, setGarments] = useState<Garment[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<GarmentCategory | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await fetchGarments(user.id, category ?? undefined, true);
      setGarments(data);
    } catch (e) {
      console.error("Failed to load garments:", e);
    } finally {
      setLoading(false);
    }
  }, [user, category]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`garments:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "garments",
          filter: `user_id=eq.${user.id}`,
        },
        () => void load()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load, user]);

  return { garments, loading, category, setCategory, refresh: load };
}
