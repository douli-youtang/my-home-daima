/**
 * 点位业务编码：P + 四位序号，如 P0001、P0002（不使用随机数）
 */
export function formatPointCode(seq: number): string {
  const n = Math.max(1, Math.floor(seq));
  return `P${String(n).padStart(4, "0")}`;
}

/** 从已有编码中解析最大序号（仅识别 P#### 形式） */
export function maxPointCodeSeq(codes: string[]): number {
  let max = 0;
  for (const code of codes) {
    const m = /^P(\d+)$/i.exec(String(code || "").trim());
    if (!m) continue;
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max;
}

/** 同步生成下一编码（传入已有编码列表） */
export function generatePointCode(existingCodes: string[] = []): string {
  return formatPointCode(maxPointCodeSeq(existingCodes) + 1);
}
