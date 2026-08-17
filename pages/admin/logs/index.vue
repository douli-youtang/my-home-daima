<template>
  <div>
    <div class="head">
      <h1 class="mi-section-title">操作日志</h1>
      <p class="mi-muted">谁在什么时候做了什么，用普通人能看懂的话记下来</p>
    </div>

    <div class="mi-card filters">
      <span class="filter-label">看哪一类：</span>
      <el-select
        v-model="action"
        clearable
        placeholder="全部操作"
        style="width: 260px"
        @change="() => { page = 1; loadLogs(); }"
      >
        <el-option
          v-for="opt in actionOptions"
          :key="opt.value"
          :label="opt.label"
          :value="opt.value"
        />
      </el-select>
      <el-button type="primary" @click="loadLogs">刷新</el-button>
    </div>

    <div v-loading="loadingLogs" class="mi-card feed-wrap">
      <div v-if="!logs.length && !loadingLogs" class="empty">暂时还没有操作记录</div>

      <ul v-else class="feed">
        <li v-for="row in logs" :key="row.id" class="feed-item">
          <div class="time-col">
            <div class="time-main">{{ row.timePrimary }}</div>
            <div v-if="row.timeSecondary" class="time-sub">
              {{ row.timeSecondary }}
            </div>
          </div>

          <div class="dot-col">
            <span class="dot" :class="`tone-${row.tone}`" />
            <span class="line" />
          </div>

          <div class="body-col">
            <div class="who-did">
              <span class="who">{{ row.operatorName || "未知用户" }}</span>
              <el-tag
                size="small"
                effect="light"
                :type="tagType(row.tone)"
                round
              >
                {{ row.title }}
              </el-tag>
            </div>
            <p class="desc">{{ row.description }}</p>
            <div class="meta">
              <span class="meta-label">相关对象</span>
              <NuxtLink v-if="row.href" class="target-link" :to="row.href">
                {{ row.targetName }}
              </NuxtLink>
              <span v-else class="target-plain">{{ row.targetName }}</span>
            </div>
          </div>
        </li>
      </ul>

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
import {
  OPERATION_ACTION_LABELS,
  formatFriendlyTime,
} from "~/lib/operation-log-format";

definePageMeta({ layout: "admin", middleware: "admin" });

type OperationLogItem = {
  id: string;
  action: string;
  title: string;
  description: string;
  targetName: string;
  href: string | null;
  tone: "create" | "update" | "danger" | "info";
  createdAt: string;
  operatorName: string;
  timePrimary?: string;
  timeSecondary?: string;
};

const { adminRequest } = useApi();

const action = ref("");
const logs = ref<OperationLogItem[]>([]);
const actionOptions = ref(
  Object.entries(OPERATION_ACTION_LABELS).map(([value, label]) => ({
    value,
    label,
  }))
);
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
      actionOptions?: { value: string; label: string }[];
      pagination: { total: number };
    }>(`/api/admin/operation-logs?${qs.toString()}`);
    logs.value = data.list.map((row) => {
      const t = formatFriendlyTime(row.createdAt);
      return {
        ...row,
        timePrimary: t.primary,
        timeSecondary: t.secondary,
      };
    });
    total.value = data.pagination.total;
    if (data.actionOptions?.length) {
      actionOptions.value = data.actionOptions;
    }
  } catch (e: any) {
    ElMessage.error(e?.message || "加载日志失败");
  } finally {
    loadingLogs.value = false;
  }
}

function tagType(tone: OperationLogItem["tone"]) {
  if (tone === "create") return "success";
  if (tone === "danger") return "danger";
  if (tone === "update") return "warning";
  return "info";
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
.filter-label {
  color: var(--mi-muted, #8c8c8c);
  font-size: 14px;
}
.feed-wrap {
  padding: 8px 8px 16px;
  min-height: 200px;
}
.empty {
  padding: 48px 16px;
  text-align: center;
  color: var(--mi-muted, #8c8c8c);
}
.feed {
  list-style: none;
  margin: 0;
  padding: 8px 12px 0;
}
.feed-item {
  display: grid;
  grid-template-columns: 120px 24px 1fr;
  gap: 8px 12px;
  padding: 14px 4px;
  align-items: start;
}
.time-col {
  text-align: right;
  padding-top: 2px;
}
.time-main {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  line-height: 1.4;
}
.time-sub {
  font-size: 12px;
  color: #a8abb2;
  margin-top: 2px;
}
.dot-col {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 100%;
  padding-top: 6px;
}
.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  z-index: 1;
}
.tone-create {
  background: #67c23a;
}
.tone-update {
  background: #e6a23c;
}
.tone-danger {
  background: #f56c6c;
}
.tone-info {
  background: #909399;
}
.line {
  flex: 1;
  width: 2px;
  background: #ebeef5;
  margin-top: 4px;
  min-height: 28px;
}
.feed-item:last-child .line {
  display: none;
}
.body-col {
  padding-bottom: 4px;
  min-width: 0;
}
.who-did {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.who {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}
.desc {
  margin: 0 0 8px;
  font-size: 14px;
  line-height: 1.55;
  color: #606266;
  word-break: break-word;
}
.meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}
.meta-label {
  color: #a8abb2;
}
.target-link {
  color: var(--el-color-primary, #ff6900);
  text-decoration: none;
  font-weight: 500;
}
.target-link:hover {
  text-decoration: underline;
}
.target-plain {
  color: #606266;
}
.pager {
  display: flex;
  justify-content: flex-end;
  padding: 12px 8px 0;
}

@media (max-width: 640px) {
  .feed-item {
    grid-template-columns: 20px 1fr;
    grid-template-rows: auto auto;
  }
  .time-col {
    grid-column: 2;
    grid-row: 1;
    text-align: left;
    margin-bottom: 4px;
  }
  .dot-col {
    grid-column: 1;
    grid-row: 1 / span 2;
  }
  .body-col {
    grid-column: 2;
    grid-row: 2;
  }
}
</style>
