import Constants from "expo-constants";
import * as Device from "expo-device";
import { AppState, Linking, Platform, TurboModuleRegistry } from "react-native";
import type { RemoteMessage } from "@react-native-firebase/messaging";

export type NativePushMessage = { data?: unknown; id?: string };
export type NativePushAdapter = {
  available: () => boolean;
  requestPermission: () => Promise<boolean>;
  hasPermission: () => Promise<boolean>;
  getToken: () => Promise<string>;
  invalidateToken: () => Promise<void>;
  notify: (data: { type: string; conversation_id: string }, id?: string) => Promise<void>;
  listen: (callbacks: {
    tap: (message: NativePushMessage) => void;
    message: (message: NativePushMessage) => void;
    token: () => void;
    resume: () => void;
    canPresent: (data: unknown) => boolean;
  }) => Promise<() => void>;
  openSettings: () => Promise<void>;
  clearBadge: () => Promise<void>;
};

// Default OFF. Set true only in a signed internal test build first.
// Public release must wait for the physical-device/shared-device privacy checklist.
export const SUPPORT_PUSH_ENABLED = process.env.EXPO_PUBLIC_SUPPORT_PUSH_ENABLED === "true";
let initializationFailed = false;
let initialNotificationChecked = false;

function nativeAvailable() {
  return Platform.OS !== "web" && Device.isDevice
    && Constants.executionEnvironment !== "storeClient"
    && !initializationFailed
    && !!TurboModuleRegistry.get("NativeRNFBTurboApp")
    && !!TurboModuleRegistry.get("NativeRNFBTurboMessaging");
}

function messagingModule() {
  if (!nativeAvailable()) throw new Error("An installed native Firebase build is required.");
  // Guarded require prevents native Firebase evaluation in web and Expo Go.
  return require("@react-native-firebase/messaging") as typeof import("@react-native-firebase/messaging");
}

async function notificationModule() {
  if (!nativeAvailable()) throw new Error("Native notifications are unavailable.");
  return import("expo-notifications");
}

function permissionGranted(p: { granted: boolean; ios?: { status: number } | null }) {
  // iOS provisional/ephemeral authorization can receive notifications too.
  return p.granted || p.ios?.status === 3 || p.ios?.status === 4;
}

export function installSupportBackgroundHandler() {
  if (!SUPPORT_PUSH_ENABLED || !nativeAvailable()) return;
  try {
    const sdk = messagingModule();
    sdk.setBackgroundMessageHandler(sdk.getMessaging(), async () => {
      // The existing server sends OS-visible notifications. Do not fetch threads
      // or start timers here: a closed-thread read marks its replies as read.
    });
  } catch {
    // A malformed native build must still open foreground chat. The controls
    // explicitly report native notifications as unavailable.
    initializationFailed = true;
  }
}

export const nativeSupportPush: NativePushAdapter = {
  available: nativeAvailable,
  async hasPermission() {
    const notifications = await notificationModule();
    return permissionGranted(await notifications.getPermissionsAsync());
  },
  async requestPermission() {
    const notifications = await notificationModule();
    if (Platform.OS === "android") {
      await notifications.setNotificationChannelAsync("eduwai-support", {
        name: "EDUwAI Support", importance: notifications.AndroidImportance.HIGH,
        sound: "default",
      });
    }
    const permission = await notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    return permissionGranted(permission);
  },
  async getToken() {
    const sdk = messagingModule();
    const messaging = sdk.getMessaging();
    await sdk.setAutoInitEnabled(messaging, true);
    if (Platform.OS === "ios") {
      await sdk.registerDeviceForRemoteMessages(messaging);
      if (!await sdk.getAPNSToken(messaging)) {
        throw new Error("APNs registration is not ready. Foreground chat still works.");
      }
    }
    return sdk.getToken(messaging);
  },
  async invalidateToken() {
    const sdk = messagingModule();
    const messaging = sdk.getMessaging();
    let failed = false;
    const attempt = async (operation: () => Promise<unknown>) => {
      try { await operation(); } catch { failed = true; }
    };
    // Always attempt tray cleanup, even when offline token deletion fails.
    // Any failed SDK phase still leaves the secure invalidation marker intact.
    await attempt(() => sdk.setAutoInitEnabled(messaging, false));
    await attempt(() => sdk.deleteToken(messaging));
    if (Platform.OS === "ios") await attempt(() => sdk.unregisterDeviceForRemoteMessages(messaging));
    const notifications = await notificationModule();
    await attempt(() => notifications.dismissAllNotificationsAsync());
    await attempt(() => notifications.setBadgeCountAsync(0));
    if (failed) throw new Error("Notification cleanup could not be completed.");
  },
  async notify(data, id) {
    const notifications = await notificationModule();
    await notifications.scheduleNotificationAsync({
      identifier: `eduwai-support-${id || Date.now()}`,
      content: {
        title: "EDUwAI Support",
        // Do not reproduce private message previews in a local foreground alert.
        body: "You have a new support reply.",
        data,
        sound: "default",
      },
      trigger: Platform.OS === "android" ? { channelId: "eduwai-support" } : null,
    });
  },
  async listen(callbacks) {
    const sdk = messagingModule();
    const messaging = sdk.getMessaging();
    const notifications = await notificationModule();
    const map = (m: RemoteMessage): NativePushMessage =>
      ({ data: m.data, id: m.messageId });
    const stopMessage = sdk.onMessage(messaging, m => callbacks.message(map(m)));
    const stopTap = sdk.onNotificationOpenedApp(messaging, m => callbacks.tap(map(m)));
    const stopToken = sdk.onTokenRefresh(messaging, () => callbacks.token());
    notifications.setNotificationHandler({
      handleNotification: async notification => {
        const present = notification.request.identifier.startsWith("eduwai-support-")
          && callbacks.canPresent(notification.request.content.data);
        return { shouldShowBanner: present, shouldShowList: present, shouldPlaySound: present, shouldSetBadge: false };
      },
    });
    const tap = notifications.addNotificationResponseReceivedListener(response => {
      if (response.notification.request.identifier.startsWith("eduwai-support-")) {
        callbacks.tap({
          data: response.notification.request.content.data,
          id: response.notification.request.identifier,
        });
      }
    });
    const resume = AppState.addEventListener("change", state => {
      if (state === "active") callbacks.resume();
    });
    // Don't replay a previous identity's cold-start tap when listeners restart.
    if (!initialNotificationChecked) {
      initialNotificationChecked = true;
      void sdk.getInitialNotification(messaging).then(m => { if (m) callbacks.tap(map(m)); }).catch(() => {});
      void notifications.getLastNotificationResponseAsync().then(async response => {
        if (response?.notification.request.identifier.startsWith("eduwai-support-")) {
          callbacks.tap({ data: response.notification.request.content.data, id: response.notification.request.identifier });
          await notifications.clearLastNotificationResponseAsync();
        }
      }).catch(() => {});
    }
    return () => {
      stopMessage(); stopTap(); stopToken(); tap.remove(); resume.remove();
      notifications.setNotificationHandler(null);
    };
  },
  openSettings: () => Linking.openSettings(),
  async clearBadge() {
    const notifications = await notificationModule();
    await notifications.setBadgeCountAsync(0);
  },
};
