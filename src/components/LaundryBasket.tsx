import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GarmentCard } from "@/components/GarmentCard";
import { LaundryItem } from "@/utils/laundry";
import { formatLocalDateLabel } from "@/utils/date";

interface LaundryBasketProps {
  items: LaundryItem[];
  loading: boolean;
  washing: boolean;
  onRefresh: () => void;
  onOpen: (garmentId: string) => void;
  onWashAll: () => void;
  onWashItem: (garmentId: string) => void;
}

function wornLabel(item: LaundryItem) {
  const when = formatLocalDateLabel(item.lastWornDate);
  if (item.wearCount > 1) {
    return `Worn ${item.wearCount} times · last ${when}`;
  }
  return `Worn ${when}`;
}

export function LaundryBasket({
  items,
  loading,
  washing,
  onRefresh,
  onOpen,
  onWashAll,
  onWashItem,
}: LaundryBasketProps) {
  const confirmWashAll = () => {
    Alert.alert(
      "Empty the basket?",
      "This marks everything here as washed. New worn outfits will show up after their day passes.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "I washed", onPress: onWashAll },
      ]
    );
  };

  return (
    <View className="flex-1 bg-[#FCFBF7]">
      {items.length > 0 && (
        <View className="px-4 pt-3">
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Mark all laundry as washed"
            disabled={washing}
            onPress={confirmWashAll}
            className={`min-h-11 flex-row items-center justify-center rounded-xl bg-clover-600 py-3 ${
              washing ? "opacity-60" : ""
            }`}
          >
            {washing ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Ionicons name="water-outline" size={18} color="#ffffff" />
                <Text className="ml-2 text-sm font-bold text-white">
                  I washed ({items.length})
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
      <FlatList
        data={items}
        numColumns={2}
        keyExtractor={(item) => item.garment.id}
        contentContainerClassName="px-2 pb-8 pt-3"
        initialNumToRender={8}
        windowSize={5}
        removeClippedSubviews
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={onRefresh}
            tintColor="#173F32"
          />
        }
        renderItem={({ item }) => (
          <View className="w-1/2 px-1 pb-3">
            <GarmentCard
              garment={item.garment}
              onPress={() => onOpen(item.garment.id)}
            />
            <Text className="mt-1 px-1 text-center text-[11px] text-stone-500">
              {wornLabel(item)}
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`Mark ${item.garment.name} as washed`}
              disabled={washing}
              onPress={() => onWashItem(item.garment.id)}
              className="mt-2 min-h-10 items-center justify-center rounded-xl bg-clover-100 py-2"
            >
              <Text className="text-xs font-bold text-clover-700">Washed</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          loading ? (
            <View className="items-center justify-center px-8 py-20">
              <ActivityIndicator color="#173F32" />
            </View>
          ) : (
            <View className="items-center justify-center px-8 py-20">
              <Ionicons name="basket-outline" size={46} color="#d6d3d1" />
              <Text className="mt-4 text-center text-base font-semibold text-stone-600">
                Laundry basket is empty
              </Text>
              <Text className="mt-2 text-center text-sm leading-5 text-stone-400">
                Clothes from scheduled outfits land here the day after you wear
                them.
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}
