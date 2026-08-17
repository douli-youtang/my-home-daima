import type { UserRole, UserStatus } from "@prisma/client";
import { fail, success } from "~~/server/utils/response";
import { requireAdminUser } from "~~/server/utils/admin";
import { createId } from "~~/server/utils/id";
import {
  hashPassword,
  isValidPasswordLength,
  MIN_PASSWORD_LENGTH,
} from "~~/server/utils/password";
import prisma from "~~/server/utils/prisma";

const ROLES: UserRole[] = ["worker", "maintainer", "admin"];
const STATUSES: UserStatus[] = ["active", "inactive"];

export default defineEventHandler(async (event) => {
  try {
    const { error, user } = await requireAdminUser(event, { adminOnly: true });
    if (error || !user) return error!;

    const id = getRouterParam(event, "id")!;
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      setResponseStatus(event, 404);
      return fail("用户不存在");
    }

    const body = await readBody(event);
    const name =
      body?.name !== undefined ? String(body.name).trim() : undefined;
    const role =
      body?.role !== undefined ? (body.role as UserRole) : undefined;
    const status =
      body?.status !== undefined ? (body.status as UserStatus) : undefined;
    const passwordRaw =
      body?.password !== undefined ? String(body.password) : undefined;
    const password =
      passwordRaw !== undefined ? passwordRaw.trim() : undefined;

    if (name !== undefined && !name) {
      setResponseStatus(event, 400);
      return fail("姓名不能为空");
    }
    if (role !== undefined && !ROLES.includes(role)) {
      setResponseStatus(event, 400);
      return fail("角色不合法");
    }
    if (status !== undefined && !STATUSES.includes(status)) {
      setResponseStatus(event, 400);
      return fail("状态不合法");
    }
    if (password !== undefined && password !== "") {
      if (!isValidPasswordLength(password)) {
        setResponseStatus(event, 400);
        return fail(`密码至少 ${MIN_PASSWORD_LENGTH} 位`);
      }
    }

    const shouldUpdatePassword =
      password !== undefined && password !== "";
    const hashed = shouldUpdatePassword
      ? await hashPassword(password!)
      : undefined;

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(role !== undefined ? { role } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(hashed !== undefined
          ? { password: hashed, mustChangePassword: true }
          : {}),
      },
      select: {
        id: true,
        openid: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    await prisma.operationLog.create({
      data: {
        id: createId(),
        userId: user.id,
        action: "update_user",
        targetId: id,
        detail: {
          before: {
            name: existing.name,
            role: existing.role,
            status: existing.status,
          },
          after: {
            name: updated.name,
            role: updated.role,
            status: updated.status,
          },
          passwordReset: shouldUpdatePassword,
        },
      },
    });

    return success(updated, "更新成功");
  } catch (err) {
    console.error("admin users PUT error:", err);
    setResponseStatus(event, 500);
    return fail("更新用户失败");
  }
});
