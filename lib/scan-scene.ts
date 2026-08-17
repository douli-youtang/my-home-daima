/**
 * 从扫码结果中解析点位 scene。
 * 支持完整 URL（含 /scan?scene=）或纯 scene 编码。
 */
export function extractSceneFromScanText(raw: string): string | null {
  const text = String(raw || "").trim();
  if (!text) return null;

  try {
    const url = new URL(text, "http://local.invalid");
    const scene = url.searchParams.get("scene");
    if (scene?.trim()) return scene.trim();
  } catch {
    // ignore
  }

  const match = text.match(/[?&]scene=([^&#]+)/i);
  if (match?.[1]) {
    try {
      return decodeURIComponent(match[1]).trim() || null;
    } catch {
      return match[1].trim() || null;
    }
  }

  if (/^[a-zA-Z0-9_-]{2,64}$/.test(text)) {
    return text;
  }

  return null;
}
