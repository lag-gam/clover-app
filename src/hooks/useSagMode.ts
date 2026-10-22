import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SAG_MODE_KEY = "clover.sagMode";

export function useSagMode() {
  const [sagMode, setSagModeState] = useState(false);

  const reload = useCallback(() => {
    void AsyncStorage.getItem(SAG_MODE_KEY).then((value) => {
      setSagModeState(value === "1");
    });
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const setSagMode = useCallback((value: boolean) => {
    setSagModeState(value);
    void AsyncStorage.setItem(SAG_MODE_KEY, value ? "1" : "0");
  }, []);

  return { sagMode, setSagMode, reload };
}
