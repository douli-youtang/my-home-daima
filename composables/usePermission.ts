import { MENU_ROUTE_PERMISSION } from "~/shared/permissions";

export function usePermission() {
  const { getAdminSession, getStoredSession } = useSession();

  const permissions = computed(() => {
    const admin = getAdminSession();
    if (admin?.permissions?.length) return admin.permissions;
    return getStoredSession()?.permissions || [];
  });

  const roleCode = computed(
    () =>
      getAdminSession()?.roleCode ||
      getAdminSession()?.role ||
      getStoredSession()?.role ||
      ""
  );

  const can = (key: string | string[]) => {
    if (roleCode.value === "admin") return true;
    const keys = Array.isArray(key) ? key : [key];
    const perms = permissions.value;
    return keys.some((k) => perms.includes(k));
  };

  const canMenu = (path: string) => {
    if (roleCode.value === "admin") return true;
    // longest prefix match
    const entries = Object.entries(MENU_ROUTE_PERMISSION).sort(
      (a, b) => b[0].length - a[0].length
    );
    for (const [route, perm] of entries) {
      if (path === route || path.startsWith(route + "/")) {
        // docs children need child perm OR parent docs
        if (perm.startsWith("menu:docs.")) {
          return can([perm, "menu:docs"]);
        }
        return can(perm);
      }
    }
    return can("menu:dashboard");
  };

  return { permissions, roleCode, can, canMenu };
}
