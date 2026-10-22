import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { GarmentCard } from "@/components/GarmentCard";
import { CategoryFilter } from "@/components/CategoryFilter";
import { LaundryBasket } from "@/components/LaundryBasket";
import { SavedOutfitsList } from "@/components/SavedOutfitsList";
import { SpatialCloset } from "@/components/SpatialCloset";
import { Ionicons } from "@expo/vector-icons";
import { fetchSavedOutfits } from "@/services/calendar.service";
import { retryGarmentProcessing } from "@/services/garment.service";
import { deleteOutfit } from "@/services/outfit.service";
import { fetchLaundryItems, washGarments } from "@/services/laundry.service";
import { LaundryItem } from "@/utils/laundry";
import { useAuth } from "@/hooks/useAuth";
import { useCloset } from "@/hooks/useCloset";
import {
  ClosetSection,
  ClosetSectionKind,
  GarmentCategory,
  OutfitWithItems,
} from "@/types/database";

type ClosetView = "spatial" | "grid" | "outfits" | "laundry";

type SectionEditor = {
  visible: boolean;
  section: ClosetSection | null;
  name: string;
  kind: ClosetSectionKind;
};

export default function ClosetScreen() {
  const router = useRouter();
  const { view: viewParam } = useLocalSearchParams<{ view?: string }>();
  const { user } = useAuth();
  const {
    sections,
    garments,
    loading,
    mutating,
    error,
    refresh,
    createSection,
    renameSection,
    reorderSections,
    moveGarment,
  } = useCloset();
  const [view, setView] = useState<ClosetView>(
    viewParam === "outfits" ||
      viewParam === "spatial" ||
      viewParam === "laundry"
      ? viewParam
      : "grid"
  );
  const [savedOutfits, setSavedOutfits] = useState<OutfitWithItems[]>([]);
  const [outfitsLoading, setOutfitsLoading] = useState(false);
  const [laundry, setLaundry] = useState<LaundryItem[]>([]);
  const [laundryLoading, setLaundryLoading] = useState(false);
  const [washing, setWashing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [category, setCategory] = useState<GarmentCategory | null>(null);
  const [savingSection, setSavingSection] = useState(false);
  const [sectionEditor, setSectionEditor] = useState<SectionEditor>({
    visible: false,
    section: null,
    name: "",
    kind: "rail",
  });

  useEffect(() => {
    if (
      viewParam === "outfits" ||
      viewParam === "grid" ||
      viewParam === "spatial" ||
      viewParam === "laundry"
    ) {
      setView(viewParam);
    }
  }, [viewParam]);

  const loadSavedOutfits = useCallback(async () => {
    if (!user) return;
    setOutfitsLoading(true);
    try {
      setSavedOutfits(await fetchSavedOutfits(user.id));
    } catch (loadError) {
      Alert.alert(
        "Could not load outfits",
        loadError instanceof Error ? loadError.message : "Please try again."
      );
    } finally {
      setOutfitsLoading(false);
    }
  }, [user]);

  const loadLaundry = useCallback(async () => {
    if (!user) return;
    setLaundryLoading(true);
    try {
      setLaundry(await fetchLaundryItems(user.id));
    } catch (loadError) {
      Alert.alert(
        "Could not load laundry",
        loadError instanceof Error ? loadError.message : "Please try again."
      );
    } finally {
      setLaundryLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void loadLaundry();
      if (view === "outfits") void loadSavedOutfits();
    }, [loadLaundry, loadSavedOutfits, view])
  );

  const handleWash = useCallback(
    async (garmentIds: string[]) => {
      if (!user || garmentIds.length === 0) return;
      setWashing(true);
      try {
        await washGarments(user.id, garmentIds);
        setLaundry((current) =>
          current.filter((item) => !garmentIds.includes(item.garment.id))
        );
      } catch (washError) {
        Alert.alert(
          "Could not empty laundry",
          washError instanceof Error ? washError.message : "Please try again."
        );
      } finally {
        setWashing(false);
      }
    },
    [user]
  );

  const handleDeleteOutfit = useCallback(async (outfitId: string) => {
    try {
      await deleteOutfit(outfitId);
      setSavedOutfits((current) =>
        current.filter((item) => item.id !== outfitId)
      );
    } catch (deleteError) {
      Alert.alert(
        "Could not delete outfit",
        deleteError instanceof Error
          ? deleteError.message
          : "Please try again."
      );
    }
  }, []);

  const filteredGarments = useMemo(
    () =>
      category
        ? garments.filter((garment) => garment.category === category)
        : garments,
    [category, garments]
  );

  const handleRetry = useCallback(async (garmentId: string) => {
    try {
      await retryGarmentProcessing(garmentId);
      await refresh();
    } catch (error) {
      Alert.alert(
        "Retry failed",
        error instanceof Error ? error.message : "Could not retry analysis"
      );
    }
  }, [refresh]);

  const openCreateSection = () => {
    setSectionEditor({
      visible: true,
      section: null,
      name: "",
      kind: "rail",
    });
  };

  const openRenameSection = (section: ClosetSection) => {
    setSectionEditor({
      visible: true,
      section,
      name: section.name,
      kind: section.kind,
    });
  };

  const closeSectionEditor = () => {
    if (savingSection) return;
    setSectionEditor((current) => ({ ...current, visible: false }));
  };

  const saveSection = async () => {
    const name = sectionEditor.name.trim();
    if (!name) {
      Alert.alert("Name required", "Give this closet section a name.");
      return;
    }

    setSavingSection(true);
    try {
      if (sectionEditor.section) {
        await renameSection(sectionEditor.section.id, name);
      } else {
        await createSection(name, sectionEditor.kind);
      }
      setSectionEditor((current) => ({ ...current, visible: false }));
    } catch (saveError) {
      Alert.alert(
        "Could not save section",
        saveError instanceof Error ? saveError.message : "Please try again."
      );
    } finally {
      setSavingSection(false);
    }
  };

  const moveSection = async (sectionId: string, direction: -1 | 1) => {
    const index = sections.findIndex((section) => section.id === sectionId);
    const destination = index + direction;
    if (index < 0 || destination < 0 || destination >= sections.length) return;

    const ids = sections.map((section) => section.id);
    [ids[index], ids[destination]] = [ids[destination], ids[index]];

    try {
      await reorderSections(ids);
    } catch (reorderError) {
      Alert.alert(
        "Could not reorder sections",
        reorderError instanceof Error
          ? reorderError.message
          : "Please try again."
      );
    }
  };

  const handleMoveGarment = async (
    garmentId: string,
    sectionId: string,
    position: number
  ) => {
    try {
      await moveGarment(garmentId, sectionId, position);
    } catch (moveError) {
      Alert.alert(
        "Could not move garment",
        moveError instanceof Error ? moveError.message : "Please try again."
      );
    }
  };

  if (
    loading &&
    sections.length === 0 &&
    view !== "outfits" &&
    view !== "laundry"
  ) {
    return (
      <View className="flex-1 items-center justify-center bg-clover-50">
        <ActivityIndicator size="large" color="#173F32" />
        <Text className="mt-3 text-sm text-stone-500">
          Opening your closet…
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-clover-50">
      <View className="border-b border-clover-200 bg-[#FCFBF7] px-4 pb-3 pt-2">
        <View className="flex-row rounded-xl bg-stone-100 p-1">
          {(
            [
              {
                id: "spatial",
                label: "Closet",
                icon: "file-tray-stacked-outline",
              },
              { id: "grid", label: "Grid", icon: "grid-outline" },
              { id: "outfits", label: "Outfits", icon: "layers-outline" },
              { id: "laundry", label: "Laundry", icon: "basket-outline" },
            ] as const
          ).map((tab) => {
            const selected = view === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                accessibilityRole="button"
                accessibilityLabel={
                  tab.id === "laundry" && laundry.length > 0
                    ? `Laundry, ${laundry.length} items`
                    : tab.label
                }
                accessibilityState={{ selected }}
                onPress={() => setView(tab.id)}
                className={`flex-1 items-center justify-center rounded-lg py-2 ${
                  selected ? "bg-white" : ""
                }`}
              >
                <View className="flex-row items-center">
                  <Ionicons
                    name={tab.icon}
                    size={16}
                    color={selected ? "#12372A" : "#77827B"}
                  />
                  {tab.id === "laundry" && laundry.length > 0 ? (
                    <View className="ml-1 min-w-[16px] items-center rounded-full bg-clover-600 px-1">
                      <Text className="text-[10px] font-bold text-white">
                        {laundry.length > 99 ? "99+" : laundry.length}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text
                  numberOfLines={1}
                  className={`mt-0.5 text-[10px] font-semibold ${
                    selected ? "text-clover-700" : "text-stone-500"
                  }`}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {view === "spatial" && (
          <View className="mt-3 flex-row items-center justify-end">
            {editing && (
              <TouchableOpacity
                onPress={openCreateSection}
                className="mr-2 h-11 w-11 items-center justify-center rounded-xl bg-clover-100"
                accessibilityLabel="Add closet section"
              >
                <Ionicons name="add" size={21} color="#12372A" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => setEditing((current) => !current)}
              className={`rounded-xl px-3 py-2 ${
                editing ? "bg-clover-600" : "bg-stone-100"
              }`}
            >
              <Text
                className={`text-xs font-semibold ${
                  editing ? "text-white" : "text-stone-600"
                }`}
              >
                {editing ? "Done" : "Edit sections"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
        {view === "outfits" && (
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => router.push("/outfit/create")}
            className="mt-3 min-h-11 flex-row items-center justify-center rounded-xl bg-clover-600 py-3"
          >
            <Ionicons name="layers-outline" size={18} color="#ffffff" />
            <Text className="ml-2 text-sm font-bold text-white">
              Create your own outfit
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {error && (
        <View className="mx-4 mt-3 flex-row items-center rounded-xl bg-red-50 px-3 py-2">
          <Ionicons name="alert-circle-outline" size={17} color="#dc2626" />
          <Text className="ml-2 flex-1 text-xs text-red-700" numberOfLines={2}>
            {error}
          </Text>
        </View>
      )}

      {view === "laundry" ? (
        <LaundryBasket
          items={laundry}
          loading={laundryLoading}
          washing={washing}
          onRefresh={() => void loadLaundry()}
          onOpen={(garmentId) => router.push(`/garment/${garmentId}`)}
          onWashAll={() =>
            void handleWash(laundry.map((item) => item.garment.id))
          }
          onWashItem={(garmentId) => void handleWash([garmentId])}
        />
      ) : view === "outfits" ? (
        <SavedOutfitsList
          outfits={savedOutfits}
          loading={outfitsLoading}
          onRefresh={() => void loadSavedOutfits()}
          onOpen={(outfit) => router.push(`/outfit/${outfit.id}`)}
          onSchedule={(outfit) =>
            router.push({
              pathname: "/(tabs)/calendar",
              params: { outfitId: outfit.id },
            })
          }
          onDelete={(outfit) => void handleDeleteOutfit(outfit.id)}
          onCreate={() => router.push("/outfit/create")}
        />
      ) : view === "spatial" ? (
        sections.length > 0 ? (
          <SpatialCloset
            sections={sections}
            garments={garments}
            editing={editing}
            refreshing={loading}
            mutating={mutating}
            onRefresh={() => void refresh()}
            onPressGarment={(garment) =>
              router.push(`/garment/${garment.id}`)
            }
            onRetryGarment={(garment) => void handleRetry(garment.id)}
            onRenameSection={openRenameSection}
            onMoveSection={(id, direction) =>
              void moveSection(id, direction)
            }
            onMoveGarment={handleMoveGarment}
          />
        ) : (
          <View className="flex-1 items-center justify-center px-8">
            <Ionicons name="file-tray-outline" size={46} color="#a8a29e" />
            <Text className="mt-4 text-base font-semibold text-stone-600">
              No closet sections yet
            </Text>
            <TouchableOpacity
              onPress={openCreateSection}
              className="mt-5 min-h-11 rounded-xl bg-clover-600 px-5 py-3"
            >
              <Text className="font-semibold text-white">Create a section</Text>
            </TouchableOpacity>
          </View>
        )
      ) : (
        <View className="flex-1 bg-[#FCFBF7]">
          <CategoryFilter selected={category} onSelect={setCategory} />
          <FlatList
            data={filteredGarments}
            numColumns={3}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <GarmentCard
                garment={item}
                onPress={() => router.push(`/garment/${item.id}`)}
                onRetry={() => void handleRetry(item.id)}
              />
            )}
            initialNumToRender={12}
            maxToRenderPerBatch={9}
            windowSize={5}
            removeClippedSubviews
            contentContainerClassName="px-2 pb-4"
            refreshControl={
              <RefreshControl
                refreshing={loading}
                onRefresh={() => void refresh()}
                tintColor="#173F32"
              />
            }
            ListEmptyComponent={
              <View className="items-center justify-center px-8 py-20">
                <Ionicons name="shirt-outline" size={42} color="#d6d3d1" />
                <Text className="mt-3 text-center text-stone-400">
                  {garments.length === 0
                    ? "Your closet is empty. Add your first garment from the Add tab."
                    : "No garments in this category"}
                </Text>
              </View>
            }
          />
        </View>
      )}

      <Modal
        visible={sectionEditor.visible}
        transparent
        animationType="fade"
        onRequestClose={closeSectionEditor}
      >
        <View className="flex-1 justify-end bg-black/30">
          <Pressable className="flex-1" onPress={closeSectionEditor} />
          <View className="rounded-t-3xl bg-white px-5 pb-8 pt-5">
            <View className="mb-5 flex-row items-center justify-between">
              <Text className="text-xl font-bold text-stone-900">
                {sectionEditor.section ? "Rename section" : "New section"}
              </Text>
              <TouchableOpacity
                accessibilityLabel="Close section editor"
                onPress={closeSectionEditor}
                className="h-9 w-9 items-center justify-center rounded-full bg-stone-100"
              >
                <Ionicons name="close" size={20} color="#57534e" />
              </TouchableOpacity>
            </View>

            <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-500">
              Name
            </Text>
            <TextInput
              value={sectionEditor.name}
              onChangeText={(name) =>
                setSectionEditor((current) => ({ ...current, name }))
              }
              autoFocus
              maxLength={48}
              placeholder="Weekend rail"
              className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-base text-stone-900"
            />

            {!sectionEditor.section && (
              <>
                <Text className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wider text-stone-500">
                  Type
                </Text>
                <View className="flex-row gap-2">
                  {(["rail", "shelf", "drawer"] as ClosetSectionKind[]).map(
                    (kind) => (
                      <TouchableOpacity
                        key={kind}
                        onPress={() =>
                          setSectionEditor((current) => ({
                            ...current,
                            kind,
                          }))
                        }
                        className={`flex-1 items-center rounded-xl border py-3 ${
                          sectionEditor.kind === kind
                            ? "border-clover-600 bg-clover-50"
                            : "border-stone-200 bg-white"
                        }`}
                      >
                        <Ionicons
                          name={
                            kind === "rail"
                              ? "remove-outline"
                              : kind === "shelf"
                              ? "albums-outline"
                              : "file-tray-outline"
                          }
                          size={20}
                          color={
                            sectionEditor.kind === kind
                              ? "#12372A"
                              : "#78716c"
                          }
                        />
                        <Text
                          className={`mt-1 text-xs capitalize ${
                            sectionEditor.kind === kind
                              ? "font-semibold text-clover-700"
                              : "text-stone-500"
                          }`}
                        >
                          {kind}
                        </Text>
                      </TouchableOpacity>
                    )
                  )}
                </View>
              </>
            )}

            <TouchableOpacity
              disabled={savingSection}
              onPress={() => void saveSection()}
              className={`mt-6 min-h-11 items-center rounded-xl bg-clover-600 py-4 ${
                savingSection ? "opacity-60" : ""
              }`}
            >
              {savingSection ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="font-bold text-white">Save section</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
