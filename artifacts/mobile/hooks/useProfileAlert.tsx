import React, { useCallback, useState } from "react";
import { Alert, type AlertButton, Modal, Platform, Pressable, Text, View } from "react-native";
import { Colors } from "@/constants/colors";

/** Native alerts plus actionable in-app dialogs for Expo's iframe web preview. */
export function useProfileAlert() {
  const [dialog, setDialog] = useState<{ title: string; message: string; buttons: AlertButton[] } | null>(null);
  const showAlert = useCallback((title: string, message = "", buttons: AlertButton[] = [{ text: "OK" }]) => {
    if (Platform.OS !== "web") {
      Alert.alert(title, message, buttons);
    } else {
      setDialog({ title, message, buttons });
    }
  }, []);
  const alertDialog = dialog ? (
    <Modal transparent visible animationType="fade" onRequestClose={() => setDialog(null)}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "center", alignItems: "center", padding: 24 }}>
        <View style={{ width: "100%", maxWidth: 400, backgroundColor: Colors.darkCard, borderRadius: 16, padding: 20, gap: 14 }}>
          <Text style={{ color: Colors.darkText, fontFamily: "Inter_700Bold", fontSize: 18 }}>{dialog.title}</Text>
          <Text style={{ color: Colors.darkTextMuted }}>{dialog.message}</Text>
          {dialog.buttons.map((button, i) => (
            <Pressable key={i} style={{ paddingVertical: 12 }} onPress={() => {
              setDialog(null);
              button.onPress?.();
            }}>
              <Text style={{ color: button.style === "destructive" ? Colors.danger : Colors.primary, fontFamily: "Inter_600SemiBold" }}>{button.text}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  ) : null;
  return { showAlert, alertDialog };
}
