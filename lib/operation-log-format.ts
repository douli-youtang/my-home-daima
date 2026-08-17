/**
 * 将操作日志整理成普通人能看懂的说明
 */

export const OPERATION_ACTION_LABELS: Record<string, string> = {
  delete_record: "删除了一条工作记录",
  restore_record: "恢复了一条工作记录",
  update_template: "修改了填报表单",
  deactivate_point: "停用了点位",
  activate_point: "启用了点位",
  create_point: "新增了点位",
  update_point: "修改了点位信息",
  delete_point: "删除了点位",
  update_user: "修改了用户信息",
  delete_user: "停用了用户",
  create_user: "新增了用户",
  update_settings: "修改了系统参数",
  create_role: "新增了角色",
  update_role: "修改了角色",
  delete_role: "删除了角色",
  grant_role: "调整了角色权限",
};

export function getActionLabel(action: string): string {
  return OPERATION_ACTION_LABELS[action] || "进行了一次操作";
}

export type FormattedOperationLog = {
  /** 一句话标题，如：新增了点位 */
  title: string;
  /** 白话说明 */
  description: string;
  /** 关联对象显示名 */
  targetName: string;
  /** 可跳转链接 */
  href: string | null;
  /** 分类色：create / update / danger / info */
  tone: "create" | "update" | "danger" | "info";
};

function asRecord(detail: unknown): Record<string, any> {
  if (detail && typeof detail === "object" && !Array.isArray(detail)) {
    return detail as Record<string, any>;
  }
  return {};
}

function quote(v: unknown): string {
  const s = String(v ?? "").trim();
  return s ? `「${s}」` : "";
}

function statusText(v: unknown): string {
  if (v === "active") return "启用";
  if (v === "inactive") return "停用";
  return String(v ?? "");
}

function roleText(v: unknown): string {
  if (!v) return "";
  if (typeof v === "object" && v && "name" in (v as object)) {
    return String((v as any).name || (v as any).code || "");
  }
  if (v === "admin") return "系统管理员";
  if (v === "maintainer") return "运营管理员";
  if (v === "worker") return "作业人员";
  return String(v);
}

function diffLines(
  before: Record<string, any> | undefined,
  after: Record<string, any> | undefined,
  labels: Record<string, string>,
  formatters?: Record<string, (v: unknown) => string>
): string[] {
  if (!before || !after) return [];
  const lines: string[] = [];
  for (const key of Object.keys(labels)) {
    const b = before[key];
    const a = after[key];
    if (JSON.stringify(b) === JSON.stringify(a)) continue;
    const fmt = formatters?.[key] || ((v: unknown) => String(v ?? "空"));
    lines.push(`${labels[key]}：${fmt(b)} → ${fmt(a)}`);
  }
  return lines;
}

function toneOf(action: string): FormattedOperationLog["tone"] {
  if (action.startsWith("create_") || action.startsWith("activate_") || action === "restore_record") {
    return "create";
  }
  if (action.startsWith("delete_") || action.startsWith("deactivate_")) {
    return "danger";
  }
  if (action.startsWith("update_") || action === "grant_role") {
    return "update";
  }
  return "info";
}

