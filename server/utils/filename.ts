/**
 * 清理上传文件名，避免路径穿越与特殊字符导致对象存储 Key 异常
 */
export function sanitizeFileName(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop() || "file";
  const cleaned = base
    .replace(/[^\w.\u4e00-\u9fa5()-]+/g, "_")
    .replace(/^\.+/, "")
    .slice(0, 120);

  return cleaned || `file-${Date.now()}`;
}
