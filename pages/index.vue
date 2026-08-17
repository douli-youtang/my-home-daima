<template>
  <div class="mi-hero-login">
    <div class="landing mi-card">
      <div class="logo-row">
        <span class="logo" />
        <div>
          <h1>扫码填表系统</h1>
          <p>小米风格移动作业与管理入口</p>
        </div>
      </div>
      <div class="actions">
        <el-button type="primary" size="large" class="mi-press" @click="router.push('/login')">
          管理后台登录
        </el-button>
        <el-button size="large" class="mi-press" @click="router.push('/worker/login')">
          作业人员登录
        </el-button>
      </div>
      <p class="hint">扫描点位二维码可直接进入填表流程</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { DEFAULT_SCENE } from "~/composables/useSession";

definePageMeta({ layout: "blank" });

const route = useRoute();
const router = useRouter();
const { getStoredSession, getPostLoginPath, isAdminRole } = useSession();

onMounted(() => {
  const scene =
    typeof route.query.scene === "string" && route.query.scene.trim()
      ? route.query.scene.trim()
      : "";
  const openidQ =
    typeof route.query.openid === "string" && route.query.openid.trim()
      ? route.query.openid.trim()
      : "";

  if (scene) {
    router.replace(`/scan?scene=${encodeURIComponent(scene)}`);
    return;
  }

  const session = getStoredSession();
  if (session?.role === "worker") {
    router.replace(getPostLoginPath("worker", session.openid));
    return;
  }
  if (session && isAdminRole(session.role)) {
    router.replace("/admin/dashboard");
    return;
  }

  if (openidQ) {
    router.replace(
      `/scan?scene=${encodeURIComponent(DEFAULT_SCENE)}`
    );
  }
});
</script>

<style scoped>
.landing {
  width: 100%;
  max-width: 420px;
  padding: 36px 32px 28px;
}
.logo-row {
  display: flex;
  gap: 14px;
  align-items: center;
  margin-bottom: 28px;
}
.logo {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: linear-gradient(145deg, #ff8533, #ff6900);
  box-shadow: 0 10px 24px rgba(255, 105, 0, 0.35);
}
h1 {
  margin: 0;
  font-size: 1.45rem;
  letter-spacing: -0.03em;
}
p {
  margin: 4px 0 0;
  color: var(--mi-ink-3);
  font-size: 13px;
}
.actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.actions .el-button {
  width: 100%;
  height: 44px;
}
.hint {
  margin-top: 18px;
  text-align: center;
  font-size: 12px;
  color: var(--mi-ink-3);
}
</style>
