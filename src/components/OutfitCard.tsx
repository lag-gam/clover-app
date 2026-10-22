import { useRef } from "react";
import {
  View,
  Text,
  Animated,
  PanResponder,
  Dimensions,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Garment } from "@/types/database";
import { FlatLayCollage, FlatLayItem } from "@/components/FlatLayCollage";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const SWIPE_UP_THRESHOLD = 96;
const DOUBLE_TAP_MS = 280;

interface OutfitCardProps {
  garments: { garment: Garment; slot: string }[];
  score: number | null;
  saved?: boolean;
  saving?: boolean;
  onLike: () => void;
  onPass: () => void;
  onDislike: () => void;
  onSave: () => void;
  onItemTap: (item: FlatLayItem) => void;
}

export function OutfitCard({
  garments,
  score,
  saved = false,
  saving = false,
  onLike,
  onPass,
  onDislike,
  onSave,
  onItemTap,
}: OutfitCardProps) {
  const pan = useRef(new Animated.ValueXY()).current;
  const heart = useRef(new Animated.Value(0)).current;
  const lastTap = useRef(0);
  const pendingItemTap = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onLikeRef = useRef(onLike);
  const onPassRef = useRef(onPass);
  const onItemTapRef = useRef(onItemTap);
  onLikeRef.current = onLike;
  onPassRef.current = onPass;
  onItemTapRef.current = onItemTap;

  const popHeart = () => {
    heart.setValue(0);
    Animated.sequence([
      Animated.spring(heart, {
        toValue: 1,
        friction: 5,
        useNativeDriver: true,
      }),
      Animated.delay(280),
      Animated.timing(heart, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const like = () => {
    popHeart();
    onLikeRef.current();
  };

  const flyUp = (onDone: () => void) => {
    Animated.timing(pan, {
      toValue: { x: 0, y: -SCREEN_HEIGHT },
      duration: 240,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) onDone();
    });
  };

  const springBack = () => {
    Animated.spring(pan, {
      toValue: { x: 0, y: 0 },
      friction: 7,
      useNativeDriver: false,
    }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dy) > 8 && Math.abs(gs.dy) > Math.abs(gs.dx),
      onPanResponderMove: (_, gs) => {
        const dy = gs.dy < 0 ? gs.dy : gs.dy * 0.22;
        pan.setValue({ x: 0, y: dy });
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy < -SWIPE_UP_THRESHOLD || gs.vy < -1.05) {
          flyUp(() => onPassRef.current());
        } else {
          springBack();
        }
      },
      onPanResponderTerminate: springBack,
    })
  ).current;

  const registerTap = () => {
    const now = Date.now();
    const isDouble = now - lastTap.current < DOUBLE_TAP_MS;
    lastTap.current = now;
    if (isDouble && pendingItemTap.current) {
      clearTimeout(pendingItemTap.current);
      pendingItemTap.current = null;
    }
    return isDouble;
  };

  const handleCardPress = () => {
    if (registerTap()) like();
  };

  const handleItemPress = (item: FlatLayItem) => {
    if (registerTap()) {
      like();
      return;
    }
    if (pendingItemTap.current) clearTimeout(pendingItemTap.current);
    pendingItemTap.current = setTimeout(() => {
      pendingItemTap.current = null;
      onItemTapRef.current(item);
    }, DOUBLE_TAP_MS);
  };

  const heartScale = heart.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 1],
  });

  return (
    <View className="flex-1">
      <Animated.View
        {...panResponder.panHandlers}
        style={{ flex: 1, transform: [{ translateY: pan.y }] }}
        className="overflow-hidden bg-clover-50"
      >
        <View className="flex-1 justify-center px-3 pb-6 pt-1">
          <View className="mb-2 flex-row items-center justify-end gap-2">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Not for me"
              onPress={onDislike}
              className="min-h-11 flex-row items-center rounded-full bg-white px-4"
              style={{ borderWidth: 1, borderColor: "#E7E5E4" }}
            >
              <Ionicons name="close" size={18} color="#57534e" />
              <Text className="ml-1.5 text-sm font-bold text-stone-600">
                Not for me
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                saved ? "Outfit saved to closet" : "Save outfit to closet"
              }
              disabled={saving || saved}
              onPress={onSave}
              className={`min-h-11 flex-row items-center rounded-full px-4 ${
                saved ? "bg-clover-100" : "bg-clover-600"
              }`}
            >
              {saving ? (
                <ActivityIndicator color={saved ? "#12372A" : "#ffffff"} />
              ) : (
                <MaterialCommunityIcons
                  name="hanger"
                  size={22}
                  color={saved ? "#12372A" : "#ffffff"}
                />
              )}
              <Text
                className={`ml-2 text-sm font-bold ${
                  saved ? "text-clover-800" : "text-white"
                }`}
              >
                {saved ? "Saved" : "Save"}
              </Text>
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Double tap to like this outfit"
            onPress={handleCardPress}
          >
            <FlatLayCollage
              items={garments}
              showLabels={false}
              onGarmentPress={() => {}}
              onItemPress={handleItemPress}
              accessibilityLabel="Recommended outfit flat lay"
            />
          </Pressable>
          {score !== null && score > 0 && (
            <View className="mt-3 items-center">
              <Text className="text-xs text-gray-400">
                Style match: {Math.round(score * 100)}%
              </Text>
            </View>
          )}
        </View>
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        className="absolute inset-0 items-center justify-center"
        style={{
          opacity: heart,
          transform: [{ scale: heartScale }],
        }}
      >
        <Ionicons name="heart" size={92} color="#ff2d55" />
      </Animated.View>
    </View>
  );
}
