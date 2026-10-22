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
  multicolor: "#efede8",
};

const ACCESSORY_PLACEMENTS: Placement[] = [
  { left: "70%", top: "5%", width: "25%", height: "19%", zIndex: 7, rotate: "4deg" },
  { left: "69%", top: "27%", width: "24%", height: "17%", zIndex: 8, rotate: "-5deg" },
  { left: "3%", top: "67%", width: "24%", height: "17%", zIndex: 7, rotate: "-7deg" },
  { left: "72%", top: "48%", width: "22%", height: "15%", zIndex: 8, rotate: "6deg" },
  { left: "4%", top: "45%", width: "20%", height: "14%", zIndex: 8, rotate: "-4deg" },
];

const ACCESSORY_POSITION_BY_SUBTYPE: Record<string, number> = {
  hat: 0,
  beanie: 0,
  earbuds: 0,
  glasses: 1,
  necklace: 2,
  belt: 2,
  watch: 3,
  bracelet: 3,
  ring: 3,
  bag: 4,
};

function canvasColor(items: FlatLayItem[]) {
  const dominant =
    items.find(({ slot }) => slot === "top" || slot === "dress") ??
    items.find(({ slot }) => slot === "bottom" || slot === "outerwear") ??
    items[0];
  return SOFT_CANVASES[dominant?.garment.color ?? "multicolor"];
}

function basePlacement(
  item: FlatLayItem,
  sagMode: boolean,
  hasOuterwear: boolean,
  sparseLayout: boolean
): Placement {
  switch (item.slot) {
    case "dress":
      return {
        left: sparseLayout ? "2%" : "4%",
        top: "3%",
        width: sparseLayout ? "88%" : "72%",
        height: sparseLayout ? "82%" : "74%",
        zIndex: 3,
      };
    case "outerwear":
      return {
        left: "0%",
        top: "1%",
        width: sparseLayout ? "86%" : "68%",
        height: sparseLayout ? "48%" : "44%",
        zIndex: 5,
        rotate: "-2deg",
      };
    case "top":
      return {
        left: hasOuterwear ? "39%" : sparseLayout ? "0%" : "2%",
        top: sparseLayout ? "1%" : "3%",
        width: hasOuterwear ? "60%" : sparseLayout ? "88%" : "72%",
        height: sparseLayout ? "46%" : "43%",
        zIndex: 4,
        rotate: "1deg",
      };
    case "underwear":
      return { left: "15%", top: "38%", width: "55%", height: "16%", zIndex: 2 };
    case "bottom":
      return {
        left: sparseLayout ? "1%" : sagMode ? "8%" : "4%",
        top: sagMode ? "43%" : sparseLayout ? "38%" : "39%",
        width: sparseLayout ? "78%" : "65%",
        height: sagMode ? "55%" : sparseLayout ? "61%" : "58%",
        zIndex: 3,
        rotate: "-1deg",
      };
    case "shoes":
      return {
        left: sparseLayout ? "46%" : "50%",
        top: sparseLayout ? "72%" : "75%",
        width: sparseLayout ? "52%" : "48%",
        height: "24%",
        zIndex: 6,
        rotate: "3deg",
      };
    default:
      return ACCESSORY_PLACEMENTS[0];
  }
}

export function FlatLayCollage({
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
      ACCESSORY_POSITION_BY_SUBTYPE[accessory.garment.subtype ?? "other"] ?? 4;
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
    accessoryPlacement.set(
      accessory.garment.id,
      ACCESSORY_PLACEMENTS[index]
    );
  }

  return (
    <View accessibilityLabel={accessibilityLabel}>
      <View
        className="w-full overflow-hidden rounded-2xl"
        style={{ aspectRatio: 0.78, backgroundColor: canvasColor(items) }}
      >
        {items.map((item) => {
          const placement =
            accessoryPlacement.get(item.garment.id) ??
            basePlacement(item, sagMode, hasOuterwear, sparseLayout);

          return (
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
                transform: placement.rotate
                  ? [{ rotate: placement.rotate }]
                  : undefined,
              }}
            >
              <Image
                source={{
                  uri: garmentImageForSide(item),
                }}
                accessibilityIgnoresInvertColors
                resizeMode="contain"
                style={{ width: "100%", height: "100%" }}
              />
            </Pressable>
          );
        })}
      </View>

      {showLabels && (
        <View className="mt-2 flex-row flex-wrap justify-center gap-1">
          {items.map((item) => (
            <Pressable
              key={`label:${item.slot}:${item.garment.id}`}
              onPress={() =>
                onItemPress
                  ? onItemPress(item)
                  : onGarmentPress(item.garment)
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
}
