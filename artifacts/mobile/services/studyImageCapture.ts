import * as ImagePicker from "expo-image-picker";
import { Alert, Linking, Platform } from "react-native";

/** Study-only picker; keep permission recovery separate from OCR and Profile. */
export async function pickStudyImage(
  fromCamera: boolean,
  recovery: { retryCamera: () => void; choosePhoto: () => void },
): Promise<ImagePicker.ImagePickerResult | null> {
  if (fromCamera && Platform.OS !== "web") {
    // iOS launchCameraAsync rejects without permission; Android may ask implicitly.
    let permission = await ImagePicker.getCameraPermissionsAsync();
    if (!permission.granted && permission.canAskAgain) {
      permission = await ImagePicker.requestCameraPermissionsAsync();
    }
    if (!permission.granted) {
      const canAskAgain = permission.canAskAgain;
      Alert.alert(
        "Camera access needed",
        canAskAgain
          ? "Allow camera access to scan a study question, or choose an existing photo."
          : "Camera access is disabled. Enable it in Settings, return here and tap the camera again, or choose an existing photo.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Choose Photo", onPress: recovery.choosePhoto },
          canAskAgain
            ? { text: "Try Again", onPress: recovery.retryCamera }
            : {
                text: "Open Settings",
                onPress: () => {
                  void Linking.openSettings().catch(() => {
                    Alert.alert(
                      "Could not open Settings",
                      "Open your device Settings manually to allow camera access, then return and tap the camera again.",
                    );
                  });
                },
              },
        ],
      );
      return null;
    }
  }

  // Web must launch directly from the tap, without awaiting native permissions.
  return fromCamera
    ? ImagePicker.launchCameraAsync({ quality: 0.8 })
    : ImagePicker.launchImageLibraryAsync({ quality: 0.8, mediaTypes: ["images"] });
}
