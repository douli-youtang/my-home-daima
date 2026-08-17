import {
  isAdminRole,
  setAdminSession,
  clearAdminSession,
} from "@/lib/admin-auth";
import type { UserRole } from "@/lib/types";

export const DEFAULT_SCENE = "qr_test_001";

export const SESSION_OPENID_KEY = "qrcode_openid";
export const SESSION_ROLE_KEY = "qrcode_role";
export const SESSION_NAME_KEY = "qrcode_name";
export const SESSION_MUST_CHANGE_PASSWORD_KEY = "qrcode_must_change_password";

export type AppSession = {
  openid: string;
  role: UserRole;
  name: string;
  mustChangePassword?: boolean;
};

export function getStoredOpenid(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(SESSION_OPENID_KEY) || "";
}

export function getStoredSession(): AppSession | null {
  if (typeof window === "undefined") return null;
  const openid = localStorage.getItem(SESSION_OPENID_KEY) || "";
  const role = (localStorage.getItem(SESSION_ROLE_KEY) || "") as UserRole;
  const name = localStorage.getItem(SESSION_NAME_KEY) || "";
  if (!openid || !role) return null;
  const mustChangePassword =
    localStorage.getItem(SESSION_MUST_CHANGE_PASSWORD_KEY) === "1";
  return { openid, role, name, mustChangePassword };
}

/** 登录成功后写入会话（兼容后台 AdminShell 鉴权） */
export function saveLoginSession(session: AppSession) {
  localStorage.setItem(SESSION_OPENID_KEY, session.openid);
  localStorage.setItem(SESSION_ROLE_KEY, session.role);
  localStorage.setItem(SESSION_NAME_KEY, session.name);
  localStorage.setItem(
    SESSION_MUST_CHANGE_PASSWORD_KEY,
    session.mustChangePassword ? "1" : "0"
  );

  if (isAdminRole(session.role)) {
    setAdminSession({
      openid: session.openid,
      name: session.name,
      role: session.role,
    });
  } else {
    clearAdminSession();
  }
}

export function setMustChangePasswordFlag(value: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SESSION_MUST_CHANGE_PASSWORD_KEY, value ? "1" : "0");
}

export function clearLoginSession() {
  localStorage.removeItem(SESSION_OPENID_KEY);
  localStorage.removeItem(SESSION_ROLE_KEY);
  localStorage.removeItem(SESSION_NAME_KEY);
  localStorage.removeItem(SESSION_MUST_CHANGE_PASSWORD_KEY);
  clearAdminSession();
}

/** 扫码入口：先登录，再按角色展示表单 / 历史记录 */
export function buildScanUrl(scene = DEFAULT_SCENE) {
  return `/scan?scene=${encodeURIComponent(scene)}`;
}

/** 作业人员主页（我的工单） */
export function buildWorkerHomeUrl() {
  return "/worker";
}

export function buildWorkerLoginUrl() {
  return "/worker/login";
}

export function buildWorkerSubmissionUrl(id: string) {
  return `/worker/submissions/${encodeURIComponent(id)}`;
}

export function buildWorkerScanUrl() {
  return "/worker/scan";
}

/** 管理员 / 维护员移动端：全部工单（只读） */
export function buildViewerHomeUrl(opts?: { point?: string }) {
  if (opts?.point?.trim()) {
    return `/viewer?point=${encodeURIComponent(opts.point.trim())}`;
  }
  return "/viewer";
}

export function buildViewerSubmissionUrl(id: string) {
  return `/viewer/submissions/${encodeURIComponent(id)}`;
}

export function buildHomeUrl(openid: string, scene = DEFAULT_SCENE) {
  return `/?scene=${encodeURIComponent(scene)}&openid=${encodeURIComponent(openid)}`;
}

/**
 * 登录成功后按角色跳转。
 * - 带 scene：作业人员进扫码填表；管理员/维护员进移动端全部工单
 * - 无 scene：管理员/维护员进管理后台；作业人员进我的工单（作业端登录）
 */
export function getPostLoginPath(
  role: string,
  openid: string,
  scene?: string | null
): string {
  if (scene) {
    if (role === "admin" || role === "maintainer") {
      return buildViewerHomeUrl({ point: scene });
    }
    return buildScanUrl(scene);
  }
  if (role === "admin" || role === "maintainer") return "/admin/dashboard";
  if (role === "worker") return buildWorkerHomeUrl();
  return buildHomeUrl(openid);
}
