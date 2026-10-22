import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import {
  createClosetSection,
  fetchCloset,
  placeGarment,
  renameClosetSection,
  reorderClosetSections,
} from "@/services/closet.service";
import {
  ClosetSection,
  ClosetSectionKind,
  Garment,
} from "@/types/database";

function orderedSections(sections: ClosetSection[]): ClosetSection[] {
  return [...sections].sort(
    (left, right) => left.position - right.position || left.id.localeCompare(right.id)
  );
}

function moveGarmentLocally(
  garments: Garment[],
  garmentId: string,
  sectionId: string,
  requestedPosition: number
): Garment[] {
  const moving = garments.find((garment) => garment.id === garmentId);
  if (!moving) return garments;

  const sourceId = moving.section_id;
  const target = garments
    .filter(
      (garment) =>
        garment.section_id === sectionId && garment.id !== garmentId
    )
    .sort(
      (left, right) =>
        left.position - right.position || left.id.localeCompare(right.id)
    );
  const targetPosition = Math.max(
    0,
    Math.min(requestedPosition, target.length)
  );
  target.splice(targetPosition, 0, { ...moving, section_id: sectionId });

  const positions = new Map(
    target.map((garment, position) => [
      garment.id,
      { sectionId, position },
    ])
  );

  if (sourceId !== sectionId) {
    garments
      .filter(
        (garment) =>
          garment.section_id === sourceId && garment.id !== garmentId
      )
      .sort(
        (left, right) =>
          left.position - right.position || left.id.localeCompare(right.id)
      )
      .forEach((garment, position) => {
        positions.set(garment.id, { sectionId: sourceId, position });
      });
  }

  return garments.map((garment) => {
    const placement = positions.get(garment.id);
    return placement
      ? {
          ...garment,
          section_id: placement.sectionId,
          position: placement.position,
        }
      : garment;
  });
}

export function useCloset() {
  const { user } = useAuth();
  const [sections, setSections] = useState<ClosetSection[]>([]);
  const [garments, setGarments] = useState<Garment[]>([]);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshSequence = useRef(0);
  const layoutMutationDepth = useRef(0);

  const load = useCallback(
    async (showLoading = false) => {
      if (!user) {
        setSections([]);
        setGarments([]);
        setLoading(false);
        return;
      }

      const sequence = ++refreshSequence.current;
      if (showLoading) setLoading(true);

      try {
        const snapshot = await fetchCloset(user.id);
        if (
          sequence !== refreshSequence.current ||
          layoutMutationDepth.current > 0
        ) {
          return;
        }
        setSections(orderedSections(snapshot.sections));
        setGarments(snapshot.garments);
        setError(null);
      } catch (loadError) {
        if (sequence === refreshSequence.current) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load closet"
          );
        }
      } finally {
        if (showLoading && sequence === refreshSequence.current) {
          setLoading(false);
        }
      }
    },
    [user]
  );

  useEffect(() => {
    void load(true);
  }, [load]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`spatial-closet:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "garments",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const deleted = payload.old as Pick<Garment, "id">;
            setGarments((current) =>
              current.filter((garment) => garment.id !== deleted.id)
            );
            return;
          }

          const incoming = payload.new as Garment;
          setGarments((current) => {
            const index = current.findIndex(
              (garment) => garment.id === incoming.id
            );
            if (index === -1) return [...current, incoming];

            const existing = current[index];
            const next =
              layoutMutationDepth.current > 0
                ? {
                    ...incoming,
                    section_id: existing.section_id,
                    position: existing.position,
                  }
                : incoming;

            return current.map((garment, garmentIndex) =>
              garmentIndex === index ? next : garment
            );
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "closet_sections",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          if (layoutMutationDepth.current === 0) void load();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load, user]);

  const startMutation = () => {
    layoutMutationDepth.current += 1;
    setMutating(true);
    setError(null);
  };

  const finishMutation = () => {
    layoutMutationDepth.current = Math.max(
      0,
      layoutMutationDepth.current - 1
    );
    setMutating(layoutMutationDepth.current > 0);
    if (layoutMutationDepth.current === 0) void load();
  };

  const createSection = async (
    name: string,
    kind: ClosetSectionKind
  ): Promise<void> => {
    if (!user) return;

    const temporaryId = `local-${Date.now()}`;
    const temporarySection: ClosetSection = {
      id: temporaryId,
      user_id: user.id,
      name: name.trim(),
      kind,
      position: sections.length,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    startMutation();
    setSections((current) => [...current, temporarySection]);

    try {
      const created = await createClosetSection(name, kind);
      setSections((current) =>
        orderedSections(
          current.map((section) =>
            section.id === temporaryId ? created : section
          )
        )
      );
    } catch (mutationError) {
      setSections((current) =>
        current.filter((section) => section.id !== temporaryId)
      );
      const message =
        mutationError instanceof Error
          ? mutationError.message
          : "Could not create section";
      setError(message);
      throw mutationError;
    } finally {
      finishMutation();
    }
  };

  const renameSection = async (id: string, name: string): Promise<void> => {
    const previous = sections.find((section) => section.id === id);
    if (!previous) return;

    startMutation();
    setSections((current) =>
      current.map((section) =>
        section.id === id ? { ...section, name: name.trim() } : section
      )
    );

    try {
      const updated = await renameClosetSection(id, name);
      setSections((current) =>
        current.map((section) => (section.id === id ? updated : section))
      );
    } catch (mutationError) {
      setSections((current) =>
        current.map((section) => (section.id === id ? previous : section))
      );
      const message =
        mutationError instanceof Error
          ? mutationError.message
          : "Could not rename section";
      setError(message);
      throw mutationError;
    } finally {
      finishMutation();
    }
  };

  const reorderSections = async (orderedIds: string[]): Promise<void> => {
    const previous = sections;
    const byId = new Map(sections.map((section) => [section.id, section]));
    const next = orderedIds
      .map((id, position) => {
        const section = byId.get(id);
        return section ? { ...section, position } : null;
      })
      .filter((section): section is ClosetSection => section !== null);

    if (next.length !== sections.length) return;

    startMutation();
    setSections(next);

    try {
      await reorderClosetSections(orderedIds);
    } catch (mutationError) {
      setSections(previous);
      const message =
        mutationError instanceof Error
          ? mutationError.message
          : "Could not reorder sections";
      setError(message);
      throw mutationError;
    } finally {
      finishMutation();
    }
  };

  const moveGarment = async (
    garmentId: string,
    sectionId: string,
    position: number
  ): Promise<void> => {
    const previousLayout = new Map(
      garments.map((garment) => [
        garment.id,
        { sectionId: garment.section_id, position: garment.position },
      ])
    );

    startMutation();
    setGarments((current) =>
      moveGarmentLocally(current, garmentId, sectionId, position)
    );

    try {
      await placeGarment(garmentId, sectionId, position);
    } catch (mutationError) {
      setGarments((current) =>
        current.map((garment) => {
          const placement = previousLayout.get(garment.id);
          return placement
            ? {
                ...garment,
                section_id: placement.sectionId,
                position: placement.position,
              }
            : garment;
        })
      );
      const message =
        mutationError instanceof Error
          ? mutationError.message
          : "Could not move garment";
      setError(message);
      throw mutationError;
    } finally {
      finishMutation();
    }
  };

  return {
    sections,
    garments,
    loading,
    mutating,
    error,
    refresh: () => load(true),
    createSection,
    renameSection,
    reorderSections,
    moveGarment,
  };
}
