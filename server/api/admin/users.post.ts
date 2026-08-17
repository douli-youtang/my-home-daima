import type { UserRole, UserStatus } from "@prisma/client";
import { fail, success } from "../../utils/response";
import { requireAdminUser } from "../../utils/admin";
import { createId } from "../../utils/id";
import {
  hashPassword,
  isValidPasswordLength,
  MIN_PASSWORD_LENGTH,
} from "../../utils/password";
import prisma from "../../utils/prisma";

const ROLES: UserRole[] = ["worker", "maintainer", "admin"];
const STATUSES: UserStatus[] = ["active", "inactive"];

export default defineEventHandler(async (event) => {
  try {
    const { error, user } = await requireAdminUser(event, { adminOnly: true });
    if (error || !user) return error!;

    const body = await readBody(event);
    const openid = String(body?.openid || "").trim();
    const name = String(body?.name || "").trim();
    const password = String(body?.password || "");
    const role = (body?.role || "worker") as UserRole;
    const status = (body?.status || "active") as UserStatus;

    if (!openid) {
      setResponseStatus(event, 400);
      return fail("openid 不能为空");
    }
    if (!name) {
      setResponseStatus(event, 400);
      return fail("姓名不能为空");
    }
    if (!password) {
      setResponseStatus(event, 400);
      return fail("密码不能为空");
    }
    if (!isValidPasswordLength(password)) {
      setResponseStatus(event, 400);
      return fail(`密码至少 ${MIN_PASSWORD_LENGTH} 位`);
    }
    if (!ROLES.includes(role)) {
      setResponseStatus(event, 400);
      return fail("角色不合法");
    }
    if (!STATUSES.includes(status)) {
      setResponseStatus(event, 400);
      return fail("状态不合法");
    }

    const exists = await prisma.user.findUnique({ where: { openid } });
    if (exists) {
      setResponseStatus(event, 400);
      return fail("openid 已存在");
    }

    const hashed = await hashPassword(password);

    const created = await prisma.user.create({
      data: {
        id: createId(),
        openid,
        name,
        role,
        status,
        password: hashed,
        mustChangePassword: true,
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
        action: "create_user",
        targetId: created.id,
        detail: { openid, name, role, status },
      },
    });

    return success(created, "创建成功");
  } catch (err) {
    console.error("admin users POST error:", err);
    setResponseStatus(event, 500);
    return fail("创建用户失败");
  }
});
