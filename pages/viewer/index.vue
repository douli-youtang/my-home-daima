<template>
  <div class="page">
    <div class="mi-card hello">
      <div>
        你好，
        <strong>{{ sessionName || "管理员" }}</strong>
        <span class="role">（{{ roleLabel }} · 只读）</span>
      </div>
      <el-button text type="primary" @click="pwdOpen = true">修改密码</el-button>
    </div>

    <div class="mi-card filters">
      <div class="filters-head" @click="filtersOpen = !filtersOpen">
        <span>筛选条件{{ hasFilter ? " · 已启用" : "" }}</span>
        <span class="mi-muted">{{ filtersOpen ? "收起" : "展开" }}</span>
      </div>
      <div v-show="filtersOpen" class="filters-body">
        <el-input
          v-model="pointKeyword"
          clearable
          placeholder="搜索点位 / 二维码名称"
        />
        <div class="dates">
          <el-date-picker
            v-model="dateFrom"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="开始日期"
          />
          <el-date-picker
            v-model="dateTo"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="结束日期"
          />
        </div>
      </div>
      <div class="filters-foot">
        <span class="mi-muted">
          {{
            loading
              ? "加载中..."
              : hasFilter
                ? `筛选结果 ${filtered.length} / ${list.length} 条`
                : `全部工单共 ${list.length} 条`
          }}
        </span>
        <el-button v-if="hasFilter" text type="primary" @click="clearFilters">
          清除筛选
        </el-button>
      </div>
    </div>

    <div v-loading="loading" class="list">
      <el-empty v-if="!loading && error" :description="error">
        <el-button type="primary" @click="load">重试</el-button>
      </el-empty>
      <el-empty
        v-else-if="!loading && !error && list.length === 0"
        description="暂无工单数据"
      />
      <el-empty
        v-else-if="!loading && !error && filtered.length === 0"
        description="没有符合条件的工单"
      >
        <el-button @click="clearFilters">清除筛选</el-button>
      </el-empty>
      <button
        v-for="item in filtered"
        :key="item.id"
        type="button"
        class="mi-card item"
        @click="router.push(`/viewer/submissions/${item.id}`)"
      >
        <div class="item-main">
          <div class="item-top">
            <p class="name">{{ item.pointName || item.pointCode || "未命名点位" }}</p>
            <span class="badge">查看</span>
          </div>
          <p class="time">{{ formatTime(item.submittedAt) }}</p>
          <p class="meta">
            提交人 {{ item.submitterName || "-" }} · 填写人 {{ item.submittedBy }}
            <template v-if="item.editCount > 0"> · 已改 {{ item.editCount }} 次</template>
          </p>
        </div>
        <span class="arrow">›</span>
      </button>
    </div>

    <ChangePasswordDialog
      v-model="pwdOpen"
      :forced="forcePassword"
      :openid="openid"
      :default-account="sessionName"
      @success="onPwdSuccess"
    />
  </div>
</template>

<script setup lang="ts">
import type { WorkerSubmissionListItem } from "~/lib/client-api";

definePageMeta({
  layout: "worker",
  middleware: "viewer",
  title: "全部工单",
});

const ROLE_LABELS: Record<string, string> = {
  admin: "管理员",
  maintainer: "维护员",
};

const route = useRoute();
const router = useRouter();
const { getStoredSession, setMustChangePasswordFlag, isAdminRole } = useSession();

const openid = ref("");
const sessionName = ref("");
const roleLabel = ref("管理员");
const list = ref<WorkerSubmissionListItem[]>([]);
const loading = ref(true);
const error = ref("");
const forcePassword = ref(false);
const pwdOpen = ref(false);
const pointKeyword = ref("");
const dateFrom = ref("");
const dateTo = ref("");
const filtersOpen = ref(true);

function toDateKey(value: string | Date) {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatTime(value: string) {
  try {
    return new Date(value).toLocaleString("zh-CN", { hour12: false });
  } catch {
    return value;
  }
}

const filtered = computed(() => {
  const kw = pointKeyword.value.trim().toLowerCase();
  return list.value.filter((item) => {
    if (kw) {
      const hay = `${item.pointName || ""} ${item.pointCode || ""}`.toLowerCase();
      if (!hay.includes(kw)) return false;
    }
    if (dateFrom.value || dateTo.value) {
      const day = toDateKey(item.submittedAt);
      if (!day) return false;
      if (dateFrom.value && day < dateFrom.value) return false;
      if (dateTo.value && day > dateTo.value) return false;
    }
    return true;
  });
});

const hasFilter = computed(
  () => Boolean(pointKeyword.value.trim() || dateFrom.value || dateTo.value)
);

function clearFilters() {
  pointKeyword.value = "";
  dateFrom.value = "";
  dateTo.value = "";
  if (route.query.point) {
    router.replace({ path: "/viewer", query: {} });
  }
}

async function load() {
  if (!openid.value) return;
  loading.value = true;
  error.value = "";
  try {
    const data = await apiRequest<{ list: WorkerSubmissionListItem[] }>(
      `/api/submissions?openid=${encodeURIComponent(openid.value)}`
    );
    list.value = data.list || [];
  } catch (e: any) {
    error.value = e?.message || "加载失败";
  } finally {
    loading.value = false;
  }
}

function onPwdSuccess() {
  setMustChangePasswordFlag(false);
  forcePassword.value = false;
  pwdOpen.value = false;
}

watch(
  () => route.query.point,
  (point) => {
    if (typeof point === "string") pointKeyword.value = point;
  },
  { immediate: true }
);

onMounted(() => {
  const session = getStoredSession();
  if (!session || !isAdminRole(session.role)) {
    router.replace("/login");
    return;
  }
  openid.value = session.openid;
  sessionName.value = session.name;
  roleLabel.value = ROLE_LABELS[session.role] || session.role;
  if (session.mustChangePassword) {
    forcePassword.value = true;
    pwdOpen.value = true;
  }
  load();
});
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.hello {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 14px 16px;
  font-size: 14px;
  color: #4d4d4d;
}
.role {
  margin-left: 4px;
  font-size: 12px;
  color: #8a8a8a;
}
.filters {
  padding: 12px;
  position: sticky;
  top: 52px;
  z-index: 5;
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(8px);
}
.filters-head {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}
.filters-body {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #f5f5f5;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.dates {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.filters-foot {
  margin-top: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.list {
  min-height: 120px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 14px 16px;
  text-align: left;
  cursor: pointer;
  border: 0;
  background: #fff;
}
.item-main {
  min-width: 0;
  flex: 1;
}
.item-top {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}
.name {
  margin: 0;
  font-size: 14px;
  font-weight: 650;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.badge {
  flex-shrink: 0;
  border-radius: 6px;
  padding: 2px 8px;
  font-size: 11px;
  background: #f5f5f5;
  color: #737373;
}
.time {
  margin: 6px 0 0;
  font-size: 12px;
  color: #8a8a8a;
}
.meta {
  margin: 2px 0 0;
  font-size: 12px;
  color: #a3a3a3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.arrow {
  color: #d4d4d4;
  font-size: 18px;
}
</style>
