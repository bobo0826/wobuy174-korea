import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { Session, User } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase";

export type UserRole = "admin" | "staff";

export type AuthProfile = {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
};

type AuthContext = {
  profile: AuthProfile;
  session?: Session;
  accessExpiresAt?: number;
};

type CachedAuthContext = {
  profile: AuthProfile;
  expiresAt: number;
  accessExpiresAt: number;
};

export const ACCESS_TOKEN_COOKIE = "wobuy174_access_token";
export const REFRESH_TOKEN_COOKIE = "wobuy174_refresh_token";
export const AUTH_CONTEXT_COOKIE = "wobuy174_user_context";

const AUTH_CONTEXT_TTL_MS = 5 * 60 * 1000;
const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 7,
};

function normaliseRole(role: unknown): UserRole {
  return role === "admin" ? "admin" : "staff";
}

function authSigningSecret() {
  return process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
}

function signAuthContext(value: string) {
  return createHmac("sha256", authSigningSecret()).update(value).digest("base64url");
}

function accessTokenExpiresAt(accessToken: string) {
  try {
    const encoded = accessToken.split(".")[1];
    if (!encoded) return undefined;
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as { exp?: unknown };
    const expiresAt = Number(payload.exp);
    return Number.isFinite(expiresAt) && expiresAt > 0 ? expiresAt * 1000 : undefined;
  } catch {
    return undefined;
  }
}

function validProfile(value: unknown): value is AuthProfile {
  if (!value || typeof value !== "object") return false;
  const profile = value as Partial<AuthProfile>;
  return typeof profile.id === "string"
    && typeof profile.email === "string"
    && typeof profile.displayName === "string"
    && (profile.role === "admin" || profile.role === "staff");
}

function getCachedAuthContext(request: NextRequest): AuthContext | null {
  const signed = request.cookies.get(AUTH_CONTEXT_COOKIE)?.value;
  if (!signed || !authSigningSecret()) return null;
  const [encoded, signature, ...remainder] = signed.split(".");
  if (!encoded || !signature || remainder.length) return null;

  const expected = Buffer.from(signAuthContext(encoded), "base64url");
  const received = Buffer.from(signature, "base64url");
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

  try {
    const cached = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Partial<CachedAuthContext>;
    const now = Date.now();
    if (!validProfile(cached.profile) || !Number.isFinite(cached.expiresAt) || !Number.isFinite(cached.accessExpiresAt)) return null;
    if ((cached.expiresAt ?? 0) <= now || (cached.accessExpiresAt ?? 0) <= now) return null;
    return { profile: cached.profile, accessExpiresAt: cached.accessExpiresAt };
  } catch {
    return null;
  }
}

function setAuthContextCookie(response: NextResponse, profile: AuthProfile, accessExpiresAt?: number) {
  const now = Date.now();
  const sessionExpiresAt = accessExpiresAt && accessExpiresAt > now ? accessExpiresAt : now + AUTH_CONTEXT_TTL_MS;
  const expiresAt = Math.min(sessionExpiresAt, now + AUTH_CONTEXT_TTL_MS);
  const payload: CachedAuthContext = { profile, expiresAt, accessExpiresAt: sessionExpiresAt };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  response.cookies.set(AUTH_CONTEXT_COOKIE, `${encoded}.${signAuthContext(encoded)}`, {
    ...cookieOptions,
    maxAge: Math.max(1, Math.ceil((expiresAt - now) / 1000)),
  });
}

export async function getOrCreateProfile(user: User): Promise<AuthProfile | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, email, display_name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;

  if (data) {
    return {
      id: data.id,
      email: data.email,
      displayName: data.display_name || user.email?.split("@")[0] || "使用者",
      role: normaliseRole(data.role),
    };
  }

  const displayName = typeof user.user_metadata?.display_name === "string"
    ? user.user_metadata.display_name
    : user.email?.split("@")[0] || "使用者";
  const { data: created, error: createError } = await supabase
    .from("user_profiles")
    .upsert({ id: user.id, email: user.email ?? "", display_name: displayName, role: "staff" })
    .select("id, email, display_name, role")
    .single();

  if (createError) throw createError;
  return {
    id: created.id,
    email: created.email,
    displayName: created.display_name || displayName,
    role: normaliseRole(created.role),
  };
}

export async function getAuthContext(request: NextRequest, options: { forceRemote?: boolean } = {}): Promise<AuthContext | null> {
  if (!options.forceRemote) {
    const cached = getCachedAuthContext(request);
    if (cached) return cached;
  }

  const supabase = getSupabaseAdmin();
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  let user: User | null = null;
  let session: Session | undefined;

  if (accessToken) {
    const { data } = await supabase.auth.getUser(accessToken);
    user = data.user;
  }

  if (!user && refreshToken) {
    const { data } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
    user = data.user;
    session = data.session ?? undefined;
  }

  if (!user) return null;
  const profile = await getOrCreateProfile(user);
  const expiresAt = session?.expires_at ? session.expires_at * 1000 : accessToken ? accessTokenExpiresAt(accessToken) : undefined;
  return profile ? { profile, session, accessExpiresAt: expiresAt } : null;
}

export function setSessionCookies(response: NextResponse, session: Session, profile?: AuthProfile) {
  response.cookies.set(ACCESS_TOKEN_COOKIE, session.access_token, cookieOptions);
  response.cookies.set(REFRESH_TOKEN_COOKIE, session.refresh_token, cookieOptions);
  if (profile) setAuthContextCookie(response, profile, session.expires_at ? session.expires_at * 1000 : accessTokenExpiresAt(session.access_token));
}

export function clearSessionCookies(response: NextResponse) {
  response.cookies.set(ACCESS_TOKEN_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  response.cookies.set(REFRESH_TOKEN_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  response.cookies.set(AUTH_CONTEXT_COOKIE, "", { ...cookieOptions, maxAge: 0 });
}

export async function requireAdmin(request: NextRequest) {
  const context = await getAuthContext(request, { forceRemote: true });
  if (!context) return { context: null, response: NextResponse.json({ message: "請先登入。" }, { status: 401 }) };
  if (context.profile.role !== "admin") return { context: null, response: NextResponse.json({ message: "僅限系統管理員操作。" }, { status: 403 }) };
  return { context, response: null };
}

export async function requireSignedIn(request: NextRequest) {
  const context = await getAuthContext(request);
  if (!context) return { context: null, response: NextResponse.json({ message: "請先登入。" }, { status: 401 }) };
  return { context, response: null };
}

export function withRefreshedSession(response: NextResponse, context: AuthContext | null) {
  if (context?.session) setSessionCookies(response, context.session, context.profile);
  else if (context) setAuthContextCookie(response, context.profile, context.accessExpiresAt);
  return response;
}
