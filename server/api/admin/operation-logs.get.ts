import { fail, success } from "~~/server/utils/response";
import { requireAdminUser } from "~~/server/utils/admin";
import { formatOperationLog } from "~~/server/utils/operation-log-format";
import { OPERATION_ACTION_LABELS } from "~~/server/utils/operation-actions";
import prisma from "~~/server/utils/prisma";

function resolveHref(
  action: string,
  formattedHref: string | null,
  pointId: string | null
): string | null {
  if (action === "update_template" && pointId) {
    return `/admin/points/${pointId}/template`;
  }
  if (
    (action.includes("point") || action === "update_template") &&
    pointId
  ) {
    return `/admin/points/${pointId}`;
  }
  return formattedHref;
}

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
          point: {
            select: { id: true, name: true, code: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const userTargetIds = rows
      .filter((r) => r.action.includes("user") && r.targetId)
      .map((r) => r.targetId!)
      .filter(Boolean);
    const roleTargetIds = rows
      .filter(
        (r) =>
          (r.action.includes("role") || r.action === "grant_role") &&
          r.targetId
      )
      .map((r) => r.targetId!)
      .filter(Boolean);

    const [targetUsers, targetRoles] = await Promise.all([
      userTargetIds.length
        ? prisma.user.findMany({
            where: { id: { in: [...new Set(userTargetIds)] } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      roleTargetIds.length
        ? prisma.role.findMany({
            where: { id: { in: [...new Set(roleTargetIds)] } },
            select: { id: true, name: true, code: true },
          })
        : Promise.resolve([]),
    ]);

    const userNameById = Object.fromEntries(
      targetUsers.map((u) => [u.id, u.name])
    );
    const roleNameById = Object.fromEntries(
      targetRoles.map((r) => [r.id, r.name || r.code])
    );

    const list = rows.map((row) => {
      const isRole =
        row.action.includes("role") || row.action === "grant_role";
      const isUser = row.action.includes("user");
      const extraName = isRole
        ? roleNameById[row.targetId || ""]
        : isUser
          ? userNameById[row.targetId || ""]
          : null;

      const formatted = formatOperationLog(row.action, row.detail, {
        pointName: row.point?.name,
        pointCode: row.point?.code,
        targetUserName: extraName,
      });

      // 点位相关：优先用库里的点位名
      if (row.point?.name && formatted.targetName === "-") {
        formatted.targetName = row.point.name;
      }
      if (row.point?.name && row.action.includes("point")) {
        formatted.targetName = row.point.name;
      }
      if (extraName && (isUser || isRole)) {
        formatted.targetName = extraName;
      }

      const href = resolveHref(
        row.action,
        formatted.href,
        row.pointId || row.point?.id || null
      );

      return {
        id: row.id,
        action: row.action,
        actionLabel: formatted.title,
        title: formatted.title,
        description: formatted.description,
        targetName: formatted.targetName,
        href,
        tone: formatted.tone,
        targetId: row.targetId,
        pointId: row.pointId,
        createdAt: row.createdAt,
        operatorName: row.user.name,
        operatorOpenid: row.user.openid,
      };
    });

    const actionOptions = Object.entries(OPERATION_ACTION_LABELS).map(
      ([value, label]) => ({ value, label })
    );

    return success({
      list,
      actionOptions,
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
