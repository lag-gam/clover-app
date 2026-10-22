import { useState, useCallback } from "react";
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
import { OutfitCard } from "@/components/OutfitCard";
import {
  FlatLayItem,
} from "@/components/FlatLayCollage";
import { OutfitItemActionSheet } from "@/components/OutfitItemActionSheet";
import { SwapSheet } from "@/components/SwapSheet";
import { SagModeToggle } from "@/components/SagModeToggle";
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
  const [sagMode, setSagMode] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [actionItem, setActionItem] = useState<FlatLayItem | null>(null);
  const [savingOutfit, setSavingOutfit] = useState(false);
  const [savedIndexes, setSavedIndexes] = useState<Set<number>>(new Set());

  const { profile, maybeRecalculate, isColdStart } = useStyleProfile();

  // Swap sheet state
  const [swapTarget, setSwapTarget] = useState<Garment | null>(null);
  const [swapAlternatives, setSwapAlternatives] = useState<Garment[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (user) {
        fetchGarments(user.id).then((g) => {
          setAllGarments(g);
          setGarmentCount(g.length);
        });
      }
    }, [user])
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
    } catch (e) {
      console.error("Generation error:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleInteraction = async (type: "liked" | "disliked" | "skipped") => {
    const current = outfits[currentIndex];
    if (!current?.savedId || !user) return;

    await logInteraction(user.id, current.savedId, type);
    setCurrentIndex((i) => i + 1);

    // Trigger style recalculation check
    maybeRecalculate();
  };

  const handleSagModeChange = (value: boolean) => {
    setSagMode(value);
    setOutfits([]);
    setCurrentIndex(0);
    setSavedIndexes(new Set());
    setGenerationError(null);
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
    if (!current || !user || savingOutfit || savedIndexes.has(currentIndex)) {
      return;
    }
    setSavingOutfit(true);
    try {
      const saved = await saveOutfit(user.id, current, true);
      await logInteraction(user.id, saved.outfit.id, "selected");
      setSavedIndexes((indexes) => new Set(indexes).add(currentIndex));
      Alert.alert("Outfit saved", "Your edited outfit is ready for the calendar.");
      maybeRecalculate();
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
      className="mt-4 flex-row items-center justify-center rounded-2xl border border-clover-200 bg-clover-100 px-5 py-3"
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
        <Ionicons name="shirt-outline" size={48} color="#d1d5db" />
        <Text className="text-lg text-gray-400 mt-4 text-center">
          Add at least 3 garments (top, bottom, shoes) to generate outfits
        </Text>
        <Text className="text-sm text-gray-300 mt-1">
          You have {garmentCount} garment{garmentCount !== 1 ? "s" : ""}
        </Text>
        {manualBuilderButton}
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
        <View className="mt-5 w-full">
          <SagModeToggle value={sagMode} onValueChange={handleSagModeChange} />
        </View>
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
        {manualBuilderButton}
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
    <View className="flex-1 bg-clover-50 justify-center">
      {/* Progress */}
      <View className="px-4 pt-2 pb-1">
        <Text className="text-xs text-gray-400 text-center">
          {currentIndex + 1} / {outfits.length}
        </Text>
        <View className="mt-2">
          <SagModeToggle value={sagMode} onValueChange={handleSagModeChange} />
        </View>
        {manualBuilderButton}
      </View>

      <OutfitCard
        garments={current.garments}
        score={current.score}
        onLike={() => handleInteraction("liked")}
        onDislike={() => handleInteraction("disliked")}
        onSkip={() => handleInteraction("skipped")}
        onItemTap={setActionItem}
      />

      <TouchableOpacity
        disabled={savingOutfit || savedIndexes.has(currentIndex)}
        onPress={() => void saveCurrent()}
        className={`mx-4 mt-3 items-center rounded-xl py-3 ${
          savedIndexes.has(currentIndex) ? "bg-clover-100" : "bg-clover-600"
        }`}
      >
        <Text
          className={
            savedIndexes.has(currentIndex)
              ? "font-bold text-clover-800"
              : "font-bold text-white"
          }
        >
          {savingOutfit
            ? "Saving…"
            : savedIndexes.has(currentIndex)
              ? "Outfit saved"
              : "Save outfit"}
        </Text>
      </TouchableOpacity>

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
