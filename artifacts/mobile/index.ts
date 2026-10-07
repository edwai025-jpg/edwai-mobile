import { installSupportBackgroundHandler } from "./services/nativeSupportPush";

installSupportBackgroundHandler();

// Register the lightweight background handler before the router's app entry.
require("expo-router/entry");
