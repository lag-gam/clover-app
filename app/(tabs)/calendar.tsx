import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { FlatLayCollage } from "@/components/FlatLayCollage";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchOutfitSchedule,
  fetchSavedOutfits,
  removeScheduledOutfit,
  rescheduleOutfit,
  scheduleOutfit,
} from "@/services/calendar.service";
import { OutfitSchedule, OutfitWithItems } from "@/types/database";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function localDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}`;
}

function parseLocalDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function monthBounds(month: Date) {
  return {
    start: localDateKey(new Date(month.getFullYear(), month.getMonth(), 1)),
    end: localDateKey(new Date(month.getFullYear(), month.getMonth() + 1, 0)),
  };
}

function outfitLabel(outfit: OutfitWithItems) {
  return (
    outfit.name ||
    `Outfit · ${new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
    }).format(new Date(outfit.created_at))}`
  );
}

export default function CalendarScreen() {
  const { outfitId } = useLocalSearchParams<{ outfitId?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const today = useMemo(() => localDateKey(new Date()), []);
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const [selectedDate, setSelectedDate] = useState(today);
  const [outfits, setOutfits] = useState<OutfitWithItems[]>([]);
  const [schedules, setSchedules] = useState<OutfitSchedule[]>([]);
  const [selectedOutfitId, setSelectedOutfitId] = useState<string | null>(
    outfitId ?? null
  );
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bounds = useMemo(() => monthBounds(month), [month]);
  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [savedOutfits, scheduled] = await Promise.all([
        fetchSavedOutfits(user.id),
        fetchOutfitSchedule(user.id, bounds.start, bounds.end),
      ]);
      setOutfits(savedOutfits);
      setSchedules(scheduled);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load your calendar."
      );
    } finally {
      setLoading(false);
    }
  }, [bounds.end, bounds.start, user]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  useEffect(() => {
    if (outfitId) setSelectedOutfitId(outfitId);
  }, [outfitId]);

  const selectedOutfit = outfits.find(
    (outfit) => outfit.id === selectedOutfitId
  );
  const scheduleByDate = useMemo(() => {
    const result = new Map<string, OutfitSchedule[]>();
    for (const schedule of schedules) {
      const entries = result.get(schedule.scheduled_date) ?? [];
      entries.push(schedule);
      result.set(schedule.scheduled_date, entries);
    }
    return result;
  }, [schedules]);
  const selectedSchedules = scheduleByDate.get(selectedDate) ?? [];
  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const dayCount = new Date(
      month.getFullYear(),
      month.getMonth() + 1,
      0
    ).getDate();
    return [
      ...Array<string | null>(first.getDay()).fill(null),
      ...Array.from({ length: dayCount }, (_, index) =>
        localDateKey(
          new Date(month.getFullYear(), month.getMonth(), index + 1)
        )
      ),
    ];
  }, [month]);

  const chooseDate = async (date: string) => {
    setSelectedDate(date);
    if (!user || mutating) return;

    if (reschedulingId) {
      setMutating(true);
      try {
        await rescheduleOutfit(reschedulingId, date);
        setReschedulingId(null);
        await load();
      } catch (mutationError) {
        Alert.alert(
          "Could not reschedule",
          mutationError instanceof Error
            ? mutationError.message
            : "Please try again."
        );
      } finally {
        setMutating(false);
      }
      return;
    }

    if (selectedOutfitId) {
      setMutating(true);
      try {
        await scheduleOutfit(user.id, selectedOutfitId, date);
        await load();
      } catch (mutationError) {
        Alert.alert(
          "Could not schedule outfit",
          mutationError instanceof Error
            ? mutationError.message
            : "Please try again."
        );
      } finally {
        setMutating(false);
      }
    }
  };

  const remove = (schedule: OutfitSchedule) => {
    Alert.alert(
      "Remove scheduled outfit?",
      `Remove it from ${new Intl.DateTimeFormat(undefined, {
        month: "long",
        day: "numeric",
      }).format(parseLocalDateKey(schedule.scheduled_date))}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            setMutating(true);
            void removeScheduledOutfit(schedule.id)
              .then(load)
              .catch((mutationError: unknown) =>
                Alert.alert(
                  "Could not remove outfit",
                  mutationError instanceof Error
                    ? mutationError.message
                    : "Please try again."
                )
              )
              .finally(() => setMutating(false));
          },
        },
      ]
    );
  };

  const changeMonth = (offset: number) => {
    const next = new Date(
      month.getFullYear(),
      month.getMonth() + offset,
      1
    );
    setMonth(next);
    setSelectedDate(localDateKey(next));
  };

  return (
    <ScrollView className="flex-1 bg-clover-50">
      <View className="border-b border-clover-200 bg-[#FCFBF7] px-4 pb-5 pt-4">
        <View className="flex-row items-center justify-between">
          <TouchableOpacity
            onPress={() => changeMonth(-1)}
            accessibilityLabel="Previous month"
            className="h-10 w-10 items-center justify-center rounded-full bg-stone-100"
          >
            <Ionicons name="chevron-back" size={21} color="#44403c" />
          </TouchableOpacity>
          <View className="items-center">
            <Text className="text-xl font-bold text-stone-900">
              {new Intl.DateTimeFormat(undefined, {
                month: "long",
                year: "numeric",
              }).format(month)}
            </Text>
            <TouchableOpacity
              onPress={() => {
                const now = new Date();
                setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                setSelectedDate(today);
              }}
            >
              <Text className="mt-1 text-xs font-semibold text-clover-700">
                Today
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            onPress={() => changeMonth(1)}
            accessibilityLabel="Next month"
            className="h-10 w-10 items-center justify-center rounded-full bg-stone-100"
          >
            <Ionicons name="chevron-forward" size={21} color="#44403c" />
          </TouchableOpacity>
        </View>

        <View className="mt-5 flex-row">
          {WEEKDAYS.map((weekday) => (
            <Text
              key={weekday}
              className="text-center text-[11px] font-semibold text-stone-400"
              style={{ width: `${100 / 7}%` }}
            >
              {weekday}
            </Text>
          ))}
        </View>
        <View className="mt-2 flex-row flex-wrap">
          {days.map((date, index) => {
            if (!date) {
              return <View key={`blank:${index}`} style={{ width: `${100 / 7}%`, height: 52 }} />;
            }
            const count = scheduleByDate.get(date)?.length ?? 0;
            const selected = date === selectedDate;
            const isToday = date === today;
            return (
              <Pressable
                key={date}
                onPress={() => void chooseDate(date)}
                disabled={mutating}
                accessibilityRole="button"
                accessibilityState={{ selected, disabled: mutating }}
                accessibilityLabel={`${new Intl.DateTimeFormat(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                }).format(parseLocalDateKey(date))}, ${count} scheduled outfit${
                  count === 1 ? "" : "s"
                }`}
                className="items-center justify-center"
                style={{ width: `${100 / 7}%`, height: 52 }}
              >
                <View
                  className={`h-9 w-9 items-center justify-center rounded-full ${
                    selected
                      ? "bg-clover-600"
                      : isToday
                        ? "border border-clover-500 bg-clover-50"
                        : ""
                  }`}
                >
                  <Text
                    className={`text-sm ${
                      selected
                        ? "font-bold text-white"
                        : isToday
                          ? "font-bold text-clover-700"
                          : "text-stone-700"
                    }`}
                  >
                    {parseLocalDateKey(date).getDate()}
                  </Text>
                </View>
                {count > 0 && (
                  <View
                    className={`absolute bottom-0 h-1.5 min-w-1.5 rounded-full ${
                      selected ? "bg-clover-100" : "bg-clover-600"
                    }`}
                    style={{ width: Math.min(18, 4 + count * 3) }}
                  />
                )}
              </Pressable>
            );
          })}
        </View>
      </View>

      <View className="px-4 py-4">
        {(selectedOutfit || reschedulingId) && (
          <View className="mb-4 flex-row items-center rounded-xl border border-clover-200 bg-clover-100 px-3 py-3">
            <Ionicons
              name={reschedulingId ? "move-outline" : "calendar-outline"}
              size={20}
              color="#12372A"
            />
            <Text className="ml-2 flex-1 text-sm font-medium text-clover-800">
              {reschedulingId
                ? "Choose a new date for this outfit."
                : `Scheduling “${outfitLabel(selectedOutfit!)}” — tap a date.`}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setSelectedOutfitId(null);
                setReschedulingId(null);
              }}
              accessibilityLabel="Cancel scheduling"
            >
              <Ionicons name="close-circle" size={22} color="#12372A" />
            </TouchableOpacity>
          </View>
        )}

        <Text className="text-xs font-bold uppercase tracking-wider text-stone-500">
          Choose an outfit to schedule
        </Text>
        {outfits.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-2 py-3"
          >
            {outfits.map((outfit) => {
              const active = selectedOutfitId === outfit.id;
              return (
                <TouchableOpacity
                  key={outfit.id}
                  onPress={() => {
                    setSelectedOutfitId(active ? null : outfit.id);
                    setReschedulingId(null);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  className={`rounded-full border px-4 py-2 ${
                    active
                      ? "border-clover-600 bg-clover-600"
                      : "border-stone-200 bg-white"
                  }`}
                >
                  <Text
                    className={`max-w-48 text-xs font-semibold ${
                      active ? "text-white" : "text-stone-700"
                    }`}
                    numberOfLines={1}
                  >
                    {outfitLabel(outfit)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : (
          <TouchableOpacity
            onPress={() => router.push("/outfit/create")}
            className="my-3 items-center rounded-xl border border-dashed border-stone-300 bg-white px-4 py-5"
          >
            <Text className="font-semibold text-stone-600">
              Create an outfit first
            </Text>
            <Text className="mt-1 text-xs text-stone-400">
              Saved outfits can be added to any date.
            </Text>
          </TouchableOpacity>
        )}

        <View className="mb-3 mt-2 flex-row items-end justify-between">
          <View>
            <Text className="text-xl font-bold text-stone-900">
              {new Intl.DateTimeFormat(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              }).format(parseLocalDateKey(selectedDate))}
            </Text>
            <Text className="mt-1 text-xs text-stone-500">
              {selectedSchedules.length} outfit
              {selectedSchedules.length === 1 ? "" : "s"} planned
            </Text>
          </View>
          {(loading || mutating) && (
            <ActivityIndicator size="small" color="#173F32" />
          )}
        </View>

        {error && (
          <View className="mb-3 rounded-xl bg-red-50 px-3 py-3">
            <Text className="text-sm text-red-700">{error}</Text>
            <TouchableOpacity onPress={() => void load()} className="mt-2">
              <Text className="text-xs font-bold text-red-800">Try again</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading && selectedSchedules.length === 0 && !error && (
          <View className="items-center rounded-2xl bg-white px-6 py-10">
            <Ionicons name="calendar-clear-outline" size={38} color="#d6d3d1" />
            <Text className="mt-3 font-semibold text-stone-500">
              Nothing planned yet
            </Text>
            <Text className="mt-1 text-center text-xs text-stone-400">
              Select an outfit above, then tap a date.
            </Text>
          </View>
        )}

        {selectedSchedules.map((schedule) => (
          <View
            key={schedule.id}
            className="mb-4 overflow-hidden rounded-2xl border border-stone-200 bg-white p-3"
          >
            <View className="mb-3 flex-row items-center justify-between">
              <TouchableOpacity
                onPress={() => router.push(`/outfit/${schedule.outfit.id}`)}
                className="flex-1"
              >
                <Text className="text-base font-bold text-stone-900">
                  {outfitLabel(schedule.outfit)}
                </Text>
                <Text className="mt-0.5 text-xs text-stone-400">
                  {schedule.outfit.items.length} pieces
                </Text>
              </TouchableOpacity>
              <Ionicons name="chevron-forward" size={18} color="#a8a29e" />
            </View>
            <FlatLayCollage
              items={schedule.outfit.items}
              showLabels={false}
              onGarmentPress={(garment) =>
                router.push(`/garment/${garment.id}`)
              }
              accessibilityLabel={`${outfitLabel(
                schedule.outfit
              )} collage preview`}
            />
            <View className="mt-3 flex-row gap-2">
              <TouchableOpacity
                disabled={mutating}
                onPress={() => {
                  setSelectedOutfitId(null);
                  setReschedulingId(schedule.id);
                }}
                className="flex-1 flex-row items-center justify-center rounded-xl bg-stone-100 py-3"
              >
                <Ionicons name="move-outline" size={17} color="#57534e" />
                <Text className="ml-1.5 text-xs font-bold text-stone-700">
                  Reschedule
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={mutating}
                onPress={() => remove(schedule)}
                className="flex-1 flex-row items-center justify-center rounded-xl bg-red-50 py-3"
              >
                <Ionicons name="trash-outline" size={17} color="#dc2626" />
                <Text className="ml-1.5 text-xs font-bold text-red-700">
                  Remove
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
