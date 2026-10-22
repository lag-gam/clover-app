import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import {
  ClosetSection,
  ClosetSectionKind,
  Garment,
} from "@/types/database";
import { isGarmentProcessingStale } from "@/services/garment.service";

const ITEM_WIDTH = 84;
const ITEM_HEIGHT = 112;
const SECTION_PADDING = 12;

type SectionFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type DropTarget = {
  sectionId: string;
  position: number;
};

type DragState = {
  garment: Garment;
  absoluteX: number;
  absoluteY: number;
  target: DropTarget;
};

interface SpatialClosetProps {
  sections: ClosetSection[];
  garments: Garment[];
  editing: boolean;
  refreshing: boolean;
  mutating: boolean;
  onRefresh: () => void;
  onPressGarment: (garment: Garment) => void;
  onRetryGarment: (garment: Garment) => void;
  onRenameSection: (section: ClosetSection) => void;
  onMoveSection: (sectionId: string, direction: -1 | 1) => void;
  onMoveGarment: (
    garmentId: string,
    sectionId: string,
    position: number
  ) => Promise<void>;
}

interface DraggableGarmentProps {
  garment: Garment;
  disabled: boolean;
  isDragging: boolean;
  onPress: () => void;
  onRetry: () => void;
  onDragStart: (garment: Garment, x: number, y: number) => void;
  onDragUpdate: (x: number, y: number) => void;
  onDragEnd: () => void;
}

