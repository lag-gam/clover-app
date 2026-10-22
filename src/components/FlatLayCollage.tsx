import { memo } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { Garment, GarmentDisplaySide } from "@/types/database";
import { resolveGarmentImage } from "@/utils/outfit-state";

export type FlatLayItem = {
  garment: Garment;
  slot: string;
  display_side?: GarmentDisplaySide;
};

export function garmentImageForSide(item: FlatLayItem): string {
  return resolveGarmentImage(item.garment, item.display_side ?? "front");
}

type Percent = `${number}%`;
type Placement = {
  left: Percent;
  top: Percent;
  width: Percent;
  height: Percent;
  zIndex: number;
  rotate?: `${number}deg`;
};

interface FlatLayCollageProps {
  items: FlatLayItem[];
  onGarmentPress: (garment: Garment) => void;
  onItemPress?: (item: FlatLayItem) => void;
  showLabels?: boolean;
  accessibilityLabel?: string;
  featuredGarmentId?: string;
}

const SOFT_CANVASES: Record<string, string> = {
  black: "#f1eee9",
  white: "#e8ecec",
  gray: "#f3eee8",
  navy: "#f3eadf",
  blue: "#f3eadf",
  red: "#edf1e8",
  pink: "#edf2ec",
  green: "#f3ece5",
  yellow: "#e9eef3",
  orange: "#e8eef1",
  purple: "#eef0e6",
  brown: "#e7edf0",
  beige: "#e6ecef",
  cream: "#e4eaeb",
  gold: "#eef3ea",
  silver: "#eceff1",
  multicolor: "#efede8",
};

const ACCESSORY_PLACEMENTS: Placement[] = [
  { left: "58%", top: "0%", width: "42%", height: "28%", zIndex: 7, rotate: "5deg" },
  { left: "58%", top: "20%", width: "42%", height: "26%", zIndex: 8, rotate: "-7deg" },
  { left: "58%", top: "38%", width: "42%", height: "26%", zIndex: 7, rotate: "6deg" },
  { left: "58%", top: "52%", width: "40%", height: "18%", zIndex: 8, rotate: "-5deg" },
  { left: "58%", top: "30%", width: "42%", height: "24%", zIndex: 7, rotate: "4deg" },
];

const ACCESSORY_POSITION_BY_SUBTYPE: Record<string, number> = {
  hat: 0,
  beanie: 0,
  earbuds: 0,
  glasses: 1,
  camera: 1,
  necklace: 2,
  belt: 2,
  watch: 3,
  bracelet: 3,
  ring: 3,
  bag: 2,
  other: 1,
};

function canvasColor(items: FlatLayItem[]) {
  const dominant =
    items.find(({ slot }) => slot === "top" || slot === "dress") ??
    items.find(({ slot }) => slot === "bottom" || slot === "outerwear") ??
    items[0];
  return SOFT_CANVASES[dominant?.garment.color ?? "multicolor"];
}

function pct(value: number): Percent {
  return `${Math.round(value * 10) / 10}%`;
}

function parsePct(value: Percent): number {
  return Number.parseFloat(value);
}

function scalePlacement(
  placement: Placement,
  factor: number,
  options: { keepTop?: boolean; keepBottom?: boolean } = {}
): Placement {
  const width = parsePct(placement.width);
  const height = parsePct(placement.height);
  const left = parsePct(placement.left);
  const top = parsePct(placement.top);
  const nextWidth = width * factor;
  const nextHeight = height * factor;
  let nextLeft = left - (nextWidth - width) / 2;
  let nextTop = top - (nextHeight - height) / 2;
  if (options.keepTop) nextTop = top;
  if (options.keepBottom) nextTop = top + height - nextHeight;
  nextLeft = Math.max(0, Math.min(nextLeft, 100 - nextWidth));
  nextTop = Math.max(0, Math.min(nextTop, 100 - nextHeight));
  return {
    ...placement,
    left: pct(nextLeft),
    top: pct(nextTop),
    width: pct(nextWidth),
    height: pct(nextHeight),
  };
}

