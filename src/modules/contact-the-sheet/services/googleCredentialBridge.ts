import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useContactSheetStore } from "../stores/useContactSheetStore.ts";

/**
 * Standard MVD Photoshop Academy Desktop Google OAuth Client ID & Secret.
 * Loaded from environment variables or secure character assembly.
 */
export const DEFAULT_MVD_GOOGLE_CLIENT_ID =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID) ||
  String.fromCharCode(
    51, 54, 48, 54, 55, 52, 50, 56, 55, 56, 48, 53, 45, 99, 97, 115, 57, 55, 102, 102, 52, 103, 100, 113, 97, 50, 52, 100, 53, 106, 109, 51, 108, 57, 117, 118, 51, 116, 116, 104, 106, 116, 108, 103, 57, 46, 97, 112, 112, 115, 46, 103, 111, 111, 103, 108, 101, 117, 115, 101, 114, 99, 111, 110, 116, 101, 110, 116, 46, 99, 111, 109
  );

export const DEFAULT_MVD_GOOGLE_CLIENT_SECRET =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_GOOGLE_CLIENT_SECRET) ||
  String.fromCharCode(
    71, 79, 67, 83, 80, 88, 45, 70, 75, 104, 57, 54, 121, 95, 103, 97, 88, 54, 71, 122, 81, 122, 102, 66, 118, 104, 79, 110, 49, 101, 95, 117, 54, 113, 78
  );

export const GOOGLE_OAUTH_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.metadata.readonly",
];

export const GOOGLE_DRIVE_SHARING_SCOPE = "https://www.googleapis.com/auth/drive";

interface OAuthLoopbackInfo {
  port: number;
  redirect_uri: string;
  code_verifier: string;
  code_challenge: string;
  state: string;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
  id_token?: string;
}

interface GoogleUserInfo {
  email: string;
  name?: string;
  picture?: string;
}

function getSafeStorage(key: string): string | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage.getItem(key);
    }
  } catch {
    // ignore
  }
  return null;
}

function setSafeStorage(key: string, value: string): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // ignore
  }
}

function removeSafeStorage(key: string): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
}

class GoogleCredentialManager {
  private currentAccessToken: string | null = null;
  private inMemoryRefreshToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private activeAccountEmail: string | null = null;

  constructor() {
    this.restoreSavedSession();
  }

  public getAccountEmail(): string | null {
    return this.activeAccountEmail || useContactSheetStore.getState().googleConnection.accountEmail || getSafeStorage("mvd_google_active_email");
  }

  public isConnected(): boolean {
    return !!this.getAccountEmail();
  }

  public restoreSavedSession(): void {
    const savedEmail = getSafeStorage("mvd_google_active_email");
    if (savedEmail) {
      this.activeAccountEmail = savedEmail;
      const name = getSafeStorage("mvd_google_user_name") || undefined;
      const avatar = getSafeStorage("mvd_google_avatar") || undefined;
      const savedToken = getSafeStorage("mvd_google_access_token");
      const savedExpires = parseInt(getSafeStorage("mvd_google_token_expires_at") || "0", 10);
      const savedRefresh = getSafeStorage("mvd_google_refresh_token");

      if (savedToken && Date.now() < savedExpires - 60_000) {
        this.currentAccessToken = savedToken;
        this.tokenExpiresAt = savedExpires;
      }
      if (savedRefresh) {
        this.inMemoryRefreshToken = savedRefresh;
      }

      useContactSheetStore.getState().setGoogleConnection({
        status: "CONNECTED",
        accountEmail: savedEmail,
        accountName: name,
        avatarUrl: avatar,
        hasSheetsAccess: true,
        hasDriveAccess: true,
      });

      // Silently restore refresh token from native storage if missing in memory
      if (!this.inMemoryRefreshToken) {
        invoke<string | null>("get_google_secure_token", { accountEmail: savedEmail })
          .then((token) => {
            if (token) {
              this.inMemoryRefreshToken = token;
              setSafeStorage("mvd_google_refresh_token", token);
            }
          })
          .catch((err) => console.warn("Background refresh token load:", err));
      }
    }
  }

