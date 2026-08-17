/**
 * 后台菜单 / 按钮权限目录（前后端共用）
 * key 约定：menu:* 菜单可见；btn:* 按钮可操作
 */

export type PermissionNode = {
  key: string;
  label: string;
  children?: PermissionNode[];
};

/** 全部权限 key（扁平） */
export const ALL_PERMISSION_KEYS = [
  // menus
  "menu:dashboard",
  "menu:points",
  "menu:records",
  "menu:users",
  "menu:roles",
  "menu:settings",
  "menu:logs",
  "menu:docs",
  "menu:docs.guide",
  "menu:docs.api",
  // buttons - points
  "btn:points.create",
  "btn:points.edit",
  "btn:points.delete",
  "btn:points.qr",
  "btn:points.template",
  // buttons - records
  "btn:records.delete",
  "btn:records.restore",
  "btn:records.view",
  // buttons - users
  "btn:users.create",
  "btn:users.edit",
  "btn:users.delete",
  // buttons - roles
  "btn:roles.create",
  "btn:roles.edit",
  "btn:roles.delete",
  "btn:roles.grant",
  // buttons - settings
  "btn:settings.save",
] as const;

export type PermissionKey = (typeof ALL_PERMISSION_KEYS)[number];

/** 授权树（给角色授权 UI，结构与侧栏一致） */
export const PERMISSION_CATALOG: PermissionNode[] = [
  {
    key: "menu:dashboard",
    label: "首页",
  },
  {
    key: "menu:points",
    label: "点位管理",
    children: [
      { key: "btn:points.create", label: "新增点位" },
      { key: "btn:points.edit", label: "编辑点位" },
      { key: "btn:points.delete", label: "删除点位" },
      { key: "btn:points.qr", label: "下载二维码" },
      { key: "btn:points.template", label: "配置模板" },
    ],
  },
  {
    key: "menu:records",
    label: "工作记录",
    children: [
      { key: "btn:records.view", label: "查看详情" },
      { key: "btn:records.delete", label: "删除记录" },
      { key: "btn:records.restore", label: "恢复记录" },
    ],
  },
  {
    key: "menu:settings",
    label: "系统设置",
    children: [
      { key: "btn:settings.save", label: "保存参数设置" },
      { key: "menu:logs", label: "操作日志" },
      {
        key: "menu:users",
        label: "用户管理",
        children: [
          { key: "btn:users.create", label: "新增用户" },
          { key: "btn:users.edit", label: "编辑用户" },
          { key: "btn:users.delete", label: "禁用用户" },
        ],
      },
      {
        key: "menu:roles",
        label: "角色管理",
        children: [
          { key: "btn:roles.create", label: "新增角色" },
          { key: "btn:roles.edit", label: "编辑角色" },
          { key: "btn:roles.delete", label: "删除角色" },
          { key: "btn:roles.grant", label: "授权配置" },
        ],
      },
      {
        key: "menu:docs",
        label: "开发文档",
        children: [
          { key: "menu:docs.guide", label: "系统说明" },
          { key: "menu:docs.api", label: "接口文档" },
        ],
      },
    ],
  },
];

/** 菜单路由 → 所需菜单权限 */
export const MENU_ROUTE_PERMISSION: Record<string, string> = {
  "/admin/dashboard": "menu:dashboard",
  "/admin/points": "menu:points",
  "/admin/records": "menu:records",
  "/admin/users": "menu:users",
  "/admin/roles": "menu:roles",
  "/admin/settings": "menu:settings",
  "/admin/logs": "menu:logs",
  "/admin/docs": "menu:docs",
  "/admin/docs/guide": "menu:docs.guide",
  "/admin/docs/api": "menu:docs.api",
};

/** 维护员默认权限 */
export const MAINTAINER_DEFAULT_PERMISSIONS: string[] = [
  "menu:dashboard",
  "menu:points",
  "menu:records",
  "menu:docs",
  "menu:docs.guide",
  "menu:docs.api",
  "btn:points.create",
  "btn:points.edit",
  "btn:points.qr",
  "btn:points.template",
  "btn:records.view",
  "btn:records.delete",
  "btn:records.restore",
];

export function flattenPermissionKeys(nodes: PermissionNode[] = PERMISSION_CATALOG): string[] {
  const keys: string[] = [];
  const walk = (list: PermissionNode[]) => {
    for (const n of list) {
      keys.push(n.key);
      if (n.children?.length) walk(n.children);
    }
  };
  walk(nodes);
  return keys;
}

export function isAdminRoleCode(code: string | null | undefined): boolean {
  return code === "admin";
}

/** admin 角色视为拥有全部权限 */
export function resolvePermissions(
  roleCode: string,
  storedKeys: string[]
): string[] {
  if (roleCode === "admin") {
    return [...ALL_PERMISSION_KEYS];
  }
  return Array.from(new Set(storedKeys));
}

export function hasMenuAccess(permissions: string[]): boolean {
  return permissions.some((p) => p.startsWith("menu:"));
}

export function canAccessAdmin(roleCode: string, permissions: string[]): boolean {
  if (roleCode === "worker") return false;
  return hasMenuAccess(permissions) || roleCode === "admin" || roleCode === "maintainer";
}
