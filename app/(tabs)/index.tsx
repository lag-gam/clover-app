import { View, Text } from "react-native";

export default function HomeScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-xl text-gray-400">Outfit recommendations</Text>
      <Text className="text-sm text-gray-300 mt-2">Coming soon</Text>
    </View>
  );
}
