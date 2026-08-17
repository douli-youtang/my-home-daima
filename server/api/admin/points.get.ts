import type { PointStatus } from "@prisma/client";
import { fail, success } from "~~/server/utils/response";
import { requireAdminUser } from "~~/server/utils/admin";
import prisma from "~~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  try {
    const { error, user } = await requireAdminUser(event);
    if (error || !user) return error!;

    const query = getQuery(event);
    const keyword = String(query.keyword ?? "").trim();
    const status = String(query.status ?? "").trim();
    const page = Math.max(1, Number(query.page || 1));
    const pageSize = Math.min(
      500,
      Math.max(1, Number(query.pageSize || 20))
    );

    const where = {
      deletedAt: null,
      ...(status === "active" || status === "inactive"
        ? { status: status as PointStatus }
        : {}),
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
      prisma.point.count({ where }),
      prisma.point.findMany({
        where,
        include: {
          template: {
            select: {
              id: true,
              name: true,
              version: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
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
    console.error("admin points GET error:", err);
    setResponseStatus(event, 500);
    return fail("查询点位失败");
  }
});
