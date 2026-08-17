<template>
  <div>
    <div class="head">
      <h1 class="mi-section-title">操作日志</h1>
      <p class="mi-muted">后台关键操作审计记录</p>
    </div>

    <div class="mi-card filters">
      <el-select
        v-model="action"
        clearable
        placeholder="全部操作类型"
        style="width: 220px"
        @change="() => { page = 1; loadLogs(); }"
      >
        <el-option
          v-for="(label, key) in OPERATION_ACTION_LABELS"
          :key="key"
          :label="label"
          :value="key"
        />
      </el-select>
      <el-button type="primary" @click="loadLogs">查询</el-button>
    </div>

    <div class="mi-card table-wrap">
      <el-table v-loading="loadingLogs" :data="logs" stripe empty-text="暂无日志">
        <el-table-column label="操作时间" min-width="170">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column prop="operatorName" label="操作人" min-width="100" />
        <el-table-column label="操作类型" min-width="130">
          <template #default="{ row }">
            <el-tag size="small" round>{{ row.actionLabel }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作详情" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">{{ detailText(row.detail) }}</template>
        </el-table-column>
        <el-table-column label="目标对象" min-width="120">
          <template #default="{ row }">
            <NuxtLink v-if="targetHref(row)" :to="targetHref(row)!">
              {{ row.targetId ? `${row.targetId.slice(0, 8)}…` : "-" }}
            </NuxtLink>
            <span v-else class="mono">{{ row.targetId ? row.targetId.slice(0, 12) : "-" }}</span>
          </template>
        </el-table-column>
      </el-table>

      <div class="pager">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          background
          layout="total, sizes, prev, pager, next"
          :total="total"
          :page-sizes="[10, 20, 50]"
          @current-change="loadLogs"
          @size-change="() => { page = 1; loadLogs(); }"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from "element-plus";
import { OPERATION_ACTION_LABELS } from "~/lib/operation-actions";

definePageMeta({ layout: "admin", middleware: "admin" });

type OperationLogItem = {
  id: string;
  action: string;
  actionLabel: string;
  targetId: string | null;
  pointId: string | null;
  detail: unknown;
  createdAt: string;
  operatorName: string;
};

const { adminRequest } = useApi();

const action = ref("");
const logs = ref<OperationLogItem[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const loadingLogs = ref(false);

onMounted(() => {
  loadLogs();
});

async function loadLogs() {
  loadingLogs.value = true;
  try {
    const qs = new URLSearchParams();
    if (action.value) qs.set("action", action.value);
    qs.set("page", String(page.value));
    qs.set("pageSize", String(pageSize.value));
    const data = await adminRequest<{
      list: OperationLogItem[];
      pagination: { total: number };
    }>(`/api/admin/operation-logs?${qs.toString()}`);
    logs.value = data.list;
    total.value = data.pagination.total;
  } catch (e: any) {
    ElMessage.error(e?.message || "加载日志失败");
  } finally {
    loadingLogs.value = false;
  }
}

function detailText(detail: unknown): string {
  if (!detail) return "-";
  try {
    const text = JSON.stringify(detail);
    return text.length > 80 ? `${text.slice(0, 80)}…` : text;
  } catch {
    return "-";
  }
}

function targetHref(item: OperationLogItem): string | null {
  if (!item.targetId) return null;
  if (item.action.includes("point") && item.pointId) return "/admin/points";
  if (item.action.includes("template") && item.pointId) {
    return `/admin/points/${item.pointId}/template`;
  }
  if (item.action.includes("record")) return "/admin/records";
  if (item.action.includes("user")) return "/admin/users";
  if (item.action.includes("settings")) return "/admin/settings";
  return null;
}

function formatTime(v: string) {
  try {
    return new Date(v).toLocaleString();
  } catch {
    return v;
  }
}
</script>

<style scoped>
.head {
  margin-bottom: 16px;
}
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 14px 16px;
  margin-bottom: 16px;
  align-items: center;
}
.table-wrap {
  padding: 8px 8px 16px;
}
.pager {
  display: flex;
  justify-content: flex-end;
  padding: 12px 8px 0;
}
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
}
</style>
