<template>
  <div>
    <div class="head">
      <div>
        <h1 class="mi-section-title">点位管理</h1>
        <p class="mi-muted">共 {{ total }} 个点位</p>
      </div>
      <el-button
        v-if="can('btn:points.create')"
        type="primary"
        round
        @click="openCreate"
      >
        新增点位
      </el-button>
    </div>

    <div class="mi-card filters">
      <el-input
        v-model="keyword"
        clearable
        placeholder="搜索名称 / 编码"
        class="kw"
        @keyup.enter="search"
      />
      <el-select v-model="status" clearable placeholder="全部状态" style="width: 140px" @change="search">
        <el-option label="生效" value="active" />
        <el-option label="已失效" value="inactive" />
      </el-select>
      <el-button type="primary" @click="search">查询</el-button>
    </div>

    <div class="mi-card table-wrap">
      <el-table v-loading="loading" :data="list" stripe empty-text="暂无点位数据">
        <el-table-column prop="code" label="编码" min-width="120">
          <template #default="{ row }">
            <code class="mono">{{ row.code }}</code>
          </template>
        </el-table-column>
        <el-table-column label="点位名称" min-width="180">
          <template #default="{ row }">
            <div class="name">{{ row.name }}</div>
            <div v-if="row.description" class="mi-muted clamp">{{ row.description }}</div>
          </template>
        </el-table-column>
        <el-table-column label="关联模板" min-width="140">
          <template #default="{ row }">
            <span>{{ row.template?.name || "-" }}</span>
            <span v-if="row.template" class="mi-muted"> v{{ row.template.version }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'info'" round size="small">
              {{ row.status === "active" ? "生效" : "已失效" }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" min-width="280" fixed="right">
          <template #default="{ row }">
            <div class="ops">
              <el-button link type="primary" @click="goDetail(row.id)">详情</el-button>
              <el-button
                v-if="can('btn:points.edit')"
                link
                type="primary"
                @click="openEdit(row)"
              >
                编辑
              </el-button>
              <el-button
                v-if="can('btn:points.template')"
                link
                type="primary"
                @click="goTemplate(row.id)"
              >
                模板
              </el-button>
              <el-button
                v-if="can('btn:points.qr')"
                link
                @click="downloadQr(row.code)"
              >
                下载二维码
              </el-button>
              <el-button
                v-if="can('btn:points.edit')"
                link
                type="warning"
                @click="toggleStatus(row)"
              >
                {{ row.status === "active" ? "失效" : "生效" }}
              </el-button>
              <el-button
                v-if="can('btn:points.delete')"
                link
                type="danger"
                @click="handleDelete(row)"
              >
                删除
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

    <el-dialog
      v-model="dialogOpen"
      :title="dialogMode === 'create' ? '新增点位' : '编辑点位'"
      width="480px"
      destroy-on-close
    >
      <el-form label-position="top">
        <el-form-item label="名称" required>
          <el-input v-model="form.name" placeholder="如：A栋1楼东侧毒饵站" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="3"
            placeholder="点位备注（可选）"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.status" style="width: 100%">
            <el-option label="启用" value="active" />
            <el-option label="禁用" value="inactive" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogOpen = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from "element-plus";

definePageMeta({ layout: "admin", middleware: "admin" });

type AdminPointItem = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: "active" | "inactive";
  template: { id: string; name: string; version: number } | null;
};

const { adminRequest } = useApi();
const { can } = usePermission();
const router = useRouter();

const keyword = ref("");
const status = ref("");
const list = ref<AdminPointItem[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const loading = ref(false);

const dialogOpen = ref(false);
const dialogMode = ref<"create" | "edit">("create");
const editing = ref<AdminPointItem | null>(null);
const submitting = ref(false);
const form = reactive({
  name: "",
  description: "",
  status: "active" as "active" | "inactive",
});

onMounted(() => {
  load();
});

async function load() {
  loading.value = true;
  try {
    const qs = new URLSearchParams();
    if (keyword.value.trim()) qs.set("keyword", keyword.value.trim());
    if (status.value) qs.set("status", status.value);
    qs.set("page", String(page.value));
    qs.set("pageSize", String(pageSize.value));
    const data = await adminRequest<{
      list: AdminPointItem[];
      pagination: { total: number };
    }>(`/api/admin/points?${qs.toString()}`);
    list.value = data.list;
    total.value = data.pagination.total;
  } catch (e: any) {
    ElMessage.error(e?.message || "加载失败");
  } finally {
    loading.value = false;
  }
}

function search() {
  page.value = 1;
  load();
}

function onSizeChange() {
  page.value = 1;
  load();
}

function openCreate() {
  dialogMode.value = "create";
  editing.value = null;
  form.name = "";
  form.description = "";
  form.status = "active";
  dialogOpen.value = true;
}

function openEdit(item: AdminPointItem) {
  dialogMode.value = "edit";
  editing.value = item;
  form.name = item.name;
  form.description = item.description || "";
  form.status = item.status;
  dialogOpen.value = true;
}

async function handleSave() {
  if (!form.name.trim()) {
    ElMessage.warning("请填写点位名称");
    return;
  }
  submitting.value = true;
  try {
    const body = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      status: form.status,
    };
    if (dialogMode.value === "create") {
      await adminRequest("/api/admin/points", {
        method: "POST",
        body: JSON.stringify(body),
      });
      ElMessage.success("点位已创建");
    } else if (editing.value) {
      await adminRequest(`/api/admin/points/${editing.value.id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      ElMessage.success("点位已更新");
    }
    dialogOpen.value = false;
    await load();
  } catch (e: any) {
    ElMessage.error(e?.message || "保存失败");
  } finally {
    submitting.value = false;
  }
}

async function toggleStatus(item: AdminPointItem) {
  const next = item.status === "active" ? "inactive" : "active";
  try {
    await ElMessageBox.confirm(
      `确认将点位「${item.name}」设为${next === "active" ? "生效" : "失效"}？`,
      "变更状态",
      { type: "warning", confirmButtonText: "确认" }
    );
  } catch {
    return;
  }
  try {
    await adminRequest(`/api/admin/points/${item.id}`, {
      method: "PUT",
      body: JSON.stringify({ status: next }),
    });
    ElMessage.success("状态已更新");
    await load();
  } catch (e: any) {
    ElMessage.error(e?.message || "操作失败");
  }
}

async function handleDelete(item: AdminPointItem) {
  try {
    await ElMessageBox.confirm(
      `确认软删除点位「${item.name}」？历史记录将保留。`,
      "删除点位",
      { type: "warning", confirmButtonText: "删除", confirmButtonClass: "el-button--danger" }
    );
  } catch {
    return;
  }
  try {
    await adminRequest(`/api/admin/points/${item.id}`, { method: "DELETE" });
    ElMessage.success("已删除");
    await load();
  } catch (e: any) {
    ElMessage.error(e?.message || "删除失败");
  }
}

function downloadQr(code: string) {
  const origin = window.location.origin;
  const qs = origin ? `?origin=${encodeURIComponent(origin)}` : "";
  const a = document.createElement("a");
  a.href = `/api/qrcode/download/${encodeURIComponent(code)}${qs}`;
  a.download = "";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function goDetail(id: string) {
  router.push(`/admin/points/${id}`);
}

function goTemplate(id: string) {
  router.push(`/admin/points/${id}/template`);
}
</script>

<style scoped>
.head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
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
.kw {
  flex: 1;
  min-width: 220px;
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
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
}
.name {
  font-weight: 600;
}
.clamp {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 240px;
}
</style>
