<template>
  <div>
    <div class="head">
      <div>
        <h1 class="mi-section-title">角色管理</h1>
        <p class="mi-muted">配置角色，并按菜单 / 按钮授权</p>
      </div>
      <el-button v-if="can('btn:roles.create')" type="primary" round @click="openCreate">
        新增角色
      </el-button>
    </div>

    <div class="mi-card table-wrap">
      <el-table v-loading="loading" :data="list" stripe empty-text="暂无角色">
        <el-table-column prop="name" label="角色名称" min-width="120" />
        <el-table-column label="编码" min-width="120">
          <template #default="{ row }">
            <code class="mono">{{ row.code }}</code>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="说明" min-width="180" show-overflow-tooltip />
        <el-table-column label="类型" width="100">
          <template #default="{ row }">
            <el-tag :type="row.isSystem ? 'warning' : 'info'" size="small" round>
              {{ row.isSystem ? "系统" : "自定义" }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="用户数" width="90" prop="userCount" />
        <el-table-column label="权限数" width="90" prop="permissionCount" />
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="can('btn:roles.grant')"
              link
              type="primary"
              @click="openGrant(row)"
            >
              授权
            </el-button>
            <el-button
              v-if="can('btn:roles.edit')"
              link
              type="primary"
              @click="openEdit(row)"
            >
              编辑
            </el-button>
            <el-button
              v-if="can('btn:roles.delete')"
              link
              type="danger"
              :disabled="row.isSystem"
              :title="row.isSystem ? '系统角色不可删除' : '删除角色'"
              @click="!row.isSystem && handleDelete(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog
      v-model="dialogOpen"
      :title="dialogMode === 'create' ? '新增角色' : '编辑角色'"
      width="480px"
      destroy-on-close
    >
      <el-form label-position="top">
        <el-form-item label="角色编码" required>
          <el-input
            v-model="form.code"
            :disabled="dialogMode === 'edit' || editing?.isSystem"
            placeholder="如 ops_leader"
          />
        </el-form-item>
        <el-form-item label="角色名称" required>
          <el-input v-model="form.name" placeholder="显示名称" />
        </el-form-item>
        <el-form-item label="说明">
          <el-input v-model="form.description" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogOpen = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="grantOpen" title="角色授权" size="420px">
      <p class="grant-tip">
        为「{{ granting?.name }}」勾选可访问的菜单与按钮。管理员角色始终拥有全部权限。
      </p>
      <el-tree
        ref="treeRef"
        :data="treeData"
        show-checkbox
        node-key="key"
        default-expand-all
        :props="{ label: 'label', children: 'children' }"
        :default-checked-keys="checkedKeys"
      />
      <template #footer>
        <el-button @click="grantOpen = false">取消</el-button>
        <el-button
          type="primary"
          :loading="grantingSaving"
          :disabled="granting?.code === 'admin'"
          @click="saveGrant"
        >
          保存授权
        </el-button>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from "element-plus";
import type { PermissionNode } from "~/shared/permissions";

definePageMeta({ layout: "admin", middleware: "admin" });

type RoleItem = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  status: string;
  userCount: number;
  permissionCount: number;
  permissions: string[];
};

const { adminRequest } = useApi();
const { can } = usePermission();

const list = ref<RoleItem[]>([]);
const loading = ref(false);
const dialogOpen = ref(false);
const dialogMode = ref<"create" | "edit">("create");
const editing = ref<RoleItem | null>(null);
const submitting = ref(false);
const form = reactive({ code: "", name: "", description: "" });

const grantOpen = ref(false);
const granting = ref<RoleItem | null>(null);
const grantingSaving = ref(false);
const treeData = ref<PermissionNode[]>([]);
const checkedKeys = ref<string[]>([]);
const treeRef = ref<any>(null);

onMounted(async () => {
  await Promise.all([load(), loadCatalog()]);
});

async function load() {
  loading.value = true;
  try {
    const data = await adminRequest<{ list: RoleItem[] }>("/api/admin/roles?pageSize=100");
    list.value = data.list;
  } catch (e: any) {
    ElMessage.error(e?.message || "加载失败");
  } finally {
    loading.value = false;
  }
}

async function loadCatalog() {
  try {
    const data = await adminRequest<{ catalog: PermissionNode[] }>(
      "/api/admin/permissions/catalog"
    );
    treeData.value = data.catalog;
  } catch {
    /* ignore */
  }
}

function openCreate() {
  dialogMode.value = "create";
  editing.value = null;
  form.code = "";
  form.name = "";
  form.description = "";
  dialogOpen.value = true;
}

function openEdit(row: RoleItem) {
  dialogMode.value = "edit";
  editing.value = row;
  form.code = row.code;
  form.name = row.name;
  form.description = row.description || "";
  dialogOpen.value = true;
}

function openGrant(row: RoleItem) {
  granting.value = row;
  checkedKeys.value = [...(row.permissions || [])];
  grantOpen.value = true;
  nextTick(() => {
    treeRef.value?.setCheckedKeys(checkedKeys.value);
  });
}

async function handleSave() {
  if (dialogMode.value === "create" && !form.code.trim()) {
    ElMessage.warning("请填写角色编码");
    return;
  }
  if (!form.name.trim()) {
    ElMessage.warning("请填写角色名称");
    return;
  }
  submitting.value = true;
  try {
    if (dialogMode.value === "create") {
      await adminRequest("/api/admin/roles", {
        method: "POST",
        body: JSON.stringify({
          code: form.code.trim(),
          name: form.name.trim(),
          description: form.description.trim(),
          permissions: [],
        }),
      });
      ElMessage.success("角色已创建");
    } else if (editing.value) {
      await adminRequest(`/api/admin/roles/${editing.value.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim(),
        }),
      });
      ElMessage.success("角色已更新");
    }
    dialogOpen.value = false;
    await load();
  } catch (e: any) {
    ElMessage.error(e?.message || "保存失败");
  } finally {
    submitting.value = false;
  }
}

async function saveGrant() {
  if (!granting.value) return;
  if (granting.value.code === "admin") {
    ElMessage.info("管理员固定拥有全部权限");
    return;
  }
  const keys: string[] = treeRef.value?.getCheckedKeys(false) || [];
  const half: string[] = treeRef.value?.getHalfCheckedKeys?.() || [];
  const all = Array.from(new Set([...keys, ...half]));
  grantingSaving.value = true;
  try {
    await adminRequest(`/api/admin/roles/${granting.value.id}/permissions`, {
      method: "PUT",
      body: JSON.stringify({ permissions: all }),
    });
    ElMessage.success("授权已保存");
    grantOpen.value = false;
    await load();
  } catch (e: any) {
    ElMessage.error(e?.message || "授权失败");
  } finally {
    grantingSaving.value = false;
  }
}

async function handleDelete(row: RoleItem) {
  try {
    await ElMessageBox.confirm(
      `确认删除角色「${row.name}」？删除后不可恢复。`,
      "删除角色",
      { type: "warning", confirmButtonText: "删除" }
    );
  } catch {
    return;
  }
  try {
    await adminRequest(`/api/admin/roles/${row.id}`, { method: "DELETE" });
    ElMessage.success("已删除");
    await load();
  } catch (e: any) {
    ElMessage.error(e?.message || "删除失败");
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
.table-wrap {
  padding: 8px 8px 16px;
}
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
}
.grant-tip {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--mi-ink-3);
}
</style>
