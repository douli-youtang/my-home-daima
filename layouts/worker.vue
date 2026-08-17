<template>
  <div class="worker-shell">
    <header class="worker-top">
      <div class="brand">
        <span class="mark" />
        <span>{{ title }}</span>
      </div>
      <div class="actions">
        <slot name="actions" />
        <el-button v-if="props.showLogout" text type="primary" @click="logout">退出</el-button>
      </div>
    </header>
    <main class="worker-main">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{ title?: string; showLogout?: boolean }>(),
  { title: "", showLogout: true }
);

const route = useRoute();
const router = useRouter();
const { clearLoginSession, isAdminRole, getStoredSession } = useSession();

const title = computed(
  () =>
    props.title ||
    (route.meta.title as string) ||
    "扫码填表"
);

function logout() {
  const session = getStoredSession();
  const admin = session && isAdminRole(session.role);
  clearLoginSession();
  router.replace(admin ? "/login" : "/worker/login");
}
</script>

<style scoped>
.worker-shell {
  min-height: 100vh;
  background:
    radial-gradient(800px 400px at 50% -20%, rgba(255, 105, 0, 0.12), transparent 60%),
    var(--mi-bg);
}
.worker-top {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 52px;
  padding: 0 16px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
}
.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 650;
}
.mark {
  width: 18px;
  height: 18px;
  border-radius: 6px;
  background: linear-gradient(135deg, #ff8533, #ff6900);
}
.worker-main {
  max-width: 720px;
  margin: 0 auto;
  padding: 16px;
}
.actions {
  display: flex;
  align-items: center;
  gap: 4px;
}
</style>
