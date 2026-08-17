export default defineNuxtRouteMiddleware((to) => {
  if (!import.meta.client) return;
  const { getAdminSession } = useSession();
  const { canMenu, roleCode } = usePermission();
  const session = getAdminSession();
  if (!session?.openid) {
    return navigateTo("/login");
  }
  // worker 无后台
  if (roleCode.value === "worker") {
    return navigateTo("/worker");
  }
  // 路由菜单权限
  if (to.path.startsWith("/admin") && to.path !== "/admin") {
    if (!canMenu(to.path)) {
      // 尝试落到有权限的首页
      if (canMenu("/admin/dashboard")) {
        return navigateTo("/admin/dashboard");
      }
      return navigateTo("/login");
    }
  }
});
