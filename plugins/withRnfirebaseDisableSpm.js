/**
 * Always inject `$RNFirebaseDisableSPM = true` into the iOS Podfile.
 *
 * RNFB packages are always dependencies; gating disableSPM on GoogleService
 * files existing caused EAS builds (gitignored credentials) to keep SPM mode
 * while CocoaPods defaulted to static linkage → "SPM + static linkage is not supported".
 */
const { withPodfile, createRunOncePlugin } = require("@expo/config-plugins");
const {
  mergeContents,
  removeGeneratedContents,
} = require("@expo/config-plugins/build/utils/generateCode");

const TAG = "beru-rnfirebase-disableSPM";
const ANCHOR = /prepare_react_native_project!/;
const FLAG = "$RNFirebaseDisableSPM = true";

function setDisableSpm(src) {
  // Remove a prior injection so re-prebuild stays idempotent.
  const cleaned = removeGeneratedContents(src, TAG) ?? src;
  return mergeContents({
    src: cleaned,
    newSrc: FLAG,
    tag: TAG,
    anchor: ANCHOR,
    offset: 1,
    comment: "#",
  }).contents;
}

const withRnfirebaseDisableSpm = (config) => {
  console.log("[withRnfirebaseDisableSpm] injecting $RNFirebaseDisableSPM = true");
  return withPodfile(config, (cfg) => {
    cfg.modResults.contents = setDisableSpm(cfg.modResults.contents);
    return cfg;
  });
};

module.exports = createRunOncePlugin(
  withRnfirebaseDisableSpm,
  "withRnfirebaseDisableSpm",
  "1.0.0",
);
