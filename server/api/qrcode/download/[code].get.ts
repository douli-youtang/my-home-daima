import type { H3Event } from "h3";
import QRCode from "qrcode";
import { fail } from "~~/server/utils/response";
import prisma from "~~/server/utils/prisma";

function buildScanUrl(scene: string) {
  return `/scan?scene=${encodeURIComponent(scene)}`;
}

function resolvePublicOrigin(event: H3Event): string {
  const query = getQuery(event);
  const fromQuery = String(query.origin || "").trim();
  if (/^https?:\/\//i.test(fromQuery)) {
    return fromQuery.replace(/\/+$/, "");
  }

  const forwardedHost = getHeader(event, "x-forwarded-host")?.split(",")[0]?.trim();
  const host =
    forwardedHost ||
    getHeader(event, "host")?.trim() ||
    "localhost:8080";
  const proto =
    getHeader(event, "x-forwarded-proto")?.split(",")[0]?.trim() ||
    (host.includes("localhost") || host.startsWith("127.") ? "http" : "https");

  return `${proto}://${host}`.replace(/\/+$/, "");
}

function buildDownloadFileName(pointName: string, code: string): string {
  const base = `${pointName || "点位"}_${code || "qr"}`
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 80);
  return `${base || "qrcode"}.png`;
}

/**
 * GET /api/qrcode/download/[code]?origin=
 * 下载点位扫码二维码 PNG（内容为扫码填表完整 URL）
 */
export default defineEventHandler(async (event) => {
  try {
    const code = decodeURIComponent(getRouterParam(event, "code") || "").trim();
    if (!code) {
      setResponseStatus(event, 400);
      return fail("点位编码不能为空");
    }

    const point = await prisma.point.findFirst({
      where: { code, deletedAt: null },
      select: { id: true, code: true, name: true, status: true },
    });

    if (!point) {
      setResponseStatus(event, 404);
      return fail("点位不存在");
    }

    const origin = resolvePublicOrigin(event);
    const scanUrl = `${origin}${buildScanUrl(point.code)}`;
    const fileName = buildDownloadFileName(point.name, point.code);

    const png = await QRCode.toBuffer(scanUrl, {
      type: "png",
      width: 1024,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#111827", light: "#ffffff" },
    });

    const asciiFallback = `qrcode_${point.code.replace(/[^\w.-]+/g, "_") || "point"}.png`;

    setHeader(event, "Content-Type", "image/png");
    setHeader(event, "Content-Length", String(png.length));
    setHeader(
      event,
      "Content-Disposition",
      `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
    );
    setHeader(event, "Cache-Control", "private, max-age=60");
    setHeader(event, "X-QR-Content", scanUrl);

    return png;
  } catch (error) {
    console.error("qrcode download error:", error);
    setResponseStatus(event, 500);
    return fail("二维码下载失败");
  }
});
