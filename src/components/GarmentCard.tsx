import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  GestureResponderEvent,
} from "react-native";
import { Garment } from "@/types/database";
import { Ionicons } from "@expo/vector-icons";
import { isGarmentProcessingStale } from "@/services/garment.service";

interface GarmentCardProps {
  garment: Garment;
  onPress: () => void;
  onRetry?: () => void;
}

export function GarmentCard({
  garment,
  onPress,
  onRetry,
}: GarmentCardProps) {
  const imageUri = garment.cutout_url ?? garment.image_url;
  const isProcessing =
    garment.processing_status === "pending" ||
    garment.processing_status === "processing";
  const isStale = isGarmentProcessingStale(garment);
  const isRetryable = garment.processing_status === "failed" || isStale;

  const handleRetry = (event: GestureResponderEvent) => {
    event.stopPropagation();
    onRetry?.();
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      className="m-1 flex-1 overflow-hidden rounded-xl border border-clover-200 bg-[#FCFBF7]"
      activeOpacity={0.7}
    >
      <View className="aspect-square items-center justify-center bg-clover-100 p-2">
        <Image
          source={{ uri: imageUri }}
          className="w-full h-full"
          resizeMode="contain"
        />
        {isProcessing && !isStale && (
          <View className="absolute inset-0 bg-white/80 items-center justify-center">
            <ActivityIndicator color="#173F32" />
            <Text className="text-[10px] text-gray-600 mt-2">Analyzing</Text>
          </View>
        )}
        {isRetryable && (
          <View className="absolute top-2 right-2 bg-red-50 rounded-full p-1">
            <Ionicons name="alert-circle" size={16} color="#ef4444" />
          </View>
        )}
      </View>
      <View className="p-2">
        <Text className="text-xs font-medium text-gray-800" numberOfLines={1}>
          {garment.name}
        </Text>
        <Text className="text-xs text-gray-400 capitalize">
          {garment.processing_status === "ready"
            ? garment.category
            : isStale
              ? "analysis stalled"
              : garment.processing_status}
        </Text>
        {isRetryable && onRetry && (
          <TouchableOpacity
            className="mt-2 bg-red-50 rounded py-1 items-center"
            onPress={handleRetry}
          >
            <Text className="text-[10px] font-semibold text-red-600">
              Retry analysis
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}
