import { useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "@/lib/supabase";
import {
  updateGarment,
  deleteGarment,
  retryGarmentProcessing,
  GarmentMetadataInput,
  isGarmentProcessingStale,
  uploadGarmentBackImage,
} from "@/services/garment.service";
import { MetadataEditor } from "@/components/MetadataEditor";
import { Garment } from "@/types/database";
import { FORMALITY_LABELS } from "@/constants/categories";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/hooks/useAuth";
import { GarmentDisplaySide } from "@/types/database";

export default function GarmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [garment, setGarment] = useState<Garment | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<GarmentMetadataInput | null>(null);
  const [saving, setSaving] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [displaySide, setDisplaySide] =
    useState<GarmentDisplaySide>("front");
  const [uploadingBack, setUploadingBack] = useState(false);

  useEffect(() => {
    void loadGarment();
  }, [id]);

  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`garment:${id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "garments",
          filter: `id=eq.${id}`,
        },
        (payload) => setGarment(payload.new as Garment)
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id]);

  const loadGarment = async () => {
    const { data, error } = await supabase
      .from("garments")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      Alert.alert("Error", "Garment not found");
      router.back();
      return;
    }
    setGarment(data as Garment);
    setLoading(false);
  };

  const handleEdit = () => {
    if (!garment || garment.processing_status !== "ready") return;
    setEditData({
      name: garment.name,
      category: garment.category,
      subtype: garment.subtype,
      metal_tone: garment.metal_tone ?? "none",
      color: garment.color,
      secondary_color: garment.secondary_color,
      pattern: garment.pattern,
      material: garment.material,
      fit: garment.fit,
      formality: garment.formality,
      tags: garment.tags,
    });
    setEditing(true);
  };

  const handleRetry = async () => {
    if (!garment) return;
    setRetrying(true);
    try {
      await retryGarmentProcessing(garment.id);
      setGarment({
        ...garment,
        processing_status: "pending",
        processing_error: null,
      });
    } catch (error) {
      Alert.alert(
        "Retry failed",
        error instanceof Error ? error.message : "Could not retry analysis"
      );
    } finally {
      setRetrying(false);
    }
  };

  const handleSave = async () => {
    if (!editData || !garment) return;
    setSaving(true);
    try {
      const updated = await updateGarment(garment.id, editData);
      setGarment(updated);
      setEditing(false);
    } catch (e) {
      Alert.alert("Error", "Failed to update garment");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert("Delete Garment", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteGarment(id!);
            router.back();
          } catch (e) {
            Alert.alert("Error", "Failed to delete garment");
          }
        },
      },
    ]);
  };

  const chooseBackPhoto = () => {
    Alert.alert(
      garment?.back_image_url ? "Replace back photo" : "Add back photo",
      "Choose a source. Your photo will not be cropped.",
      [
        {
          text: "Camera",
          onPress: () => void pickBackPhoto("camera"),
        },
        {
          text: "Photo Library",
          onPress: () => void pickBackPhoto("library"),
        },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  const pickBackPhoto = async (source: "camera" | "library") => {
    if (!garment || !user || uploadingBack) return;
    try {
      if (source === "camera") {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert(
            "Camera permission required",
            "Allow camera access to photograph the back of this garment."
          );
          return;
        }
      }
      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ["images"],
              allowsEditing: false,
              quality: 1,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ["images"],
              allowsEditing: false,
              quality: 1,
            });
      if (result.canceled) return;

      setUploadingBack(true);
      const updated = await uploadGarmentBackImage(
        garment.id,
        result.assets[0].uri,
        user.id
      );
      setGarment(updated);
      setDisplaySide("back");
    } catch (error) {
      Alert.alert(
        "Could not add back photo",
        error instanceof Error ? error.message : "Please try again."
      );
    } finally {
      setUploadingBack(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-clover-50">
        <ActivityIndicator size="large" color="#173F32" />
      </View>
    );
  }

  if (!garment) return null;

  const processingStalled = isGarmentProcessingStale(garment);
  const processingRetryable =
    garment.processing_status === "failed" || processingStalled;

  if (editing && editData) {
    return (
      <View className="flex-1 bg-clover-50">
        <MetadataEditor metadata={editData} onChange={setEditData} />
        <View className="flex-row px-4 pb-8 pt-2 gap-3">
          <TouchableOpacity
            className="flex-1 border border-gray-300 rounded-lg py-3 items-center"
            onPress={() => setEditing(false)}
          >
            <Text className="text-gray-600 font-semibold">Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={`flex-1 rounded-lg py-3 items-center ${saving ? "bg-clover-300" : "bg-clover-600"}`}
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

  return (
    <ScrollView className="flex-1 bg-clover-50">
      <View className="h-80 items-center justify-center border-b border-clover-200 bg-clover-100">
        <Image
          source={{
            uri:
              displaySide === "back" && garment.back_image_url
                ? garment.back_cutout_url ?? garment.back_image_url
                : garment.cutout_url ?? garment.image_url,
          }}
          className="h-72 w-72"
          resizeMode="contain"
        />
      </View>

      <View className="px-4 pt-4">
        <View className="mb-4 flex-row gap-2">
          <TouchableOpacity
            onPress={() => setDisplaySide("front")}
            className={`flex-1 items-center rounded-xl py-2.5 ${
              displaySide === "front" ? "bg-clover-600" : "bg-gray-100"
            }`}
          >
            <Text
              className={
                displaySide === "front"
                  ? "font-semibold text-white"
                  : "font-semibold text-gray-600"
              }
            >
              Front
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            disabled={!garment.back_image_url}
            onPress={() => setDisplaySide("back")}
            className={`flex-1 items-center rounded-xl py-2.5 ${
              displaySide === "back"
                ? "bg-clover-600"
                : garment.back_image_url
                  ? "bg-gray-100"
                  : "bg-gray-50"
            }`}
          >
            <Text
              className={
                displaySide === "back"
                  ? "font-semibold text-white"
                  : garment.back_image_url
                    ? "font-semibold text-gray-600"
                    : "font-semibold text-gray-300"
              }
            >
              Back
            </Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          disabled={uploadingBack}
          onPress={chooseBackPhoto}
          className="mb-5 flex-row items-center justify-center rounded-xl border border-clover-200 bg-clover-50 py-3"
        >
          {uploadingBack ? (
            <ActivityIndicator size="small" color="#12372A" />
          ) : (
            <Ionicons name="camera-outline" size={19} color="#12372A" />
          )}
          <Text className="ml-2 font-semibold text-clover-700">
            {uploadingBack
              ? "Adding back photo…"
              : garment.back_image_url
                ? "Replace Back photo"
                : "Add Back photo"}
          </Text>
        </TouchableOpacity>
        {garment.processing_status !== "ready" && (
          <View
            className={`rounded-lg p-4 mb-4 ${
              processingRetryable
                ? "bg-red-50"
                : "bg-clover-50"
            }`}
          >
            <View className="flex-row items-center">
              {processingRetryable ? (
                <Ionicons name="alert-circle" size={20} color="#ef4444" />
              ) : (
                <ActivityIndicator size="small" color="#173F32" />
              )}
              <Text
                className={`flex-1 font-semibold ml-2 ${
                  processingRetryable
                    ? "text-red-700"
                    : "text-clover-700"
                }`}
              >
                {garment.processing_status === "failed"
                  ? "Analysis failed"
                  : processingStalled
                    ? "Analysis stalled"
                  : "Analyzing in background"}
              </Text>
            </View>
            {garment.processing_error && (
              <Text className="text-sm text-red-600 mt-2">
                {garment.processing_error}
              </Text>
            )}
            {processingRetryable && (
              <TouchableOpacity
                className="bg-red-600 rounded-lg py-2 items-center mt-3"
                onPress={() => void handleRetry()}
                disabled={retrying}
              >
                <Text className="text-white font-semibold">
                  {retrying ? "Retrying…" : "Retry analysis"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <Text className="text-2xl font-bold text-gray-800">{garment.name}</Text>

        {garment.processing_status === "ready" && (
          <>
            <View className="flex-row flex-wrap mt-3 gap-2">
              <Badge label={garment.category} />
              {garment.subtype && (
                <Badge label={garment.subtype.replaceAll("_", " ")} />
              )}
              {garment.metal_tone && garment.metal_tone !== "none" && (
                <Badge
                  label={`${garment.metal_tone.replaceAll("_", " ")} tone`}
                />
              )}
              <Badge label={garment.color} />
              <Badge label={garment.pattern} />
              <Badge label={garment.material} />
              <Badge label={garment.fit} />
              <Badge label={FORMALITY_LABELS[garment.formality]} />
            </View>

            {garment.tags.length > 0 && (
              <View className="flex-row flex-wrap mt-3 gap-1">
                {garment.tags.map((tag) => (
                  <View key={tag} className="bg-clover-50 px-2 py-1 rounded">
                    <Text className="text-xs text-clover-700">{tag}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        <TouchableOpacity
          className={`mt-6 flex-row items-center justify-center rounded-xl py-4 ${
            garment.processing_status === "ready"
              ? "bg-clover-600"
              : "bg-gray-200"
          }`}
          onPress={() => router.push(`/style/${garment.id}`)}
          disabled={garment.processing_status !== "ready"}
        >
          <Ionicons
            name="sparkles"
            size={18}
            color={garment.processing_status === "ready" ? "#ffffff" : "#9ca3af"}
          />
          <Text
            className={`ml-2 font-semibold ${
              garment.processing_status === "ready"
                ? "text-white"
                : "text-gray-400"
            }`}
          >
            Style this item
          </Text>
        </TouchableOpacity>
        {garment.processing_status !== "ready" && (
          <Text className="mt-2 text-center text-xs text-gray-400">
            Styling is available after analysis finishes.
          </Text>
        )}

        <View className="flex-row mt-6 gap-3">
          <TouchableOpacity
            className={`flex-1 border rounded-lg py-3 items-center ${
              garment.processing_status === "ready"
                ? "border-clover-600"
                : "border-gray-300"
            }`}
            onPress={handleEdit}
            disabled={garment.processing_status !== "ready"}
          >
            <Text
              className={`font-semibold ${
                garment.processing_status === "ready"
                  ? "text-clover-600"
                  : "text-gray-400"
              }`}
            >
              Edit
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 border border-red-300 rounded-lg py-3 items-center"
            onPress={handleDelete}
          >
            <Text className="text-red-500 font-semibold">Delete</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View className="h-8" />
    </ScrollView>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <View className="bg-gray-100 px-3 py-1 rounded-full">
      <Text className="text-xs text-gray-600 capitalize">{label}</Text>
    </View>
  );
}