export function formatOperationLog(
  action: string,
  detail: unknown,
  ctx?: {
    pointName?: string | null;
    pointCode?: string | null;
    targetUserName?: string | null;
  }
): FormattedOperationLog {
  const d = asRecord(detail);
  const title = getActionLabel(action);
  const tone = toneOf(action);
  let description = "暂无更多说明";
  let targetName = "-";
  let href: string | null = null;

  switch (action) {
    case "create_point":
    case "delete_point": {
      const name = d.name || ctx?.pointName;
      const code = d.code || ctx?.pointCode;
      targetName = name ? String(name) : code ? String(code) : "点位";
      description = [
        name ? `点位名称${quote(name)}` : "",
        code ? `编码 ${code}` : "",
      ]
        .filter(Boolean)
        .join("，") || "已处理点位";
      href = "/admin/points";
      break;
    }
    case "update_point":
    case "activate_point":
    case "deactivate_point": {
      const name = d.after?.name || d.before?.name || ctx?.pointName || "点位";
      targetName = String(name);
      const lines = diffLines(
        d.before,
        d.after,
        {
          name: "名称",
          status: "状态",
          description: "备注",
        },
        {
          status: statusText,
          description: (v) => (v ? String(v) : "空"),
        }
      );
      description = lines.length ? lines.join("；") : `点位${quote(name)}信息已更新`;
      href = d.after || d.before ? "/admin/points" : "/admin/points";
      if (ctx?.pointName || d.after?.name) {
        // keep list link; detail page needs id which may be targetId handled by caller
      }
      break;
    }
    case "update_template": {
      const pointName = ctx?.pointName || "某点位";
      targetName = String(pointName);
      const beforeCount = Array.isArray(d.beforeFields) ? d.beforeFields.length : null;
      const afterCount = Array.isArray(d.afterFields) ? d.afterFields.length : null;
      const parts = [`点位${quote(pointName)}的填报表单`];
      if (d.beforeVersion != null && d.afterVersion != null) {
        parts.push(`版本 ${d.beforeVersion} → ${d.afterVersion}`);
      }
      if (beforeCount != null && afterCount != null) {
        parts.push(`字段数量 ${beforeCount} → ${afterCount}`);
      }
      description = parts.join("，");
      href = null; // filled by caller with pointId
      break;
    }
    case "create_user": {
      const name = d.name || d.after?.name || ctx?.targetUserName || "新用户";
      targetName = String(name);
      const role = roleText(d.role || d.after?.role);
      description = [
        `用户${quote(name)}`,
        role ? `角色为${role}` : "",
      ]
        .filter(Boolean)
        .join("，");
      href = "/admin/users";
      break;
    }
    case "update_user": {
      const name = d.after?.name || d.before?.name || ctx?.targetUserName || "用户";
      targetName = String(name);
      const lines = diffLines(
        d.before,
        d.after,
        { name: "姓名", role: "角色", status: "状态" },
        { role: roleText, status: statusText }
      );
      if (d.passwordReset) lines.push("已重置登录密码");
      description = lines.length ? lines.join("；") : `用户${quote(name)}信息已更新`;
      href = "/admin/users";
      break;
    }
    case "delete_user": {
      const name = d.name || ctx?.targetUserName || "用户";
      targetName = String(name);
      description = `已停用用户${quote(name)}`;
      href = "/admin/users";
      break;
    }
    case "delete_record":
    case "restore_record": {
      targetName = "工作记录";
      description =
        action === "delete_record"
          ? "该条现场填报记录已标记为删除"
          : "该条现场填报记录已恢复为有效";
      href = "/admin/records";
      break;
    }
    case "update_settings": {
      targetName = "系统参数";
      const lines = diffLines(
        d.before,
        d.after,
        {
          systemName: "系统名称",
          sessionDays: "登录有效期（天）",
          maxSubmissionEdits: "允许修改次数",
          pointLockHours: "二维码占用时长（小时）",
          editWindowHours: "可修改时长（小时）",
        },
        {
          pointLockHours: (v) => (Number(v) === 0 ? "不限制" : `${v} 小时`),
          editWindowHours: (v) => (Number(v) === 0 ? "不限制" : `${v} 小时`),
          maxSubmissionEdits: (v) => (Number(v) === 0 ? "不可修改" : `${v} 次`),
        }
      );
      description = lines.length ? lines.join("；") : "系统参数已保存（内容未变化）";
      href = "/admin/settings";
      break;
    }
    case "create_role":
    case "update_role":
    case "delete_role":
    case "grant_role": {
      const name =
        d.name ||
        d.after?.name ||
        d.before?.name ||
        ctx?.targetUserName || // 复用：API 可把角色名塞进此字段
        d.code ||
        "角色";
      targetName = String(name);
      if (action === "grant_role") {
        const n = Array.isArray(d.permissions) ? d.permissions.length : null;
        description = n != null
          ? `角色${quote(name)}现有 ${n} 项权限`
          : `已调整角色${quote(name)}的权限`;
      } else if (action === "create_role") {
        description = `新增角色${quote(name)}`;
      } else if (action === "delete_role") {
        description = `删除角色${quote(name)}`;
      } else {
        description = `角色${quote(name)}信息已更新`;
      }
      href = "/admin/roles";
      break;
    }
    default: {
      description = "请到相关功能页面查看具体变更";
      break;
    }
  }

  return { title, description, targetName, href, tone };
}

/** 友好时间：今天 / 昨天 / 具体日期 */
export function formatFriendlyTime(iso: string): { primary: string; secondary: string } {
  try {
    const d = new Date(iso);
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const ymd = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startThat = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const dayDiff = Math.round((startToday - startThat) / 86400000);
    if (dayDiff === 0) return { primary: `今天 ${hm}`, secondary: ymd };
    if (dayDiff === 1) return { primary: `昨天 ${hm}`, secondary: ymd };
    if (dayDiff > 1 && dayDiff < 7) return { primary: `${dayDiff}天前 ${hm}`, secondary: ymd };
    return { primary: `${ymd} ${hm}`, secondary: "" };
  } catch {
    return { primary: iso, secondary: "" };
  }
}