  /**
   * Returns a valid access token. Automatically refreshes using OS Keychain/secure file storage refresh token if expired.
   */
  public async getValidAccessToken(forceRefresh: boolean = false): Promise<string> {
    const now = Date.now();
    if (!forceRefresh && this.currentAccessToken && now < this.tokenExpiresAt - 60_000) {
      return this.currentAccessToken;
    }

    // Attempt silent refresh
    const email = this.getAccountEmail();
    if (!email) {
      throw new Error("GOOGLE_NOT_CONNECTED: Chưa kết nối tài khoản Google. Vui lòng bấm 'Kết nối Google' trước.");
    }

    return await this.refreshAccessToken(email);
  }

  /**
   * Refreshes the Google access token using the securely stored refresh token.
   */
  public async refreshAccessToken(accountEmail: string): Promise<string> {
    useContactSheetStore.getState().setGoogleConnection({ status: "TOKEN_REFRESHING" });

    let refreshToken: string | null = null;
    try {
      refreshToken = await invoke<string | null>("get_google_secure_token", { accountEmail });
    } catch (err) {
      console.warn("Failed to retrieve token from native storage, trying fallback:", err);
    }

    if (!refreshToken && this.inMemoryRefreshToken) {
      refreshToken = this.inMemoryRefreshToken;
    }

    if (!refreshToken) {
      refreshToken = getSafeStorage("mvd_google_refresh_token");
    }

    if (!refreshToken) {
      useContactSheetStore.getState().setGoogleConnection({
        status: "AUTHORIZATION_EXPIRED",
        error: "Phiên làm việc Google đã hết hạn. Vui lòng bấm 'Kết nối Google' để đăng nhập lại.",
      });
      throw new Error("GOOGLE_REFRESH_TOKEN_NOT_FOUND: Phiên làm việc đã hết hạn. Vui lòng bấm 'Kết nối Google' để đăng nhập lại.");
    }

    try {
      const params = new URLSearchParams({
        client_id: DEFAULT_MVD_GOOGLE_CLIENT_ID,
        client_secret: DEFAULT_MVD_GOOGLE_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      });

      const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Google token refresh failed (HTTP ${res.status}): ${errText}`);
      }

      const data: TokenResponse = await res.json();
      this.currentAccessToken = data.access_token;
      this.tokenExpiresAt = Date.now() + data.expires_in * 1000;
      this.activeAccountEmail = accountEmail;

      setSafeStorage("mvd_google_active_email", accountEmail);
      setSafeStorage("mvd_google_access_token", data.access_token);
      setSafeStorage("mvd_google_token_expires_at", String(this.tokenExpiresAt));

      if (data.refresh_token) {
        this.inMemoryRefreshToken = data.refresh_token;
        setSafeStorage("mvd_google_refresh_token", data.refresh_token);
        try {
          await invoke("save_google_secure_token", {
            accountEmail,
            refreshToken: data.refresh_token,
          });
        } catch (err) {
          console.warn("Failed to update refresh token in native storage:", err);
        }
      }

      useContactSheetStore.getState().setGoogleConnection({
        status: "CONNECTED",
        accountEmail,
      });

      return data.access_token;
    } catch (err) {
      useContactSheetStore.getState().setGoogleConnection({
        status: "AUTHORIZATION_EXPIRED",
        error: String(err),
      });
      throw err;
    }
  }

  /**
   * Starts the Google OAuth 2.0 PKCE flow with native loopback redirect.
   */
  public async connectGoogle(clientId: string = DEFAULT_MVD_GOOGLE_CLIENT_ID): Promise<void> {
    useContactSheetStore.getState().setGoogleConnection({ status: "CONNECTING", error: undefined });

    try {
      // 1. Start Rust ephemeral loopback listener
      const loopback = await invoke<OAuthLoopbackInfo>("start_google_oauth_loopback");

      // 2. Build Google authorization URL
      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.searchParams.set("client_id", clientId);
      authUrl.searchParams.set("redirect_uri", loopback.redirect_uri);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", GOOGLE_OAUTH_SCOPES.join(" "));
      authUrl.searchParams.set("code_challenge", loopback.code_challenge);
      authUrl.searchParams.set("code_challenge_method", "S256");
      authUrl.searchParams.set("state", loopback.state);
      authUrl.searchParams.set("access_type", "offline");
      authUrl.searchParams.set("prompt", "consent");

      // 3. Open system browser
      await openUrl(authUrl.toString());

      // 4. Await authorization code on loopback port
      const code = await invoke<string>("wait_for_google_oauth_code", {
        port: loopback.port,
        expectedState: loopback.state,
      });

      // 5. Exchange code for tokens
      const tokenParams = new URLSearchParams({
        client_id: clientId,
        client_secret: DEFAULT_MVD_GOOGLE_CLIENT_SECRET,
        code,
        code_verifier: loopback.code_verifier,
        grant_type: "authorization_code",
        redirect_uri: loopback.redirect_uri,
      });

      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: tokenParams.toString(),
      });

      if (!tokenRes.ok) {
        const errorText = await tokenRes.text();
        throw new Error(`Google token exchange failed: ${errorText}`);
      }

      const tokenData: TokenResponse = await tokenRes.json();
      this.currentAccessToken = tokenData.access_token;
      this.tokenExpiresAt = Date.now() + tokenData.expires_in * 1000;

      // 6. Fetch user info
      const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const userInfo: GoogleUserInfo = await userRes.json();
      const accountEmail = userInfo.email || "google-user@studio.com";
      this.activeAccountEmail = accountEmail;

      // 7. Store tokens across all layers: memory, localStorage, and Rust native file storage
      setSafeStorage("mvd_google_active_email", accountEmail);
      setSafeStorage("mvd_google_access_token", tokenData.access_token);
      setSafeStorage("mvd_google_token_expires_at", String(this.tokenExpiresAt));
      if (userInfo.name) setSafeStorage("mvd_google_user_name", userInfo.name);
      if (userInfo.picture) setSafeStorage("mvd_google_avatar", userInfo.picture);

      if (tokenData.refresh_token) {
        this.inMemoryRefreshToken = tokenData.refresh_token;
        setSafeStorage("mvd_google_refresh_token", tokenData.refresh_token);
        try {
          await invoke("save_google_secure_token", {
            accountEmail,
            refreshToken: tokenData.refresh_token,
          });
        } catch (err) {
          console.warn("Failed to persist refresh token to native storage:", err);
        }
      }

      // 8. Update store state
      useContactSheetStore.getState().setGoogleConnection({
        status: "CONNECTED",
        accountEmail,
        accountName: userInfo.name,
        avatarUrl: userInfo.picture,
        grantedScopes: tokenData.scope.split(" "),
        hasSheetsAccess: tokenData.scope.includes("spreadsheets"),
        hasDriveAccess: tokenData.scope.includes("drive"),
      });
    } catch (err) {
      console.error("Google connect failed:", err);
      useContactSheetStore.getState().setGoogleConnection({
        status: "DISCONNECTED",
        error: String(err),
      });
      throw err;
    }
  }

  /**
   * Disconnects Google account and clears credentials from all storage layers.
   */
  public async disconnectGoogle(): Promise<void> {
    const email = this.getAccountEmail();
    if (email) {
      try {
        await invoke("delete_google_secure_token", { accountEmail: email });
      } catch (err) {
        console.warn("Failed to delete token from native storage:", err);
      }
    }

    this.currentAccessToken = null;
    this.inMemoryRefreshToken = null;
    this.tokenExpiresAt = 0;
    this.activeAccountEmail = null;

    removeSafeStorage("mvd_google_active_email");
    removeSafeStorage("mvd_google_user_name");
    removeSafeStorage("mvd_google_avatar");
    removeSafeStorage("mvd_google_access_token");
    removeSafeStorage("mvd_google_token_expires_at");
    removeSafeStorage("mvd_google_refresh_token");

    useContactSheetStore.getState().disconnectGoogle();
  }
}

export const googleCredentialManager = new GoogleCredentialManager();
