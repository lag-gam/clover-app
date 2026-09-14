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
import { supabase } from "@/lib/supabase";
import {
  updateGarment,
  deleteGarment,
  GarmentMetadataInput,
} from "@/services/garment.service";
import { MetadataEditor } from "@/components/MetadataEditor";
import { Garment } from "@/types/database";
import { FORMALITY_LABELS } from "@/constants/categories";

export default function GarmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [garment, setGarment] = useState<Garment | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<GarmentMetadataInput | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadGarment();
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
    if (!garment) return;
    setEditData({
      name: garment.name,
      category: garment.category,
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

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    );
  }

  if (!garment) return null;

  if (editing && editData) {
    return (
      <View className="flex-1 bg-white">
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
    <ScrollView className="flex-1 bg-white">
      <View className="h-80 bg-gray-100 items-center justify-center">
        <Image
          source={{ uri: garment.cutout_url ?? garment.image_url }}
          className="h-72 w-72"
          resizeMode="contain"
        />
      </View>

      <View className="px-4 pt-4">
        <Text className="text-2xl font-bold text-gray-800">{garment.name}</Text>

        <View className="flex-row flex-wrap mt-3 gap-2">
          <Badge label={garment.category} />
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

        <View className="flex-row mt-6 gap-3">
          <TouchableOpacity
            className="flex-1 border border-clover-600 rounded-lg py-3 items-center"
            onPress={handleEdit}
          >
            <Text className="text-clover-600 font-semibold">Edit</Text>
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
