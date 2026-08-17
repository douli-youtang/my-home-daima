<template>
  <div>
    <div class="head">
      <h1 class="mi-section-title">参数设置</h1>
      <p class="mi-muted">配置系统参数</p>
    </div>

    <div v-loading="loadingSettings" class="basic">
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

      <el-button
        v-if="can('btn:settings.save')"
        type="primary"
        :loading="saving"
        @click="handleSave"
      >
        {{ saving ? "保存中..." : "保存设置" }}
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from "element-plus";

definePageMeta({ layout: "admin", middleware: "admin" });

type SystemSettingsDTO = {
  systemName: string;
  sessionDays: number;
  maxSubmissionEdits: number;
  pointLockHours: number;
  editWindowHours: number;
};

const { adminRequest } = useApi();
const { can } = usePermission();

const settings = reactive<SystemSettingsDTO>({
  systemName: "",
  sessionDays: 7,
  maxSubmissionEdits: 2,
  pointLockHours: 6,
  editWindowHours: 6,
});
const loadingSettings = ref(true);
const saving = ref(false);

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
</script>

<style scoped>
.head {
  margin-bottom: 16px;
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
</style>
