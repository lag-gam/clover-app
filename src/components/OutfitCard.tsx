import { useRef } from "react";
import {
  View,
  Text,
  Image,
  Animated,
  PanResponder,
  Dimensions,
  TouchableWithoutFeedback,
} from "react-native";
import { Garment } from "@/types/database";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;
const SWIPE_DOWN_THRESHOLD = 120;

interface OutfitCardProps {
  garments: { garment: Garment; slot: string }[];
  score: number | null;
  onLike: () => void;
  onDislike: () => void;
  onSkip: () => void;
  onGarmentTap: (garment: Garment) => void;
}

export function OutfitCard({
  garments,
  score,
  onLike,
  onDislike,
  onSkip,
  onGarmentTap,
}: OutfitCardProps) {
  const pan = useRef(new Animated.ValueXY()).current;
  const lastTap = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 10 || Math.abs(gs.dy) > 10,
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_, gs) => {
        if (gs.dx > SWIPE_THRESHOLD) {
          // Swipe right → like
          Animated.timing(pan, {
            toValue: { x: SCREEN_WIDTH, y: gs.dy },
            duration: 200,
            useNativeDriver: false,
          }).start(onLike);
        } else if (gs.dx < -SWIPE_THRESHOLD) {
          // Swipe left → dislike
          Animated.timing(pan, {
            toValue: { x: -SCREEN_WIDTH, y: gs.dy },
            duration: 200,
            useNativeDriver: false,
          }).start(onDislike);
        } else if (gs.dy > SWIPE_DOWN_THRESHOLD) {
          // Swipe down → skip
          Animated.timing(pan, {
            toValue: { x: 0, y: 600 },
            duration: 200,
            useNativeDriver: false,
          }).start(onSkip);
        } else {
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      // Double tap → like (TikTok style)
      Animated.timing(pan, {
        toValue: { x: SCREEN_WIDTH, y: 0 },
        duration: 250,
        useNativeDriver: false,
      }).start(onLike);
    }
    lastTap.current = now;
  };

  const rotate = pan.x.interpolate({
    inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
    outputRange: ["-8deg", "0deg", "8deg"],
  });

  const opacity = pan.x.interpolate({
    inputRange: [-SCREEN_WIDTH, -SWIPE_THRESHOLD, 0, SWIPE_THRESHOLD, SCREEN_WIDTH],
    outputRange: [0.5, 0.8, 1, 0.8, 0.5],
  });

  // Sort garments in display order
  const slotOrder = ["outerwear", "top", "dress", "bottom", "shoes", "accessory"];
  const sorted = [...garments].sort(
    (a, b) => slotOrder.indexOf(a.slot) - slotOrder.indexOf(b.slot)
  );

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={{
        transform: [{ translateX: pan.x }, { translateY: pan.y }, { rotate }],
        opacity,
      }}
      className="bg-white rounded-2xl shadow-lg mx-4 overflow-hidden"
    >
      <TouchableWithoutFeedback onPress={handleDoubleTap}>
        <View className="p-4">
          {/* Swipe hint indicators */}
          <View className="flex-row justify-between mb-3 px-2">
            <Animated.Text
              style={{
                opacity: pan.x.interpolate({
                  inputRange: [-SCREEN_WIDTH, 0, 0],
                  outputRange: [1, 0, 0],
                }),
              }}
              className="text-red-400 font-bold text-sm"
            >
              NOPE
            </Animated.Text>
            <Animated.Text
              style={{
                opacity: pan.x.interpolate({
                  inputRange: [0, 0, SCREEN_WIDTH],
                  outputRange: [0, 0, 1],
                }),
              }}
              className="text-clover-500 font-bold text-sm"
            >
              LIKE
            </Animated.Text>
          </View>

          {/* Garment stack */}
          <View className="items-center gap-1">
            {sorted.map(({ garment, slot }) => (
              <TouchableWithoutFeedback
                key={garment.id}
                onPress={() => onGarmentTap(garment)}
              >
                <View className="items-center">
                  <Image
                    source={{
                      uri: garment.cutout_url ?? garment.image_url,
                    }}
                    className="w-32 h-32"
                    resizeMode="contain"
                  />
                  <Text className="text-xs text-gray-400 capitalize">
                    {slot}
                  </Text>
                </View>
              </TouchableWithoutFeedback>
            ))}
          </View>

          {/* Score */}
          {score !== null && score > 0 && (
            <View className="mt-3 items-center">
              <Text className="text-xs text-gray-400">
                Style match: {Math.round(score * 100)}%
              </Text>
            </View>
          )}

          {/* Hint text */}
          <Text className="text-center text-xs text-gray-300 mt-3">
            Swipe right to like · left to dislike · down to skip · double-tap to like
          </Text>
        </View>
      </TouchableWithoutFeedback>
    </Animated.View>
  );
}
