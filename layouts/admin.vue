<template>
  <div class="admin-shell">
    <header class="admin-top">
      <div class="brand">
        <span class="brand-mark" />
        <span class="brand-text">定点作业记录系统</span>
      </div>
      <div class="top-actions" v-if="session">
        <div class="user-chip">
          <div class="avatar">{{ initial }}</div>
          <div>
            <div class="user-name">{{ session.name }}</div>
            <div class="user-role">{{ session.roleName || session.role }}</div>
          </div>
        </div>
        <el-button round @click="pwdOpen = true">修改密码</el-button>
        <el-button round @click="logout">退出</el-button>
      </div>
    </header>

    <div class="admin-body">
      <aside class="admin-side">
        <el-menu
          ref="menuRef"
          :default-active="activeMenu"
          :default-openeds="seedOpeneds"
          router
          class="mi-menu"
        >
          <el-menu-item v-if="can('menu:dashboard')" index="/admin/dashboard">
            <span>首页</span>
          </el-menu-item>
          <el-menu-item v-if="can('menu:points')" index="/admin/points">
            <span>点位管理</span>
          </el-menu-item>
          <el-menu-item v-if="can('menu:records')" index="/admin/records">
            <span>工作记录</span>
          </el-menu-item>

          <el-sub-menu v-if="showSettingsMenu" index="settings">
            <template #title>系统设置</template>
            <el-menu-item v-if="can('menu:settings')" index="/admin/settings">
              参数设置
            </el-menu-item>
            <el-menu-item v-if="can('menu:logs')" index="/admin/logs">
              操作日志
            </el-menu-item>
            <el-menu-item v-if="can('menu:users')" index="/admin/users">
              用户管理
            </el-menu-item>
            <el-menu-item v-if="can('menu:roles')" index="/admin/roles">
              角色管理
            </el-menu-item>
            <el-sub-menu v-if="can('menu:docs')" index="docs">
              <template #title>开发文档</template>
              <el-menu-item
                v-if="can(['menu:docs.guide', 'menu:docs'])"
                index="/admin/docs/guide"
              >
                系统说明
              </el-menu-item>
              <el-menu-item
                v-if="can(['menu:docs.api', 'menu:docs'])"
                index="/admin/docs/api"
              >
                接口文档
              </el-menu-item>
            </el-sub-menu>
          </el-sub-menu>
        </el-menu>
      </aside>

      <main class="admin-main">
        <div v-if="forcePwd" class="force-tip">
          首次登录或密码已重置，请先修改密码后再继续使用后台
        </div>
        <div :class="{ dimmed: forcePwd }">
          <slot />
        </div>
      </main>
    </div>

    <ChangePasswordDialog
      v-model="pwdOpen"
      :forced="forcePwd"
      :openid="session?.openid || ''"
      :default-account="session?.name || ''"
      @success="onPwdSuccess"
    />
  </div>
</template>

<script setup lang="ts">
const route = useRoute();
const router = useRouter();
const { getAdminSession, getStoredSession, clearLoginSession, setMustChangePasswordFlag } =
  useSession();
const { can } = usePermission();

const session = ref(getAdminSession());
const forcePwd = ref(false);
const pwdOpen = ref(false);
const menuRef = ref<{ open?: (index: string) => void } | null>(null);

const initial = computed(() => session.value?.name?.trim()?.[0] || "管");
const showSettingsMenu = computed(() =>
  can(["menu:settings", "menu:logs", "menu:users", "menu:roles", "menu:docs"])
);

function isSettingsPath(path: string) {
  return (
    path.startsWith("/admin/settings") ||
    path.startsWith("/admin/logs") ||
    path.startsWith("/admin/users") ||
    path.startsWith("/admin/roles") ||
    path.startsWith("/admin/docs")
  );
}

function computeOpeneds(path: string): string[] {
  const open: string[] = [];
  if (isSettingsPath(path)) open.push("settings");
  if (path.startsWith("/admin/docs")) open.push("docs");
  return open;
}

/** 仅首次挂载用；之后由用户点击自由展开/收起，不再强制重开 */
const seedOpeneds = ref(computeOpeneds(route.path));

