/**
 * 简化后的 adminOnly：仅 admin 角色
 * 或通过 permission 参数做细粒度校验
 */
import type { H3Event } from "h3";
import {
  canAccessAdmin,
  resolvePermissions,
} from "../../shared/permissions";
import { fail } from "./response";
import prisma from "./prisma";
import { createId } from "./id";

export type AuthedUser = {
  id: string;
  openid: string;
  name: string;
  roleId: string;
  roleCode: string;
  roleName: string;
  permissions: string[];
  /** 兼容旧逻辑：等同 roleCode */
  role: string;
};

export async function loadUserWithRole(openid: string) {
  const user = await prisma.user.findUnique({
    where: { openid },
    include: {
      role: {
        include: { permissions: true },
      },
    },
  });
  if (!user || user.status !== "active") return null;
  if (user.role.status !== "active") return null;

  const stored = user.role.permissions.map((p) => p.permissionKey);
  const permissions = resolvePermissions(user.role.code, stored);

  return {
    id: user.id,
    openid: user.openid,
    name: user.name,
    roleId: user.roleId,
    roleCode: user.role.code,
    roleName: user.role.name,
    permissions,
    role: user.role.code,
    mustChangePassword: user.mustChangePassword,
    password: user.password,
  };
}

export function userHasPermission(user: AuthedUser, key: string): boolean {
  if (user.roleCode === "admin") return true;
  return user.permissions.includes(key);
}

export function userHasAnyPermission(
  user: AuthedUser,
  keys: string[]
): boolean {
  if (user.roleCode === "admin") return true;
  return keys.some((k) => user.permissions.includes(k));
}

export function isAdminRole(role: string | null | undefined): boolean {
  return role === "admin" || role === "maintainer";
}

export async function requireAdminUser(
  event: H3Event,
  options?: { adminOnly?: boolean; permission?: string | string[] }
) {
  const openid = getHeader(event, "x-openid")?.trim();

  if (!openid) {
    setResponseStatus(event, 401);
    return {
      error: fail("未登录或缺少用户标识"),
      user: null as AuthedUser | null,
    };
  }

  const user = await loadUserWithRole(openid);
  if (!user) {
    setResponseStatus(event, 403);
    return {
      error: fail("用户未授权"),
      user: null as AuthedUser | null,
    };
  }

  if (!canAccessAdmin(user.roleCode, user.permissions)) {
    setResponseStatus(event, 403);
    return {
      error: fail("无后台访问权限"),
      user: null as AuthedUser | null,
    };
  }

  if (options?.adminOnly && user.roleCode !== "admin") {
    setResponseStatus(event, 403);
    return {
      error: fail("仅管理员可操作"),
      user: null as AuthedUser | null,
    };
  }

  if (options?.permission) {
    const keys = Array.isArray(options.permission)
      ? options.permission
      : [options.permission];
    if (!userHasAnyPermission(user, keys)) {
      setResponseStatus(event, 403);
      return {
        error: fail("无操作权限"),
        user: null as AuthedUser | null,
      };
    }
  }

  const { password: _p, mustChangePassword: _m, ...safe } = user;
  return { error: null, user: safe as AuthedUser };
}

export async function requirePermission(
  event: H3Event,
  permission: string | string[]
) {
  return requireAdminUser(event, { permission });
}

export async function setRolePermissions(roleId: string, keys: string[]) {
  const unique = Array.from(new Set(keys.filter(Boolean)));
  await prisma.rolePermission.deleteMany({ where: { roleId } });
  if (unique.length) {
    await prisma.rolePermission.createMany({
      data: unique.map((permissionKey) => ({
        id: createId(),
        roleId,
        permissionKey,
      })),
    });
  }
}
