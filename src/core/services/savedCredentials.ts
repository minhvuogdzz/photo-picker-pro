/**
 * "Remember password" storage backed by the OS keychain (via Rust commands).
 * Older builds kept the password in plain localStorage; it is moved over on first read.
 */

import { invoke } from "@tauri-apps/api/core";

const LEGACY_PASSWORD_KEY = "saved_login_password";

function readLegacyPassword(): string | null {
  try {
    return localStorage.getItem(LEGACY_PASSWORD_KEY);
  } catch {
    return null;
  }
}

function removeLegacyPassword(): void {
  try {
    localStorage.removeItem(LEGACY_PASSWORD_KEY);
  } catch {}
}

export async function saveLoginPassword(email: string, password: string): Promise<void> {
  if (!email || !password) return;
  await invoke("save_login_password", { email, password });
  removeLegacyPassword();
}

export async function loadLoginPassword(email: string): Promise<string> {
  if (!email) return "";

  const legacy = readLegacyPassword();
  if (legacy) {
    try {
      await saveLoginPassword(email, legacy);
    } catch {
      // Keychain unavailable: leave the legacy value in place rather than lose it
    }
    return legacy;
  }

  try {
    return (await invoke<string | null>("get_login_password", { email })) || "";
  } catch {
    return "";
  }
}

export async function forgetLoginPassword(email: string): Promise<void> {
  removeLegacyPassword();
  if (!email) return;
  await invoke("delete_login_password", { email }).catch(() => {});
}
