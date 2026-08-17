<template>
  <div>
    <div class="head">
      <h1 class="mi-section-title">数据记录</h1>
      <p class="mi-muted">查看与管理扫码提交记录</p>
    </div>

    <section class="mi-card filters">
      <el-form :inline="true" class="filter-form" @submit.prevent="applyFilters">
        <el-form-item label="点位">
          <el-select
            v-model="draft.pointId"
            clearable
            filterable
            placeholder="全部点位"
            style="width: 200px"
          >
            <el-option
              v-for="p in points"
              :key="p.id"
              :label="`${p.name} (${p.code})`"
              :value="p.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="填写人">
          <el-input
            v-model="draft.keyword"
            clearable
            placeholder="输入姓名关键字"
            style="width: 180px"
            @keyup.enter="applyFilters"
          />
        </el-form-item>
        <el-form-item label="提交日期">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            value-format="YYYY-MM-DD"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            style="width: 260px"
          />
        </el-form-item>
        <el-form-item v-if="isAdmin">
          <el-checkbox v-model="draft.showDeleted">已删除</el-checkbox>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="applyFilters">查询</el-button>
          <el-button v-if="hasFilter" @click="clearFilters">清除</el-button>
        </el-form-item>
      </el-form>
      <div v-if="hasFilter" class="chips">
        <el-tag v-if="applied.pointId" round size="small" type="warning">
          点位 · {{ points.find((p) => p.id === applied.pointId)?.name || "已选" }}
        </el-tag>
        <el-tag v-if="applied.keyword.trim()" round size="small" type="warning">
          填写人 · {{ applied.keyword.trim() }}
        </el-tag>
        <el-tag v-if="applied.startDate || applied.endDate" round size="small" type="warning">
          日期 · {{ applied.startDate || "不限" }} ~ {{ applied.endDate || "不限" }}
        </el-tag>
        <el-tag v-if="applied.showDeleted" round size="small">含已删除</el-tag>
        <span class="mi-muted total">共 {{ total }} 条</span>
      </div>
    </section>

    <div class="mi-card table-wrap">
      <el-table
        v-loading="loading"
        :data="list"
        stripe
        empty-text="暂无记录"
        @row-click="openDetail"
      >
        <el-table-column label="序号" width="70">
          <template #default="{ $index }">
            {{ (page - 1) * pageSize + $index + 1 }}
          </template>
        </el-table-column>
        <el-table-column prop="pointName" label="点位名称" min-width="140" />
        <el-table-column label="提交人" min-width="100">
          <template #default="{ row }">{{ row.submitterName || "-" }}</template>
        </el-table-column>
        <el-table-column label="填写人" min-width="120">
          <template #default="{ row }">
            {{ row.submittedBy }}
            <el-tag v-if="row.editCount > 0" size="small" type="warning" round class="ml">
              改{{ row.editCount }}次
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="提交时间" min-width="160">
          <template #default="{ row }">
            {{ formatTime(row.submittedAt) }}
          </template>
        </el-table-column>
        <el-table-column prop="summary" label="内容摘要" min-width="160" show-overflow-tooltip />
        <el-table-column prop="imageCount" label="图片数" width="80" />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.isDeleted ? 'info' : 'success'" size="small" round>
              {{ row.isDeleted ? "已删除" : "正常" }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <div class="ops" @click.stop>
              <el-button link type="primary" @click="openDetail(row)">详情</el-button>
              <el-button
                v-if="!row.isDeleted"
                link
                type="danger"
                @click="handleDelete(row)"
              >
                删除
              </el-button>
              <el-button
                v-if="isAdmin && row.isDeleted"
                link
                type="warning"
                @click="handleRestore(row)"
              >
                恢复
              </el-button>
            </div>
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
          @current-change="load"
          @size-change="onSizeChange"
        />
      </div>
    </div>

    <el-drawer v-model="drawerOpen" title="记录详情" size="480px" destroy-on-close>
      <template v-if="detail">
        <el-tabs v-model="tab">
          <el-tab-pane label="最终结果" name="final" />
          <el-tab-pane name="history">
            <template #label>
              修改记录
              <span v-if="detail.editCount > 0" class="hist-count">({{ detail.editCount }})</span>
            </template>
          </el-tab-pane>
        </el-tabs>

        <div class="meta mi-card">
          <p><span>点位：</span>{{ detail.pointName }}</p>
          <p><span>提交人：</span>{{ detail.submitterName || "-" }}</p>
          <p><span>填写人：</span>{{ detail.submittedBy }}</p>
          <p><span>提交时间：</span>{{ formatTime(detail.submittedAt) }}</p>
          <p><span>修改次数：</span>{{ detail.editCount || 0 }}</p>
          <p><span>状态：</span>{{ detail.isDeleted ? "已删除" : "正常" }}</p>
        </div>

        <template v-if="tab === 'final'">
          <h4 class="sub-title">最终填写内容</h4>
          <SubmissionView
            :fields="detail.fieldsSnapshot || []"
            :data="detail.data || {}"
            :images="detail.images || []"
          />
        </template>

        <template v-else>
          <div v-loading="historyLoading">
            <el-alert
              v-if="historyError"
              :title="historyError"
              type="error"
              show-icon
              :closable="false"
            />
            <el-empty
              v-else-if="!history || history.edits.length === 0"
              description="暂无修改记录"
            />
            <div v-else class="history-list">
              <section class="hist-card">
                <p class="hist-label">原始提交</p>
                <p class="mi-muted">
                  {{ history.original.submittedBy }} · {{ formatTime(history.original.at) }}
                </p>
                <SubmissionView
                  compact
                  :fields="history.fieldsSnapshot || detail.fieldsSnapshot || []"
                  :data="history.original.data || {}"
                  :images="history.original.images || []"
                />
              </section>
              <section
                v-for="edit in history.edits"
                :key="edit.id"
                class="hist-card edit"
              >
                <p class="hist-label amber">第 {{ edit.sequence }} 次修改</p>
                <p class="mi-muted">
                  {{ edit.editedByName }} · {{ formatTime(edit.editedAt) }}
                </p>
                <p class="hist-sub">修改后内容</p>
                <SubmissionView
                  compact
                  :fields="history.fieldsSnapshot || detail.fieldsSnapshot || []"
                  :data="edit.afterData || {}"
                  :images="edit.afterImages || []"
                />
              </section>
            </div>
          </div>
        </template>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from "element-plus";
import { formatFieldDisplayValue } from "~/lib/submission-utils";
import type { FormFieldDefinition } from "~/lib/types/form-fields";

definePageMeta({ layout: "admin", middleware: "admin" });

type PointItem = { id: string; code: string; name: string };
type RecordItem = {
  id: string;
  pointName: string;
  submittedBy: string;
  submitterName?: string;
  submittedAt: string;
  data: Record<string, unknown>;
  images: string[];
  fieldsSnapshot: FormFieldDefinition[];
  isDeleted: boolean;
  editCount: number;
  summary: string;
  imageCount: number;
};
type EditsResult = {
  submissionId: string;
  edits: {
    id: string;
    sequence: number;
    afterData: Record<string, unknown>;
    afterImages: string[];
    editedByName: string;
    editedAt: string;
  }[];
  fieldsSnapshot: FormFieldDefinition[];
  original: {
    data: Record<string, unknown>;
    images: string[];
    submittedBy: string;
    at: string;
  };
};

const SubmissionView = defineComponent({
  name: "SubmissionView",
  props: {
    fields: { type: Array as () => FormFieldDefinition[], default: () => [] },
    data: { type: Object as () => Record<string, unknown>, default: () => ({}) },
    images: { type: Array as () => string[], default: () => [] },
    compact: { type: Boolean, default: false },
  },
  setup(props) {
    const { getFileUrl } = useApi();
    const sorted = computed(() =>
      [...props.fields].sort((a, b) => a.order - b.order)
    );
    return () =>
      h(
        "div",
        { class: props.compact ? "sub-view compact" : "sub-view" },
        [
          ...sorted.value.map((field) => {
            if (field.type === "image_upload") return null;
            if (field.type === "group") {
              return h("p", { class: "group-label", key: field.id }, field.label);
            }
            return h(
              "div",
              {
                class: ["field-row", field.parentId ? "nested" : ""],
                key: field.id,
              },
              [
                h("p", { class: "field-label" }, field.label),
                h(
                  "p",
                  { class: "field-value" },
                  formatFieldDisplayValue(props.data[field.id])
                ),
              ]
            );
          }),
          props.images.length
            ? h("div", { class: "imgs" }, [
                h("p", { class: "field-label" }, "现场照片"),
                h(
                  "div",
                  { class: "img-grid" },
                  props.images.map((key) =>
                    h("img", {
                      key,
                      src: getFileUrl(key),
                      alt: "",
                      class: "thumb",
                    })
                  )
                ),
              ])
            : null,
        ]
      );
  },
});

const { adminRequest } = useApi();
const { getAdminSession } = useSession();

const isAdmin = ref(false);
const points = ref<PointItem[]>([]);
const list = ref<RecordItem[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const loading = ref(false);

const EMPTY = {
  pointId: "",
  keyword: "",
  startDate: "",
  endDate: "",
  showDeleted: false,
};
const draft = reactive({ ...EMPTY });
const applied = reactive({ ...EMPTY });
const dateRange = ref<string[] | null>(null);

const detail = ref<RecordItem | null>(null);
const drawerOpen = ref(false);
const tab = ref<"final" | "history">("final");
const history = ref<EditsResult | null>(null);
const historyLoading = ref(false);
const historyError = ref("");

const hasFilter = computed(
  () =>
    Boolean(
      applied.pointId ||
        applied.keyword.trim() ||
        applied.startDate ||
        applied.endDate ||
        applied.showDeleted
    )
);

watch(dateRange, (v) => {
  draft.startDate = v?.[0] || "";
  draft.endDate = v?.[1] || "";
});

watch(tab, (v) => {
  if (v === "history" && detail.value) loadHistory(detail.value.id);
});

onMounted(async () => {
  isAdmin.value = getAdminSession()?.role === "admin";
  try {
    const data = await adminRequest<{ list: PointItem[] }>(
      "/api/admin/points?status=active&pageSize=500"
    );
    points.value = data.list;
  } catch {
    points.value = [];
  }
  load();
});

async function load() {
  loading.value = true;
  try {
    const qs = new URLSearchParams();
    if (applied.pointId) qs.set("pointId", applied.pointId);
    if (applied.keyword.trim()) qs.set("keyword", applied.keyword.trim());
    if (applied.startDate) qs.set("startDate", applied.startDate);
    if (applied.endDate) qs.set("endDate", applied.endDate);
    qs.set(
      "isDeleted",
      isAdmin.value ? (applied.showDeleted ? "all" : "false") : "false"
    );
    qs.set("page", String(page.value));
    qs.set("pageSize", String(pageSize.value));
    const data = await adminRequest<{
      list: RecordItem[];
      total: number;
    }>(`/api/admin/records?${qs.toString()}`);
    list.value = data.list;
    total.value = data.total;
  } catch (e: any) {
    ElMessage.error(e?.message || "加载失败");
  } finally {
    loading.value = false;
  }
}

function applyFilters() {
  Object.assign(applied, { ...draft });
  page.value = 1;
  load();
}

function clearFilters() {
  Object.assign(draft, { ...EMPTY });
  Object.assign(applied, { ...EMPTY });
  dateRange.value = null;
  page.value = 1;
  load();
}

function onSizeChange() {
  page.value = 1;
  load();
}

function openDetail(row: RecordItem) {
  detail.value = row;
  tab.value = "final";
  history.value = null;
  historyError.value = "";
  drawerOpen.value = true;
}

async function loadHistory(id: string) {
  if (history.value?.submissionId === id) return;
  historyLoading.value = true;
  historyError.value = "";
  try {
    history.value = await adminRequest<EditsResult>(
      `/api/admin/records/${encodeURIComponent(id)}/edits`
    );
  } catch (e: any) {
    historyError.value = e?.message || "加载失败";
  } finally {
    historyLoading.value = false;
  }
}

async function handleDelete(item: RecordItem) {
  try {
    await ElMessageBox.confirm(
      `确认删除「${item.submittedBy}」的这条记录？`,
      "删除记录",
      { type: "warning", confirmButtonText: "删除" }
    );
  } catch {
    return;
  }
  try {
    await adminRequest(`/api/admin/records/${item.id}`, { method: "DELETE" });
    ElMessage.success("已删除");
    await load();
  } catch (e: any) {
    ElMessage.error(e?.message || "删除失败");
  }
}

async function handleRestore(item: RecordItem) {
  try {
    await ElMessageBox.confirm(
      `确认恢复「${item.submittedBy}」的这条记录？`,
      "恢复记录",
      { type: "warning", confirmButtonText: "恢复" }
    );
  } catch {
    return;
  }
  try {
    await adminRequest(`/api/admin/records/${item.id}/restore`, { method: "PUT" });
    ElMessage.success("已恢复");
    await load();
  } catch (e: any) {
    ElMessage.error(e?.message || "恢复失败");
  }
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
  padding: 14px 16px 6px;
  margin-bottom: 16px;
}
.filter-form {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 8px 0 10px;
  border-top: 1px solid #f0f0f0;
  margin-top: 4px;
}
.total {
  margin-left: auto;
}
.table-wrap {
  padding: 8px 8px 16px;
}
.pager {
  display: flex;
  justify-content: flex-end;
  padding: 12px 8px 0;
}
.ops {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
}
.ml {
  margin-left: 6px;
}
.meta {
  padding: 12px 14px;
  margin-bottom: 16px;
  background: #fafafa;
  box-shadow: none;
}
.meta p {
  margin: 0 0 6px;
  font-size: 13px;
}
.meta span {
  color: var(--mi-ink-3);
}
.sub-title {
  margin: 0 0 10px;
  font-size: 14px;
}
.hist-count {
  color: #e6a23c;
  font-size: 12px;
}
.history-list {
  display: grid;
  gap: 12px;
}
.hist-card {
  border: 1px solid #eee;
  border-radius: 14px;
  padding: 12px;
}
.hist-card.edit {
  border-color: #fde68a;
  background: #fffbeb;
}
.hist-label {
  margin: 0 0 4px;
  font-size: 12px;
  font-weight: 700;
  color: var(--mi-ink-3);
}
.hist-label.amber {
  color: #b45309;
}
.hist-sub {
  margin: 10px 0 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--mi-ink-3);
}
:deep(.sub-view) {
  display: grid;
  gap: 10px;
}
:deep(.sub-view.compact) {
  gap: 8px;
}
:deep(.group-label) {
  margin: 4px 0 0;
  font-size: 12px;
  font-weight: 700;
  color: var(--mi-ink-3);
}
:deep(.field-row) {
  border: 1px solid #f0f0f0;
  border-radius: 12px;
  padding: 10px 12px;
}
:deep(.field-row.nested) {
  margin-left: 12px;
}
:deep(.field-label) {
  margin: 0 0 4px;
  font-size: 12px;
  color: var(--mi-ink-3);
}
:deep(.field-value) {
  margin: 0;
  font-size: 14px;
  word-break: break-word;
}
:deep(.img-grid) {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
:deep(.thumb) {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 10px;
  border: 1px solid #eee;
}
</style>
