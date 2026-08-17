import { fail, success } from "~~/server/utils/response";
import { requireAdminUser } from "~~/server/utils/admin";
import { formatOperationLog } from "~~/server/utils/operation-log-format";
import prisma from "~~/server/utils/prisma";
import { resolveSubmitterNames } from "~~/server/utils/submitter-names";

const TZ = "Asia/Shanghai";

function shanghaiDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value || "00";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
  };
}

/** 上海时区某天 00:00 对应的 Date */
function shanghaiDayStart(year: number, month: number, day: number): Date {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return new Date(`${year}-${mm}-${dd}T00:00:00+08:00`);
}

function addDays(year: number, month: number, day: number, delta: number) {
  const base = shanghaiDayStart(year, month, day);
  const next = new Date(base.getTime() + delta * 24 * 60 * 60 * 1000);
  return shanghaiDateParts(next);
}

function formatDayLabel(month: number, day: number) {
  return `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatActivityTime(date: Date, now = new Date()): string {
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "刚刚";
  if (diffMin < 60) return `${diffMin} 分钟前`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} 小时前`;

  const d = shanghaiDateParts(date);
  const n = shanghaiDateParts(now);
  const today = shanghaiDayStart(n.year, n.month, n.day);
  const that = shanghaiDayStart(d.year, d.month, d.day);
  const dayDiff = Math.round(
    (today.getTime() - that.getTime()) / (24 * 60 * 60 * 1000)
  );
  const hm = new Intl.DateTimeFormat("zh-CN", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);

  if (dayDiff === 1) return `昨天 ${hm}`;
  if (dayDiff === 2) return `前天 ${hm}`;
  return `${formatDayLabel(d.month, d.day)} ${hm}`;
}

/**
 * GET /api/admin/dashboard
 * 仪表盘真实数据（点位/提交统计、近 7 天趋势、最新动态）
 */
export default defineEventHandler(async (event) => {
  try {
    const { error, user } = await requireAdminUser(event);
    if (error || !user) return error!;

    const now = new Date();
    const todayParts = shanghaiDateParts(now);
    const todayStart = shanghaiDayStart(
      todayParts.year,
      todayParts.month,
      todayParts.day
    );

    const dayRanges: { label: string; start: Date; end: Date }[] = [];
    for (let i = 6; i >= 0; i--) {
      const parts = addDays(
        todayParts.year,
        todayParts.month,
        todayParts.day,
        -i
      );
      const start = shanghaiDayStart(parts.year, parts.month, parts.day);
      const endParts = addDays(parts.year, parts.month, parts.day, 1);
      const end = shanghaiDayStart(
        endParts.year,
        endParts.month,
        endParts.day
      );
      dayRanges.push({
        label: formatDayLabel(parts.month, parts.day),
        start,
        end,
      });
    }

    const [
      totalPoints,
      activePoints,
      todaySubmissions,
      totalSubmissions,
      trendCounts,
      recentLogs,
      recentSubmissions,
    ] = await Promise.all([
      prisma.point.count({ where: { deletedAt: null } }),
      prisma.point.count({ where: { deletedAt: null, status: "active" } }),
      prisma.formSubmission.count({
        where: { isDeleted: false, submittedAt: { gte: todayStart } },
      }),
      prisma.formSubmission.count({ where: { isDeleted: false } }),
      Promise.all(
        dayRanges.map((range) =>
          prisma.formSubmission.count({
            where: {
              isDeleted: false,
              submittedAt: { gte: range.start, lt: range.end },
            },
          })
        )
      ),
      prisma.operationLog.findMany({
        take: 12,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { name: true } },
          point: { select: { name: true, code: true } },
        },
      }),
      prisma.formSubmission.findMany({
        where: { isDeleted: false },
        take: 12,
        orderBy: { submittedAt: "desc" },
        include: {
          point: { select: { name: true, code: true } },
        },
      }),
    ]);

    const nameMap = await resolveSubmitterNames(
      recentSubmissions.map((r) => r.submitterOpenid)
    );

    type Activity = {
      id: string;
      time: string;
      text: string;
      at: string;
      kind: "log" | "submission";
    };

    const activities: Activity[] = [
      ...recentLogs.map((log) => {
        const formatted = formatOperationLog(log.action, log.detail, {
          pointName: log.point?.name,
          pointCode: log.point?.code,
        });
        const objectHint =
          formatted.targetName && formatted.targetName !== "-"
            ? `「${formatted.targetName}」`
            : "";
        const text = `${log.user.name} ${formatted.title}${objectHint}`;
        return {
          id: `log-${log.id}`,
          time: formatActivityTime(log.createdAt, now),
          text,
          at: log.createdAt.toISOString(),
          kind: "log" as const,
        };
      }),
      ...recentSubmissions.map((row) => {
        const who =
          nameMap.get(row.submitterOpenid) || row.submittedBy || "作业人员";
        return {
          id: `sub-${row.id}`,
          time: formatActivityTime(row.submittedAt, now),
          text: `${who} 提交了「${row.point.name}」`,
          at: row.submittedAt.toISOString(),
          kind: "submission" as const,
        };
      }),
    ]
      .sort((a, b) => (a.at < b.at ? 1 : -1))
      .slice(0, 10);

    return success({
      stats: {
        totalPoints,
        activePoints,
        todaySubmissions,
        totalSubmissions,
      },
      trend: dayRanges.map((range, index) => ({
        day: range.label,
        count: trendCounts[index] || 0,
      })),
      activities,
    });
  } catch (err) {
    console.error("admin dashboard GET error:", err);
    setResponseStatus(event, 500);
    return fail("获取仪表盘数据失败");
  }
});