function DraggableGarment({
  garment,
  disabled,
  isDragging,
  onPress,
  onRetry,
  onDragStart,
  onDragUpdate,
  onDragEnd,
}: DraggableGarmentProps) {
  const imageUri = garment.cutout_url ?? garment.image_url;
  const isProcessing =
    garment.processing_status === "pending" ||
    garment.processing_status === "processing";
  const isStale = isGarmentProcessingStale(garment);
  const isRetryable = garment.processing_status === "failed" || isStale;

  const gesture = useMemo(() => {
    const drag = Gesture.Pan()
      .enabled(!disabled)
      .activateAfterLongPress(350)
      .runOnJS(true)
      .onStart((event) => {
        onDragStart(garment, event.absoluteX, event.absoluteY);
      })
      .onUpdate((event) => {
        onDragUpdate(event.absoluteX, event.absoluteY);
      })
      .onFinalize(() => {
        onDragEnd();
      });

    const tap = Gesture.Tap()
      .enabled(!disabled)
      .maxDuration(300)
      .runOnJS(true)
      .onEnd((_event, success) => {
        if (success) onPress();
      });

    return Gesture.Race(drag, tap);
  }, [
    disabled,
    garment,
    onDragEnd,
    onDragStart,
    onDragUpdate,
    onPress,
  ]);

  return (
    <View style={styles.garmentSlot}>
      <GestureDetector gesture={gesture}>
        <View
          accessible
          accessibilityLabel={`${garment.name}. Long press and drag to move.`}
          style={[styles.garmentTouch, isDragging && styles.draggingSource]}
        >
          <Image
            source={{ uri: imageUri }}
            resizeMode="contain"
            style={styles.garmentImage}
          />
          {isProcessing && !isStale && (
            <View style={styles.processingOverlay}>
              <ActivityIndicator size="small" color="#173F32" />
              <Text style={styles.processingText}>Analyzing</Text>
            </View>
          )}
          {isRetryable && (
            <View style={styles.failedBadge}>
              <Ionicons name="alert-circle" size={15} color="#dc2626" />
            </View>
          )}
        </View>
      </GestureDetector>
      <Text style={styles.garmentName} numberOfLines={1}>
        {garment.name}
      </Text>
      {isRetryable && (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`Retry analysis for ${garment.name}`}
          onPress={onRetry}
          style={styles.retryButton}
        >
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function SectionDecoration({ kind }: { kind: ClosetSectionKind }) {
  if (kind === "rail") {
    return (
      <>
        <View style={styles.railRod} />
        <View style={[styles.railBracket, { left: 18 }]} />
        <View style={[styles.railBracket, { right: 18 }]} />
      </>
    );
  }

  if (kind === "shelf") {
    return <View style={styles.shelfEdge} />;
  }

  return (
    <>
      <View style={styles.drawerHandle} />
      <View style={styles.drawerInset} />
    </>
  );
}

function sectionIcon(kind: ClosetSectionKind) {
  if (kind === "rail") return "remove-outline" as const;
  if (kind === "shelf") return "albums-outline" as const;
  return "file-tray-outline" as const;
}

export function SpatialCloset({
  sections,
  garments,
  editing,
  refreshing,
  mutating,
  onRefresh,
  onPressGarment,
  onRetryGarment,
  onRenameSection,
  onMoveSection,
  onMoveGarment,
}: SpatialClosetProps) {
  const rootRef = useRef<View>(null);
  const bodyRefs = useRef<Record<string, View | null>>({});
  const sectionFrames = useRef<Record<string, SectionFrame>>({});
  const sectionOffsets = useRef<Record<string, number>>({});
  const rootOrigin = useRef({ x: 0, y: 0 });
  const dragRef = useRef<DragState | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  const garmentsBySection = useMemo(() => {
    const grouped = new Map<string, Garment[]>();
    sections.forEach((section) => grouped.set(section.id, []));
    garments.forEach((garment) => {
      const group = grouped.get(garment.section_id);
      if (group) group.push(garment);
    });
    grouped.forEach((group) =>
      group.sort(
        (left, right) =>
          left.position - right.position || left.id.localeCompare(right.id)
      )
    );
    return grouped;
  }, [garments, sections]);

  const measureRoot = () => {
    rootRef.current?.measureInWindow((x, y) => {
      rootOrigin.current = { x, y };
    });
  };

  const measureSection = (sectionId: string) => {
    bodyRefs.current[sectionId]?.measureInWindow((x, y, width, height) => {
      sectionFrames.current[sectionId] = { x, y, width, height };
    });
  };

  const measureAllSections = () => {
    measureRoot();
    sections.forEach((section) => measureSection(section.id));
  };

  const targetAt = (
    absoluteX: number,
    absoluteY: number,
    garmentId: string
  ): DropTarget | null => {
    let closest:
      | { section: ClosetSection; frame: SectionFrame; distance: number }
      | undefined;

    for (const section of sections) {
      const frame = sectionFrames.current[section.id];
      if (!frame) continue;

      const inside =
        absoluteY >= frame.y - 16 &&
        absoluteY <= frame.y + frame.height + 16;
      const distance = Math.abs(absoluteY - (frame.y + frame.height / 2));
      if (inside || !closest || distance < closest.distance) {
        closest = { section, frame, distance: inside ? -1 : distance };
        if (inside) break;
      }
    }

    if (!closest) return null;

    const items = (garmentsBySection.get(closest.section.id) ?? []).filter(
      (garment) => garment.id !== garmentId
    );
    const scrollOffset = sectionOffsets.current[closest.section.id] ?? 0;
    const contentX =
      absoluteX - closest.frame.x + scrollOffset - SECTION_PADDING;
    const position = Math.max(
      0,
      Math.min(Math.round(contentX / ITEM_WIDTH), items.length)
    );

    return { sectionId: closest.section.id, position };
  };

  const handleDragStart = (garment: Garment, x: number, y: number) => {
    measureAllSections();
    const initialTarget = targetAt(x, y, garment.id) ?? {
      sectionId: garment.section_id,
      position: garment.position,
    };
    const next = {
      garment,
      absoluteX: x,
      absoluteY: y,
      target: initialTarget,
    };
    dragRef.current = next;
    setDrag(next);
  };

  const handleDragUpdate = (x: number, y: number) => {
    const current = dragRef.current;
    if (!current) return;
    const target = targetAt(x, y, current.garment.id) ?? current.target;
    const next = { ...current, absoluteX: x, absoluteY: y, target };
    dragRef.current = next;
    setDrag(next);
  };

  const handleDragEnd = () => {
    const current = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (current) {
      void onMoveGarment(
        current.garment.id,
        current.target.sectionId,
        current.target.position
      );
    }
  };

  const handleSectionScroll = (
    sectionId: string,
    event: NativeSyntheticEvent<NativeScrollEvent>
  ) => {
    sectionOffsets.current[sectionId] = event.nativeEvent.contentOffset.x;
  };

  return (
    <GestureHandlerRootView style={styles.root}>
      <View
        ref={rootRef}
        style={styles.root}
        onLayout={() => requestAnimationFrame(measureAllSections)}
      >
        <ScrollView
          contentContainerStyle={styles.sectionsContent}
          onScroll={() => measureAllSections()}
          scrollEventThrottle={32}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#173F32"
            />
          }
        >
          <View style={styles.dragHintRow}>
            <Ionicons name="hand-left-outline" size={15} color="#78716c" />
            <Text style={styles.dragHint}>
              Long press a garment to move it between sections
            </Text>
            {mutating && <ActivityIndicator size="small" color="#173F32" />}
          </View>

          {sections.map((section, sectionIndex) => {
            const sectionGarments = garmentsBySection.get(section.id) ?? [];
            const dropPosition =
              drag?.target.sectionId === section.id
                ? drag.target.position
                : null;

            return (
              <View
                key={section.id}
                style={[
                  styles.sectionCard,
                  section.kind === "drawer" && styles.drawerCard,
                  dropPosition !== null && styles.activeDropSection,
                ]}
              >
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionTitleGroup}>
                    <View style={styles.sectionIcon}>
                      <Ionicons
                        name={sectionIcon(section.kind)}
                        size={17}
                        color="#57534e"
                      />
                    </View>
                    <View>
                      <Text style={styles.sectionName}>{section.name}</Text>
                      <Text style={styles.sectionKind}>{section.kind}</Text>
                    </View>
                  </View>

                  {editing && (
                    <View style={styles.editActions}>
                      <TouchableOpacity
                        accessibilityLabel={`Move ${section.name} up`}
                        disabled={mutating || sectionIndex === 0}
                        onPress={() => onMoveSection(section.id, -1)}
                        style={[
                          styles.iconButton,
                          (mutating || sectionIndex === 0) &&
                            styles.disabledButton,
                        ]}
                      >
                        <Ionicons name="chevron-up" size={18} color="#57534e" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        accessibilityLabel={`Move ${section.name} down`}
                        disabled={
                          mutating || sectionIndex === sections.length - 1
                        }
                        onPress={() => onMoveSection(section.id, 1)}
                        style={[
                          styles.iconButton,
                          (mutating ||
                            sectionIndex === sections.length - 1) &&
                            styles.disabledButton,
                        ]}
                      >
                        <Ionicons
                          name="chevron-down"
                          size={18}
                          color="#57534e"
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        accessibilityLabel={`Rename ${section.name}`}
                        onPress={() => onRenameSection(section)}
                        style={styles.iconButton}
                      >
                        <Ionicons name="pencil" size={16} color="#12372A" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                <View
                  ref={(node) => {
                    bodyRefs.current[section.id] = node;
                  }}
                  onLayout={() =>
                    requestAnimationFrame(() => measureSection(section.id))
                  }
                  style={[
                    styles.sectionBody,
                    section.kind === "rail" && styles.railBody,
                    section.kind === "shelf" && styles.shelfBody,
                    section.kind === "drawer" && styles.drawerBody,
                  ]}
                >
                  <SectionDecoration kind={section.kind} />
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    onScroll={(event) =>
                      handleSectionScroll(section.id, event)
                    }
                    scrollEventThrottle={16}
                    contentContainerStyle={[
                      styles.garmentRow,
                      sectionGarments.length === 0 && styles.emptyGarmentRow,
                    ]}
                  >
                    {dropPosition !== null && (
                      <View
                        pointerEvents="none"
                        style={[
                          styles.dropMarker,
                          {
                            left:
                              SECTION_PADDING +
                              dropPosition * ITEM_WIDTH -
                              2,
                          },
                        ]}
                      />
                    )}
                    {sectionGarments.map((garment) => (
                      <DraggableGarment
                        key={garment.id}
                        garment={garment}
                        disabled={mutating}
                        isDragging={drag?.garment.id === garment.id}
                        onPress={() => onPressGarment(garment)}
                        onRetry={() => onRetryGarment(garment)}
                        onDragStart={handleDragStart}
                        onDragUpdate={handleDragUpdate}
                        onDragEnd={handleDragEnd}
                      />
                    ))}
                    {sectionGarments.length === 0 && (
                      <View style={styles.emptySection}>
                        <Ionicons
                          name="add-circle-outline"
                          size={22}
                          color="#a8a29e"
                        />
                        <Text style={styles.emptySectionText}>
                          Drop garments here
                        </Text>
                      </View>
                    )}
                  </ScrollView>
                </View>
              </View>
            );
          })}
        </ScrollView>

        {drag && (
          <View
            pointerEvents="none"
            style={[
              styles.dragPreview,
              {
                left:
                  drag.absoluteX - rootOrigin.current.x - ITEM_WIDTH / 2,
                top:
                  drag.absoluteY - rootOrigin.current.y - ITEM_HEIGHT / 2,
              },
            ]}
          >
            <Image
              source={{
                uri: drag.garment.cutout_url ?? drag.garment.image_url,
              }}
              resizeMode="contain"
              style={styles.dragPreviewImage}
            />
          </View>
        )}
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  sectionsContent: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 32,
    gap: 14,
  },
  dragHintRow: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 4,
  },
  dragHint: { flex: 1, fontSize: 12, color: "#78716c" },
  sectionCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#d1ddd2",
    backgroundColor: "#fcfbf7",
    shadowColor: "#0f2d23",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 0,
    overflow: "hidden",
    transform: [{ perspective: 900 }, { rotateX: "0.4deg" }],
  },
  drawerCard: { backgroundColor: "#f2f4ed", borderColor: "#d1ddd2" },
  activeDropSection: { borderColor: "#789a82", borderWidth: 2 },
  sectionHeader: {
    minHeight: 54,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitleGroup: { flexDirection: "row", alignItems: "center", gap: 10 },
  sectionIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e7e5e4",
  },
  sectionName: { fontSize: 15, fontWeight: "700", color: "#292524" },
  sectionKind: {
    marginTop: 1,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "#a8a29e",
  },
  editActions: { flexDirection: "row", alignItems: "center", gap: 5 },
  iconButton: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e7e5e4",
  },
  disabledButton: { opacity: 0.3 },
  sectionBody: { minHeight: 144, position: "relative" },
  railBody: {
    backgroundColor: "#f5f5f4",
    borderTopWidth: 1,
    borderTopColor: "#e7e5e4",
    paddingTop: 13,
  },
  shelfBody: {
    backgroundColor: "#fffefb",
    borderTopWidth: 1,
    borderTopColor: "#ede9e3",
  },
  drawerBody: {
    minHeight: 154,
    backgroundColor: "#ede8e0",
    borderTopWidth: 1,
    borderTopColor: "#d6cec3",
    paddingTop: 7,
  },
  railRod: {
    position: "absolute",
    left: 15,
    right: 15,
    top: 10,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#a8a29e",
  },
  railBracket: {
    position: "absolute",
    top: 7,
    width: 5,
    height: 13,
    borderRadius: 3,
    backgroundColor: "#78716c",
  },
  shelfEdge: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 9,
    backgroundColor: "#d6c7b5",
    borderTopWidth: 1,
    borderTopColor: "#c4b49f",
  },
  drawerHandle: {
    position: "absolute",
    top: 5,
    left: "42%",
    width: "16%",
    height: 4,
    borderRadius: 3,
    backgroundColor: "#b4aa9d",
  },
  drawerInset: {
    position: "absolute",
    top: 11,
    left: 7,
    right: 7,
    bottom: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d6cec3",
  },
  garmentRow: {
    minWidth: "100%",
    minHeight: 138,
    alignItems: "flex-start",
    paddingHorizontal: SECTION_PADDING,
    paddingTop: 8,
    paddingBottom: 8,
    position: "relative",
  },
  emptyGarmentRow: { alignItems: "center", justifyContent: "center" },
  garmentSlot: {
    width: ITEM_WIDTH,
    minHeight: ITEM_HEIGHT,
    alignItems: "center",
  },
  garmentTouch: {
    width: 76,
    height: 82,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.64)",
  },
  draggingSource: { opacity: 0.22 },
  garmentImage: { width: 70, height: 76 },
  garmentName: {
    width: 76,
    marginTop: 4,
    textAlign: "center",
    fontSize: 10,
    color: "#57534e",
  },
  processingOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.86)",
  },
  processingText: { marginTop: 3, fontSize: 9, color: "#12372A" },
  failedBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    borderRadius: 10,
    backgroundColor: "#fef2f2",
  },
  retryButton: {
    marginTop: 2,
    borderRadius: 7,
    backgroundColor: "#fef2f2",
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  retryText: { fontSize: 9, fontWeight: "700", color: "#dc2626" },
  emptySection: {
    height: 96,
    minWidth: 180,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  emptySectionText: { fontSize: 12, color: "#a8a29e" },
  dropMarker: {
    position: "absolute",
    zIndex: 5,
    top: 9,
    bottom: 20,
    width: 4,
    borderRadius: 2,
    backgroundColor: "#4e765e",
    shadowColor: "#173f32",
    shadowOpacity: 0.35,
    shadowRadius: 4,
  },
  dragPreview: {
    position: "absolute",
    zIndex: 100,
    width: ITEM_WIDTH,
    height: ITEM_HEIGHT,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.94)",
    borderWidth: 2,
    borderColor: "#789a82",
    shadowColor: "#0f2d23",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  dragPreviewImage: { width: 76, height: 98 },
});
