import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { FlatLayCollage } from "@/components/FlatLayCollage";
import { CATEGORIES, SUBTYPES_BY_CATEGORY } from "@/constants/categories";
import { useAuth } from "@/hooks/useAuth";
import { fetchGarments } from "@/services/garment.service";
import {
  inferOutfitSlot,
  saveManualOutfit,
} from "@/services/outfit.service";
import {
  Garment,
  GarmentCategory,
  GarmentSubtype,
} from "@/types/database";

function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) =>
    letter.toUpperCase()
  );
}

export default function CreateOutfitScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [garments, setGarments] = useState<Garment[]>([]);
  const [selected, setSelected] = useState<Garment[]>([]);
  const [category, setCategory] = useState<GarmentCategory | null>(null);
  const [subtype, setSubtype] = useState<GarmentSubtype | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    setLoading(true);
    fetchGarments(user.id)
      .then(setGarments)
      .catch((error: unknown) =>
        setLoadError(
          error instanceof Error ? error.message : "Could not load your closet."
        )
      )
      .finally(() => setLoading(false));
  }, [user]);

  const filteredGarments = useMemo(
    () =>
      garments.filter(
        (garment) =>
          (!category || garment.category === category) &&
          (!subtype || garment.subtype === subtype)
      ),
    [category, garments, subtype]
  );
  const selectedIds = useMemo(
    () => new Set(selected.map((garment) => garment.id)),
    [selected]
  );
  const collageItems = useMemo(
    () =>
      selected.map((garment) => ({
        garment,
        slot: inferOutfitSlot(garment),
      })),
    [selected]
  );

  const toggleGarment = (garment: Garment) => {
    setSelected((current) => {
      if (current.some((item) => item.id === garment.id)) {
        return current.filter((item) => item.id !== garment.id);
      }

      if (garment.category === "accessories") {
        return [...current, garment];
      }

      const slot = inferOutfitSlot(garment);
      return [
        ...current.filter((item) => {
          const itemSlot = inferOutfitSlot(item);
          if (itemSlot === slot) return false;
          if (slot === "dress" && (itemSlot === "top" || itemSlot === "bottom")) {
            return false;
          }
          if ((slot === "top" || slot === "bottom") && itemSlot === "dress") {
            return false;
          }
          return true;
        }),
        garment,
      ];
    });
  };

  const save = async () => {
    if (!user || selected.length < 2) return;
    setSaving(true);
    try {
      const outfit = await saveManualOutfit(user.id, selected, name);
      router.replace(`/outfit/${outfit.id}`);
    } catch (error) {
      Alert.alert(
        "Could not save outfit",
        error instanceof Error ? error.message : "Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  const header = (
    <View>
      <View className="bg-stone-50 px-4 pb-5 pt-4">
        <View className="mb-3 flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-bold text-stone-900">
              Create your own outfit
            </Text>
            <Text className="mt-1 text-sm text-stone-500">
              Tap closet pieces to build a flat lay.
            </Text>
          </View>
          {selected.length > 0 && (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Clear selected garments"
              onPress={() => setSelected([])}
              className="rounded-full bg-white px-3 py-2"
            >
              <Text className="text-xs font-semibold text-stone-600">Clear</Text>
            </TouchableOpacity>
          )}
        </View>

        {selected.length > 0 ? (
          <FlatLayCollage
            items={collageItems}
            onGarmentPress={toggleGarment}
            accessibilityLabel={`Outfit preview with ${selected.length} garments`}
          />
        ) : (
          <View
            className="items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-white px-8"
            style={{ aspectRatio: 1.45 }}
          >
            <Ionicons name="layers-outline" size={38} color="#a8a29e" />
            <Text className="mt-3 text-center font-semibold text-stone-600">
              Your collage will appear here
            </Text>
            <Text className="mt-1 text-center text-xs text-stone-400">
              Choose at least two ready garments below.
            </Text>
          </View>
        )}

        <TextInput
          value={name}
          onChangeText={setName}
          maxLength={80}
          placeholder="Outfit name (optional)"
          accessibilityLabel="Optional outfit name"
          returnKeyType="done"
          className="mt-4 rounded-xl border border-stone-200 bg-white px-4 py-3 text-base text-stone-900"
        />
        <TouchableOpacity
          disabled={selected.length < 2 || saving}
          onPress={() => void save()}
          accessibilityRole="button"
          accessibilityState={{ disabled: selected.length < 2 || saving }}
          className={`mt-3 items-center rounded-xl bg-green-600 py-4 ${
            selected.length < 2 || saving ? "opacity-40" : ""
          }`}
        >
          {saving ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text className="font-bold text-white">
              Save outfit · {selected.length} selected
            </Text>
          )}
        </TouchableOpacity>
        {selected.length === 1 && (
          <Text className="mt-2 text-center text-xs text-amber-700">
            Add one more garment to save this outfit.
          </Text>
        )}
      </View>

      <View className="border-t border-stone-200 bg-white pb-3 pt-4">
        <Text className="px-4 text-base font-bold text-stone-900">
          Your ready garments
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-2 px-4 pt-3"
        >
          <Pressable
            onPress={() => {
              setCategory(null);
              setSubtype(null);
            }}
            className={`rounded-full px-4 py-2 ${
              category === null ? "bg-green-600" : "bg-stone-100"
            }`}
          >
            <Text
              className={`text-xs font-semibold ${
                category === null ? "text-white" : "text-stone-600"
              }`}
            >
              All
            </Text>
          </Pressable>
          {CATEGORIES.map((item) => (
            <Pressable
              key={item.value}
              onPress={() => {
                setCategory(item.value);
                setSubtype(null);
              }}
              className={`rounded-full px-4 py-2 ${
                category === item.value ? "bg-green-600" : "bg-stone-100"
              }`}
            >
              <Text
                className={`text-xs font-semibold ${
                  category === item.value ? "text-white" : "text-stone-600"
                }`}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {category && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-2 px-4 pt-2"
          >
            <Pressable
              onPress={() => setSubtype(null)}
              className={`rounded-full border px-3 py-1.5 ${
                subtype === null
                  ? "border-green-600 bg-green-50"
                  : "border-stone-200"
              }`}
            >
              <Text className="text-xs text-stone-600">All types</Text>
            </Pressable>
            {SUBTYPES_BY_CATEGORY[category].map((item) => (
              <Pressable
                key={item}
                onPress={() => setSubtype(item)}
                className={`rounded-full border px-3 py-1.5 ${
                  subtype === item
                    ? "border-green-600 bg-green-50"
                    : "border-stone-200"
                }`}
              >
                <Text className="text-xs text-stone-600">{label(item)}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#16a34a" />
        <Text className="mt-3 text-sm text-stone-500">
          Loading ready garments…
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      className="flex-1 bg-white"
      data={filteredGarments}
      numColumns={3}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={header}
      contentContainerClassName="pb-8"
      columnWrapperClassName="px-2"
      renderItem={({ item }) => {
        const isSelected = selectedIds.has(item.id);
        return (
          <Pressable
            onPress={() => toggleGarment(item)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isSelected }}
            accessibilityLabel={`${isSelected ? "Remove" : "Add"} ${item.name}`}
            className={`m-1 flex-1 overflow-hidden rounded-xl border ${
              isSelected
                ? "border-green-600 bg-green-50"
                : "border-stone-200 bg-stone-50"
            }`}
            style={{ maxWidth: "32%" }}
          >
            <View className="relative aspect-square">
              <Image
                source={{ uri: item.cutout_url ?? item.image_url }}
                resizeMode="contain"
                className="h-full w-full"
              />
              {isSelected && (
                <View className="absolute right-1.5 top-1.5 h-6 w-6 items-center justify-center rounded-full bg-green-600">
                  <Ionicons name="checkmark" size={16} color="#ffffff" />
                </View>
              )}
            </View>
            <Text
              numberOfLines={1}
              className="px-2 pb-2 text-center text-[11px] font-medium text-stone-700"
            >
              {item.name}
            </Text>
          </Pressable>
        );
      }}
      ListEmptyComponent={
        <View className="items-center px-8 py-16">
          <Ionicons name="shirt-outline" size={40} color="#d6d3d1" />
          <Text className="mt-3 text-center font-semibold text-stone-500">
            {loadError
              ? "Could not load your closet"
              : garments.length === 0
                ? "No ready garments yet"
                : "No garments match these filters"}
          </Text>
          <Text className="mt-1 text-center text-xs text-stone-400">
            {loadError ??
              (garments.length === 0
                ? "Add garments and wait for processing to finish."
                : "Try another category or subtype.")}
          </Text>
        </View>
      }
    />
  );
}
