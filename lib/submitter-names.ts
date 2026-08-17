import prisma from "@/lib/prisma";

/** 批量解析 openid → 用户姓名（提交人） */
export async function resolveSubmitterNames(
  openids: Array<string | null | undefined>
): Promise<Map<string, string>> {
  const unique = Array.from(
    new Set(openids.map((v) => String(v || "").trim()).filter(Boolean))
  );
  if (unique.length === 0) return new Map();

  const users = await prisma.user.findMany({
    where: { openid: { in: unique } },
    select: { openid: true, name: true },
  });

  return new Map(users.map((u) => [u.openid, u.name]));
}
