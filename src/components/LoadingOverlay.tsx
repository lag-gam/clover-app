import { View, Text, ActivityIndicator } from "react-native";
import { IngestionStep } from "@/services/garment.service";

const STEP_LABELS: Record<IngestionStep, string> = {
  compressing: "Compressing image...",
  uploading_original: "Uploading photo...",
  removing_background: "Removing background...",
  uploading_cutout: "Saving cutout...",
  analyzing: "Analyzing garment with AI...",
  generating_embedding: "Generating style embedding...",
  saving: "Saving to closet...",
};

interface LoadingOverlayProps {
  step: IngestionStep;
}

export function LoadingOverlay({ step }: LoadingOverlayProps) {
  return (
    <View className="absolute inset-0 bg-black/60 items-center justify-center z-50">
      <View className="bg-white rounded-2xl p-8 mx-8 items-center">
        <ActivityIndicator size="large" color="#16a34a" />
        <Text className="text-lg font-semibold mt-4 text-gray-800">
          Processing
        </Text>
        <Text className="text-sm text-gray-500 mt-2 text-center">
          {STEP_LABELS[step]}
        </Text>
      </View>
    </View>
  );
}
