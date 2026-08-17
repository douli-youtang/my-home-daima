<template>
  <el-dialog
    :model-value="modelValue"
    :title="forced ? '请修改密码' : '修改密码'"
    width="420px"
    :close-on-click-modal="!forced"
    :show-close="!forced"
    @close="!forced && emit('update:modelValue', false)"
  >
    <el-form label-position="top" @submit.prevent="submit">
      <el-form-item v-if="!forced" label="当前密码">
        <el-input v-model="currentPassword" type="password" show-password />
      </el-form-item>
      <el-form-item label="新密码">
        <el-input v-model="newPassword" type="password" show-password placeholder="至少 6 位" />
      </el-form-item>
      <el-form-item label="确认新密码">
        <el-input v-model="confirmPassword" type="password" show-password />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button v-if="!forced" @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" class="mi-press" :loading="loading" @click="submit">
        确认修改
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ElMessage } from "element-plus";

const props = defineProps<{
  modelValue: boolean;
  forced?: boolean;
  openid: string;
  defaultAccount?: string;
}>();
const emit = defineEmits<{
  "update:modelValue": [boolean];
  success: [];
}>();

const currentPassword = ref("");
const newPassword = ref("");
const confirmPassword = ref("");
const loading = ref(false);

async function submit() {
  if (newPassword.value.length < 6) {
    ElMessage.warning("新密码至少 6 位");
    return;
  }
  if (newPassword.value !== confirmPassword.value) {
    ElMessage.warning("两次输入的新密码不一致");
    return;
  }
  loading.value = true;
  try {
    await apiRequest("/api/password/change", {
      method: "POST",
      body: JSON.stringify({
        openid: props.openid,
        name: props.defaultAccount,
        currentPassword: props.forced ? undefined : currentPassword.value,
        newPassword: newPassword.value,
        firstLogin: props.forced,
      }),
    });
    ElMessage.success("密码已修改");
    emit("success");
    emit("update:modelValue", false);
  } catch (e: any) {
    ElMessage.error(e?.message || "修改失败");
  } finally {
    loading.value = false;
  }
}
</script>
