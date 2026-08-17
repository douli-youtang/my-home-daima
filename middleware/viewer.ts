export default defineNuxtRouteMiddleware(() => {
  if (!import.meta.client) return;
  const { getStoredSession, isAdminRole } = useSession();
  const session = getStoredSession();
  if (!session?.openid || !isAdminRole(session.role)) {
    return navigateTo("/login");
  }
});
