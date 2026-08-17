import { fail, success } from "../../utils/response";
import prisma from "../../utils/prisma";
import { toSubmissionListItem } from "../../utils/submission-dto";
import { resolveSubmitterNames } from "../../utils/submitter-names";
import { getSubmissionPolicy } from "../../utils/system-settings";

/**
 * GET /api/submissions?openid=
 * - 作业人员：仅本人提交
 * - 管理员 / 维护员：全部工单
 */
export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const openid =
      String(query.openid ?? "").trim() ||
      getHeader(event, "x-openid")?.trim() ||
      "";

    if (!openid) {
      setResponseStatus(event, 401);
      return fail("用户未登录");
    }

    const user = await prisma.user.findUnique({ where: { openid } });
    if (!user || user.status !== "active") {
      setResponseStatus(event, 403);
      return fail("用户未授权");
    }

    const isStaff = user.role === "admin" || user.role === "maintainer";
    if (user.role !== "worker" && !isStaff) {
      setResponseStatus(event, 403);
      return fail("无权限查看");
    }

    const policy = await getSubmissionPolicy();

    const rows = await prisma.formSubmission.findMany({
      where: {
        isDeleted: false,
        ...(isStaff ? {} : { submitterOpenid: openid }),
      },
      include: {
        point: { select: { name: true, code: true } },
      },
      orderBy: { submittedAt: "desc" },
      take: isStaff ? 500 : 200,
    });

    const nameMap = await resolveSubmitterNames(
      rows.map((r) => r.submitterOpenid)
    );

    return success({
      list: rows.map((row) =>
        toSubmissionListItem(
          {
            ...row,
            submitterName: nameMap.get(row.submitterOpenid) || "",
          },
          policy
        )
      ),
      scope: isStaff ? "all" : "mine",
      policy,
    });
  } catch (error) {
    console.error("submissions GET list error:", error);
    setResponseStatus(event, 500);
    return fail("获取工单列表失败");
  }
});
