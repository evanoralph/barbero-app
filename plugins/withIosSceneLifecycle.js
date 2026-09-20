/**
 * Backport UIScene lifecycle for Xcode 27 / iOS 27 SDK.
 *
 * Expo SDK 57.0.x still creates the UIWindow in AppDelegate. iOS 27 traps at
 * launch (NoSceneLifecycleAdoption) unless UIApplicationSceneManifest + a
 * SceneDelegate own the window. Upstream ExpoAppSceneDelegate lands later;
 * this plugin keeps local/dev-client builds launching until then.
 *
 * Remove once Expo's prebuild template includes SceneDelegate by default.
 */
const { withAppDelegate, withInfoPlist } = require("@expo/config-plugins");

const LOG = "[withIosSceneLifecycle]";

const sceneConfigurationMethod = `  public func application(
    _ application: UIApplication,
    configurationForConnecting connectingSceneSession: UISceneSession,
    options: UIScene.ConnectionOptions
  ) -> UISceneConfiguration {
    let configuration = UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
    configuration.delegateClass = SceneDelegate.self
    return configuration
  }
`;

const sceneDelegateClass = `
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene else {
      print("${LOG} willConnectTo: not a UIWindowScene")
      return
    }

    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate,
          let factory = appDelegate.reactNativeFactory else {
      print("${LOG} willConnectTo: missing AppDelegate / reactNativeFactory")
      return
    }

    print("${LOG} willConnectTo: creating UIWindow + starting React Native")
    let nextWindow = UIWindow(windowScene: windowScene)
    window = nextWindow
    appDelegate.window = nextWindow

    factory.startReactNative(
      withModuleName: "main",
      in: nextWindow,
      launchOptions: appDelegate.launchOptions)

    if !connectionOptions.urlContexts.isEmpty {
      self.scene(scene, openURLContexts: connectionOptions.urlContexts)
    }

    for userActivity in connectionOptions.userActivities {
      self.scene(scene, continue: userActivity)
    }
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let urlContext = URLContexts.first,
          let appDelegate = UIApplication.shared.delegate as? AppDelegate else {
      return
    }

    var options: [UIApplication.OpenURLOptionsKey: Any] = [
      .openInPlace: urlContext.options.openInPlace,
    ]

    if let sourceApplication = urlContext.options.sourceApplication {
      options[.sourceApplication] = sourceApplication
    }

    if let annotation = urlContext.options.annotation {
      options[.annotation] = annotation
    }

    print("${LOG} openURLContexts: \\(urlContext.url.absoluteString)")
    _ = appDelegate.application(UIApplication.shared, open: urlContext.url, options: options)
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate else {
      return
    }
    print("${LOG} continue userActivity: \\(userActivity.activityType)")
    _ = appDelegate.application(
      UIApplication.shared,
      continue: userActivity,
      restorationHandler: { _ in }
    )
  }
}
`;

function addInfoPlistSceneManifest(config) {
  return withInfoPlist(config, (nextConfig) => {
    console.log(`${LOG} adding UIApplicationSceneManifest to Info.plist`);
    nextConfig.modResults.UIApplicationSceneManifest = {
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
    return nextConfig;
  });
}

function patchAppDelegate(contents) {
  if (contents.includes("class SceneDelegate: UIResponder, UIWindowSceneDelegate")) {
    console.log(`${LOG} AppDelegate already has SceneDelegate — skipping`);
    return contents;
  }

  let nextContents = contents;

  if (!nextContents.includes("var launchOptions:")) {
    nextContents = nextContents.replace(
      "var reactNativeFactory: RCTReactNativeFactory?\n",
      "var reactNativeFactory: RCTReactNativeFactory?\n  var launchOptions: [UIApplication.LaunchOptionsKey: Any]?\n",
    );
  }

  if (!nextContents.includes("self.launchOptions = launchOptions")) {
    nextContents = nextContents.replace(
      "reactNativeDelegate = delegate\n    reactNativeFactory = factory\n",
      "reactNativeDelegate = delegate\n    reactNativeFactory = factory\n    self.launchOptions = launchOptions\n",
    );
  }

  const startupBlockPattern =
    /#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\(\n\s*withModuleName: "main",\n\s*in: window,\n\s*launchOptions: launchOptions\)\n#endif/;

  if (!startupBlockPattern.test(nextContents)) {
    throw new Error(
      `${LOG} Could not find the Expo AppDelegate React Native startup block to patch for UIScene lifecycle.`,
    );
  }

  console.log(`${LOG} moving window + startReactNative to SceneDelegate`);
  nextContents = nextContents.replace(
    startupBlockPattern,
    `// Window + startReactNative are owned by SceneDelegate (Xcode 27 / iOS 27 UIScene)
#if os(iOS) || os(tvOS)
    if #unavailable(iOS 13.0) {
      window = UIWindow(frame: UIScreen.main.bounds)
      factory.startReactNative(
        withModuleName: "main",
        in: window,
        launchOptions: launchOptions)
    }
#endif`,
  );

  if (!nextContents.includes("configurationForConnecting connectingSceneSession")) {
    const linkingMarker = "\n  // Linking API";
    if (!nextContents.includes(linkingMarker)) {
      throw new Error(
        `${LOG} Could not find the AppDelegate linking section to insert the UIScene configuration method.`,
      );
    }
    console.log(`${LOG} inserting configurationForConnecting`);
    nextContents = nextContents.replace(
      linkingMarker,
      `\n${sceneConfigurationMethod}\n  // Linking API`,
    );
  }

  const reactNativeDelegateMarker = "\nclass ReactNativeDelegate: ExpoReactNativeFactoryDelegate";
  if (!nextContents.includes(reactNativeDelegateMarker)) {
    throw new Error(`${LOG} Could not find ReactNativeDelegate to insert SceneDelegate.`);
  }

  console.log(`${LOG} appending SceneDelegate class`);
  return nextContents.replace(
    reactNativeDelegateMarker,
    `\n${sceneDelegateClass}${reactNativeDelegateMarker}`,
  );
}

function addAppDelegateSceneLifecycle(config) {
  return withAppDelegate(config, (nextConfig) => {
    if (nextConfig.modResults.language !== "swift") {
      throw new Error(
        `${LOG} Cannot apply to ${nextConfig.modResults.language} AppDelegate. Swift is required.`,
      );
    }
    nextConfig.modResults.contents = patchAppDelegate(nextConfig.modResults.contents);
    return nextConfig;
  });
}

module.exports = function withIosSceneLifecycle(config) {
  console.log(`${LOG} applying UIScene lifecycle backport`);
  return addAppDelegateSceneLifecycle(addInfoPlistSceneManifest(config));
};
