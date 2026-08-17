import { fail, success } from "../../utils/response";
import { requireAdminUser } from "../../utils/admin";
import prisma from "../../utils/prisma";
import { summarizeSubmissionData } from "../../utils/submission-utils";
import { resolveSubmitterNames } from "../../utils/submitter-names";
import type {
  FormFieldDefinition,
  FormFieldValues,
} from "../../utils/types/types/form-fields";

/** GET /api/admin/records */
export default defineEventHandler(async (event) => {
  try {
    const { error, user } = await requireAdminUser(event);
    if (error || !user) return error!;

    const query = getQuery(event);
    const pointId = String(query.pointId ?? "").trim();
    const keyword = String(query.keyword ?? "").trim();
    const startDate = String(query.startDate ?? "").trim();
    const endDate = String(query.endDate ?? "").trim();
    const isDeletedParam = String(query.isDeleted ?? "").trim();
    const page = Math.max(1, Number(query.page || 1));
    const pageSize = Math.min(
      100,
      Math.max(1, Number(query.pageSize || 20))
    );

    // 维护员默认只看未删除；管理员可看 all
    let isDeletedFilter: boolean | undefined = false;
    if (user.role === "admin") {
      if (isDeletedParam === "true") isDeletedFilter = true;
      else if (isDeletedParam === "false") isDeletedFilter = false;
      else if (isDeletedParam === "all") isDeletedFilter = undefined;
      else isDeletedFilter = false;
    } else {
      // maintainer 强制 false（即使传 all）
      isDeletedFilter = false;
    }

    const submittedAtFilter: { gte?: Date; lte?: Date } = {};
    if (startDate) {
      submittedAtFilter.gte = new Date(`${startDate}T00:00:00.000Z`);
    }
    if (endDate) {
      submittedAtFilter.lte = new Date(`${endDate}T23:59:59.999Z`);
    }

    const where = {
      ...(isDeletedFilter === undefined ? {} : { isDeleted: isDeletedFilter }),
      ...(pointId ? { pointId } : {}),
      ...(keyword ? { submittedBy: { contains: keyword } } : {}),
      ...(Object.keys(submittedAtFilter).length
        ? { submittedAt: submittedAtFilter }
        : {}),
      point: {
        deletedAt: null,
      },
    };

    const [total, rows] = await Promise.all([
      prisma.formSubmission.count({ where }),
      prisma.formSubmission.findMany({
        where,
        include: {
          point: {
            select: { id: true, name: true, code: true },
          },
        },
        orderBy: { submittedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const nameMap = await resolveSubmitterNames(
      rows.map((r) => r.submitterOpenid)
    );

    const list = rows.map((row) => {
      const fields = (
        Array.isArray(row.fieldsSnapshot) ? row.fieldsSnapshot : []
      ) as FormFieldDefinition[];
      const data = (row.data || {}) as FormFieldValues;
      const images = Array.isArray(row.images)
        ? (row.images as string[])
        : [];

      return {
        id: row.id,
        pointId: row.pointId,
        pointName: row.point.name,
        pointCode: row.point.code,
        submittedBy: row.submittedBy,
        submitterName: nameMap.get(row.submitterOpenid) || "",
        submitterOpenid: row.submitterOpenid,
        submitterType: row.submitterType,
        submittedAt: row.submittedAt,
        data: row.data,
        images,
        fieldsSnapshot: row.fieldsSnapshot,
        templateVersion: row.templateVersion,
        isDeleted: row.isDeleted,
        editCount: row.editCount,
        summary: summarizeSubmissionData(fields, data),
        imageCount: images.length,
      };
    });

    return success({
      list,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    });
  } catch (err) {
    console.error("admin records GET error:", err);
    setResponseStatus(event, 500);
    return fail("查询记录失败");
  }
});
