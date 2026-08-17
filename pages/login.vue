<template>
  <div class="mi-hero-login">
    <div class="login-card mi-card">
      <div class="logo-row">
        <span class="logo" />
        <div>
          <h1>定点作业记录系统</h1>
          <p>扫码即记 · 云端可溯</p>
        </div>
      </div>

      <el-form label-position="top" @submit.prevent="onSubmit">
        <el-form-item label="账号">
          <el-input
            ref="nameRef"
            v-model="name"
            size="large"
            name="username"
            autocomplete="username"
            placeholder="姓名或工号"
            clearable
            @keyup.enter="onSubmit"
          />
        </el-form-item>
        <el-form-item label="密码">
          <el-input
            ref="pwdRef"
            v-model="password"
            size="large"
            name="password"
            autocomplete="current-password"
            type="password"
            show-password
            placeholder="请输入密码"
            @keyup.enter="onSubmit"
          />
        </el-form-item>

        <p v-if="errorText" class="form-error">{{ errorText }}</p>

        <el-button
          native-type="submit"
          type="primary"
          size="large"
          class="mi-press submit"
          :loading="loading"
          :disabled="loading"
        >
          登录
        </el-button>
      </el-form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from "element-plus";
import { apiRequest } from "~/composables/useApi";

definePageMeta({ layout: "blank" });

const name = ref("");
const password = ref("");
const loading = ref(false);
const errorText = ref("");
const nameRef = ref<{ input?: HTMLInputElement } | null>(null);
const pwdRef = ref<{ input?: HTMLInputElement } | null>(null);
const router = useRouter();
const { saveLoginSession, getPostLoginPath } = useSession();

/** 兼容浏览器自动填充：DOM 已有值但 v-model 尚未同步 */
function syncAutofillValues() {
  const nameEl =
    (nameRef.value as any)?.input ||
    (nameRef.value as any)?.$el?.querySelector?.("input");
  const pwdEl =
    (pwdRef.value as any)?.input ||
    (pwdRef.value as any)?.$el?.querySelector?.("input");
  if (nameEl?.value && !name.value) name.value = nameEl.value;
  if (pwdEl?.value && !password.value) password.value = pwdEl.value;
}

async function onSubmit() {
  errorText.value = "";
  syncAutofillValues();

  const account = name.value.trim();
  const pwd = password.value;

  if (!account || !pwd) {
    errorText.value = "请输入账号和密码";
    ElMessage.warning(errorText.value);
    return;
  }

  loading.value = true;
  try {
    const data = await apiRequest<{
      role: string;
      roleId?: string;
      roleCode?: string;
      roleName?: string;
      permissions?: string[];
      name: string;
      openid: string;
      mustChangePassword?: boolean;
    }>("/api/login", {
      method: "POST",
      body: JSON.stringify({
        name: account,
        password: pwd,
        scope: "admin",
      }),
    });

    saveLoginSession({
      openid: data.openid,
      role: data.roleCode || data.role,
      roleId: data.roleId,
      roleCode: data.roleCode || data.role,
      roleName: data.roleName,
      name: data.name,
      permissions: data.permissions || [],
      mustChangePassword: Boolean(data.mustChangePassword),
    });

    ElMessage.success("登录成功");
    await router.replace(
      getPostLoginPath(
        data.roleCode || data.role,
        data.openid,
        null,
        data.permissions || []
      )
    );
  } catch (e: any) {
    const msg = e?.message || "登录失败";
    errorText.value = msg;
    ElMessage.error(msg);
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
.form-error {
  margin: 0 0 12px;
  color: #e11d48;
  font-size: 13px;
}
.submit {
  width: 100%;
  margin-top: 8px;
  height: 44px;
  font-size: 15px;
  background-color: #ff6900 !important;
  border-color: #ff6900 !important;
}
.submit:hover,
.submit:focus {
  background-color: #ff8533 !important;
  border-color: #ff8533 !important;
}
</style>
