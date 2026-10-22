import { Modal, Pressable, Text, View } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

const STEPS = [
  {
    icon: "arrow-up-outline" as const,
    title: "Swipe up",
    body: "Go to the next look.",
  },
  {
    icon: "heart-outline" as const,
    title: "Double tap",
    body: "Like this outfit.",
  },
  {
    icon: "hanger" as const,
    title: "Hanger",
    body: "Save it to Closet → Outfits.",
    hanger: true,
  },
  {
    icon: "close-outline" as const,
    title: "Not for me",
    body: "Skip it as a dislike.",
  },
];

interface HomeGestureCoachProps {
  visible: boolean;
  onDismiss: () => void;
}

export function HomeGestureCoach({
  visible,
  onDismiss,
}: HomeGestureCoachProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 justify-end bg-black/40">
        <View className="rounded-t-3xl bg-[#FCFBF7] px-5 pb-10 pt-5">
          <Text className="text-xl font-bold text-stone-900">
            How this feed works
          </Text>
          <Text className="mt-1 text-sm text-stone-500">
            Same gestures every time. You can still tap a piece to swap or turn it.
          </Text>
          <View className="mt-5 gap-3">
            {STEPS.map((step) => (
              <View key={step.title} className="flex-row items-center">
                <View className="h-11 w-11 items-center justify-center rounded-full bg-clover-100">
                  {step.hanger ? (
                    <MaterialCommunityIcons
                      name="hanger"
                      size={20}
                      color="#12372A"
                    />
                  ) : (
                    <Ionicons name={step.icon} size={20} color="#12372A" />
                  )}
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-sm font-bold text-stone-900">
                    {step.title}
                  </Text>
                  <Text className="text-sm text-stone-500">{step.body}</Text>
                </View>
              </View>
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={onDismiss}
            className="mt-6 min-h-11 items-center justify-center rounded-xl bg-clover-600 py-3"
          >
            <Text className="font-bold text-white">Got it</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
