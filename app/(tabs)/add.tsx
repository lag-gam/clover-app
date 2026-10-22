import { useRef, useState } from "react";
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
  BatchGarmentProgress,
  createPendingGarments,
  IngestionStep,
} from "@/services/garment.service";
import { Ionicons } from "@expo/vector-icons";

const MAX_LIBRARY_SELECTION = 25;

type Confirmation = {
  message: string;
  hasFailures: boolean;
};

export default function AddScreen() {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<BatchGarmentProgress | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const operationInProgress = useRef(false);

  const pickImage = async (useCamera: boolean) => {
    if (operationInProgress.current) return;
    if (!user) {
      Alert.alert("Sign in required", "Please sign in before adding garments.");
      return;
    }

    operationInProgress.current = true;
    setSaving(true);
    setProgress(null);
    setConfirmation(null);

    try {
      const permission = useCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      const hasLimitedLibraryAccess =
        !useCamera &&
        "accessPrivileges" in permission &&
        permission.accessPrivileges === "limited";

      if (!permission.granted && !hasLimitedLibraryAccess) {
        Alert.alert(
          "Permission needed",
          useCamera
            ? "Please allow camera access to take a garment photo."
            : "Please allow photo access to select garments."
        );
        return;
      }

      let result: ImagePicker.ImagePickerResult;
      let usedSingleSelectionFallback = false;
      if (useCamera) {
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          quality: 1,
          allowsEditing: false,
        });
      } else {
        try {
          result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            quality: 1,
            allowsEditing: false,
            allowsMultipleSelection: true,
            selectionLimit: MAX_LIBRARY_SELECTION,
            orderedSelection: true,
          });
        } catch {
          usedSingleSelectionFallback = true;
          result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            quality: 1,
            allowsEditing: false,
          });
        }
      }

      if (result.canceled) return;

      const uris = (result.assets ?? [])
        .map((asset) => asset.uri)
        .filter((uri): uri is string => Boolean(uri));
      const selectedUris = useCamera ? uris.slice(0, 1) : uris;
      if (selectedUris.length === 0) {
        Alert.alert(
          "No photos selected",
          "Choose at least one garment photo to continue."
        );
        return;
      }

      if (usedSingleSelectionFallback) {
        Alert.alert(
          "Batch selection unavailable",
          "This device supports one library photo at a time. The selected garment will still be saved."
        );
      }

      const resultSummary = await createPendingGarments(
        selectedUris,
        user.id,
        setProgress
      );
      const saved = resultSummary.garments.length;
      const failed = resultSummary.failures.length;

      if (saved > 0) {
        setConfirmation({
          message: `${saved} garment${saved === 1 ? "" : "s"} saved — analyzing in background.${
            failed > 0
              ? ` ${failed} failed — select ${failed === 1 ? "that photo" : "those photos"} again to retry.`
              : ""
          }`,
          hasFailures: failed > 0,
        });
      } else {
        setConfirmation({
          message: `${failed} photo${failed === 1 ? "" : "s"} could not be saved — select ${
            failed === 1 ? "it" : "them"
          } again to retry.`,
          hasFailures: true,
        });
      }

      if (failed > 0) {
        const firstError = resultSummary.failures[0]?.error.message;
        Alert.alert(
          saved > 0 ? "Some garments were not saved" : "Garments not saved",
          `${failed} of ${selectedUris.length} failed.${
            firstError ? ` ${firstError}` : ""
          } ${
            saved > 0
              ? "Your successful garments were kept."
              : "Select the photos again to retry."
          }`
        );
      }
    } catch (error) {
      Alert.alert(
        "Could not add garment",
        error instanceof Error ? error.message : "Please try again"
      );
    } finally {
      operationInProgress.current = false;
      setSaving(false);
    }
  };

  return (
    <View className="flex-1 bg-clover-50 items-center justify-center px-8">
      {confirmation && (
        <View
          className={`w-full flex-row items-center border rounded-lg p-3 mb-8 ${
            confirmation.hasFailures
              ? "bg-amber-50 border-amber-200"
              : "bg-clover-50 border-clover-200"
          }`}
        >
          <Ionicons
            name={confirmation.hasFailures ? "alert-circle" : "checkmark-circle"}
            size={22}
            color={confirmation.hasFailures ? "#d97706" : "#173F32"}
          />
          <Text
            className={`flex-1 font-medium ml-2 ${
              confirmation.hasFailures ? "text-amber-800" : "text-clover-700"
            }`}
          >
            {confirmation.message}
          </Text>
        </View>
      )}

      <View className="items-center mb-10">
        <View className="mb-4 h-24 w-24 items-center justify-center rounded-3xl border border-clover-200 bg-clover-100">
          {saving ? (
            <ActivityIndicator size="large" color="#173F32" />
          ) : (
            <Ionicons name="shirt-outline" size={40} color="#173F32" />
          )}
        </View>
        <Text className="text-xl font-semibold text-gray-800">
          {saving
            ? progress
              ? `${progress.completed}/${progress.total} complete`
              : "Choosing photos…"
            : "Add Garments"}
        </Text>
        <Text className="text-gray-500 text-center mt-2">
          {saving
            ? progress?.currentStep
              ? stepLabel(progress.currentStep)
              : progress
                ? `${progress.succeeded} saved${
                    progress.failed > 0
                      ? `, ${progress.failed} failed`
                      : ""
                  }`
                : "Waiting for your selection"
            : `Take one photo or select up to ${MAX_LIBRARY_SELECTION} from your library`}
        </Text>
      </View>

      <TouchableOpacity
        className={`mb-3 min-h-11 w-full items-center rounded-xl px-6 py-3 ${
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
        className={`min-h-11 w-full items-center rounded-xl border px-6 py-3 ${
          saving ? "border-clover-300" : "border-clover-600"
        }`}
        onPress={() => pickImage(false)}
        disabled={saving}
      >
        <View className="flex-row items-center">
          <Ionicons
            name="images"
            size={20}
            color={saving ? "#adc3b3" : "#173f32"}
          />
          <Text
            className={`font-semibold ml-2 ${
              saving ? "text-clover-300" : "text-clover-600"
            }`}
          >
            Select from Photo Library
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

function stepLabel(step: IngestionStep) {
  switch (step) {
    case "compressing":
      return "Preparing photos…";
    case "uploading_original":
      return "Uploading photos…";
    case "saving":
      return "Saving garments…";
  }
}
