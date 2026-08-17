<template>
  <div>
    <div class="head">
      <div>
        <h1 class="mi-section-title">点位详情</h1>
        <p class="mi-muted">查看与编辑点位信息</p>
      </div>
      <div class="actions">
        <el-button round @click="router.push('/admin/points')">返回列表</el-button>
        <el-button
          v-if="item"
          round
          @click="downloadQr(item.code)"
        >
          下载二维码
        </el-button>
        <el-button
          v-if="item && isAdmin"
          type="primary"
          round
          @click="router.push(`/admin/points/${item.id}/template`)"
        >
          模板编辑
        </el-button>
      </div>
    </div>

    <div v-loading="loading" class="mi-card panel">
      <template v-if="error">
        <el-alert :title="error" type="error" show-icon :closable="false" />
        <el-button class="mt" type="primary" link @click="router.push('/admin/points')">
          返回点位列表
        </el-button>
      </template>

      <template v-else-if="item">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="编码">
            <code class="mono">{{ item.code }}</code>
          </el-descriptions-item>
          <el-descriptions-item label="模板">
            {{ item.template?.name || "-" }}
            <span v-if="item.template" class="mi-muted"> v{{ item.template.version }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="创建时间">
            {{ formatTime(item.createdAt) }}
          </el-descriptions-item>
          <el-descriptions-item label="更新时间">
            {{ formatTime(item.updatedAt) }}
          </el-descriptions-item>
        </el-descriptions>

        <el-divider />

        <el-form label-position="top" class="edit-form">
          <el-form-item label="名称" required>
            <el-input v-model="form.name" :disabled="!isAdmin" />
          </el-form-item>
          <el-form-item label="描述">
            <el-input
              v-model="form.description"
              type="textarea"
              :rows="3"
              :disabled="!isAdmin"
            />
          </el-form-item>
          <el-form-item label="状态">
            <el-select v-model="form.status" style="width: 100%" :disabled="!isAdmin">
              <el-option label="生效" value="active" />
              <el-option label="已失效" value="inactive" />
            </el-select>
          </el-form-item>
          <el-button
            v-if="isAdmin"
            type="primary"
            :loading="saving"
            @click="handleSave"
          >
            保存修改
          </el-button>
        </el-form>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from "element-plus";

definePageMeta({ layout: "admin", middleware: "admin" });

type AdminPointItem = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
  template: { id: string; name: string; version: number } | null;
};

const route = useRoute();
const router = useRouter();
const { adminRequest } = useApi();
const { getAdminSession } = useSession();

const isAdmin = ref(false);
const loading = ref(true);
const saving = ref(false);
const error = ref("");
const item = ref<AdminPointItem | null>(null);
const form = reactive({
  name: "",
  description: "",
  status: "active" as "active" | "inactive",
});

const pointId = computed(() => String(route.params.id || ""));

onMounted(() => {
  isAdmin.value = getAdminSession()?.role === "admin";
  load();
});

watch(pointId, () => load());

async function load() {
  if (!pointId.value) return;
  loading.value = true;
  error.value = "";
  try {
    const data = await adminRequest<AdminPointItem>(
      `/api/admin/points/${encodeURIComponent(pointId.value)}`
    );
    item.value = data;
    form.name = data.name;
    form.description = data.description || "";
    form.status = data.status;
  } catch (e: any) {
    item.value = null;
    error.value = e?.message || "点位不存在或已删除";
  } finally {
    loading.value = false;
  }
}

async function handleSave() {
  if (!item.value) return;
  if (!form.name.trim()) {
    ElMessage.warning("请填写点位名称");
    return;
  }
  saving.value = true;
  try {
    const data = await adminRequest<AdminPointItem>(
      `/api/admin/points/${item.value.id}`,
      {
        method: "PUT",
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || "",
          status: form.status,
        }),
      }
    );
    item.value = data;
    ElMessage.success("已保存");
  } catch (e: any) {
    ElMessage.error(e?.message || "保存失败");
  } finally {
    saving.value = false;
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
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.panel {
  padding: 20px;
  max-width: 640px;
}
.edit-form {
  max-width: 480px;
}
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
}
.mt {
  margin-top: 12px;
}
</style>
