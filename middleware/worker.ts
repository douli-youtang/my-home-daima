export default defineNuxtRouteMiddleware(() => {
  if (!import.meta.client) return;
  const { getStoredSession } = useSession();
  const session = getStoredSession();
  if (!session?.openid || session.role !== "worker") {
    return navigateTo("/worker/login");
  }
});
