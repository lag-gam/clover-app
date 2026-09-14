import { useState } from "react";
import { View, Text, TouchableOpacity, Image, Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@/hooks/useAuth";
import {
  ingestGarment,
  saveGarment,
  IngestionStep,
  GarmentMetadataInput,
} from "@/services/garment.service";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { MetadataEditor } from "@/components/MetadataEditor";
import { Ionicons } from "@expo/vector-icons";

type Phase = "pick" | "processing" | "review";

export default function AddScreen() {
  const { user } = useAuth();
  const [phase, setPhase] = useState<Phase>("pick");
  const [step, setStep] = useState<IngestionStep>("compressing");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<GarmentMetadataInput | null>(null);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [cutoutUrl, setCutoutUrl] = useState<string | null>(null);
  const [embedding, setEmbedding] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

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
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
      allowsEditing: true,
      aspect: [3, 4],
    });

    if (!result.canceled && result.assets[0]) {
      processImage(result.assets[0].uri);
    }
  };

  const processImage = async (uri: string) => {
    setImageUri(uri);
    setPhase("processing");

    try {
      const result = await ingestGarment(uri, user!.id, setStep);
      setMetadata(result.metadata);
      setImageUrl(result.imageUrl);
      setCutoutUrl(result.cutoutUrl);
      setEmbedding(result.embedding);
      setPhase("review");
    } catch (error) {
      Alert.alert(
        "Processing Error",
        error instanceof Error ? error.message : "Something went wrong"
      );
      resetState();
    }
  };

  const handleSave = async () => {
    if (!metadata || !user) return;
    setSaving(true);
    try {
      await saveGarment(user.id, metadata, imageUrl, cutoutUrl, embedding);
      Alert.alert("Saved", `${metadata.name} added to your closet!`);
      resetState();
    } catch (error) {
      Alert.alert(
        "Save Error",
        error instanceof Error ? error.message : "Failed to save"
      );
    } finally {
      setSaving(false);
    }
  };

  const resetState = () => {
    setPhase("pick");
    setImageUri(null);
    setMetadata(null);
    setImageUrl("");
    setCutoutUrl(null);
    setEmbedding([]);
  };

  if (phase === "processing") {
    return (
      <View className="flex-1 bg-white">
        {imageUri && (
          <Image
            source={{ uri: imageUri }}
            className="flex-1 opacity-30"
            resizeMode="cover"
          />
        )}
        <LoadingOverlay step={step} />
      </View>
    );
  }

  if (phase === "review" && metadata) {
    return (
      <View className="flex-1 bg-white">
        <View className="h-48 bg-gray-100 items-center justify-center">
          <Image
            source={{ uri: cutoutUrl ?? imageUrl }}
            className="h-44 w-44"
            resizeMode="contain"
          />
        </View>

        <MetadataEditor metadata={metadata} onChange={setMetadata} />

        <View className="flex-row px-4 pb-8 pt-2 gap-3">
          <TouchableOpacity
            className="flex-1 border border-gray-300 rounded-lg py-3 items-center"
            onPress={resetState}
          >
            <Text className="text-gray-600 font-semibold">Discard</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={`flex-1 rounded-lg py-3 items-center ${
              saving ? "bg-clover-300" : "bg-clover-600"
            }`}
            onPress={handleSave}
            disabled={saving}
          >
            <Text className="text-white font-semibold">
              {saving ? "Saving..." : "Save"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Pick phase
  return (
    <View className="flex-1 bg-white items-center justify-center px-8">
      <View className="items-center mb-10">
        <View className="w-24 h-24 rounded-full bg-clover-50 items-center justify-center mb-4">
          <Ionicons name="shirt-outline" size={40} color="#16a34a" />
        </View>
        <Text className="text-xl font-semibold text-gray-800">
          Add a Garment
        </Text>
        <Text className="text-gray-500 text-center mt-2">
          Take a photo or pick from your gallery
        </Text>
      </View>

      <TouchableOpacity
        className="bg-clover-600 rounded-lg py-3 px-6 w-full items-center mb-3"
        onPress={() => pickImage(true)}
      >
        <View className="flex-row items-center">
          <Ionicons name="camera" size={20} color="white" />
          <Text className="text-white font-semibold ml-2">Take Photo</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        className="border border-clover-600 rounded-lg py-3 px-6 w-full items-center"
        onPress={() => pickImage(false)}
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
