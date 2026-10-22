import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const HOME_GESTURES_KEY = "clover.homeGesturesTaught";

export function useHomeGestureCoach() {
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void AsyncStorage.getItem(HOME_GESTURES_KEY).then((value) => {
      setVisible(value !== "1");
      setReady(true);
    });
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    void AsyncStorage.setItem(HOME_GESTURES_KEY, "1");
  }, []);

  return { visible: ready && visible, dismiss };
}
