import { randomBytes } from "crypto";

/**
 * 生成 32 位十六进制 ID（适配 VARCHAR(32) 主键）
 */
export function createId(): string {
  return randomBytes(16).toString("hex");
}
