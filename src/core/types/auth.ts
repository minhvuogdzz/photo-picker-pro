/** Auth session stored locally and synced with server */
export interface AuthSession {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly userId: string;
  readonly email: string;
  readonly name: string;
  readonly subscription: SubscriptionInfo;
  readonly deviceId: string;
  readonly lastSyncAt: string;
}

/** Subscription details */
export interface SubscriptionInfo {
  readonly status: SubscriptionStatus;
  readonly plan: SubscriptionPlan;
  readonly isPremium?: boolean;
  readonly expiresAt: string | null;
  readonly daysRemaining: number | null;
}


/** Possible subscription states */
export type SubscriptionStatus =
  | "INACTIVE"
  | "TRIAL"
  | "ACTIVE"
  | "EXPIRED"
  | "SUSPENDED"
  | "CANCELLED"
  | "LIFETIME";

/** Available subscription plans */
export type SubscriptionPlan = "STARTER" | "PROFESSIONAL" | "STUDIO" | "LIFETIME";

/** Login request payload */
export interface LoginRequest {
  readonly email: string;
  readonly password: string;
  readonly deviceFingerprint: string;
  readonly force?: boolean;
}

/** Login response from server */
export interface LoginResponse {
  readonly session: AuthSession;
}

/** Password reset request */
export interface PasswordResetRequest {
  readonly email: string;
}

/** Verification code submission */
export interface VerifyCodeRequest {
  readonly email: string;
  readonly code: string;
}

/** New password submission */
export interface ResetPasswordRequest {
  readonly email: string;
  readonly code: string;
  readonly newPassword: string;
}

/** Local session format matching Rust struct */
export interface LocalSession {
  readonly access_token: string;
  readonly refresh_token: string;
  readonly user_id: string;
  readonly email: string;
  readonly name: string;
  readonly subscription_status: string;
  readonly subscription_plan: string;
  readonly expires_at: string | null;
  readonly device_id: string;
  readonly last_sync_at: string;
}
