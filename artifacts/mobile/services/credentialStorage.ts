import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// Browser previews retain credentials for this tab only; native uses Keychain/Keystore.
export const credentialStorage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === "web") {
      const current = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(key) : null;
      if (current !== null) return current;
    } else {
      const current = await SecureStore.getItemAsync(key);
      if (current !== null) return current;
    }
    // Migrate existing native login credentials without signing the user out.
    const legacy = await AsyncStorage.getItem(key);
    if (legacy !== null) {
      await credentialStorage.setItem(key, legacy);
      await AsyncStorage.removeItem(key);
    }
    return legacy;
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === "web") {
      if (typeof sessionStorage === "undefined") throw new Error("Session storage is unavailable.");
      sessionStorage.setItem(key, value);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  },
  async removeItem(key: string): Promise<void> {
    if (Platform.OS === "web") {
      if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(key);
    } else {
      await SecureStore.deleteItemAsync(key);
    }
    await AsyncStorage.removeItem(key);
  },
};