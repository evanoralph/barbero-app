const ENABLED = typeof __DEV__ !== "undefined" ? __DEV__ : true;

type LogLevel = "debug" | "info" | "warn" | "error";

function emit(level: LogLevel, scope: string, message: string, data?: unknown) {
  if (!ENABLED && level === "debug") return;
  const prefix = `[barbero-mobile:${scope}]`;
  const args = data !== undefined ? [prefix, message, data] : [prefix, message];
  switch (level) {
    case "error":
      console.error(...args);
      break;
    case "warn":
      console.warn(...args);
      break;
    default:
      console.log(...args);
  }
}

export const logger = {
  debug: (scope: string, message: string, data?: unknown) =>
    emit("debug", scope, message, data),
  info: (scope: string, message: string, data?: unknown) =>
    emit("info", scope, message, data),
  warn: (scope: string, message: string, data?: unknown) =>
    emit("warn", scope, message, data),
  error: (scope: string, message: string, data?: unknown) =>
    emit("error", scope, message, data),
};
