import { useEffect, useRef, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { Platform, type AlertButton } from "react-native";
import { apiUserToProfile, useAuth } from "@/context/auth";
import api, { ApiError } from "@/services/api";
import { PhotoValidationError } from "@/services/profilePhotoUpload";

type Alert = (title: string, message?: string, buttons?: AlertButton[]) => void;
export type ProfilePhotoActions = ReturnType<typeof useProfilePhoto>;

/** One controller shared by the Profile avatar and the Account editor. */
export function useProfilePhoto(showAlert: Alert) {
  const { user, updateUser, runAuthenticatedRequest, setHasPhoto } = useAuth();
  const [asset, setAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [busy, setBusy] = useState(false);
  const [needsReconcile, setNeedsReconcile] = useState(false);
  const lock = useRef(false);
  const epoch = useRef(0);
  const latestId = useRef(user?.id); latestId.current = user?.id;
  useEffect(() => {
    epoch.current++;
    setAsset(null); setNeedsReconcile(false);
  }, [user?.id]);
  const canRemove = !!user?.profilePhotoUrl;
  const support = "\nPlease contact the EDUwAI team through in-app chat or the “Contact Us” section on the home page for help.";
  const report = (title: string, error: unknown) =>
    showAlert(title, `${error instanceof Error ? error.message : "Please try again."}${support}`);
  const ambiguous = (error: unknown) => !(error instanceof ApiError) || error.statusCode >= 500 || error.statusCode < 400;

  async function run<T>(operation: (active: () => boolean) => Promise<T>): Promise<T | undefined> {
    if (lock.current || !latestId.current) return;
    const id = latestId.current, generation = epoch.current;
    const active = () => latestId.current === id && epoch.current === generation;
    lock.current = true; setBusy(true);
    try { return await operation(active); }
    finally { lock.current = false; setBusy(false); }
  }

  async function reconcile(active: () => boolean) {
    const server = await runAuthenticatedRequest(token => api.auth.getMe(token));
    if (!active() || server.id !== latestId.current) throw new Error("Your account changed. Please reopen Profile.");
    await updateUser(apiUserToProfile(server));
    if (!active()) throw new Error("Your account changed.");
    setHasPhoto(!!server.profile_photo_url);
    // A new revision reloads all private image widgets, including replacements
    // whose logical storage key did not change.
    return server;
  }

  async function checkSavedPhoto() {
    await run(async active => {
      try {
        await reconcile(active);
        await runAuthenticatedRequest(token => api.profile.probePhoto(token));
        if (active()) { setNeedsReconcile(false); showAlert("Saved photo refreshed", "Review your current photo before deliberately trying again."); }
      } catch (error) { if (active()) report("Could not check saved photo", error); }
    });
  }

  async function save(cropped: ImagePicker.ImagePickerAsset): Promise<boolean> {
    if (needsReconcile) { await checkSavedPhoto(); return false; }
    return await run(async active => {
      let committed = false;
      try {
        const response = await runAuthenticatedRequest(token => api.profile.uploadPhoto(token, cropped));
        if (response?.success !== true || !response.profile_photo_url) throw new Error("Photo upload was not confirmed.");
        committed = true;
        if (!active()) return false;
        // A committed write is never replayed just because its GET failed.
        await updateUser({ profilePhotoUrl: response.profile_photo_url });
        setHasPhoto(true);
        setAsset(null);
        try {
          const server = await reconcile(active);
          if (server.profile_photo_url !== response.profile_photo_url) throw new Error("The saved profile did not confirm the uploaded photo.");
          if (active()) showAlert("Profile photo updated!", "Your photo was saved to your existing account.");
        } catch (error) {
          if (active()) { setNeedsReconcile(true); report("Photo uploaded; refresh needed", error); }
        }
        return true;
      } catch (error) {
        if (!active()) return false;
        if (!committed && !(error instanceof PhotoValidationError) && ambiguous(error)) {
          try {
            await reconcile(active);
            await runAuthenticatedRequest(token => api.profile.probePhoto(token));
            if (active()) showAlert("Check your current photo", "The upload response was lost. Your saved photo has been refreshed, but the same storage key cannot prove replacement succeeded. Cancel the crop to review it before deliberately retrying.");
          } catch {
            if (active()) { setNeedsReconcile(true); showAlert("Photo update outcome unknown", `No automatic retry was made. Check your saved photo before trying again.${support}`); }
          }
        } else report("Photo upload failed", error);
        return false;
      }
    }) ?? false;
  }

  async function remove() {
    if (needsReconcile) { await checkSavedPhoto(); return; }
    await run(async active => {
      let committed = false;
      try {
        const response = await runAuthenticatedRequest(token => api.profile.deletePhoto(token));
        if (response?.success !== true) throw new Error("Photo removal was not confirmed.");
        committed = true;
        if (!active()) return;
        await updateUser({ profilePhotoUrl: null });
        setHasPhoto(false);
        try {
          const server = await reconcile(active);
          if (server.profile_photo_url) throw new Error("The saved profile still has a photo reference.");
          if (active()) showAlert("Profile photo removed", "Your account now uses its initials.");
        } catch (error) {
          if (active()) { setNeedsReconcile(true); report("Photo removed; refresh needed", error); }
        }
      } catch (error) {
        if (!active()) return;
        if (!committed && ambiguous(error)) {
          try {
            const server = await reconcile(active);
            if (active()) {
              if (!server.profile_photo_url) showAlert("Profile photo removed", "Removal confirmed from your saved profile.");
              else showAlert("Photo is still linked", `The removal response was lost. Your saved profile still has a photo; no automatic retry was made.${support}`);
            }
          } catch {
            if (active()) { setNeedsReconcile(true); showAlert("Photo removal outcome unknown", `Check your saved photo before trying again.${support}`); }
          }
        } else report("Photo removal failed", error);
      }
    });
  }

  async function pick(camera: boolean) {
    if (needsReconcile) { await checkSavedPhoto(); return; }
    await run(async active => {
      try {
        if (Platform.OS !== "web") {
          const permission = camera
            ? await ImagePicker.requestCameraPermissionsAsync()
            : await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!permission.granted) {
            if (active()) showAlert("Permission needed", `Allow ${camera ? "camera" : "photo library"} access in device Settings to choose a profile photo.`);
            return;
          }
        }
        if (!active()) return;
        const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], allowsEditing: false, quality: 1, selectionLimit: 1 };
        const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
        if (active() && !result.canceled && result.assets[0]) setAsset(result.assets[0]);
      } catch (error) { if (active()) report("Could not select photo", error); }
    });
  }

  function openPicker() {
    if (lock.current) return;
    if (needsReconcile) { void checkSavedPhoto(); return; }
    showAlert("Profile Photo", "Choose an option", [
      { text: "Take Photo", onPress: () => { void pick(true); } },
      { text: "Choose from Library", onPress: () => { void pick(false); } },
      ...(canRemove ? [{ text: "Remove Photo", style: "destructive" as const, onPress: () => { void remove(); } }] : []),
      { text: "Cancel", style: "cancel" },
    ]);
  }
  return { asset, busy, canRemove, needsReconcile, openPicker, remove,
    cancel: () => { if (!lock.current) setAsset(null); }, save, checkSavedPhoto };
}
