import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  ListRenderItem,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  FlatLayCollage,
  FlatLayItem,
} from "@/components/FlatLayCollage";
import { OutfitItemActionSheet } from "@/components/OutfitItemActionSheet";
import { CATEGORIES, SUBTYPES_BY_CATEGORY } from "@/constants/categories";
import { useAuth } from "@/hooks/useAuth";
import { fetchGarments } from "@/services/garment.service";
import { logInteraction } from "@/services/interaction.service";
import {
  inferOutfitSlot,
  saveManualOutfit,
} from "@/services/outfit.service";
import {
  Garment,
  GarmentCategory,
  GarmentDisplaySide,
  GarmentSubtype,
} from "@/types/database";

function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) =>
    letter.toUpperCase()
  );
}

const PickerItem = memo(function PickerItem({
  garment,
  selected,
  onToggle,
}: {
  garment: Garment;
  selected: boolean;
  onToggle: (garment: Garment) => void;
}) {
  return (
    <Pressable
      onPress={() => onToggle(garment)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${selected ? "Remove" : "Add"} ${garment.name}`}
      className={`m-1 flex-1 overflow-hidden rounded-xl border ${
        selected
          ? "border-clover-600 bg-clover-50"
          : "border-stone-200 bg-stone-50"
      }`}
      style={{ maxWidth: "32%" }}
    >
      <View className="relative aspect-square">
        <Image
          source={{ uri: garment.cutout_url ?? garment.image_url }}
          resizeMode="contain"
          className="h-full w-full"
        />
        {selected && (
          <View className="absolute right-1.5 top-1.5 h-6 w-6 items-center justify-center rounded-full bg-clover-600">
            <Ionicons name="checkmark" size={16} color="#ffffff" />
          </View>
        )}
      </View>
      <Text
        numberOfLines={1}
        className="px-2 pb-2 text-center text-[11px] font-medium text-stone-700"
      >
        {garment.name}
      </Text>
    </Pressable>
  );
});

const OutfitNameField = memo(function OutfitNameField({
  nameRef,
}: {
  nameRef: MutableRefObject<string>;
}) {
  const [name, setName] = useState("");
  return (
    <TextInput
      value={name}
      onChangeText={(value) => {
        nameRef.current = value;
        setName(value);
      }}
      maxLength={80}
      placeholder="Name (optional, otherwise Outfit 1, 2, 3…)"
      accessibilityLabel="Optional outfit name"
      returnKeyType="done"
      className="mt-4 rounded-xl border border-stone-200 bg-white px-4 py-3 text-base text-stone-900"
    />
  );
});

const CreateOutfitHeader = memo(function CreateOutfitHeader({
  collageItems,
  selectedCount,
  category,
  subtype,
  nameRef,
  onClear,
  onItemPress,
  onCategoryChange,
  onSubtypeChange,
}: {
  collageItems: FlatLayItem[];
  selectedCount: number;
  category: GarmentCategory | null;
  subtype: GarmentSubtype | null;
  nameRef: MutableRefObject<string>;
  onClear: () => void;
  onItemPress: (item: FlatLayItem) => void;
  onCategoryChange: (value: GarmentCategory | null) => void;
  onSubtypeChange: (value: GarmentSubtype | null) => void;
}) {
  return (
    <View>
      <View className="bg-stone-50 px-4 pb-5 pt-4">
        <View className="mb-3 flex-row items-center justify-between">
          <View>
            <Text className="text-sm text-stone-500">
              Tap closet pieces to build a flat lay.
            </Text>
          </View>
          {selectedCount > 0 && (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Clear selected garments"
              onPress={onClear}
              className="rounded-full bg-white px-3 py-2"
            >
              <Text className="text-xs font-semibold text-stone-600">Clear</Text>
            </TouchableOpacity>
          )}
        </View>

        {selectedCount > 0 ? (
          <FlatLayCollage
            items={collageItems}
            onGarmentPress={() => {}}
            onItemPress={onItemPress}
            accessibilityLabel={`Outfit preview with ${selectedCount} garments`}
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

        <OutfitNameField nameRef={nameRef} />
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
              onCategoryChange(null);
              onSubtypeChange(null);
            }}
            className={`rounded-full px-4 py-2 ${
              category === null ? "bg-clover-600" : "bg-stone-100"
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
                onCategoryChange(item.value);
                onSubtypeChange(null);
              }}
              className={`rounded-full px-4 py-2 ${
                category === item.value ? "bg-clover-600" : "bg-stone-100"
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
              onPress={() => onSubtypeChange(null)}
              className={`rounded-full border px-3 py-1.5 ${
                subtype === null
                  ? "border-clover-600 bg-clover-50"
                  : "border-stone-200"
              }`}
            >
              <Text className="text-xs text-stone-600">All types</Text>
            </Pressable>
            {SUBTYPES_BY_CATEGORY[category].map((item) => (
              <Pressable
                key={item}
                onPress={() => onSubtypeChange(item)}
                className={`rounded-full border px-3 py-1.5 ${
                  subtype === item
                    ? "border-clover-600 bg-clover-50"
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
});

export default function CreateOutfitScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const nameRef = useRef("");
  const [garments, setGarments] = useState<Garment[]>([]);
  const [selected, setSelected] = useState<Garment[]>([]);
  const [category, setCategory] = useState<GarmentCategory | null>(null);
  const [subtype, setSubtype] = useState<GarmentSubtype | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [displaySides, setDisplaySides] = useState<
    Record<string, GarmentDisplaySide>
  >({});
  const [actionItem, setActionItem] = useState<FlatLayItem | null>(null);

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
        display_side: displaySides[garment.id] ?? "front",
      })),
    [displaySides, selected]
  );

  const toggleGarment = useCallback((garment: Garment) => {
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
  }, []);

  const clearSelected = useCallback(() => setSelected([]), []);

  const save = useCallback(async () => {
    if (!user || selected.length < 2) return;
    setSaving(true);
    try {
      const outfit = await saveManualOutfit(
        user.id,
        selected,
        nameRef.current,
        displaySides
      );
      await logInteraction(user.id, outfit.id, "selected");
      await logInteraction(user.id, outfit.id, "liked");
      router.replace({
        pathname: "/outfit/[id]",
        params: { id: outfit.id, justSaved: "1" },
      });
    } catch (error) {
      Alert.alert(
        "Could not save outfit",
        error instanceof Error ? error.message : "Please try again."
      );
    } finally {
      setSaving(false);
    }
  }, [displaySides, router, selected, user]);

  const renderItem = useCallback<ListRenderItem<Garment>>(
    ({ item }) => (
      <PickerItem
        garment={item}
        selected={selectedIds.has(item.id)}
        onToggle={toggleGarment}
      />
    ),
    [selectedIds, toggleGarment]
  );

  const listHeader = useMemo(
    () => (
      <CreateOutfitHeader
        collageItems={collageItems}
        selectedCount={selected.length}
        category={category}
        subtype={subtype}
        nameRef={nameRef}
        onClear={clearSelected}
        onItemPress={setActionItem}
        onCategoryChange={setCategory}
        onSubtypeChange={setSubtype}
      />
    ),
    [
      category,
      clearSelected,
      collageItems,
      selected.length,
      subtype,
    ]
  );

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-clover-50">
        <ActivityIndicator size="large" color="#173F32" />
        <Text className="mt-3 text-sm text-stone-500">
          Loading ready garments…
        </Text>
      </View>
    );
  }

  return (
    <>
      <FlatList
        className="flex-1 bg-clover-50"
        data={filteredGarments}
        numColumns={3}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={listHeader}
        contentContainerClassName="pb-4"
        columnWrapperClassName="px-2"
        renderItem={renderItem}
        extraData={selectedIds}
        initialNumToRender={12}
        maxToRenderPerBatch={9}
        updateCellsBatchingPeriod={50}
        windowSize={5}
        removeClippedSubviews
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
      <View className="border-t border-stone-200 bg-[#FCFBF7] px-4 pb-6 pt-3">
        {selected.length === 1 && (
          <Text className="mb-2 text-center text-xs text-amber-700">
            Add one more garment to save this outfit.
          </Text>
        )}
        <TouchableOpacity
          disabled={selected.length < 2 || saving}
          onPress={() => void save()}
          accessibilityRole="button"
          accessibilityState={{ disabled: selected.length < 2 || saving }}
          className={`min-h-11 items-center rounded-xl bg-clover-600 py-4 ${
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
      </View>
      <OutfitItemActionSheet
        item={actionItem}
        visible={Boolean(actionItem)}
        onClose={() => setActionItem(null)}
        onTurn={
          actionItem?.garment.back_image_url
            ? () => {
                const next =
                  actionItem.display_side === "back" ? "front" : "back";
                setDisplaySides((current) => ({
                  ...current,
                  [actionItem.garment.id]: next,
                }));
                setActionItem(null);
              }
            : undefined
        }
        onView={() => {
          if (!actionItem) return;
          const garmentId = actionItem.garment.id;
          setActionItem(null);
          router.push(`/garment/${garmentId}`);
        }}
        onRemove={() => {
          if (!actionItem) return;
          setSelected((current) =>
            current.filter((item) => item.id !== actionItem.garment.id)
          );
          setActionItem(null);
        }}
      />
    </>
  );
}
