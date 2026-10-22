import { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "@/hooks/useAuth";
import { fetchGarments } from "@/services/garment.service";
import {
  generateOutfitCandidates,
  saveOutfit,
  getAlternatives,
  OutfitCandidate,
  swapPersistedOutfitItem,
} from "@/services/outfit.service";
import { logInteraction } from "@/services/interaction.service";
import { HomeGestureCoach } from "@/components/HomeGestureCoach";
import { OutfitCard } from "@/components/OutfitCard";
import { useHomeGestureCoach } from "@/hooks/useHomeGestureCoach";
import {
  FlatLayItem,
} from "@/components/FlatLayCollage";
import { OutfitItemActionSheet } from "@/components/OutfitItemActionSheet";
import { SwapSheet } from "@/components/SwapSheet";
import { useSagMode } from "@/hooks/useSagMode";
import { useStyleProfile } from "@/hooks/useStyleProfile";
import { Garment } from "@/types/database";
import { Ionicons } from "@expo/vector-icons";
import { replaceDisplayedItem } from "@/utils/outfit-state";
import { averageVectors } from "@/utils/math";

interface DisplayOutfit extends OutfitCandidate {
  savedId?: string;
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [allGarments, setAllGarments] = useState<Garment[]>([]);
  const [outfits, setOutfits] = useState<DisplayOutfit[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [garmentCount, setGarmentCount] = useState(0);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [actionItem, setActionItem] = useState<FlatLayItem | null>(null);
  const [savingOutfit, setSavingOutfit] = useState(false);
  const [savedIndexes, setSavedIndexes] = useState<Set<number>>(new Set());
  const [likedIndexes, setLikedIndexes] = useState<Set<number>>(new Set());
  const advancingRef = useRef(false);
  const likedIndexesRef = useRef(likedIndexes);
  const savedIndexesRef = useRef(savedIndexes);
  likedIndexesRef.current = likedIndexes;
  savedIndexesRef.current = savedIndexes;

  const { profile, maybeRecalculate, isColdStart } = useStyleProfile();
  const { sagMode, reload: reloadSagMode } = useSagMode();
  const { visible: showGestureCoach, dismiss: dismissGestureCoach } =
    useHomeGestureCoach();

  // Swap sheet state
  const [swapTarget, setSwapTarget] = useState<Garment | null>(null);
  const [swapAlternatives, setSwapAlternatives] = useState<Garment[]>([]);

  useFocusEffect(
    useCallback(() => {
      reloadSagMode();
      if (user) {
        fetchGarments(user.id).then((g) => {
          setAllGarments(g);
          setGarmentCount(g.length);
        });
      }
    }, [reloadSagMode, user])
  );

  const generateOutfits = async () => {
    if (!user) return;
    setLoading(true);
    setGenerationError(null);

    try {
      const styleEmbed = profile?.style_embedding as number[] | null;

      const garments = await fetchGarments(user.id);
      setAllGarments(garments);

      const candidates = generateOutfitCandidates(
        garments,
        10,
        styleEmbed,
        undefined,
        profile?.pinterest_embedding,
        { sagMode }
      );
      if (candidates.length === 0) {
        setGenerationError(
          sagMode
            ? "Sag mode needs ready tops, bottoms, shoes, and underwear."
            : "Add ready, compatible tops, bottoms or dresses, and shoes."
        );
      }

      // Save all as outfits in DB and log "shown"
      const saved: DisplayOutfit[] = [];
      for (const candidate of candidates) {
        const result = await saveOutfit(user.id, candidate);
        await logInteraction(user.id, result.outfit.id, "shown");
        saved.push({
          ...candidate,
          garments: candidate.garments.map((item) => ({
            ...item,
            outfit_item_id: result.items.find(
              (savedItem) => savedItem.garment_id === item.garment.id
            )?.id,
          })),
          savedId: result.outfit.id,
        });
      }

      setOutfits(saved);
      setCurrentIndex(0);
      setSavedIndexes(new Set());
      setLikedIndexes(new Set());
      advancingRef.current = false;
    } catch (e) {
      console.error("Generation error:", e);
    } finally {
      setLoading(false);
    }
  };

  const advanceFeed = () => {
    if (advancingRef.current) return false;
    advancingRef.current = true;
    setCurrentIndex((index) => index + 1);
    advancingRef.current = false;
    return true;
  };

  const handleLike = () => {
    const current = outfits[currentIndex];
    if (!current || likedIndexes.has(currentIndex) || savedIndexes.has(currentIndex)) {
      return;
    }
    setLikedIndexes((indexes) => new Set(indexes).add(currentIndex));
    if (current.savedId && user) {
      void logInteraction(user.id, current.savedId, "liked").catch((error) => {
        console.error("Could not save rating:", error);
      });
      void maybeRecalculate().catch((error) => {
        console.error("Style recalculation failed:", error);
      });
    }
  };

  const handlePass = () => {
    const current = outfits[currentIndex];
    if (!current || !advanceFeed()) return;

    const alreadyPositive =
      likedIndexesRef.current.has(currentIndex) ||
      savedIndexesRef.current.has(currentIndex);
    if (current.savedId && user && !alreadyPositive) {
      void logInteraction(user.id, current.savedId, "skipped").catch((error) => {
        console.error("Could not save rating:", error);
      });
    }
  };

  const handleDislike = () => {
    const current = outfits[currentIndex];
    if (!current || !advanceFeed()) return;
    if (current.savedId && user) {
      void logInteraction(user.id, current.savedId, "disliked").catch((error) => {
        console.error("Could not save rating:", error);
      });
      void maybeRecalculate().catch((error) => {
        console.error("Style recalculation failed:", error);
      });
    }
  };

  const beginSwap = (garment: Garment) => {
    const current = outfits[currentIndex];
    if (!current) return;

    const outfitGarments = current.garments.map((g) => g.garment);
    const alts = getAlternatives(allGarments, garment, outfitGarments);
    setSwapTarget(garment);
    setSwapAlternatives(alts);
    setActionItem(null);
  };

  const handleSwap = async (replacement: Garment) => {
    const current = outfits[currentIndex];
    if (!current || !swapTarget || !user) return;

    if (current.savedId) {
      const targetItem = current.garments.find(
        (item) => item.garment.id === swapTarget.id
      );
      if (!targetItem?.outfit_item_id) {
        Alert.alert("Could not swap item", "The saved outfit item was not found.");
        return;
      }
      try {
        await swapPersistedOutfitItem(
          current.savedId,
          targetItem.outfit_item_id,
          replacement.id
        );
        await logInteraction(
          user.id,
          current.savedId,
          "item_swapped",
          swapTarget.id,
          replacement.id
        );
        maybeRecalculate();
      } catch (error) {
        Alert.alert(
          "Could not swap item",
          error instanceof Error ? error.message : "Please try again."
        );
        return;
      }
    }

    // Update the current outfit in state
    const updatedGarments = replaceDisplayedItem(
      current.garments,
      swapTarget.id,
      replacement
    );

    const updatedOutfits = [...outfits];
    const embeddings = updatedGarments
      .map(({ garment }) => garment.embedding)
      .filter((embedding): embedding is number[] => embedding !== null);
    updatedOutfits[currentIndex] = {
      ...current,
      garments: updatedGarments,
      embedding: embeddings.length > 0 ? averageVectors(embeddings) : [],
      score: 0,
    };
    setOutfits(updatedOutfits);

    setSwapTarget(null);
    setSwapAlternatives([]);
  };

  const turnActionItem = () => {
    const current = outfits[currentIndex];
    if (!current || !actionItem?.garment.back_image_url) return;
    const updated = current.garments.map((item) =>
      item.garment.id === actionItem.garment.id
        ? {
            ...item,
            display_side:
              item.display_side === "back"
                ? ("front" as const)
                : ("back" as const),
          }
        : item
    );
    setOutfits((existing) =>
      existing.map((outfit, index) =>
        index === currentIndex ? { ...outfit, garments: updated } : outfit
      )
    );
    setActionItem(null);
  };

  const saveCurrent = async () => {
    const current = outfits[currentIndex];
    if (!current || !user || savedIndexes.has(currentIndex) || savingOutfit) {
      return;
    }
    setSavingOutfit(true);
    try {
      const saved = await saveOutfit(user.id, current, true);
      await logInteraction(user.id, saved.outfit.id, "selected");
      await logInteraction(user.id, saved.outfit.id, "liked");
      if (current.savedId && current.savedId !== saved.outfit.id) {
        await logInteraction(user.id, current.savedId, "liked");
      }
      setSavedIndexes((indexes) => new Set(indexes).add(currentIndex));
      setLikedIndexes((indexes) => new Set(indexes).add(currentIndex));
      void maybeRecalculate().catch((error) => {
        console.error("Style recalculation failed:", error);
      });
    } catch (error) {
      Alert.alert(
        "Could not save outfit",
        error instanceof Error ? error.message : "Please try again."
      );
    } finally {
      setSavingOutfit(false);
    }
  };

  const manualBuilderButton = (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={() => router.push("/outfit/create")}
      className="flex-row items-center justify-center rounded-2xl border border-clover-200 bg-clover-100 px-5 py-3"
    >
      <Ionicons name="add-circle-outline" size={20} color="#12372A" />
      <Text className="ml-2 font-semibold text-clover-700">
        Create your own outfit
      </Text>
    </TouchableOpacity>
  );

  // Not enough garments
  if (garmentCount < 3) {
    return (
      <View className="flex-1 bg-clover-50 items-center justify-center px-8">
        <Ionicons name="shirt-outline" size={48} color="#173F32" />
        <Text className="mt-4 text-center text-xl font-semibold text-stone-800">
          Photograph your clothes
        </Text>
        <Text className="mt-2 text-center text-base text-stone-500">
          Add at least 3 ready garments — a top, a bottom or dress, and shoes —
          to generate outfits.
        </Text>
        <Text className="mt-2 text-sm text-stone-400">
          You have {garmentCount} garment{garmentCount !== 1 ? "s" : ""}
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => router.push("/(tabs)/add")}
          className="mt-6 min-h-11 items-center rounded-xl bg-clover-600 px-8 py-3"
        >
          <Text className="font-bold text-white">Add garments</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Loading state
  if (loading) {
    return (
      <View className="flex-1 bg-clover-50 items-center justify-center">
        <ActivityIndicator size="large" color="#173F32" />
        <Text className="text-gray-500 mt-4">Generating outfits...</Text>
      </View>
    );
  }

  // No outfits generated yet or all reviewed
  if (outfits.length === 0 || currentIndex >= outfits.length) {
    return (
      <View className="flex-1 bg-clover-50 items-center justify-center px-8">
        <Ionicons name="sparkles-outline" size={48} color="#173F32" />
        <Text className="text-xl font-semibold text-gray-800 mt-4">
          {outfits.length > 0 ? "All done!" : "Ready to style?"}
        </Text>
        <Text className="text-gray-500 text-center mt-2">
          {outfits.length > 0
            ? `You reviewed ${outfits.length} outfits. Generate more?`
            : "Generate outfit recommendations from your closet"}
        </Text>
        {generationError && (
          <Text className="mt-3 text-center text-sm text-red-600">
            {generationError}
          </Text>
        )}
        <TouchableOpacity
          className="bg-clover-600 rounded-lg py-3 px-8 mt-6"
          onPress={generateOutfits}
        >
          <Text className="text-white font-semibold">Generate Outfits</Text>
        </TouchableOpacity>
        <View className="mt-4">{manualBuilderButton}</View>
        {isColdStart && (
          <Text className="text-xs text-gray-400 mt-3 text-center px-4">
            Keep rating outfits to improve your recommendations
          </Text>
        )}
      </View>
    );
  }

  const current = outfits[currentIndex];

  return (
    <View className="flex-1 bg-clover-50">
      <View className="flex-row items-center justify-between px-4 pb-1 pt-2">
        <View>
          <Text className="text-xs text-stone-400">
            {currentIndex + 1} / {outfits.length}
          </Text>
          <Text className="text-[11px] text-stone-400">
            Swipe up next · Double tap like
          </Text>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => router.push("/outfit/create")}
          className="flex-row items-center rounded-full bg-clover-100 px-3 py-1.5"
        >
          <Ionicons name="add" size={14} color="#12372A" />
          <Text className="ml-1 text-[11px] font-semibold text-clover-700">
            Create
          </Text>
        </TouchableOpacity>
      </View>

      <OutfitCard
        key={current.savedId ?? `outfit-${currentIndex}`}
        garments={current.garments}
        score={current.score}
        saved={savedIndexes.has(currentIndex)}
        saving={savingOutfit}
        onLike={handleLike}
        onPass={handlePass}
        onDislike={handleDislike}
        onSave={() => void saveCurrent()}
        onItemTap={setActionItem}
      />
      <HomeGestureCoach
        visible={showGestureCoach}
        onDismiss={dismissGestureCoach}
      />

      {/* Swap sheet */}
      {swapTarget && (
        <SwapSheet
          visible={!!swapTarget}
          currentGarment={swapTarget}
          alternatives={swapAlternatives}
          onSwap={handleSwap}
          onClose={() => setSwapTarget(null)}
        />
      )}
      <OutfitItemActionSheet
        item={actionItem}
        visible={Boolean(actionItem)}
        onClose={() => setActionItem(null)}
        onTurn={
          actionItem?.garment.back_image_url ? turnActionItem : undefined
        }
        onSwap={() => {
          if (actionItem) beginSwap(actionItem.garment);
        }}
        onView={() => {
          if (!actionItem) return;
          const garmentId = actionItem.garment.id;
          setActionItem(null);
          router.push(`/garment/${garmentId}`);
        }}
      />
    </View>
  );
}
