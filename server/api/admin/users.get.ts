import type { UserRole } from "@prisma/client";
import { fail, success } from "~~/server/utils/response";
import { requireAdminUser } from "~~/server/utils/admin";
import prisma from "~~/server/utils/prisma";

const ROLES: UserRole[] = ["worker", "maintainer", "admin"];

export default defineEventHandler(async (event) => {
  try {
    const { error, user } = await requireAdminUser(event, { adminOnly: true });
    if (error || !user) return error!;

    const query = getQuery(event);
    const keyword = String(query.keyword ?? "").trim();
    const role = String(query.role ?? "").trim();
    const page = Math.max(1, Number(query.page || 1));
    const pageSize = Math.min(
      100,
      Math.max(1, Number(query.pageSize || 20))
    );

    const where = {
      ...(role && ROLES.includes(role as UserRole)
        ? { role: role as UserRole }
        : {}),
      ...(keyword
        ? {
            OR: [
              { name: { contains: keyword } },
              { openid: { contains: keyword } },
            ],
          }
        : {}),
    };

    const [total, list] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          openid: true,
          name: true,
          role: true,
          status: true,
          createdAt: true,
        },
      }),
    ]);

    return success({
      list,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    });
  } catch (err) {
    console.error("admin users GET error:", err);
    setResponseStatus(event, 500);
    return fail("查询用户失败");
  }
});
