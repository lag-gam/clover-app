import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Platform, type ColorValue } from "react-native";

const ACTIVE = "#12372A";
const INACTIVE = "#77827B";

type TabIconName = React.ComponentProps<typeof Ionicons>["name"];

function tabIcon(active: TabIconName, inactive: TabIconName) {
  return ({ color, focused }: { color: ColorValue; focused: boolean }) => (
    <Ionicons name={focused ? active : inactive} size={23} color={color} />
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: ACTIVE,
        tabBarInactiveTintColor: INACTIVE,
        tabBarShowLabel: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          height: Platform.OS === "ios" ? 78 : 64,
          paddingTop: 8,
          paddingBottom: Platform.OS === "ios" ? 18 : 8,
          backgroundColor: "#FCFBF7",
          borderTopColor: "#DCE3DC",
          borderTopWidth: 1,
          elevation: 0,
          shadowColor: "#0F2D23",
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.05,
          shadowRadius: 10,
        },
        tabBarItemStyle: {
          minHeight: 44,
          paddingVertical: 4,
        },
        headerShown: true,
        headerStyle: { backgroundColor: "#FCFBF7" },
        headerShadowVisible: false,
        headerTintColor: ACTIVE,
        headerTitleStyle: {
          color: "#202823",
          fontSize: 18,
          fontWeight: "700",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarAccessibilityLabel: "Home",
          tabBarIcon: tabIcon("home", "home-outline"),
        }}
      />
      <Tabs.Screen
        name="closet"
        options={{
          title: "Closet",
          tabBarAccessibilityLabel: "Closet",
          tabBarIcon: tabIcon("shirt", "shirt-outline"),
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: "Add",
          tabBarAccessibilityLabel: "Add garment",
          tabBarIcon: tabIcon("add-circle", "add-circle-outline"),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: "Calendar",
          tabBarAccessibilityLabel: "Calendar",
          tabBarIcon: tabIcon("calendar", "calendar-outline"),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarAccessibilityLabel: "Profile",
          tabBarIcon: tabIcon("person", "person-outline"),
        }}
      />
    </Tabs>
  );
}
