<template>
  <div>
    <div class="head">
      <div>
        <h1 class="mi-section-title">用户管理</h1>
        <p class="mi-muted">管理系统用户与角色权限</p>
      </div>
      <el-button type="primary" round @click="openCreate">新增用户</el-button>
    </div>

    <div class="mi-card filters">
      <el-input
        v-model="keyword"
        clearable
        placeholder="搜索姓名 / openid"
        class="kw"
        @keyup.enter="search"
      />
      <el-select
        v-model="roleFilter"
        clearable
        placeholder="全部角色"
        style="width: 160px"
        @change="search"
      >
        <el-option label="worker" value="worker" />
        <el-option label="maintainer" value="maintainer" />
        <el-option label="admin" value="admin" />
      </el-select>
      <el-button type="primary" @click="search">查询</el-button>
    </div>

    <div class="mi-card table-wrap">
      <el-table v-loading="loading" :data="list" stripe empty-text="暂无用户">
        <el-table-column label="序号" width="70">
          <template #default="{ $index }">
            {{ (page - 1) * pageSize + $index + 1 }}
          </template>
        </el-table-column>
        <el-table-column prop="name" label="姓名" min-width="120" />
        <el-table-column label="openid" min-width="140">
          <template #default="{ row }">
            <code class="mono">{{ maskOpenid(row.openid) }}</code>
          </template>
        </el-table-column>
        <el-table-column label="角色" width="120">
          <template #default="{ row }">
            <el-tag :type="roleTagType(row.role)" size="small" round>
              {{ ROLE_LABELS[row.role] || row.role }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'info'" size="small" round>
              {{ row.status === "active" ? "启用" : "禁用" }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" min-width="170">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button
              link
              type="danger"
              :disabled="row.openid === selfOpenid"
              @click="handleDelete(row)"
            >
              删除
            </el-button>
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
      :title="dialogMode === 'create' ? '新增用户' : '编辑用户'"
      width="480px"
      destroy-on-close
    >
      <el-form label-position="top">
        <el-form-item label="openid" required>
          <el-input
            v-model="form.openid"
            :disabled="dialogMode === 'edit'"
            placeholder="如 worker_new"
          />
        </el-form-item>
        <el-form-item label="姓名" required>
          <el-input v-model="form.name" placeholder="真实姓名" />
        </el-form-item>
        <el-form-item :required="dialogMode === 'create'">
          <template #label>
            {{ dialogMode === "create" ? "密码" : "重置密码" }}
            <span v-if="dialogMode === 'edit'" class="mi-muted">（留空则不修改）</span>
          </template>
          <el-input
            v-model="form.password"
            type="password"
            show-password
            autocomplete="new-password"
            :placeholder="
              dialogMode === 'create'
                ? `至少 ${MIN_PASSWORD_LENGTH} 位`
                : '填写则重置密码'
            "
          />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="form.role" style="width: 100%">
            <el-option label="worker（作业人员）" value="worker" />
            <el-option label="maintainer（维护员）" value="maintainer" />
            <el-option label="admin（管理员）" value="admin" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-checkbox v-model="formActive">启用状态</el-checkbox>
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
import { maskOpenid } from "~/lib/mask";
import { MIN_PASSWORD_LENGTH } from "~/lib/password-policy";

definePageMeta({ layout: "admin", middleware: "admin" });

type UserItem = {
  id: string;
  openid: string;
  name: string;
  role: "worker" | "maintainer" | "admin";
  status: "active" | "inactive";
  createdAt: string;
};

const ROLE_LABELS: Record<string, string> = {
  admin: "管理员",
  maintainer: "维护员",
  worker: "作业人员",
};

const { adminRequest } = useApi();
const { getAdminSession } = useSession();

const selfOpenid = ref("");
const keyword = ref("");
const roleFilter = ref("");
const list = ref<UserItem[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const loading = ref(false);

const dialogOpen = ref(false);
const dialogMode = ref<"create" | "edit">("create");
const editing = ref<UserItem | null>(null);
const submitting = ref(false);
const form = reactive({
  openid: "",
  name: "",
  role: "worker" as UserItem["role"],
  status: "active" as UserItem["status"],
  password: "",
});
const formActive = computed({
  get: () => form.status === "active",
  set: (v: boolean) => {
    form.status = v ? "active" : "inactive";
  },
});

onMounted(() => {
  selfOpenid.value = getAdminSession()?.openid || "";
  load();
});

async function load() {
  loading.value = true;
  try {
    const qs = new URLSearchParams();
    if (keyword.value.trim()) qs.set("keyword", keyword.value.trim());
    if (roleFilter.value) qs.set("role", roleFilter.value);
    qs.set("page", String(page.value));
    qs.set("pageSize", String(pageSize.value));
    const data = await adminRequest<{
      list: UserItem[];
      pagination: { total: number };
    }>(`/api/admin/users?${qs.toString()}`);
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
  form.openid = "";
  form.name = "";
  form.role = "worker";
  form.status = "active";
  form.password = "";
  dialogOpen.value = true;
}

function openEdit(item: UserItem) {
  dialogMode.value = "edit";
  editing.value = item;
  form.openid = item.openid;
  form.name = item.name;
  form.role = item.role;
  form.status = item.status;
  form.password = "";
  dialogOpen.value = true;
}

async function handleSave() {
  if (dialogMode.value === "create" && !form.openid.trim()) {
    ElMessage.warning("请填写 openid");
    return;
  }
  if (!form.name.trim()) {
    ElMessage.warning("请填写姓名");
    return;
  }
  if (dialogMode.value === "create") {
    if (!form.password) {
      ElMessage.warning("请设置密码");
      return;
    }
    if (form.password.length < MIN_PASSWORD_LENGTH) {
      ElMessage.warning(`密码至少 ${MIN_PASSWORD_LENGTH} 位`);
      return;
    }
  } else if (form.password && form.password.length < MIN_PASSWORD_LENGTH) {
    ElMessage.warning(`密码至少 ${MIN_PASSWORD_LENGTH} 位`);
    return;
  }

  submitting.value = true;
  try {
    if (dialogMode.value === "create") {
      await adminRequest("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          openid: form.openid.trim(),
          name: form.name.trim(),
          role: form.role,
          status: form.status,
          password: form.password,
        }),
      });
      ElMessage.success("用户已创建");
    } else if (editing.value) {
      await adminRequest(`/api/admin/users/${editing.value.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: form.name.trim(),
          role: form.role,
          status: form.status,
          ...(form.password ? { password: form.password } : {}),
        }),
      });
      ElMessage.success(form.password ? "用户已更新（密码已重置）" : "用户已更新");
    }
    dialogOpen.value = false;
    await load();
  } catch (e: any) {
    ElMessage.error(e?.message || "保存失败");
  } finally {
    submitting.value = false;
  }
}

async function handleDelete(item: UserItem) {
  if (item.openid === selfOpenid.value) {
    ElMessage.warning("不可删除自己");
    return;
  }
  try {
    await ElMessageBox.confirm(`确认禁用用户「${item.name}」？`, "禁用用户", {
      type: "warning",
      confirmButtonText: "禁用",
    });
  } catch {
    return;
  }
  try {
    await adminRequest(`/api/admin/users/${item.id}`, { method: "DELETE" });
    ElMessage.success("用户已禁用");
    await load();
  } catch (e: any) {
    ElMessage.error(e?.message || "删除失败");
  }
}

function roleTagType(role: string) {
  if (role === "admin") return "danger";
  if (role === "maintainer") return "warning";
  return "";
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
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
}
</style>
