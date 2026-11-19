/**
 * iOS 27 asserts at launch unless the app adopts the UIScene life cycle.
 * Expo SDK 57 ships `ExpoAppSceneDelegate`, but the prebuild template still
 * starts React Native from the app delegate. This plugin:
 *   1. Registers a scene delegate in Info.plist (UIApplicationSceneManifest).
 *   2. Makes AppDelegate an ExpoReactNativeFactoryProvider and stops it from
 *      creating its own window / starting React Native (the scene delegate does that).
 *   3. Adds `SceneDelegate: ExpoAppSceneDelegate`.
 */
const { withInfoPlist, withAppDelegate } = require("expo/config-plugins");

function withSceneManifest(config) {
  return withInfoPlist(config, (cfg) => {
    cfg.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: "Default Configuration",
            UISceneDelegateClassName: "$(PRODUCT_MODULE_NAME).SceneDelegate",
          },
        ],
      },
    };
    return cfg;
  });
}

function withSceneAppDelegate(config) {
  return withAppDelegate(config, (cfg) => {
    if (cfg.modResults.language !== "swift") {
      throw new Error("with-ios-scene-lifecycle only supports a Swift AppDelegate.");
    }
    let src = cfg.modResults.contents;

    if (!src.includes("ExpoReactNativeFactoryProvider")) {
      src = src.replace(
        /class AppDelegate: ExpoAppDelegate \{/,
        "class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {"
      );
    }

    // The scene delegate creates the window and starts React Native.
    src = src.replace(/^\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\s*\n/m, "\n");
    src = src.replace(
      /^\s*factory\.startReactNative\(\s*withModuleName: "main",\s*in: window,\s*launchOptions: launchOptions\)\s*\n/m,
      "\n"
    );

    if (!src.includes("class SceneDelegate")) {
      src += "\nclass SceneDelegate: ExpoAppSceneDelegate {}\n";
    }

    if (!src.includes("ExpoReactNativeFactoryProvider") || src.includes("factory.startReactNative(")) {
      throw new Error(
        "with-ios-scene-lifecycle could not patch AppDelegate.swift; the Expo template may have changed."
      );
    }

    cfg.modResults.contents = src;
    return cfg;
  });
}

module.exports = function withIosSceneLifecycle(config) {
  return withSceneAppDelegate(withSceneManifest(config));
};
