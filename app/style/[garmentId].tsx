import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "@/hooks/useAuth";
import { useStyleProfile } from "@/hooks/useStyleProfile";
import { supabase } from "@/lib/supabase";
import { fetchGarments } from "@/services/garment.service";
import {
  generateOutfitCandidates,
  getAlternatives,
  OutfitCandidate,
  saveOutfit,
} from "@/services/outfit.service";
import { Garment } from "@/types/database";
import { FlatLayCollage, FlatLayItem } from "@/components/FlatLayCollage";
import { SagModeToggle } from "@/components/SagModeToggle";
import { OutfitItemActionSheet } from "@/components/OutfitItemActionSheet";
import { SwapSheet } from "@/components/SwapSheet";
import { logInteraction } from "@/services/interaction.service";

export default function SeededStyleScreen() {
  const { garmentId } = useLocalSearchParams<{ garmentId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const {
    profile,
    loading: profileLoading,
    maybeRecalculate,
  } = useStyleProfile();
  const [garment, setGarment] = useState<Garment | null>(null);
  const [closet, setCloset] = useState<Garment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generation, setGeneration] = useState(0);
  const [sagMode, setSagMode] = useState(false);
  const [looks, setLooks] = useState<OutfitCandidate[]>([]);
  const [action, setAction] = useState<{
    lookIndex: number;
    item: FlatLayItem;
  } | null>(null);
  const [swapAlternatives, setSwapAlternatives] = useState<Garment[]>([]);
  const [swapping, setSwapping] = useState(false);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [savedIndexes, setSavedIndexes] = useState<Set<number>>(new Set());
  const swapTargetRef = useRef<{
    lookIndex: number;
    item: FlatLayItem;
  } | null>(null);

  useEffect(() => {
    if (!user || !garmentId) return;

    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const [garmentResult, readyGarments] = await Promise.all([
          supabase
            .from("garments")
            .select("*")
            .eq("id", garmentId)
            .eq("user_id", user.id)
            .single(),
          fetchGarments(user.id),
        ]);

        if (garmentResult.error) {
          throw new Error("Garment not found.");
        }
        if (!active) return;

        setGarment(garmentResult.data as Garment);
        setCloset(readyGarments);
        if ((garmentResult.data as Garment).category === "underwear") {
          setSagMode(true);
        }
      } catch (loadError) {
        if (!active) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not build looks for this item."
        );
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [garmentId, user]);

  const generatedLooks = useMemo(() => {
    if (!garment || garment.processing_status !== "ready") return [];

    return generateOutfitCandidates(
      closet,
      3,
      profile?.style_embedding,
      garment,
      profile?.pinterest_embedding,
      { sagMode }
    );
  }, [
    closet,
    garment,
    generation,
    sagMode,
    profile?.pinterest_embedding,
    profile?.style_embedding,
  ]);

  useEffect(() => {
    setLooks(generatedLooks);
    setSavedIndexes(new Set());
  }, [generatedLooks]);

  const turnItem = () => {
    if (!action?.item.garment.back_image_url) return;
    setLooks((current) =>
      current.map((look, index) =>
        index !== action.lookIndex
          ? look
          : {
              ...look,
              garments: look.garments.map((item) =>
                item.garment.id === action.item.garment.id
                  ? {
                      ...item,
                      display_side:
                        item.display_side === "back"
                          ? ("front" as const)
                          : ("back" as const),
                    }
                  : item
              ),
            }
      )
    );
    setAction(null);
  };

  const beginSwap = () => {
    if (!action) return;
    const look = looks[action.lookIndex];
    swapTargetRef.current = action;
    setSwapAlternatives(
      getAlternatives(
        closet,
        action.item.garment,
        look.garments.map((item) => item.garment)
      )
    );
    setSwapping(true);
    setAction(null);
  };

  const replaceItem = (replacement: Garment) => {
    if (!action && !swapping) return;
    const target = swapTargetRef.current;
    if (!target) return;
    setLooks((current) =>
      current.map((look, index) =>
        index !== target.lookIndex
          ? look
          : {
              ...look,
              garments: look.garments.map((item) =>
                item.garment.id === target.item.garment.id
                  ? {
                      ...item,
                      garment: replacement,
                      display_side: "front",
                    }
                  : item
              ),
            }
      )
    );
    setSwapping(false);
    swapTargetRef.current = null;
  };

  const saveLook = async (index: number) => {
    if (!user || savingIndex !== null || savedIndexes.has(index)) return;
    setSavingIndex(index);
    try {
      const saved = await saveOutfit(user.id, looks[index], true);
      await logInteraction(user.id, saved.outfit.id, "selected");
      await logInteraction(user.id, saved.outfit.id, "liked");
      maybeRecalculate();
      setSavedIndexes((current) => new Set(current).add(index));
      Alert.alert(
        "Look saved",
        "Find it in Closet under the Outfits tab."
      );
    } catch (saveError) {
      Alert.alert(
        "Could not save look",
        saveError instanceof Error ? saveError.message : "Please try again."
      );
    } finally {
      setSavingIndex(null);
    }
  };

  if (loading || profileLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-clover-50">
        <ActivityIndicator size="large" color="#173F32" />
        <Text className="mt-3 text-gray-500">Building three looks…</Text>
      </View>
    );
  }

  if (error || !garment) {
    return (
      <View className="flex-1 items-center justify-center bg-clover-50 px-8">
        <Ionicons name="alert-circle-outline" size={44} color="#ef4444" />
        <Text className="mt-3 text-center text-gray-600">
          {error ?? "Garment not found."}
        </Text>
      </View>
    );
  }

  if (garment.processing_status !== "ready") {
    const failed = garment.processing_status === "failed";

    return (
      <View className="flex-1 items-center justify-center bg-clover-50 px-8">
        <Image
          source={{ uri: garment.cutout_url ?? garment.image_url }}
          className="h-40 w-40"
          resizeMode="contain"
        />
        <Ionicons
          name={failed ? "alert-circle-outline" : "hourglass-outline"}
          size={36}
          color={failed ? "#ef4444" : "#173F32"}
        />
        <Text className="mt-3 text-center text-lg font-semibold text-gray-800">
          {failed ? "Analysis needs attention" : "Still analyzing this item"}
        </Text>
        <Text className="mt-2 text-center text-sm text-gray-500">
          {failed
            ? "Retry analysis from the garment detail screen before creating looks."
            : "Three looks will be available when garment analysis finishes."}
        </Text>
        <TouchableOpacity
          className="mt-6 rounded-lg border border-clover-600 px-5 py-3"
          onPress={() => router.back()}
        >
          <Text className="font-semibold text-clover-700">Back to item</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-clover-50">
      <View className="px-4 pb-10 pt-5">
        <View className="mb-5 flex-row items-center rounded-2xl bg-clover-50 p-4">
          <Image
            source={{ uri: garment.cutout_url ?? garment.image_url }}
            className="h-20 w-20"
            resizeMode="contain"
          />
          <View className="ml-4 flex-1">
            <Text className="text-xs font-semibold uppercase tracking-wide text-clover-700">
              Styling around
            </Text>
            <Text className="mt-1 text-xl font-bold text-gray-900">
              {garment.name}
            </Text>
            <Text className="mt-1 text-sm text-gray-500">
              Every look keeps this item in the outfit.
            </Text>
          </View>
        </View>

        <View className="mb-5">
          <SagModeToggle value={sagMode} onValueChange={setSagMode} />
        </View>

        {looks.length > 0 ? (
          <>
            <View className="mb-3 flex-row items-end justify-between">
              <View>
                <Text className="text-2xl font-bold text-gray-900">
                  Your three looks
                </Text>
                <Text className="mt-1 text-sm text-gray-500">
                  {profile?.pinterest_pin_count
                    ? "Ranked for your combined Clover and Pinterest taste"
                    : "Ranked for your Clover style profile"}
                </Text>
              </View>
              <TouchableOpacity
                className="flex-row items-center rounded-lg px-2 py-2"
                onPress={() => setGeneration((value) => value + 1)}
              >
                <Ionicons name="refresh" size={16} color="#12372A" />
                <Text className="ml-1 text-sm font-semibold text-clover-700">
                  Refresh
                </Text>
              </TouchableOpacity>
            </View>

            {looks.map((look, index) => (
              <LookCard
                key={look.garments
                  .map(({ garment: item }) => item.id)
                  .sort()
                  .join(":")}
                look={look}
                rank={index + 1}
                requiredGarmentId={garment.id}
                onItemPress={(item) => setAction({ lookIndex: index, item })}
                onSave={() => void saveLook(index)}
                saving={savingIndex === index}
                saved={savedIndexes.has(index)}
              />
            ))}

            {looks.length < 3 && (
              <Text className="mt-1 text-center text-sm text-gray-500">
                Add more compatible ready garments to unlock all three looks.
              </Text>
            )}
          </>
        ) : (
          <View className="items-center rounded-2xl bg-white px-6 py-10">
            <Ionicons name="shirt-outline" size={44} color="#9ca3af" />
            <Text className="mt-4 text-center text-lg font-semibold text-gray-800">
              Not enough compatible items yet
            </Text>
            <Text className="mt-2 text-center text-sm text-gray-500">
              {sagMode
                ? "Sag mode needs ready tops, bottoms, shoes, and compatible underwear."
                : "A look needs a dress or top and bottom, plus ready shoes. Add or finish analyzing those pieces, then try again."}
            </Text>
          </View>
        )}
      </View>
      <OutfitItemActionSheet
        item={action?.item ?? null}
        visible={Boolean(action)}
        onClose={() => setAction(null)}
        onTurn={action?.item.garment.back_image_url ? turnItem : undefined}
        onSwap={beginSwap}
        onView={() => {
          if (!action) return;
          const id = action.item.garment.id;
          setAction(null);
          router.push(`/garment/${id}`);
        }}
      />
      {swapping && swapTargetRef.current && (
        <SwapSheet
          visible
          currentGarment={swapTargetRef.current.item.garment}
          alternatives={swapAlternatives}
          onSwap={replaceItem}
          onClose={() => {
            setSwapping(false);
            swapTargetRef.current = null;
          }}
        />
      )}
    </ScrollView>
  );
}

