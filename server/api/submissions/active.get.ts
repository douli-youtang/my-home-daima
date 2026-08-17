import { fail, success } from "../../utils/response";
import { findActiveSubmissionForPoint, pointLockMeta } from "../../utils/point-lock";
import prisma from "../../utils/prisma";
import { toSubmissionDetail } from "../../utils/submission-dto";
import { formatPointLockHint } from "../../utils/submission-limits";
import { resolveSubmitterNames } from "../../utils/submitter-names";
import { getSubmissionPolicy } from "../../utils/system-settings";

/**
 * GET /api/submissions/active?scene=&openid=
 * 扫码填表：查询该二维码占用窗口内是否已有有效提交
 */
export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const scene =
      String(query.scene ?? "").trim() ||
      String(query.point ?? "").trim() ||
      "";
    const openid =
      String(query.openid ?? "").trim() ||
      getHeader(event, "x-openid")?.trim() ||
      "";

    if (!scene) {
      setResponseStatus(event, 400);
      return fail("scene 不能为空");
    }
    if (!openid) {
      setResponseStatus(event, 401);
      return fail("用户未登录");
    }

    const user = await prisma.user.findUnique({ where: { openid } });
    if (!user || user.status !== "active") {
      setResponseStatus(event, 403);
      return fail("用户未授权");
    }
    if (user.role !== "worker") {
      setResponseStatus(event, 403);
      return fail("仅作业人员可扫码填表");
    }

    const point = await prisma.point.findFirst({
      where: { code: scene, deletedAt: null },
      select: { id: true, name: true, code: true, status: true },
    });
    if (!point || point.status !== "active") {
      setResponseStatus(event, 404);
      return fail("点位不存在或已失效");
    }

    const policy = await getSubmissionPolicy();
    const record = await findActiveSubmissionForPoint(point.id, policy);
    if (!record) {
      return success({
        active: false,
        submission: null,
        policy,
        pointLockHint: formatPointLockHint(policy),
      });
    }

    const nameMap = await resolveSubmitterNames([record.submitterOpenid]);
    const submitterName = nameMap.get(record.submitterOpenid) || "";
    const detail = toSubmissionDetail(
      {
        ...record,
        submitterName,
      },
      policy
    );
    const isOwner = record.submitterOpenid === openid;

    return success({
      active: true,
      submission: {
        ...detail,
        canEdit: detail.canEdit && isOwner,
        editLockMessage: isOwner
          ? detail.editLockMessage
          : "该点位已由其他账号填写，仅可查看",
        isOwner,
        ...pointLockMeta(record.submittedAt, policy),
      },
      policy,
      pointLockHint: formatPointLockHint(policy),
    });
  } catch (error) {
    console.error("submissions active GET error:", error);
    setResponseStatus(event, 500);
    return fail("查询占用状态失败");
  }
});
