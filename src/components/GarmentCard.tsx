import { View, Text, Image, TouchableOpacity } from "react-native";
import { Garment } from "@/types/database";

interface GarmentCardProps {
  garment: Garment;
  onPress: () => void;
}

export function GarmentCard({ garment, onPress }: GarmentCardProps) {
  const imageUri = garment.cutout_url ?? garment.image_url;

  return (
    <TouchableOpacity
      onPress={onPress}
      className="flex-1 m-1 bg-gray-50 rounded-lg overflow-hidden"
      activeOpacity={0.7}
    >
      <View className="aspect-square items-center justify-center bg-gray-100 p-2">
        <Image
          source={{ uri: imageUri }}
          className="w-full h-full"
          resizeMode="contain"
        />
      </View>
      <View className="p-2">
        <Text className="text-xs font-medium text-gray-800" numberOfLines={1}>
          {garment.name}
        </Text>
        <Text className="text-xs text-gray-400 capitalize">
          {garment.category}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
