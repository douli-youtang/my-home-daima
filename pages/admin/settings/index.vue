<template>
  <div>
    <div class="head">
      <h1 class="mi-section-title">系统设置</h1>
      <p class="mi-muted">配置系统参数并查看操作审计</p>
    </div>

    <el-tabs v-model="tab">
      <el-tab-pane label="基本设置" name="basic" />
      <el-tab-pane label="操作日志" name="logs" />
    </el-tabs>

    <div v-if="tab === 'basic'" v-loading="loadingSettings" class="basic">
      <section class="mi-card section">
        <h2>基本信息</h2>
        <p class="mi-muted">影响登录页展示与会话时长</p>
        <el-form label-position="top" class="form">
          <el-form-item label="系统名称" required>
            <el-input v-model="settings.systemName" />
          </el-form-item>
          <el-form-item label="会话有效期">
            <el-select v-model="settings.sessionDays" style="width: 100%">
              <el-option :value="7" label="7 天" />
              <el-option :value="14" label="14 天" />
              <el-option :value="30" label="30 天" />
            </el-select>
          </el-form-item>
        </el-form>
      </section>

      <section class="mi-card section">
        <h2>填表策略</h2>
        <p class="mi-muted">控制扫码填表的占用、修改次数与可改时间，保存后立即生效</p>
        <el-form label-position="top" class="form">
          <el-form-item label="表单修改次数上限">
            <el-input-number
              v-model="settings.maxSubmissionEdits"
              :min="0"
              :max="20"
              :step="1"
              controls-position="right"
            />
            <p class="hint">单条提交最多可修改几次。设为 0 表示提交后不可修改。</p>
          </el-form-item>
          <el-form-item label="同一二维码占用窗口（小时）">
            <el-input-number
              v-model="settings.pointLockHours"
              :min="0"
              :max="720"
              :step="1"
              controls-position="right"
            />
            <p class="hint">
              窗口内同一二维码仅允许一条有效填报；再扫将展示详情。设为 0 表示不限制，可重复提交。
            </p>
          </el-form-item>
          <el-form-item label="提交后可修改时间（小时）">
            <el-input-number
              v-model="settings.editWindowHours"
              :min="0"
              :max="720"
              :step="1"
              controls-position="right"
            />
            <p class="hint">
              从首次提交起计时。设为 0 表示不限制时间，仅受修改次数上限约束。
            </p>
          </el-form-item>
        </el-form>

        <div class="preview">
          当前策略预览：修改上限
          <strong>{{ settings.maxSubmissionEdits }}</strong>
          次；占用
          <strong>
            {{ settings.pointLockHours === 0 ? "不限制" : `${settings.pointLockHours} 小时` }}
          </strong>
          ；可改时间
          <strong>
            {{ settings.editWindowHours === 0 ? "不限制" : `${settings.editWindowHours} 小时` }}
          </strong>
          。
        </div>
      </section>

      <el-button type="primary" :loading="saving" @click="handleSave">
        {{ saving ? "保存中..." : "保存设置" }}
      </el-button>
    </div>

    <div v-else>
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
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from "element-plus";
import { OPERATION_ACTION_LABELS } from "~/lib/operation-actions";

definePageMeta({ layout: "admin", middleware: "admin" });

type SystemSettingsDTO = {
  systemName: string;
  sessionDays: number;
  maxSubmissionEdits: number;
  pointLockHours: number;
  editWindowHours: number;
};

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

const tab = ref<"basic" | "logs">("basic");
const settings = reactive<SystemSettingsDTO>({
  systemName: "",
  sessionDays: 7,
  maxSubmissionEdits: 2,
  pointLockHours: 6,
  editWindowHours: 6,
});
const loadingSettings = ref(true);
const saving = ref(false);

const action = ref("");
const logs = ref<OperationLogItem[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const loadingLogs = ref(false);

onMounted(async () => {
  loadingSettings.value = true;
  try {
    const data = await adminRequest<SystemSettingsDTO>("/api/admin/settings");
    Object.assign(settings, data);
  } catch (e: any) {
    ElMessage.error(e?.message || "加载设置失败");
  } finally {
    loadingSettings.value = false;
  }
});

watch(tab, (v) => {
  if (v === "logs") loadLogs();
});

async function handleSave() {
  if (!settings.systemName.trim()) {
    ElMessage.warning("请填写系统名称");
    return;
  }
  if (
    !Number.isFinite(settings.maxSubmissionEdits) ||
    settings.maxSubmissionEdits < 0 ||
    settings.maxSubmissionEdits > 20
  ) {
    ElMessage.warning("修改次数上限请填写 0～20 的整数");
    return;
  }
  if (
    !Number.isFinite(settings.pointLockHours) ||
    settings.pointLockHours < 0 ||
    settings.pointLockHours > 720
  ) {
    ElMessage.warning("占用窗口请填写 0～720 的整数（小时）");
    return;
  }
  if (
    !Number.isFinite(settings.editWindowHours) ||
    settings.editWindowHours < 0 ||
    settings.editWindowHours > 720
  ) {
    ElMessage.warning("可修改时间窗口请填写 0～720 的整数（小时）");
    return;
  }

  saving.value = true;
  try {
    const saved = await adminRequest<SystemSettingsDTO>("/api/admin/settings", {
      method: "PUT",
      body: JSON.stringify({
        systemName: settings.systemName.trim(),
        sessionDays: settings.sessionDays,
        maxSubmissionEdits: Math.round(settings.maxSubmissionEdits),
        pointLockHours: Math.round(settings.pointLockHours),
        editWindowHours: Math.round(settings.editWindowHours),
      }),
    });
    Object.assign(settings, saved);
    ElMessage.success("设置已保存");
  } catch (e: any) {
    ElMessage.error(e?.message || "保存失败");
  } finally {
    saving.value = false;
  }
}

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
  margin-bottom: 8px;
}
.basic {
  max-width: 560px;
}
.section {
  padding: 18px 20px;
  margin-bottom: 14px;
}
.section h2 {
  margin: 0 0 4px;
  font-size: 15px;
}
.form {
  margin-top: 12px;
}
.hint {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--mi-ink-3);
  line-height: 1.5;
}
.preview {
  margin-top: 8px;
  border-radius: 12px;
  background: #fafafa;
  padding: 10px 12px;
  font-size: 12px;
  color: var(--mi-ink-2);
  line-height: 1.6;
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
