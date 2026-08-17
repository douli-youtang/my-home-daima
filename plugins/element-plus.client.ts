import { ElLoading, ElMessage, ElMessageBox, ElNotification } from "element-plus";

/**
 * 确保 ElMessage / ElMessageBox 等命令式 API 在客户端可用，
 * 避免未自动导入时点击保存/登录无响应。
 */
export default defineNuxtPlugin(() => {
  return {
    provide: {
      message: ElMessage,
      msgbox: ElMessageBox,
      notify: ElNotification,
      loading: ElLoading,
    },
  };
});
