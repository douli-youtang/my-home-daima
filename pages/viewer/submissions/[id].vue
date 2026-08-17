<template>
  <div class="page">
    <div v-if="loading" class="mi-card state">加载工单...</div>
    <div v-else-if="error || !detail" class="mi-card state">
      <p>{{ error || "记录不存在" }}</p>
      <el-button type="primary" @click="load">重试</el-button>
      <el-button @click="goHome">返回列表</el-button>
    </div>
    <template v-else>
      <div class="mi-card block">
        <p class="readonly">管理员查看 · 仅可浏览</p>
        <p class="title">{{ detail.pointName || "工单详情" }}</p>
        <p v-if="detail.pointCode" class="meta">{{ detail.pointCode }}</p>
        <p class="meta">提交人：{{ detail.submitterName || "-" }}</p>
        <p class="meta">
          填写人：{{ detail.submittedBy }} · {{ formatTime(detail.submittedAt) }}
        </p>
        <p v-if="detail.editCount > 0" class="meta">
          该工单已被修改 {{ detail.editCount }} 次
        </p>
      </div>
      <div class="mi-card block">
        <p class="section">提交内容</p>
        <SubmissionDataView
          :fields="fields"
          :data="detail.data"
          :images="detail.images"
        />
      </div>
      <el-button text type="primary" @click="goHome">返回列表</el-button>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { WorkerSubmissionDetail } from "~/lib/client-api";

definePageMeta({
  layout: "worker",
  middleware: "viewer",
  title: "工单详情",
});

const route = useRoute();
const router = useRouter();
const { getStoredSession, isAdminRole } = useSession();

const id = computed(() => String(route.params.id || ""));
const openid = ref("");
const detail = ref<WorkerSubmissionDetail | null>(null);
const loading = ref(true);
const error = ref("");

const fields = computed(() =>
  [...(detail.value?.fieldsSnapshot || [])].sort((a, b) => a.order - b.order)
);

function formatTime(value: string) {
  try {
    return new Date(value).toLocaleString("zh-CN", { hour12: false });
  } catch {
    return value;
  }
}

function goHome() {
  const point = detail.value?.pointCode || detail.value?.pointName;
  if (point) {
    router.push(`/viewer?point=${encodeURIComponent(point)}`);
    return;
  }
  router.push("/viewer");
}

async function load() {
  if (!openid.value || !id.value) return;
  loading.value = true;
  error.value = "";
  try {
    detail.value = await apiRequest<WorkerSubmissionDetail>(
      `/api/submissions/${encodeURIComponent(id.value)}?openid=${encodeURIComponent(openid.value)}`
    );
  } catch (e: any) {
    error.value = e?.message || "加载失败";
    detail.value = null;
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  const session = getStoredSession();
  if (!session || !isAdminRole(session.role)) {
    router.replace("/login");
    return;
  }
  openid.value = session.openid;
  load();
});

watch(id, () => load());
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.state {
  padding: 28px 16px;
  text-align: center;
  color: #8a8a8a;
}
.block {
  padding: 14px 16px;
}
.readonly {
  margin: 0;
  font-size: 12px;
  color: #8a8a8a;
}
.title {
  margin: 4px 0 0;
  font-size: 18px;
  font-weight: 650;
}
.meta {
  margin: 6px 0 0;
  font-size: 12px;
  color: #8a8a8a;
}
.section {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 500;
}
</style>
