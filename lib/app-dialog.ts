import type { AppDialogState } from "@/components/ui/AppDialog";

export type ConfirmOptions = {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  /** 危险操作（删除等）用红色确认按钮 */
  danger?: boolean;
};

export type AlertOptions = {
  title?: string;
  message: string;
  confirmText?: string;
};

type DialogHandler = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  alert: (options: AlertOptions) => Promise<void>;
};

let handler: DialogHandler | null = null;

export function registerAppDialogHandler(next: DialogHandler | null) {
  handler = next;
}

/** 系统确认弹窗，返回是否点击确定 */
export function appConfirm(
  options: ConfirmOptions | string
): Promise<boolean> {
  const opts =
    typeof options === "string" ? { message: options } : options;
  if (!handler) {
    console.warn("AppDialog 未挂载，回退到浏览器 confirm");
    return Promise.resolve(window.confirm(opts.message));
  }
  return handler.confirm(opts);
}

/** 系统提示弹窗 */
export function appAlert(options: AlertOptions | string): Promise<void> {
  const opts =
    typeof options === "string" ? { message: options } : options;
  if (!handler) {
    console.warn("AppDialog 未挂载，回退到浏览器 alert");
    window.alert(opts.message);
    return Promise.resolve();
  }
  return handler.alert(opts);
}

export function toDialogState(
  mode: "alert" | "confirm",
  options: ConfirmOptions | AlertOptions
): AppDialogState {
  const confirmOpts = options as ConfirmOptions;
  return {
    mode,
    title:
      options.title ||
      (mode === "confirm" ? "请确认" : "提示"),
    message: options.message,
    confirmText:
      options.confirmText || (mode === "confirm" ? "确定" : "知道了"),
    cancelText: confirmOpts.cancelText || "取消",
    danger: Boolean(confirmOpts.danger),
  };
}
