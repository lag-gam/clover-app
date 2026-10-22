import { Switch, Text, View } from "react-native";

export function SagModeToggle({
  value,
  onValueChange,
  disabled = false,
}: {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View className="flex-row items-center justify-between rounded-xl border border-stone-200 bg-white px-4 py-3">
      <View className="mr-3 flex-1">
        <Text className="font-semibold text-stone-800">
          Sag mode · {value ? "On" : "Off"}
        </Text>
        <Text className="mt-0.5 text-xs text-stone-500">
          {value
            ? "Pants looks include a visible underwear waistband."
            : "Underwear is not added to recommendations."}
        </Text>
      </View>
      <Switch
        accessibilityLabel="Sag mode"
        accessibilityHint="Controls whether pants outfits show an underwear waistband"
        value={value}
        disabled={disabled}
        onValueChange={onValueChange}
        trackColor={{ false: "#d6d3d1", true: "#86efac" }}
        thumbColor={value ? "#15803d" : "#f5f5f4"}
      />
    </View>
  );
}
