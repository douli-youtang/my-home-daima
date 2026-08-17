import { fail, success } from "~~/server/utils/response";
import { requirePermission, setRolePermissions } from "~~/server/utils/admin";
import { createId } from "~~/server/utils/id";
import prisma from "~~/server/utils/prisma";
import { ALL_PERMISSION_KEYS } from "~~/shared/permissions";

export default defineEventHandler(async (event) => {
  const method = event.method;
  const id = getRouterParam(event, "id")!;

  try {
    if (method === "GET") {
      const { error } = await requirePermission(event, [
        "menu:roles",
        "btn:roles.edit",
        "btn:roles.grant",
      ]);
      if (error) return error;

      const role = await prisma.role.findUnique({
        where: { id },
        include: { permissions: true, _count: { select: { users: true } } },
      });
      if (!role) {
        setResponseStatus(event, 404);
        return fail("角色不存在");
      }
      return success({
        id: role.id,
        code: role.code,
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
        status: role.status,
        userCount: role._count.users,
        permissions: role.permissions.map((p) => p.permissionKey),
      });
    }

    if (method === "PUT") {
      const { error, user } = await requirePermission(event, "btn:roles.edit");
      if (error || !user) return error!;

      const role = await prisma.role.findUnique({ where: { id } });
      if (!role) {
        setResponseStatus(event, 404);
        return fail("角色不存在");
      }

      const body = await readBody(event);
      const name =
        body?.name !== undefined ? String(body.name).trim() : undefined;
      const description =
        body?.description !== undefined
          ? String(body.description || "").trim()
          : undefined;
      const status =
        body?.status === "active" || body?.status === "inactive"
          ? body.status
          : undefined;

      if (name !== undefined && !name) {
        setResponseStatus(event, 400);
        return fail("角色名称不能为空");
      }
      if (role.isSystem && status === "inactive") {
        setResponseStatus(event, 400);
        return fail("系统角色不可停用");
      }

      const updated = await prisma.role.update({
        where: { id },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(description !== undefined
            ? { description: description || null }
            : {}),
          ...(status !== undefined ? { status } : {}),
        },
      });

      await prisma.operationLog.create({
        data: {
          id: createId(),
          userId: user.id,
          action: "update_role",
          targetId: id,
          detail: { before: role, after: updated },
        },
      });

      return success(updated, "更新成功");
    }

    if (method === "DELETE") {
      const { error, user } = await requirePermission(event, "btn:roles.delete");
      if (error || !user) return error!;

      const role = await prisma.role.findUnique({
        where: { id },
        include: { _count: { select: { users: true } } },
      });
      if (!role) {
        setResponseStatus(event, 404);
        return fail("角色不存在");
      }
      if (role.isSystem) {
        setResponseStatus(event, 400);
        return fail("系统角色不可删除");
      }
      if (role._count.users > 0) {
        setResponseStatus(event, 400);
        return fail(`仍有 ${role._count.users} 个用户使用该角色，无法删除`);
      }

      await prisma.role.delete({ where: { id } });
      await prisma.operationLog.create({
        data: {
          id: createId(),
          userId: user.id,
          action: "delete_role",
          targetId: id,
          detail: { code: role.code, name: role.name },
        },
      });
      return success({ id }, "已删除");
    }

    setResponseStatus(event, 405);
    return fail("方法不允许");
  } catch (e) {
    console.error("admin roles [id]", e);
    setResponseStatus(event, 500);
    return fail("角色操作失败");
  }
});
