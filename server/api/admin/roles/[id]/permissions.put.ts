import { fail, success } from "~~/server/utils/response";
import { requirePermission, setRolePermissions } from "~~/server/utils/admin";
import { createId } from "~~/server/utils/id";
import prisma from "~~/server/utils/prisma";
import {
  ALL_PERMISSION_KEYS,
  resolvePermissions,
} from "~~/shared/permissions";

/** PUT /api/admin/roles/:id/permissions 覆盖式保存权限 */
export default defineEventHandler(async (event) => {
  try {
    const { error, user } = await requirePermission(event, "btn:roles.grant");
    if (error || !user) return error!;

    const id = getRouterParam(event, "id")!;
    const role = await prisma.role.findUnique({ where: { id } });
    if (!role) {
      setResponseStatus(event, 404);
      return fail("角色不存在");
    }

    const body = await readBody(event);
    const permissions = Array.isArray(body?.permissions)
      ? body.permissions.map(String)
      : [];
    const validKeys = permissions.filter((k: string) =>
      (ALL_PERMISSION_KEYS as readonly string[]).includes(k)
    );

    // admin 系统角色始终全量（防锁死）
    const keys =
      role.code === "admin" ? [...ALL_PERMISSION_KEYS] : validKeys;

    await setRolePermissions(id, keys);

    await prisma.operationLog.create({
      data: {
        id: createId(),
        userId: user.id,
        action: "grant_role",
        targetId: id,
        detail: { code: role.code, name: role.name, permissions: keys },
      },
    });

    return success(
      {
        id,
        permissions: resolvePermissions(role.code, keys),
      },
      "授权已保存"
    );
  } catch (e) {
    console.error("admin roles permissions PUT", e);
    setResponseStatus(event, 500);
    return fail("保存授权失败");
  }
});