const activeMenu = computed(() => {
  const p = route.path;
  if (p.startsWith("/admin/points")) return "/admin/points";
  if (p.startsWith("/admin/records")) return "/admin/records";
  if (p.startsWith("/admin/users")) return "/admin/users";
  if (p.startsWith("/admin/roles")) return "/admin/roles";
  if (p.startsWith("/admin/settings")) return "/admin/settings";
  if (p.startsWith("/admin/logs")) return "/admin/logs";
  if (p.startsWith("/admin/docs/guide")) return "/admin/docs/guide";
  if (p.startsWith("/admin/docs/api")) return "/admin/docs/api";
  return "/admin/dashboard";
});

onMounted(() => {
  const s = getAdminSession();
  if (!s) {
    router.replace("/login");
    return;
  }
  session.value = s;
  const app = getStoredSession();
  if (app?.mustChangePassword) {
    forcePwd.value = true;
    pwdOpen.value = true;
  }
});

/** 从非设置页进入设置相关页时，自动展开对应分组（不强制保持展开） */
watch(
  () => route.path,
  (path, prev) => {
    if (!isSettingsPath(path) || isSettingsPath(prev || "")) return;
    menuRef.value?.open?.("settings");
    if (path.startsWith("/admin/docs")) {
      menuRef.value?.open?.("docs");
    }
  }
);

function logout() {
  clearLoginSession();
  router.replace("/login");
}

function onPwdSuccess() {
  setMustChangePasswordFlag(false);
  forcePwd.value = false;
  pwdOpen.value = false;
}
</script>

<style scoped>
.admin-shell {
  min-height: 100vh;
  background: var(--mi-bg);
}
.admin-top {
  position: sticky;
  top: 0;
  z-index: 20;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 650;
  letter-spacing: -0.02em;
}
.brand-mark {
  width: 22px;
  height: 22px;
  border-radius: 7px;
  background: linear-gradient(135deg, #ff8533, #ff6900);
  box-shadow: 0 4px 12px rgba(255, 105, 0, 0.35);
}
.top-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
.user-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-right: 6px;
}
.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--mi-orange);
  color: #fff;
  display: grid;
  place-items: center;
  font-size: 14px;
  font-weight: 600;
}
.user-name {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.2;
}
.user-role {
  font-size: 11px;
  color: var(--mi-ink-3);
}
.admin-body {
  display: flex;
  height: calc(100vh - 56px);
  min-height: 0;
  overflow: hidden;
}
.admin-side {
  width: 220px;
  flex-shrink: 0;
  height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-gutter: stable;
  background: #fff;
  border-right: 1px solid rgba(0, 0, 0, 0.04);
  padding: 12px 8px;
  /* 展开子菜单时避免整页重排抖动 */
  contain: layout paint;
}
.mi-menu {
  border: none !important;
  background: transparent;
  width: 100%;
}
.mi-menu :deep(.el-menu-item.is-active) {
  background: var(--mi-orange-soft) !important;
  color: var(--mi-orange) !important;
  font-weight: 600;
}
.mi-menu :deep(.el-menu-item),
.mi-menu :deep(.el-sub-menu__title) {
  border-radius: 12px;
  margin: 0;
  height: 44px;
  line-height: 44px;
  transition: background-color 0.15s ease, color 0.15s ease;
}
/* 用内边距替代外边距，避免折叠高度动画计算抖动 */
.mi-menu :deep(> .el-menu-item),
.mi-menu :deep(> .el-sub-menu) {
  margin-bottom: 4px;
}
.mi-menu :deep(.el-sub-menu .el-menu-item) {
  height: 40px;
  line-height: 40px;
  min-width: auto;
  margin: 0;
}
.mi-menu :deep(.el-sub-menu .el-sub-menu .el-menu-item) {
  padding-left: 48px !important;
}
.mi-menu :deep(.el-sub-menu .el-menu) {
  background: transparent !important;
  overflow: hidden;
}
/* 折叠动画仅改高度，禁止子项在动画中位移 */
.mi-menu :deep(.el-menu--inline) {
  overflow: hidden !important;
}
.mi-menu :deep(.el-sub-menu__icon-arrow) {
  transition: transform 0.2s ease;
  margin-top: 0;
}
.admin-main {
  flex: 1;
  min-width: 0;
  height: 100%;
  padding: 24px;
  overflow: auto;
}
.force-tip {
  margin-bottom: 16px;
  padding: 12px 16px;
  border-radius: 12px;
  background: #fff7ed;
  color: #9a3412;
  font-size: 14px;
}
.dimmed {
  pointer-events: none;
  opacity: 0.4;
}
</style>
