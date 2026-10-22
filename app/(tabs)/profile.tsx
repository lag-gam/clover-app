import { useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { SagModeToggle } from "@/components/SagModeToggle";
import { useAuth } from "@/hooks/useAuth";
import { useSagMode } from "@/hooks/useSagMode";
import { useStyleProfile } from "@/hooks/useStyleProfile";
import { fetchGarments } from "@/services/garment.service";
import {
  connectPinterest,
  disconnectPinterest,
  getPinterestStatus,
  refreshPinterestBoards,
  selectPinterestBoards,
  syncPinterestPins,
} from "@/services/pinterest.service";
import { Garment, PinterestStatus } from "@/types/database";

function profileName(user: { email?: string | null; user_metadata?: Record<string, unknown> } | null) {
  const meta = user?.user_metadata ?? {};
  const name = meta.full_name ?? meta.name;
  if (typeof name === "string" && name.trim()) return name.trim();
  return user?.email?.split("@")[0] ?? "You";
}

function profileAvatar(user: { user_metadata?: Record<string, unknown> } | null) {
  const meta = user?.user_metadata ?? {};
  const url = meta.avatar_url ?? meta.picture;
  return typeof url === "string" && url.length > 0 ? url : null;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { profile, interactionCount, loading, refresh, isColdStart } =
    useStyleProfile();
  const { sagMode, setSagMode } = useSagMode();
  const [topGarments, setTopGarments] = useState<Garment[]>([]);
  const [garmentCount, setGarmentCount] = useState(0);
  const [pinterest, setPinterest] = useState<PinterestStatus | null>(null);
  const [selectedBoardIds, setSelectedBoardIds] = useState<string[]>([]);
  const [pinterestLoading, setPinterestLoading] = useState(true);
  const [pinterestAction, setPinterestAction] = useState<string | null>(null);
  const [pinterestError, setPinterestError] = useState<string | null>(null);

  const loadPinterest = useCallback(async () => {
    setPinterestLoading(true);
    try {
      const status = await getPinterestStatus();
      setPinterest(status);
      setSelectedBoardIds(
        status.boards
          .filter((board) => board.selected)
          .map((board) => board.pinterest_board_id)
      );
      setPinterestError(null);
    } catch (error) {
      setPinterestError(errorMessage(error));
    } finally {
      setPinterestLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
      void loadPinterest();
      if (user) {
        fetchGarments(user.id).then((g) => {
          setGarmentCount(g.length);
          setTopGarments(g.slice(0, 6));
        });
      }
    }, [loadPinterest, refresh, user])
  );

  const runPinterestAction = async (
    name: string,
    action: () => Promise<void>
  ) => {
    setPinterestAction(name);
    setPinterestError(null);
    try {
      await action();
    } catch (error) {
      setPinterestError(errorMessage(error));
    } finally {
      setPinterestAction(null);
    }
  };

  const handleConnect = () =>
    runPinterestAction("connect", async () => {
      const result = await connectPinterest();
      if (result === "cancelled") return;
      const status = await refreshPinterestBoards();
      setPinterest(status);
      setSelectedBoardIds(
        status.boards
          .filter((board) => board.selected)
          .map((board) => board.pinterest_board_id)
      );
    });

  const handleRefreshBoards = () =>
    runPinterestAction("boards", async () => {
      const status = await refreshPinterestBoards();
      setPinterest(status);
      setSelectedBoardIds(
        status.boards
          .filter((board) => board.selected)
          .map((board) => board.pinterest_board_id)
      );
    });

  const handleSync = () =>
    runPinterestAction("sync", async () => {
      const selectedStatus = await selectPinterestBoards(selectedBoardIds);
      setPinterest(selectedStatus);
      await syncPinterestPins();
      await Promise.all([loadPinterest(), refresh()]);
    });

  const handleDisconnect = () => {
    Alert.alert(
      "Disconnect Pinterest",
      "Remove Pinterest tokens, selected boards, cached Pins, and Pinterest taste data?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect",
          style: "destructive",
          onPress: () =>
            void runPinterestAction("disconnect", async () => {
              await disconnectPinterest();
              setPinterest({
                connected: false,
                connectedAt: null,
                expiresAt: null,
                boards: [],
                pinCount: 0,
              });
              setSelectedBoardIds([]);
              await refresh();
            }),
        },
      ]
    );
  };

  const toggleBoard = (boardId: string) => {
    setSelectedBoardIds((current) =>
      current.includes(boardId)
        ? current.filter((id) => id !== boardId)
        : current.length < 10
          ? [...current, boardId]
          : current
    );
  };

  const handleSignOut = () => {
    Alert.alert("Sign out", "Sign out of Clover?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: () => void signOut(),
      },
    ]);
  };

  return (
    <ScrollView
      className="flex-1 bg-clover-50"
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={refresh}
          tintColor="#173F32"
        />
      }
    >
      <View className="items-center pt-8 pb-4">
        <View className="mb-4 h-20 w-20 overflow-hidden rounded-full bg-clover-100">
          {profileAvatar(user) ? (
            <Image
              source={{ uri: profileAvatar(user)! }}
              className="h-20 w-20"
            />
          ) : (
            <View className="h-20 w-20 items-center justify-center">
              <Text className="text-2xl font-bold text-clover-700">
                {profileName(user).slice(0, 1).toUpperCase()}
              </Text>
            </View>
          )}
        </View>
        <Text className="text-lg font-semibold text-stone-900">
          {profileName(user)}
        </Text>
        <Text className="mt-1 text-sm text-stone-500">{user?.email}</Text>
      </View>

      <View className="px-4 mb-4">
        <View className="flex-row gap-3">
          <View className="flex-1 items-center rounded-xl border border-clover-200 bg-[#FCFBF7] p-3">
            <Text className="text-2xl font-bold text-clover-600">
              {garmentCount}
            </Text>
            <Text className="text-xs text-stone-500">Garments</Text>
          </View>
          <View className="flex-1 items-center rounded-xl border border-clover-200 bg-[#FCFBF7] p-3">
            <Text className="text-2xl font-bold text-clover-600">
              {interactionCount}
            </Text>
            <Text className="text-xs text-stone-500">Ratings</Text>
          </View>
        </View>

        {isColdStart && (
          <View className="mt-3 rounded-xl border border-clover-200 bg-clover-100 p-3">
            <Text className="text-sm text-clover-700">
              Rate {5 - interactionCount} more outfit
              {5 - interactionCount !== 1 ? "s" : ""} to activate personalized
              recommendations.
            </Text>
          </View>
        )}

        {profile && (
          <Text className="text-xs text-gray-400 mt-2">
            Last updated:{" "}
            {new Date(profile.updated_at).toLocaleDateString()}
          </Text>
        )}
      </View>

      {/* Pinterest taste */}
      <View className="mx-4 mb-6 rounded-2xl border border-clover-200 bg-[#FCFBF7] p-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-base font-semibold text-stone-900">
              Pinterest
            </Text>
            <Text className="mt-1 text-xs text-stone-500">
              Optional. Blend boards with your ratings.
            </Text>
          </View>
          {pinterest?.connected && (
            <View className="rounded-full bg-clover-100 px-3 py-1">
              <Text className="text-xs font-semibold text-clover-700">
                {pinterest.pinCount} Pins
              </Text>
            </View>
          )}
        </View>

        {pinterestLoading ? (
          <ActivityIndicator className="my-5" color="#173F32" />
        ) : !pinterest?.connected ? (
          <TouchableOpacity
            className={`mt-4 items-center rounded-xl border border-clover-200 bg-white py-3 ${
              pinterestAction ? "opacity-60" : ""
            }`}
            onPress={() => void handleConnect()}
            disabled={Boolean(pinterestAction)}
          >
            {pinterestAction === "connect" ? (
              <ActivityIndicator color="#173F32" />
            ) : (
              <Text className="font-semibold text-clover-700">
                Connect Pinterest
              </Text>
            )}
          </TouchableOpacity>
        ) : (
          <>
            <View className="mt-4 flex-row items-center justify-between">
              <Text className="text-sm font-semibold text-gray-700">
                Boards to learn from
              </Text>
              <TouchableOpacity
                onPress={() => void handleRefreshBoards()}
                disabled={Boolean(pinterestAction)}
              >
                <Text className="text-xs font-semibold text-clover-700">
                  Refresh boards
                </Text>
              </TouchableOpacity>
            </View>

            {pinterest.boards.length === 0 ? (
              <Text className="mt-3 text-sm text-gray-500">
                No boards are available. Pinterest may still be reviewing this
                app&apos;s boards:read access.
              </Text>
            ) : (
              <View className="mt-2">
                {pinterest.boards.map((board) => {
                  const selected = selectedBoardIds.includes(
                    board.pinterest_board_id
                  );
                  return (
                    <TouchableOpacity
                      key={board.pinterest_board_id}
                      className="mb-2 flex-row items-center rounded-xl bg-white p-3"
                      onPress={() => toggleBoard(board.pinterest_board_id)}
                      disabled={Boolean(pinterestAction)}
                    >
                      <View
                        className={`mr-3 h-5 w-5 items-center justify-center rounded border ${
                          selected
                            ? "border-clover-600 bg-clover-600"
                            : "border-stone-300"
                        }`}
                      >
                        {selected && (
                          <Text className="text-xs font-bold text-white">✓</Text>
                        )}
                      </View>
                      <Text className="flex-1 font-medium text-gray-800">
                        {board.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <TouchableOpacity
              className={`mt-2 items-center rounded-xl bg-clover-600 py-3 ${
                pinterestAction || selectedBoardIds.length === 0
                  ? "opacity-50"
                  : ""
              }`}
              onPress={() => void handleSync()}
              disabled={
                Boolean(pinterestAction) || selectedBoardIds.length === 0
              }
            >
              {pinterestAction === "sync" ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="font-semibold text-white">
                  Save boards & sync Pins
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              className="mt-3 items-center py-2"
              onPress={handleDisconnect}
              disabled={Boolean(pinterestAction)}
            >
              <Text className="text-sm font-medium text-red-600">
                Disconnect Pinterest
              </Text>
            </TouchableOpacity>
          </>
        )}

        {pinterestError && (
          <Text className="mt-3 text-sm text-red-700">{pinterestError}</Text>
        )}
      </View>

      {/* Recent garments */}
      {topGarments.length > 0 && (
        <View className="px-4 mb-6">
          <Text className="text-base font-semibold text-gray-800 mb-3">
            Recent Garments
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {topGarments.map((g) => (
              <TouchableOpacity
                key={g.id}
                onPress={() => router.push(`/garment/${g.id}`)}
                accessibilityRole="button"
                accessibilityLabel={g.name}
                className="h-16 w-16 items-center justify-center rounded-xl border border-clover-200 bg-[#FCFBF7]"
              >
                <Image
                  source={{ uri: g.cutout_url ?? g.image_url }}
                  className="w-14 h-14"
                  resizeMode="contain"
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <View className="px-4 mb-6">
        <Text className="mb-3 text-base font-semibold text-gray-800">
          Settings
        </Text>
        <SagModeToggle value={sagMode} onValueChange={setSagMode} />
      </View>

      <View className="px-4 pb-8">
        <TouchableOpacity
          className="items-center rounded-lg border border-red-300 py-3"
          onPress={handleSignOut}
        >
          <Text className="font-semibold text-red-500">Sign out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Pinterest is unavailable right now.";
}
