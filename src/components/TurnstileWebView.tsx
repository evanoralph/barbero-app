import { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { logger } from "@/src/utils/logger";

type TurnstileMessage =
  | { type: "token"; token: string }
  | { type: "expire" }
  | { type: "error"; message?: string }
  | { type: "ready" };

type TurnstileWebViewProps = {
  siteKey: string;
  onToken: (token: string | null) => void;
  theme?: "light" | "dark";
};

function buildHtml(siteKey: string, theme: "light" | "dark"): string {
  const safeKey = siteKey.replace(/"/g, "");
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" async defer></script>
  <style>
    html, body { margin: 0; padding: 0; background: transparent; }
    #cf-turnstile { display: flex; justify-content: center; padding: 4px 0; }
  </style>
</head>
<body>
  <div id="cf-turnstile"></div>
  <script>
    function post(payload) {
      window.ReactNativeWebView.postMessage(JSON.stringify(payload));
    }
    function renderWidget() {
      if (!window.turnstile) return;
      window.turnstile.render("#cf-turnstile", {
        sitekey: "${safeKey}",
        theme: "${theme}",
        size: "normal",
        appearance: "always",
        callback: function (token) { post({ type: "token", token: token }); },
        "expired-callback": function () { post({ type: "expire" }); },
        "error-callback": function () { post({ type: "error", message: "widget_error" }); }
      });
      post({ type: "ready" });
    }
    var tries = 0;
    function waitForApi() {
      if (window.turnstile) {
        renderWidget();
        return;
      }
      tries += 1;
      if (tries > 40) {
        post({ type: "error", message: "api_timeout" });
        return;
      }
      setTimeout(waitForApi, 100);
    }
    waitForApi();
  </script>
</body>
</html>`;
}

/** Resolves Turnstile site key from env or public config. */
export function resolveMobileTurnstileSiteKey(fromConfig?: string | null): string | null {
  const fromEnv = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY?.trim() || null;
  const key = (fromConfig?.trim() || fromEnv) || null;
  logger.info("turnstile", "resolve site key", {
    fromConfig: Boolean(fromConfig),
    fromEnv: Boolean(fromEnv),
  });
  return key;
}

export function TurnstileWebView({
  siteKey,
  onToken,
  theme = "light",
}: TurnstileWebViewProps) {
  const [height, setHeight] = useState(80);
  const html = useMemo(() => buildHtml(siteKey, theme), [siteKey, theme]);

  const onMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data) as TurnstileMessage;
        if (data.type === "token") {
          logger.info("turnstile", "token received");
          onToken(data.token);
          setHeight(80);
        } else if (data.type === "expire") {
          logger.info("turnstile", "token expired");
          onToken(null);
        } else if (data.type === "error") {
          logger.warn("turnstile", "widget error", data.message);
          onToken(null);
        } else if (data.type === "ready") {
          logger.info("turnstile", "widget ready (appearance=always)");
          setHeight(80);
        }
      } catch (error) {
        logger.warn("turnstile", "bad message", error);
      }
    },
    [onToken],
  );

  if (!siteKey) return null;

  return (
    <View style={[styles.wrap, { height }]}>
      <WebView
        originWhitelist={["*"]}
        source={{ html, baseUrl: "https://challenges.cloudflare.com" }}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
        scrollEnabled={false}
        style={styles.webview}
        setSupportMultipleWindows={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    overflow: "hidden",
    marginVertical: 4,
  },
  webview: {
    backgroundColor: "transparent",
    flex: 1,
  },
});