function LookCard({
  look,
  rank,
  requiredGarmentId,
  onItemPress,
  onSave,
  saving,
  saved,
}: {
  look: OutfitCandidate;
  rank: number;
  requiredGarmentId: string;
  onItemPress: (item: FlatLayItem) => void;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
}) {
  return (
    <View className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
      <View className="mb-3 flex-row items-center justify-between">
        <View className="rounded-full bg-clover-600 px-3 py-1">
          <Text className="text-xs font-bold text-white">LOOK {rank}</Text>
        </View>
        <View className="items-end">
          {look.pinterestInformed && (
            <View className="rounded-full bg-red-50 px-2 py-1">
              <Text className="text-[10px] font-semibold text-red-600">
                Pinterest-informed
              </Text>
            </View>
          )}
          {look.score > 0 && (
            <Text className="mt-1 text-xs font-medium text-gray-400">
              {Math.round(look.score * 100)}% taste match
            </Text>
          )}
        </View>
      </View>

      <FlatLayCollage
        items={look.garments}
        featuredGarmentId={requiredGarmentId}
        onGarmentPress={() => {}}
        onItemPress={onItemPress}
        accessibilityLabel={`Look ${rank} flat lay`}
      />
      <TouchableOpacity
        disabled={saving || saved}
        onPress={onSave}
        className={`mt-3 items-center rounded-xl py-3 ${
          saved ? "bg-clover-100" : "bg-clover-600"
        }`}
      >
        <Text className={saved ? "font-bold text-clover-800" : "font-bold text-white"}>
          {saving ? "Saving…" : saved ? "Look saved" : "Save this look"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
