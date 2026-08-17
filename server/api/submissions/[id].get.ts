import { fail, success } from "../../../utils/response";
import { findActiveSubmissionForPoint } from "../../../utils/point-lock";
import prisma from "../../../utils/prisma";
import { toSubmissionDetail } from "../../../utils/submission-dto";
import { resolveSubmitterNames } from "../../../utils/submitter-names";
import { getSubmissionPolicy } from "../../../utils/system-settings";

/**
 * GET /api/submissions/[id]?openid=
 * 作业人员查看自己的提交；管理员 / 维护员可查看任意工单
 */
export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, "id")!;
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

    const record = await prisma.formSubmission.findUnique({
      where: { id },
      include: { point: { select: { name: true, code: true } } },
    });

    if (!record || record.isDeleted) {
      setResponseStatus(event, 404);
      return fail("记录不存在");
    }

    const policy = await getSubmissionPolicy();
    const isStaff = user.role === "admin" || user.role === "maintainer";
    const isOwner = record.submitterOpenid === openid;
    if (!isStaff) {
      if (user.role !== "worker") {
        setResponseStatus(event, 403);
        return fail("无权限查看");
      }
      // 非本人：仅允许查看占用窗口内的当前填报（扫码详情）
      if (!isOwner) {
        const active = await findActiveSubmissionForPoint(
          record.pointId,
          policy
        );
        if (!active || active.id !== record.id) {
          setResponseStatus(event, 403);
          return fail("无权查看该记录");
        }
      }
    }

    const nameMap = await resolveSubmitterNames([record.submitterOpenid]);
    const detail = toSubmissionDetail(
      {
        ...record,
        submitterName: nameMap.get(record.submitterOpenid) || "",
      },
      policy
    );
    // 管理端移动页只读：即使仍在可改窗口，也不返回可修改
    if (isStaff) {
      return success({
        ...detail,
        canEdit: false,
        editLockReason: null,
        editLockMessage: "管理员仅可查看，不可修改",
      });
    }

    return success({
      ...detail,
      canEdit: detail.canEdit && isOwner,
      editLockMessage: isOwner
        ? detail.editLockMessage
        : "该点位已由其他账号填写，仅可查看",
      isOwner,
    });
  } catch (error) {
    console.error("submissions GET error:", error);
    setResponseStatus(event, 500);
    return fail("获取提交失败");
  }
});
