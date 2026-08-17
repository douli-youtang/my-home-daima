/** openid 脱敏：保留前后各 2 位 */
export function maskOpenid(openid: string): string {
  const value = String(openid || "");
  if (value.length <= 4) return "***";
  return `${value.slice(0, 2)}***${value.slice(-2)}`;
}
