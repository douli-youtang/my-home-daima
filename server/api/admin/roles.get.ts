import { fail, success } from "~~/server/utils/response";
import { requirePermission } from "~~/server/utils/admin";
import prisma from "~~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  try {
    const { error } = await requirePermission(event, [
      "menu:roles",
      "menu:users",
      "btn:roles.grant",
      "btn:users.create",
    ]);
    if (error) return error;

    const query = getQuery(event);
    const keyword = String(query.keyword ?? "").trim();
    const page = Math.max(1, Number(query.page || 1));
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize || 50)));

    const where = {
      ...(keyword
        ? {
            OR: [
              { name: { contains: keyword } },
              { code: { contains: keyword } },
            ],
          }
        : {}),
    };

    const [total, list] = await Promise.all([
      prisma.role.count({ where }),
      prisma.role.findMany({
        where,
        include: {
          _count: { select: { users: true, permissions: true } },
          permissions: { select: { permissionKey: true } },
        },
        orderBy: [{ isSystem: "desc" }, { createdAt: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return success({
      list: list.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        description: r.description,
        isSystem: r.isSystem,
        status: r.status,
        userCount: r._count.users,
        permissionCount: r._count.permissions,
        permissions: r.permissions.map((p) => p.permissionKey),
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    });
  } catch (e) {
    console.error("admin roles GET", e);
    setResponseStatus(event, 500);
    return fail("获取角色列表失败");
  }
});
