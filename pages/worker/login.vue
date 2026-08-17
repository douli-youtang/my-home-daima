<template>
  <div class="mi-hero-login">
    <div class="login-card mi-card">
      <div class="logo-row">
        <span class="logo" />
        <div>
          <h1>作业登录</h1>
          <p>扫码填表 · 作业人员入口</p>
        </div>
      </div>
      <el-form label-position="top" @submit.prevent="onSubmit">
        <el-form-item label="账号">
          <el-input
            v-model="name"
            size="large"
            placeholder="姓名或工号"
            clearable
            autocomplete="username"
          />
        </el-form-item>
        <el-form-item label="密码">
          <el-input
            v-model="password"
            size="large"
            type="password"
            show-password
            placeholder="请输入密码"
            autocomplete="current-password"
            @keyup.enter="onSubmit"
          />
        </el-form-item>
        <el-button
          type="primary"
          size="large"
          class="mi-press submit"
          :loading="loading"
          @click="onSubmit"
        >
          登录
        </el-button>
      </el-form>
      <p class="hint">也可扫描点位二维码直接进入填表</p>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: "blank" });

const name = ref("");
const password = ref("");
const loading = ref(false);
const route = useRoute();
const router = useRouter();
const { saveLoginSession, getStoredSession, getPostLoginPath, isAdminRole } =
  useSession();

const scene = computed(() => {
  const q = route.query.scene;
  return typeof q === "string" && q.trim() ? q.trim() : null;
});

onMounted(() => {
  const session = getStoredSession();
  if (!session) return;
  if (session.role === "worker") {
    router.replace(getPostLoginPath("worker", session.openid, scene.value));
    return;
  }
  if (isAdminRole(session.role)) {
    router.replace(getPostLoginPath(session.role, session.openid, scene.value));
  }
});

async function onSubmit() {
  if (!name.value.trim() || !password.value) {
    ElMessage.warning("请输入账号和密码");
    return;
  }
  loading.value = true;
  try {
    const data = await apiRequest<{
      role: string;
      name: string;
      openid: string;
      mustChangePassword?: boolean;
    }>("/api/login", {
      method: "POST",
      body: JSON.stringify({
        name: name.value.trim(),
        password: password.value,
      }),
    });
    saveLoginSession({
      openid: data.openid,
      role: data.role as any,
      name: data.name,
      mustChangePassword: data.mustChangePassword,
    });
    ElMessage.success("登录成功");
    router.replace(getPostLoginPath(data.role, data.openid, scene.value));
  } catch (e: any) {
    ElMessage.error(e?.message || "登录失败");
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-card {
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
.submit {
  width: 100%;
  margin-top: 8px;
  height: 44px;
  font-size: 15px;
}
.hint {
  margin-top: 18px;
  text-align: center;
  font-size: 12px;
  color: var(--mi-ink-3);
}
</style>
