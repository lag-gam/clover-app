import { ScrollView, TouchableOpacity, Text } from "react-native";
import { GarmentCategory } from "@/types/database";
import { CATEGORIES } from "@/constants/categories";

interface CategoryFilterProps {
  selected: GarmentCategory | null;
  onSelect: (category: GarmentCategory | null) => void;
}

export function CategoryFilter({ selected, onSelect }: CategoryFilterProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="px-3 py-2"
      contentContainerClassName="gap-2"
    >
      <TouchableOpacity
        onPress={() => onSelect(null)}
        className={`px-4 py-1.5 rounded-full border ${
          selected === null
            ? "bg-clover-600 border-clover-600"
            : "bg-white border-gray-300"
        }`}
      >
        <Text
          className={`text-sm ${
            selected === null ? "text-white" : "text-gray-600"
          }`}
        >
          All
        </Text>
      </TouchableOpacity>
      {CATEGORIES.map((cat) => (
        <TouchableOpacity
          key={cat.value}
          onPress={() =>
            onSelect(selected === cat.value ? null : cat.value)
          }
          className={`px-4 py-1.5 rounded-full border ${
            selected === cat.value
              ? "bg-clover-600 border-clover-600"
              : "bg-white border-gray-300"
          }`}
        >
          <Text
            className={`text-sm ${
              selected === cat.value ? "text-white" : "text-gray-600"
            }`}
          >
            {cat.label}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}
