import type { UserRole } from "@/lib/types";

export const ADMIN_SESSION_KEY = "qrcode_admin_session";

export type AdminSession = {
  openid: string;
  name: string;
  role: Extract<UserRole, "admin" | "maintainer">;
};

export function isAdminRole(
  role: string | null | undefined
): role is AdminSession["role"] {
  return role === "admin" || role === "maintainer";
}

export function getAdminSession(): AdminSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ADMIN_SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as AdminSession;
    if (!data?.openid || !isAdminRole(data.role)) return null;
    return data;
  } catch {
    return null;
  }
}

export function setAdminSession(session: AdminSession) {
  localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
}

export function clearAdminSession() {
  localStorage.removeItem(ADMIN_SESSION_KEY);
}

export function adminAuthHeaders(openid?: string): HeadersInit {
  const sessionOpenid = openid || getAdminSession()?.openid || "";
  return {
    "Content-Type": "application/json",
    "x-openid": sessionOpenid,
  };
}
