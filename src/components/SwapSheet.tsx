import {
  View,
  Text,
  Image,
  TouchableOpacity,
  FlatList,
  Modal,
} from "react-native";
import { Garment } from "@/types/database";
import { Ionicons } from "@expo/vector-icons";

interface SwapSheetProps {
  visible: boolean;
  currentGarment: Garment;
  alternatives: Garment[];
  onSwap: (replacement: Garment) => void;
  onClose: () => void;
}

export function SwapSheet({
  visible,
  currentGarment,
  alternatives,
  onSwap,
  onClose,
}: SwapSheetProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View className="flex-1 justify-end">
        <TouchableOpacity
          className="flex-1"
          activeOpacity={1}
          onPress={onClose}
        />
        <View className="bg-white rounded-t-2xl px-4 pb-8 pt-4 max-h-[60%]">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-semibold">
              Replace {currentGarment.name}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          {alternatives.length === 0 ? (
            <Text className="text-gray-400 text-center py-8">
              No compatible alternatives available
            </Text>
          ) : (
            <FlatList
              data={alternatives}
              numColumns={3}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  className="flex-1 m-1 bg-gray-50 rounded-lg p-2 items-center"
                  onPress={() => onSwap(item)}
                >
                  <Image
                    source={{ uri: item.cutout_url ?? item.image_url }}
                    className="w-20 h-20"
                    resizeMode="contain"
                  />
                  <Text
                    className="text-xs text-gray-600 mt-1"
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}
