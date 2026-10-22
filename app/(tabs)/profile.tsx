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
import { useFocusEffect } from "expo-router";
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

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { profile, interactionCount, loading, refresh, isColdStart } =
    useStyleProfile();
  const { sagMode, setSagMode } = useSagMode();
  const [topGarments, setTopGarments] = useState<Garment[]>([]);
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
          // Show first 6 garments as "top" items for now
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
        <View className="w-20 h-20 rounded-full bg-clover-100 items-center justify-center mb-4">
          <Text className="text-2xl text-clover-600">
            C
          </Text>
        </View>
        <Text className="text-lg font-semibold">Your closet</Text>
        <Text className="text-sm text-gray-500 mt-1">{user?.email}</Text>
      </View>

      {/* Style Stats */}
      <View className="px-4 mb-4">
        <Text className="text-base font-semibold text-gray-800 mb-3">
          Style Profile
        </Text>
        <View className="flex-row gap-3">
          <View className="flex-1 items-center rounded-xl border border-clover-200 bg-[#FCFBF7] p-3">
            <Text className="text-2xl font-bold text-clover-600">
              {interactionCount}
            </Text>
            <Text className="text-xs text-gray-500">Ratings</Text>
          </View>
          <View className="flex-1 items-center rounded-xl border border-clover-200 bg-[#FCFBF7] p-3">
            <Text className="text-2xl font-bold text-clover-600">
              {profile ? "Active" : "---"}
            </Text>
            <Text className="text-xs text-gray-500">Style Model</Text>
          </View>
          <View className="flex-1 items-center rounded-xl border border-clover-200 bg-[#FCFBF7] p-3">
            <Text className="text-2xl font-bold text-clover-600">
              {topGarments.length}
            </Text>
            <Text className="text-xs text-gray-500">Garments</Text>
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
      <View className="mx-4 mb-6 rounded-2xl border border-red-100 bg-red-50 p-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-base font-semibold text-gray-900">
              Pinterest taste
            </Text>
            <Text className="mt-1 text-xs text-gray-500">
              Blend selected boards with your Clover ratings.
            </Text>
          </View>
          {pinterest?.connected && (
            <View className="rounded-full bg-white px-3 py-1">
              <Text className="text-xs font-semibold text-red-600">
                {pinterest.pinCount} Pins
              </Text>
            </View>
          )}
        </View>

        {pinterestLoading ? (
          <ActivityIndicator className="my-5" color="#dc2626" />
        ) : !pinterest?.connected ? (
          <TouchableOpacity
            className={`mt-4 items-center rounded-xl bg-red-600 py-3 ${
              pinterestAction ? "opacity-60" : ""
            }`}
            onPress={() => void handleConnect()}
            disabled={Boolean(pinterestAction)}
          >
            {pinterestAction === "connect" ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="font-semibold text-white">
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
                <Text className="text-xs font-semibold text-red-600">
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
                            ? "border-red-600 bg-red-600"
                            : "border-gray-300"
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
              className={`mt-2 items-center rounded-xl bg-red-600 py-3 ${
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
              <View
                key={g.id}
                className="h-16 w-16 items-center justify-center rounded-xl border border-clover-200 bg-[#FCFBF7]"
              >
                <Image
                  source={{ uri: g.cutout_url ?? g.image_url }}
                  className="w-14 h-14"
                  resizeMode="contain"
                />
              </View>
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
