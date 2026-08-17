export const ADMIN_SESSION_KEY = "qrcode_admin_session";
export const SESSION_OPENID_KEY = "qrcode_openid";
export const SESSION_ROLE_KEY = "qrcode_role";
export const SESSION_NAME_KEY = "qrcode_name";
export const SESSION_MUST_CHANGE_PASSWORD_KEY = "qrcode_must_change_password";
export const SESSION_PERMISSIONS_KEY = "qrcode_permissions";
export const SESSION_ROLE_ID_KEY = "qrcode_role_id";
export const SESSION_ROLE_NAME_KEY = "qrcode_role_name";
export const DEFAULT_SCENE = "qr_test_001";

export type UserRole = string;

export type AppSession = {
  openid: string;
  role: UserRole;
  roleId?: string;
  roleCode?: string;
  roleName?: string;
  name: string;
  permissions?: string[];
  mustChangePassword?: boolean;
};

export type AdminSession = {
  openid: string;
  name: string;
  role: string;
  roleId?: string;
  roleCode?: string;
  roleName?: string;
  permissions?: string[];
};

export function isAdminRole(role: string | null | undefined): boolean {
  return role === "admin" || role === "maintainer";
}

export function useSession() {
  const getStoredSession = (): AppSession | null => {
    if (!import.meta.client) return null;
    const openid = localStorage.getItem(SESSION_OPENID_KEY) || "";
    const role = localStorage.getItem(SESSION_ROLE_KEY) || "";
    const name = localStorage.getItem(SESSION_NAME_KEY) || "";
    if (!openid || !role) return null;
    const mustChangePassword =
      localStorage.getItem(SESSION_MUST_CHANGE_PASSWORD_KEY) === "1";
    let permissions: string[] = [];
    try {
      permissions = JSON.parse(
        localStorage.getItem(SESSION_PERMISSIONS_KEY) || "[]"
      );
    } catch {
      permissions = [];
    }
    return {
      openid,
      role,
      roleCode: role,
      roleId: localStorage.getItem(SESSION_ROLE_ID_KEY) || undefined,
      roleName: localStorage.getItem(SESSION_ROLE_NAME_KEY) || undefined,
      name,
      permissions,
      mustChangePassword,
    };
  };

  const getAdminSession = (): AdminSession | null => {
    if (!import.meta.client) return null;
    try {
      const raw = localStorage.getItem(ADMIN_SESSION_KEY);
      if (!raw) {
        // fallback from app session
        const app = getStoredSession();
        if (!app) return null;
        const perms = app.permissions || [];
        const canAdmin =
          app.role === "admin" ||
          app.role === "maintainer" ||
          perms.some((p) => p.startsWith("menu:"));
        if (!canAdmin) return null;
        return {
          openid: app.openid,
          name: app.name,
          role: app.role,
          roleId: app.roleId,
          roleCode: app.roleCode || app.role,
          roleName: app.roleName,
          permissions: perms,
        };
      }
      const data = JSON.parse(raw) as AdminSession;
      if (!data?.openid) return null;
      return {
        ...data,
        roleCode: data.roleCode || data.role,
        permissions: data.permissions || [],
      };
    } catch {
      return null;
    }
  };

  const saveLoginSession = (session: AppSession) => {
    localStorage.setItem(SESSION_OPENID_KEY, session.openid);
    localStorage.setItem(SESSION_ROLE_KEY, session.role);
    localStorage.setItem(SESSION_NAME_KEY, session.name);
    localStorage.setItem(
      SESSION_MUST_CHANGE_PASSWORD_KEY,
      session.mustChangePassword ? "1" : "0"
    );
    localStorage.setItem(
      SESSION_PERMISSIONS_KEY,
      JSON.stringify(session.permissions || [])
    );
    if (session.roleId) {
      localStorage.setItem(SESSION_ROLE_ID_KEY, session.roleId);
    }
    if (session.roleName) {
      localStorage.setItem(SESSION_ROLE_NAME_KEY, session.roleName);
    }

    const perms = session.permissions || [];
    const canAdmin =
      session.role === "admin" ||
      session.role === "maintainer" ||
      perms.some((p) => p.startsWith("menu:"));

    if (canAdmin) {
      localStorage.setItem(
        ADMIN_SESSION_KEY,
        JSON.stringify({
          openid: session.openid,
          name: session.name,
          role: session.role,
          roleId: session.roleId,
          roleCode: session.roleCode || session.role,
          roleName: session.roleName,
          permissions: perms,
        } satisfies AdminSession)
      );
    } else {
      localStorage.removeItem(ADMIN_SESSION_KEY);
    }
  };

  const setMustChangePasswordFlag = (value: boolean) => {
    localStorage.setItem(SESSION_MUST_CHANGE_PASSWORD_KEY, value ? "1" : "0");
  };

  const clearLoginSession = () => {
    localStorage.removeItem(SESSION_OPENID_KEY);
    localStorage.removeItem(SESSION_ROLE_KEY);
    localStorage.removeItem(SESSION_NAME_KEY);
    localStorage.removeItem(SESSION_MUST_CHANGE_PASSWORD_KEY);
    localStorage.removeItem(SESSION_PERMISSIONS_KEY);
    localStorage.removeItem(SESSION_ROLE_ID_KEY);
    localStorage.removeItem(SESSION_ROLE_NAME_KEY);
    localStorage.removeItem(ADMIN_SESSION_KEY);
  };

  const getPostLoginPath = (
    role: string,
    openid: string,
    scene?: string | null,
    permissions?: string[]
  ) => {
    const perms = permissions || [];
    const canAdmin =
      role === "admin" ||
      role === "maintainer" ||
      perms.some((p) => p.startsWith("menu:"));

    if (scene) {
      if (canAdmin) {
        return `/viewer?point=${encodeURIComponent(scene.trim())}`;
      }
      return `/scan?scene=${encodeURIComponent(scene)}`;
    }
    if (canAdmin) return "/admin/dashboard";
    if (role === "worker") return "/worker";
    return `/?scene=${encodeURIComponent(DEFAULT_SCENE)}&openid=${encodeURIComponent(openid)}`;
  };

  return {
    getStoredSession,
    getAdminSession,
    saveLoginSession,
    setMustChangePasswordFlag,
    clearLoginSession,
    getPostLoginPath,
    isAdminRole,
  };
}
