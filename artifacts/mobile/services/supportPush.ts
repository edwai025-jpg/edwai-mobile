import { Platform } from "react-native";
import { credentialStorage } from "./credentialStorage";
import { nativeSupportPush, SUPPORT_PUSH_ENABLED } from "./nativeSupportPush";
import { SupportPushManager } from "./supportPushManager";
import { supportApi } from "./supportApi";
import { authorizeSupportReply } from "./supportNotification";
import { parseSavedSupportPointer, supportStorageKey } from "./supportSession";

export const supportPush = new SupportPushManager({
  enabled: SUPPORT_PUSH_ENABLED,
  native: nativeSupportPush,
  storage: credentialStorage,
  // One native token can outlive API environment changes; cleanup is device-wide.
  storageKey: "edwai_support_push_device_v1",
  ownerKey: supportStorageKey,
  loadPointer: async identity => parseSavedSupportPointer(
    await credentialStorage.getItem(supportStorageKey(identity)), identity === "guest",
  ),
  platform: Platform.OS === "ios" ? "ios" : "android",
  register: supportApi.registerFcmToken,
  authorize: authorizeSupportReply,
});
