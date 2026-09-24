/**
 * Fix Android Manifest merger conflicts between expo-notifications and
 * @react-native-firebase/messaging (FCM default_notification_* meta-data).
 *
 * EAS/local: expo-notifications writes channel_id + color; RNFB messaging
 * also declares them → processReleaseMainManifest fails without tools:replace.
 *
 * Uses withDangerousMod (file rewrite after all XML mods) because
 * createRunOncePlugin + withAndroidManifest alone can be skipped when
 * Expo evaluates app.config multiple times before prebuild persists mods.
 */
const fs = require("fs");
const path = require("path");
const {
  withAndroidManifest,
  withDangerousMod,
  AndroidConfig,
} = require("@expo/config-plugins");

const LOG = "[withAndroidFirebaseMessagingManifestFix]";

const META_CHANNEL_ID =
  "com.google.firebase.messaging.default_notification_channel_id";
const META_COLOR =
  "com.google.firebase.messaging.default_notification_color";

function ensureToolsNamespace(manifest) {
  manifest.$ = {
    ...manifest.$,
    "xmlns:tools": "http://schemas.android.com/tools",
  };
}

function upsertMetaData(application, name, attrs) {
  application["meta-data"] ??= [];
  const metaData = application["meta-data"];
  let entry = metaData.find((item) => item?.$?.["android:name"] === name);
  if (!entry) {
    entry = { $: { "android:name": name } };
    metaData.push(entry);
    console.log(`${LOG} created meta-data ${name}`);
  }
  Object.assign(entry.$, attrs);
  console.log(`${LOG} patched meta-data ${name}`, attrs);
  return true;
}

function patchManifestObject(config) {
  return withAndroidManifest(config, (cfg) => {
    console.log(`${LOG} withAndroidManifest: patching in-memory mods`);
    const manifest = cfg.modResults.manifest;
    ensureToolsNamespace(manifest);
    const application =
      AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);

    upsertMetaData(application, META_CHANNEL_ID, {
      "android:value": "default",
      "tools:replace": "android:value",
    });
    upsertMetaData(application, META_COLOR, {
      "android:resource": "@color/notification_icon_color",
      "tools:replace": "android:resource",
    });

    console.log(`${LOG} withAndroidManifest: done`);
    return cfg;
  });
}

/**
 * Final safety net: rewrite AndroidManifest.xml on disk after all plugins.
 * Guarantees tools:replace even if earlier XML mods were skipped/reordered.
 */
function patchManifestFile(config) {
  return withDangerousMod(config, [
    "android",
    async (cfg) => {
      const manifestPath = path.join(
        cfg.modRequest.platformProjectRoot,
        "app",
        "src",
        "main",
        "AndroidManifest.xml",
      );

      if (!fs.existsSync(manifestPath)) {
        console.warn(`${LOG} dangerousMod: missing ${manifestPath}`);
        return cfg;
      }

      let xml = fs.readFileSync(manifestPath, "utf8");
      const before = xml;

      if (!xml.includes('xmlns:tools="http://schemas.android.com/tools"')) {
        xml = xml.replace(
          /<manifest\b([^>]*)>/,
          '<manifest$1 xmlns:tools="http://schemas.android.com/tools">',
        );
        console.log(`${LOG} dangerousMod: added xmlns:tools`);
      }

      // Channel id: ensure tools:replace="android:value"
      xml = xml.replace(
        /<meta-data\b([^>]*android:name="com\.google\.firebase\.messaging\.default_notification_channel_id"[^>]*)\/?>/g,
        (full, attrs) => {
          let next = attrs;
          if (!/\btools:replace=/.test(next)) {
            next += ' tools:replace="android:value"';
          } else {
            next = next.replace(
              /tools:replace="[^"]*"/,
              'tools:replace="android:value"',
            );
          }
          console.log(`${LOG} dangerousMod: patched channel_id`);
          return `<meta-data${next}/>`;
        },
      );

      // Color: ensure tools:replace="android:resource"
      xml = xml.replace(
        /<meta-data\b([^>]*android:name="com\.google\.firebase\.messaging\.default_notification_color"[^>]*)\/?>/g,
        (full, attrs) => {
          let next = attrs;
          if (!/\btools:replace=/.test(next)) {
            next += ' tools:replace="android:resource"';
          } else {
            next = next.replace(
              /tools:replace="[^"]*"/,
              'tools:replace="android:resource"',
            );
          }
          console.log(`${LOG} dangerousMod: patched color`);
          return `<meta-data${next}/>`;
        },
      );

      if (xml === before) {
        console.log(
          `${LOG} dangerousMod: no text changes (entries missing or already patched)`,
        );
      } else {
        fs.writeFileSync(manifestPath, xml);
        console.log(`${LOG} dangerousMod: wrote ${manifestPath}`);
      }

      return cfg;
    },
  ]);
}

function withAndroidFirebaseMessagingManifestFix(config) {
  console.log(`${LOG} registering Manifest merger fix (xml mod + file rewrite)`);
  config = patchManifestObject(config);
  config = patchManifestFile(config);
  return config;
}

// Do NOT wrap in createRunOncePlugin — EAS evaluates app.config many times;
// run-once can drop the real prebuild mod registration.
module.exports = withAndroidFirebaseMessagingManifestFix;
