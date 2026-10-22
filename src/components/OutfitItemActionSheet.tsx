import { Modal, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { FlatLayItem } from "@/components/FlatLayCollage";

interface Props {
  item: FlatLayItem | null;
  visible: boolean;
  onClose: () => void;
  onTurn?: () => void;
  onSwap?: () => void;
  onView: () => void;
  onRemove?: () => void;
}

export function OutfitItemActionSheet({
  item,
  visible,
  onClose,
  onTurn,
  onSwap,
  onView,
  onRemove,
}: Props) {
  if (!item) return null;
  const canTurn = Boolean(item.garment.back_image_url && onTurn);
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View className="flex-1 justify-end bg-black/25">
        <TouchableOpacity
          accessibilityLabel="Close item actions"
          className="flex-1"
          activeOpacity={1}
          onPress={onClose}
        />
        <View className="rounded-t-3xl bg-white px-5 pb-9 pt-4">
          <View className="mb-4 h-1 w-10 self-center rounded-full bg-stone-300" />
          <Text className="text-lg font-bold text-stone-900">
            {item.garment.name}
          </Text>
          <Text className="mt-1 text-xs font-semibold uppercase tracking-wide text-stone-400">
            Showing {item.display_side === "back" ? "back" : "front"}
          </Text>
          {canTurn && (
            <Action
              icon="sync-outline"
              label="Turn around"
              onPress={onTurn!}
            />
          )}
          {onSwap && (
            <Action icon="swap-horizontal-outline" label="Swap item" onPress={onSwap} />
          )}
          <Action icon="eye-outline" label="View item" onPress={onView} />
          {onRemove && (
            <Action
              icon="remove-circle-outline"
              label="Remove from outfit"
              destructive
              onPress={onRemove}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

function Action({
  icon,
  label,
  onPress,
  destructive = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={onPress}
      className={`mt-3 flex-row items-center rounded-2xl px-4 py-4 ${
        destructive ? "bg-red-50" : "bg-stone-50"
      }`}
    >
      <Ionicons
        name={icon}
        size={21}
        color={destructive ? "#dc2626" : "#44403c"}
      />
      <Text
        className={`ml-3 font-semibold ${
          destructive ? "text-red-700" : "text-stone-800"
        }`}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
