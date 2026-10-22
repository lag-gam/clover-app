import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@/hooks/useAuth";
import {
  createPendingGarment,
  IngestionStep,
} from "@/services/garment.service";
import { Ionicons } from "@expo/vector-icons";

export default function AddScreen() {
  const { user } = useAuth();
  const [step, setStep] = useState<IngestionStep>("compressing");
  const [saving, setSaving] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const pickImage = async (useCamera: boolean) => {
    const permMethod = useCamera
      ? ImagePicker.requestCameraPermissionsAsync
      : ImagePicker.requestMediaLibraryPermissionsAsync;

    const { granted } = await permMethod();
    if (!granted) {
      Alert.alert("Permission needed", "Please grant access to continue.");
      return;
    }

    const launchMethod = useCamera
      ? ImagePicker.launchCameraAsync
      : ImagePicker.launchImageLibraryAsync;

    const result = await launchMethod({
      mediaTypes: ["images"],
      quality: 1,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets[0]) {
      void saveImage(result.assets[0].uri);
    }
  };

  const saveImage = async (uri: string) => {
    if (!user) return;
    setSaving(true);
    setConfirmation(null);
    try {
      await createPendingGarment(uri, user.id, setStep);
      setConfirmation("Saved — analyzing in background");
    } catch (error) {
      Alert.alert(
        "Could not save garment",
        error instanceof Error ? error.message : "Please try again"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="flex-1 bg-white items-center justify-center px-8">
      {confirmation && (
        <View className="w-full flex-row items-center bg-clover-50 border border-clover-200 rounded-lg p-3 mb-8">
          <Ionicons name="checkmark-circle" size={22} color="#16a34a" />
          <Text className="flex-1 text-clover-700 font-medium ml-2">
            {confirmation}
          </Text>
        </View>
      )}

      <View className="items-center mb-10">
        <View className="w-24 h-24 rounded-full bg-clover-50 items-center justify-center mb-4">
          {saving ? (
            <ActivityIndicator size="large" color="#16a34a" />
          ) : (
            <Ionicons name="shirt-outline" size={40} color="#16a34a" />
          )}
        </View>
        <Text className="text-xl font-semibold text-gray-800">
          {saving ? stepLabel(step) : "Add a Garment"}
        </Text>
        <Text className="text-gray-500 text-center mt-2">
          {saving
            ? "You can add another as soon as the photo is saved"
            : "Take a photo or pick from your gallery"}
        </Text>
      </View>

      <TouchableOpacity
        className={`rounded-lg py-3 px-6 w-full items-center mb-3 ${
          saving ? "bg-clover-300" : "bg-clover-600"
        }`}
        onPress={() => pickImage(true)}
        disabled={saving}
      >
        <View className="flex-row items-center">
          <Ionicons name="camera" size={20} color="white" />
          <Text className="text-white font-semibold ml-2">Take Photo</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        className="border border-clover-600 rounded-lg py-3 px-6 w-full items-center"
        onPress={() => pickImage(false)}
        disabled={saving}
      >
        <View className="flex-row items-center">
          <Ionicons name="images" size={20} color="#16a34a" />
          <Text className="text-clover-600 font-semibold ml-2">
            Pick from Gallery
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

function stepLabel(step: IngestionStep) {
  switch (step) {
    case "compressing":
      return "Preparing photo…";
    case "uploading_original":
      return "Uploading photo…";
    case "saving":
      return "Saving garment…";
  }
}
