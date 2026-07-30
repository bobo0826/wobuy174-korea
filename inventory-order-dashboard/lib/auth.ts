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
};

export const ACCESS_TOKEN_COOKIE = "wobuy174_access_token";
export const REFRESH_TOKEN_COOKIE = "wobuy174_refresh_token";

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

async function getOrCreateProfile(user: User): Promise<AuthProfile | null> {
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

export async function getAuthContext(request: NextRequest): Promise<AuthContext | null> {
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
  return profile ? { profile, session } : null;
}

export function setSessionCookies(response: NextResponse, session: Session) {
  response.cookies.set(ACCESS_TOKEN_COOKIE, session.access_token, cookieOptions);
  response.cookies.set(REFRESH_TOKEN_COOKIE, session.refresh_token, cookieOptions);
}

export function clearSessionCookies(response: NextResponse) {
  response.cookies.set(ACCESS_TOKEN_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  response.cookies.set(REFRESH_TOKEN_COOKIE, "", { ...cookieOptions, maxAge: 0 });
}

export async function requireAdmin(request: NextRequest) {
  const context = await getAuthContext(request);
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
  if (context?.session) setSessionCookies(response, context.session);
  return response;
}
