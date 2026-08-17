import { fail, success } from "../../utils/response";
import { requireAdminUser } from "../../utils/admin";
import { getActionLabel } from "../../utils/operation-actions";
import prisma from "../../utils/prisma";

export default defineEventHandler(async (event) => {
  try {
    const { error, user } = await requireAdminUser(event, { adminOnly: true });
    if (error || !user) return error!;

    const query = getQuery(event);
    const action = String(query.action ?? "").trim();
    const page = Math.max(1, Number(query.page || 1));
    const pageSize = Math.min(
      100,
      Math.max(1, Number(query.pageSize || 20))
    );

    const where = {
      ...(action ? { action } : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.operationLog.count({ where }),
      prisma.operationLog.findMany({
        where,
        include: {
          user: {
            select: { id: true, name: true, openid: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const list = rows.map((row) => ({
      id: row.id,
      action: row.action,
      actionLabel: getActionLabel(row.action),
      targetId: row.targetId,
      pointId: row.pointId,
      detail: row.detail,
      createdAt: row.createdAt,
      operatorName: row.user.name,
      operatorOpenid: row.user.openid,
    }));

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
    console.error("admin operation-logs GET error:", err);
    setResponseStatus(event, 500);
    return fail("查询操作日志失败");
  }
});
