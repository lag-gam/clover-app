import { useRef } from "react";
import {
  View,
  Text,
  Animated,
  PanResponder,
  Dimensions,
  TouchableWithoutFeedback,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Garment } from "@/types/database";
import { FlatLayCollage, FlatLayItem } from "@/components/FlatLayCollage";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const PEEK_START = 18;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.28;
const SWIPE_VERTICAL_THRESHOLD = 110;

interface OutfitCardProps {
  garments: { garment: Garment; slot: string }[];
  score: number | null;
  onLike: () => void;
  onDislike: () => void;
  onSkip: () => void;
  onSave: () => void | Promise<void>;
  onItemTap: (item: FlatLayItem) => void;
}

export function OutfitCard({
  garments,
  score,
  onLike,
  onDislike,
  onSkip,
  onSave,
  onItemTap,
}: OutfitCardProps) {
  const pan = useRef(new Animated.ValueXY()).current;
  const lastTap = useRef(0);
  const onLikeRef = useRef(onLike);
  const onDislikeRef = useRef(onDislike);
  const onSkipRef = useRef(onSkip);
  const onSaveRef = useRef(onSave);
  onLikeRef.current = onLike;
  onDislikeRef.current = onDislike;
  onSkipRef.current = onSkip;
  onSaveRef.current = onSave;

  const flyOff = (
    toValue: { x: number; y: number },
    onDone: () => void
  ) => {
    Animated.timing(pan, {
      toValue,
      duration: 220,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) onDone();
    });
  };

  const springBack = () => {
    Animated.spring(pan, {
      toValue: { x: 0, y: 0 },
      friction: 6,
      useNativeDriver: false,
    }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 8 || Math.abs(gs.dy) > 8,
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_, gs) => {
        const absX = Math.abs(gs.dx);
        const absY = Math.abs(gs.dy);
        const vertical = absY > absX;

        if (vertical && gs.dy < -SWIPE_VERTICAL_THRESHOLD) {
          flyOff({ x: 0, y: -SCREEN_HEIGHT }, () => {
            void Promise.resolve(onSaveRef.current()).catch(() => {
              springBack();
            });
          });
        } else if (vertical && gs.dy > SWIPE_VERTICAL_THRESHOLD) {
          flyOff({ x: 0, y: SCREEN_HEIGHT }, () => onSkipRef.current());
        } else if (gs.dx < -SWIPE_THRESHOLD) {
          flyOff({ x: -SCREEN_WIDTH, y: gs.dy }, () => onLikeRef.current());
        } else if (gs.dx > SWIPE_THRESHOLD) {
          flyOff({ x: SCREEN_WIDTH, y: gs.dy }, () => onDislikeRef.current());
        } else {
          springBack();
        }
      },
    })
  ).current;

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      flyOff({ x: -SCREEN_WIDTH, y: 0 }, () => onLikeRef.current());
    }
    lastTap.current = now;
  };

  const rotate = pan.x.interpolate({
    inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
    outputRange: ["-8deg", "0deg", "8deg"],
  });

  const likePeek = pan.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, -PEEK_START, 0],
    outputRange: [1, 0.7, 0.22],
    extrapolate: "clamp",
  });
  const dislikePeek = pan.x.interpolate({
    inputRange: [0, PEEK_START, SWIPE_THRESHOLD],
    outputRange: [0.22, 0.7, 1],
    extrapolate: "clamp",
  });
  const savePeek = pan.y.interpolate({
    inputRange: [-SWIPE_VERTICAL_THRESHOLD, -PEEK_START, 0],
    outputRange: [1, 0.7, 0.22],
    extrapolate: "clamp",
  });
  const skipPeek = pan.y.interpolate({
    inputRange: [0, PEEK_START, SWIPE_VERTICAL_THRESHOLD],
    outputRange: [0.22, 0.7, 1],
    extrapolate: "clamp",
  });
  const likeStamp = pan.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, -PEEK_START, 0],
    outputRange: [1, 0.85, 0],
    extrapolate: "clamp",
  });
  const dislikeStamp = pan.x.interpolate({
    inputRange: [0, PEEK_START, SWIPE_THRESHOLD],
    outputRange: [0, 0.85, 1],
    extrapolate: "clamp",
  });
  const saveStamp = pan.y.interpolate({
    inputRange: [-SWIPE_VERTICAL_THRESHOLD, -PEEK_START, 0],
    outputRange: [1, 0.85, 0],
    extrapolate: "clamp",
  });
  const likeScale = pan.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [1.08, 0.86],
    extrapolate: "clamp",
  });
  const dislikeScale = pan.x.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [0.86, 1.08],
    extrapolate: "clamp",
  });
  const saveScale = pan.y.interpolate({
    inputRange: [-SWIPE_VERTICAL_THRESHOLD, 0],
    outputRange: [1.08, 0.86],
    extrapolate: "clamp",
  });

  return (
    <View className="mx-2">
      <View
        pointerEvents="none"
        className="absolute inset-y-0 left-0 right-0 items-center justify-center"
      >
        <Animated.View
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={{
            position: "absolute",
            top: 8,
            opacity: savePeek,
            transform: [{ scale: saveScale }],
          }}
        >
          <View className="h-16 w-16 items-center justify-center rounded-full bg-clover-600">
            <Ionicons name="add" size={36} color="#ffffff" />
          </View>
        </Animated.View>
        <Animated.View
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={{
            position: "absolute",
            left: 2,
            opacity: likePeek,
            transform: [{ scale: likeScale }],
          }}
        >
          <View className="h-16 w-16 items-center justify-center rounded-full bg-clover-600">
            <Ionicons name="checkmark" size={36} color="#ffffff" />
          </View>
        </Animated.View>
        <Animated.View
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={{
            position: "absolute",
            right: 2,
            opacity: dislikePeek,
            transform: [{ scale: dislikeScale }],
          }}
        >
          <View className="h-16 w-16 items-center justify-center rounded-full bg-red-500">
            <Ionicons name="close" size={36} color="#ffffff" />
          </View>
        </Animated.View>
        <Animated.View
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={{
            position: "absolute",
            bottom: 8,
            opacity: skipPeek,
            transform: [{ scale: skipPeek }],
          }}
        >
          <View className="h-14 w-14 items-center justify-center rounded-full bg-stone-400">
            <Ionicons name="arrow-down" size={28} color="#ffffff" />
          </View>
        </Animated.View>
      </View>

      <Animated.View
        {...panResponder.panHandlers}
        style={{
          transform: [{ translateX: pan.x }, { translateY: pan.y }, { rotate }],
        }}
        className="mx-3 overflow-hidden rounded-2xl bg-white shadow-lg"
      >
        <TouchableWithoutFeedback onPress={handleDoubleTap}>
          <View className="p-4">
            <Animated.View
              pointerEvents="none"
              style={{
                position: "absolute",
                alignSelf: "center",
                top: 18,
                zIndex: 20,
                opacity: saveStamp,
                transform: [{ scale: saveScale }],
              }}
            >
              <View className="h-11 w-11 items-center justify-center rounded-full border-2 border-clover-600 bg-white/95">
                <Ionicons name="add" size={26} color="#173F32" />
              </View>
            </Animated.View>
            <Animated.View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: 16,
                top: 18,
                zIndex: 20,
                opacity: likeStamp,
                transform: [{ rotate: "-12deg" }, { scale: likeScale }],
              }}
            >
              <View className="h-11 w-11 items-center justify-center rounded-full border-2 border-clover-600 bg-white/95">
                <Ionicons name="checkmark" size={22} color="#173F32" />
              </View>
            </Animated.View>
            <Animated.View
              pointerEvents="none"
              style={{
                position: "absolute",
                right: 16,
                top: 18,
                zIndex: 20,
                opacity: dislikeStamp,
                transform: [{ rotate: "12deg" }, { scale: dislikeScale }],
              }}
            >
              <View className="h-11 w-11 items-center justify-center rounded-full border-2 border-red-500 bg-white/95">
                <Ionicons name="close" size={22} color="#ef4444" />
              </View>
            </Animated.View>

            <FlatLayCollage
              items={garments}
              onGarmentPress={() => {}}
              onItemPress={onItemTap}
              accessibilityLabel="Recommended outfit flat lay"
            />

            {score !== null && score > 0 && (
              <View className="mt-3 items-center">
                <Text className="text-xs text-gray-400">
                  Style match: {Math.round(score * 100)}%
                </Text>
              </View>
            )}
          </View>
        </TouchableWithoutFeedback>
      </Animated.View>
    </View>
  );
}
