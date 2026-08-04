import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { logger } from "@/src/utils/logger";

const TOKEN_KEY = "barbero_resume_token";

async function setItem(key: string, value: string) {
  try {
    if (Platform.OS === "web") {
      await AsyncStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  } catch (error) {
    logger.warn("auth", "setItem failed — falling back to AsyncStorage", error);
    await AsyncStorage.setItem(key, value);
  }
}

async function getItem(key: string): Promise<string | null> {
  try {
    if (Platform.OS === "web") {
      return AsyncStorage.getItem(key);
    }
    return await SecureStore.getItemAsync(key);
  } catch (error) {
    logger.warn("auth", "getItem failed — falling back to AsyncStorage", error);
    return AsyncStorage.getItem(key);
  }
}

async function deleteItem(key: string) {
  try {
    if (Platform.OS === "web") {
      await AsyncStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  } catch (error) {
    logger.warn("auth", "deleteItem failed — clearing AsyncStorage fallback", error);
  }
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export async function saveToken(token: string): Promise<void> {
  await setItem(TOKEN_KEY, token);
  logger.info("auth", "token saved");
}

export async function loadToken(): Promise<string | null> {
  const token = await getItem(TOKEN_KEY);
  logger.debug("auth", "token loaded", { hasToken: Boolean(token) });
  return token;
}

export async function clearToken(): Promise<void> {
  await deleteItem(TOKEN_KEY);
  logger.info("auth", "token cleared");
}
