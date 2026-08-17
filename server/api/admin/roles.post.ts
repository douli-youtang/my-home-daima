import { fail, success } from "~~/server/utils/response";
import { requirePermission, setRolePermissions } from "~~/server/utils/admin";
import { createId } from "~~/server/utils/id";
import prisma from "~~/server/utils/prisma";
import { ALL_PERMISSION_KEYS } from "~~/shared/permissions";

export default defineEventHandler(async (event) => {
  try {
    const { error, user } = await requirePermission(event, "btn:roles.create");
    if (error || !user) return error!;

    const body = await readBody(event);
    const code = String(body?.code || "").trim();
    const name = String(body?.name || "").trim();
    const description =
      body?.description !== undefined
        ? String(body.description || "").trim()
        : "";
    const permissions = Array.isArray(body?.permissions)
      ? body.permissions.map(String)
      : [];

    if (!code || !/^[a-z][a-z0-9_]{1,31}$/.test(code)) {
      setResponseStatus(event, 400);
      return fail("角色编码须为小写字母开头的字母数字下划线（2-32位）");
    }
    if (!name) {
      setResponseStatus(event, 400);
      return fail("请填写角色名称");
    }
    if (["admin", "maintainer", "worker"].includes(code)) {
      setResponseStatus(event, 400);
      return fail("不可使用系统保留编码");
    }

    const exists = await prisma.role.findUnique({ where: { code } });
    if (exists) {
      setResponseStatus(event, 400);
      return fail("角色编码已存在");
    }

    const validKeys = permissions.filter((k: string) =>
      (ALL_PERMISSION_KEYS as readonly string[]).includes(k)
    );

    const id = createId();
    const role = await prisma.role.create({
      data: {
        id,
        code,
        name,
        description: description || null,
        isSystem: false,
        status: "active",
      },
    });
    await setRolePermissions(role.id, validKeys);

    await prisma.operationLog.create({
      data: {
        id: createId(),
        userId: user.id,
        action: "create_role",
        targetId: role.id,
        detail: { code, name, permissions: validKeys },
      },
    });

    return success({ id: role.id, code: role.code, name: role.name }, "创建成功");
  } catch (e) {
    console.error("admin roles POST", e);
    setResponseStatus(event, 500);
    return fail("创建角色失败");
  }
});