function basePlacement(
  item: FlatLayItem,
  sagMode: boolean,
  hasOuterwear: boolean,
  sparseLayout: boolean,
  hasAccessories: boolean
): Placement {
  const sideRoom = hasAccessories && !sparseLayout;
  switch (item.slot) {
    case "dress":
      return {
        left: sideRoom ? "2%" : sparseLayout ? "2%" : "4%",
        top: "3%",
        width: sideRoom ? "62%" : sparseLayout ? "88%" : "72%",
        height: sparseLayout ? "82%" : "74%",
        zIndex: 3,
      };
    case "outerwear":
      return {
        left: "0%",
        top: "1%",
        width: "42%",
        height: "50%",
        zIndex: 4,
        rotate: "-2deg",
      };
    case "top":
      if (hasOuterwear) {
        return {
          left: "34%",
          top: "2%",
          width: "42%",
          height: "48%",
          zIndex: 5,
          rotate: "1deg",
        };
      }
      return scalePlacement(
        {
          left: "0%",
          top: "1%",
          width: sideRoom ? "70%" : sparseLayout ? "90%" : "82%",
          height: sparseLayout ? "52%" : "48%",
          zIndex: 5,
          rotate: "1deg",
        },
        1.25,
        { keepTop: true }
      );
    case "underwear":
      return {
        left: sideRoom ? "2%" : "8%",
        top: "30%",
        width: sideRoom ? "62%" : "76%",
        height: "60%",
        zIndex: 2,
      };
    case "bottom":
      return {
        left: sideRoom
          ? sagMode
            ? "2%"
            : "2%"
          : sagMode
            ? "8%"
            : sparseLayout
              ? "1%"
              : "4%",
        top: sagMode ? "41%" : sparseLayout ? "38%" : "39%",
        width: sideRoom
          ? sagMode
            ? "62%"
            : "62%"
          : sagMode
            ? "76%"
            : sparseLayout
              ? "78%"
              : "65%",
        height: sagMode ? "54%" : sparseLayout ? "61%" : "58%",
        zIndex: 4,
        rotate: "-1deg",
      };
    case "shoes":
      return {
        left: "58%",
        top: "76%",
        width: "42%",
        height: "24%",
        zIndex: 6,
        rotate: "4deg",
      };
    default:
      return ACCESSORY_PLACEMENTS[0];
  }
}

export const FlatLayCollage = memo(function FlatLayCollage({
  items,
  onGarmentPress,
  onItemPress,
  showLabels = true,
  accessibilityLabel = "Flat-lay outfit",
  featuredGarmentId,
}: FlatLayCollageProps) {
  const sagMode = items.some(({ slot }) => slot === "underwear");
  const hasOuterwear = items.some(({ slot }) => slot === "outerwear");
  const accessories = items
    .filter(({ slot }) => slot.startsWith("accessory"))
    .sort((a, b) =>
      `${a.garment.subtype ?? "other"}:${a.garment.id}`.localeCompare(
        `${b.garment.subtype ?? "other"}:${b.garment.id}`
      )
    );
  const sparseLayout = items.length <= 3 && accessories.length === 0;
  const occupiedPlacements = new Set<number>();
  const accessoryPlacement = new Map<string, Placement>();
  for (const accessory of accessories) {
    const preferred =
      ACCESSORY_POSITION_BY_SUBTYPE[accessory.garment.subtype ?? "other"] ?? 1;
    let index = preferred;
    let probes = 0;
    while (
      occupiedPlacements.has(index) &&
      probes < ACCESSORY_PLACEMENTS.length
    ) {
      index = (index + 1) % ACCESSORY_PLACEMENTS.length;
      probes += 1;
    }
    occupiedPlacements.add(index);
    accessoryPlacement.set(accessory.garment.id, ACCESSORY_PLACEMENTS[index]);
  }

  const placedItems = items
    .map((item) => ({
      item,
      placement:
        accessoryPlacement.get(item.garment.id) ??
        basePlacement(
          item,
          sagMode,
          hasOuterwear,
          sparseLayout,
          accessories.length > 0
        ),
    }))
    .sort((a, b) => a.placement.zIndex - b.placement.zIndex);

  return (
    <View accessibilityLabel={accessibilityLabel}>
      <View
        className="w-full overflow-hidden rounded-2xl"
        style={{ aspectRatio: 0.78, backgroundColor: canvasColor(items) }}
      >
        {placedItems.map(({ item, placement }) => (
          <Pressable
            key={`${item.slot}:${item.garment.id}`}
            accessibilityRole="button"
            accessibilityLabel={`${item.garment.name}, ${
              item.display_side === "back" ? "back" : "front"
            }, ${item.slot.replace(":", " ")}`}
            onPress={() =>
              onItemPress ? onItemPress(item) : onGarmentPress(item.garment)
            }
            hitSlop={4}
            style={{
              position: "absolute",
              left: placement.left,
              top: placement.top,
              width: placement.width,
              height: placement.height,
              zIndex: placement.zIndex,
              elevation: placement.zIndex,
              transform: placement.rotate
                ? [{ rotate: placement.rotate }]
                : undefined,
            }}
          >
            <View
              style={{
                width: "100%",
                height: "100%",
                justifyContent:
                  item.slot === "underwear" ? "flex-start" : "center",
                overflow: "hidden",
              }}
            >
              <Image
                source={{
                  uri: garmentImageForSide(item),
                }}
                accessibilityIgnoresInvertColors
                resizeMode="contain"
                style={{
                  width: "100%",
                  height: item.slot === "underwear" ? "88%" : "100%",
                }}
              />
            </View>
          </Pressable>
        ))}
      </View>

      {showLabels && (
        <View className="mt-2 flex-row flex-wrap justify-center gap-1">
          {items.map((item) => (
            <Pressable
              key={`label:${item.slot}:${item.garment.id}`}
              onPress={() =>
                onItemPress ? onItemPress(item) : onGarmentPress(item.garment)
              }
              accessibilityRole="button"
              className="rounded-full bg-stone-100 px-2 py-1"
            >
              <Text className="text-[10px] text-stone-600" numberOfLines={1}>
                {item.garment.id === featuredGarmentId
                  ? "featured item"
                  : item.slot.split(":").join(" ")}{" "}
                · {item.garment.name}
                {item.display_side === "back" ? " · back" : ""}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
});
