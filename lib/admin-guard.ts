import { NextRequest } from "next/server";
import { fail } from "@/lib/api-response";
import prisma from "@/lib/prisma";
import type { UserRole } from "@prisma/client";

export type AuthedAdmin = {
  id: string;
  openid: string;
  name: string;
  role: Extract<UserRole, "admin" | "maintainer">;
};

export async function requireAdminUser(
  request: NextRequest,
  options?: { adminOnly?: boolean }
) {
  const openid = request.headers.get("x-openid")?.trim();

  if (!openid) {
    return {
      error: Response.json(fail("未登录或缺少用户标识"), { status: 401 }),
      user: null as AuthedAdmin | null,
    };
  }

  const user = await prisma.user.findUnique({ where: { openid } });

  if (!user || user.status !== "active") {
    return {
      error: Response.json(fail("用户未授权"), { status: 403 }),
      user: null as AuthedAdmin | null,
    };
  }

  if (user.role !== "admin" && user.role !== "maintainer") {
    return {
      error: Response.json(fail("无后台访问权限"), { status: 403 }),
      user: null as AuthedAdmin | null,
    };
  }

  if (options?.adminOnly && user.role !== "admin") {
    return {
      error: Response.json(fail("仅管理员可操作"), { status: 403 }),
      user: null as AuthedAdmin | null,
    };
  }

  return {
    error: null,
    user: {
      id: user.id,
      openid: user.openid,
      name: user.name,
      role: user.role as AuthedAdmin["role"],
    },
  };
}
