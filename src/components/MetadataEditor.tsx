import { View, Text, TextInput, ScrollView, TouchableOpacity } from "react-native";
import { GarmentMetadataInput } from "@/services/garment.service";
import {
  CATEGORIES,
  COLORS,
  PATTERNS,
  MATERIALS,
  FITS,
  FORMALITY_LABELS,
} from "@/constants/categories";

interface MetadataEditorProps {
  metadata: GarmentMetadataInput;
  onChange: (metadata: GarmentMetadataInput) => void;
}

function ChipSelect<T extends string>({
  label,
  options,
  value,
  onChange,
  renderLabel,
}: {
  label: string;
  options: T[];
  value: T;
  onChange: (v: T) => void;
  renderLabel?: (v: T) => string;
}) {
  return (
    <View className="mb-4">
      <Text className="text-sm font-medium text-gray-700 mb-2">{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="flex-row"
      >
        {options.map((option) => (
          <TouchableOpacity
            key={option}
            onPress={() => onChange(option)}
            className={`px-3 py-1.5 rounded-full mr-2 border ${
              value === option
                ? "bg-clover-600 border-clover-600"
                : "bg-white border-gray-300"
            }`}
          >
            <Text
              className={`text-sm capitalize ${
                value === option ? "text-white" : "text-gray-600"
              }`}
            >
              {renderLabel ? renderLabel(option) : option}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

export function MetadataEditor({ metadata, onChange }: MetadataEditorProps) {
  const update = (field: keyof GarmentMetadataInput, value: unknown) => {
    onChange({ ...metadata, [field]: value });
  };

  return (
    <ScrollView className="flex-1 px-4 pt-4" showsVerticalScrollIndicator={false}>
      <View className="mb-4">
        <Text className="text-sm font-medium text-gray-700 mb-2">Name</Text>
        <TextInput
          className="border border-gray-300 rounded-lg px-4 py-2.5 text-base"
          value={metadata.name}
          onChangeText={(text) => update("name", text)}
          placeholder="Garment name"
          placeholderTextColor="#9ca3af"
        />
      </View>

      <ChipSelect
        label="Category"
        options={CATEGORIES.map((c) => c.value)}
        value={metadata.category as never}
        onChange={(v) => update("category", v)}
        renderLabel={(v) => CATEGORIES.find((c) => c.value === v)?.label ?? v}
      />

      <ChipSelect
        label="Primary Color"
        options={COLORS}
        value={metadata.color as never}
        onChange={(v) => update("color", v)}
      />

      <ChipSelect
        label="Pattern"
        options={PATTERNS}
        value={metadata.pattern as never}
        onChange={(v) => update("pattern", v)}
      />

      <ChipSelect
        label="Material"
        options={MATERIALS}
        value={metadata.material as never}
        onChange={(v) => update("material", v)}
      />

      <ChipSelect
        label="Fit"
        options={FITS}
        value={metadata.fit as never}
        onChange={(v) => update("fit", v)}
      />

      <ChipSelect
        label="Formality"
        options={[1, 2, 3, 4, 5].map(String) as never[]}
        value={String(metadata.formality) as never}
        onChange={(v) => update("formality", parseInt(v, 10))}
        renderLabel={(v) => FORMALITY_LABELS[parseInt(v, 10)] ?? v}
      />

      <View className="mb-4">
        <Text className="text-sm font-medium text-gray-700 mb-2">Tags</Text>
        <TextInput
          className="border border-gray-300 rounded-lg px-4 py-2.5 text-base"
          value={metadata.tags.join(", ")}
          onChangeText={(text) =>
            update(
              "tags",
              text
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean)
            )
          }
          placeholder="comma-separated tags"
          placeholderTextColor="#9ca3af"
        />
      </View>

      <View className="h-8" />
    </ScrollView>
  );
}
