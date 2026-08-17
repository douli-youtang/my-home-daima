/**
 * 严谨全量自检：API + 关键页面 Vite 编译 + 模板页可达
 * Run: npx tsx scripts/rigorous-check.ts
 */
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE_URL || "http://127.0.0.1:8080";
const prisma = new PrismaClient();

type Check = { name: string; ok: boolean; detail?: string };
const checks: Check[] = [];

function pass(name: string, detail?: string) {
  checks.push({ name, ok: true, detail });
}
function fail(name: string, detail?: string) {
  checks.push({ name, ok: false, detail });
}

async function req(
  path: string,
  init?: RequestInit & { openid?: string }
): Promise<{ status: number; json?: any; text?: string; headers?: Headers }> {
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string>),
  };
  if (init?.openid) headers["x-openid"] = init.openid;
  if (init?.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    return { status: res.status, json: await res.json(), headers: res.headers };
  }
  return {
    status: res.status,
    text: await res.text(),
    headers: res.headers,
  };
}

/** 触发 Vite 编译页面模块；若依赖有语法错误会在 HTML/模块响应中体现 */
async function assertPageCompiles(path: string) {
  const r = await req(path);
  const body = r.text || "";
  const broken =
    body.includes("Transform failed") ||
    body.includes("Multiple exports") ||
    body.includes("Internal server error") ||
    body.includes("Failed to resolve") ||
    r.status >= 500;
  if (r.status === 200 && !broken) {
    pass(`页面编译 ${path}`, `HTTP ${r.status}`);
  } else {
    fail(
      `页面编译 ${path}`,
      `HTTP ${r.status} ${body.slice(0, 180).replace(/\s+/g, " ")}`
    );
  }
}

async function assertViteModule(relPath: string) {
  // Nuxt/Vite 开发态常见路径：/_nuxt/<absolute or project relative>
  const candidates = [
    `/_nuxt/${relPath}`,
    `/_nuxt/home/devbox/project/${relPath}`,
  ];
  let ok = false;
  let detail = "";
  for (const url of candidates) {
    const r = await req(url);
    const body = r.text || "";
    if (
      r.status === 200 &&
      !body.includes("Transform failed") &&
      !body.includes("Multiple exports") &&
      !body.includes("Internal server error")
    ) {
      ok = true;
      detail = url;
      break;
    }
    detail = `${url} -> ${r.status} ${body.slice(0, 120).replace(/\s+/g, " ")}`;
  }
  if (ok) pass(`模块编译 ${relPath}`, detail);
  else fail(`模块编译 ${relPath}`, detail);
}

async function main() {
  const adminUser = await prisma.user.findFirst({
    where: { openid: "admin", status: "active" },
    include: { role: true },
  });
  const worker = await prisma.user.findFirst({
    where: { openid: "worker_test", status: "active" },
  });
  const point = await prisma.point.findFirst({
    where: { deletedAt: null, status: "active" },
    include: { template: true },
  });

  if (!adminUser) fail("前置:admin 账号");
  else pass("前置:admin 账号", adminUser.role.code);
  if (!worker) fail("前置:worker_test");
  else pass("前置:worker_test");
  if (!point) fail("前置:生效点位");
  else pass("前置:生效点位", point.code);

  // —— 登录 ——
  {
    const r = await req("/api/login", {
      method: "POST",
      body: JSON.stringify({
        name: "admin",
        password: "123456",
        scope: "admin",
      }),
    });
    r.json?.code === 0 && r.json?.data?.openid === "admin"
      ? pass("登录 admin/123456", `perms=${r.json.data.permissions?.length}`)
      : fail("登录 admin/123456", JSON.stringify(r.json));
  }

  const adminOpenid = "admin";

  // —— 关键页面（含模板路由） ——
  const pages = [
    "/",
    "/login",
    "/worker/login",
    "/admin/dashboard",
    "/admin/points",
    "/admin/records",
    "/admin/users",
    "/admin/roles",
    "/admin/settings",
    "/admin/logs",
    "/admin/docs/guide",
    "/admin/docs/api",
    "/worker",
    "/viewer",
    `/scan?scene=${encodeURIComponent(point?.code || "qr_test_001")}`,
  ];
  if (point) {
    pages.push(`/admin/points/${point.id}`);
    pages.push(`/admin/points/${point.id}/template`);
  }
  for (const p of pages) await assertPageCompiles(p);

  // —— 关键前端模块（模板页依赖） ——
  await assertViteModule("lib/field-utils.ts");
  await assertViteModule("pages/admin/points/[id]/template.vue");
  await assertViteModule("pages/admin/points/index.vue");
  await assertViteModule("layouts/admin.vue");

  // —— 模板 API 读写 ——
  if (point) {
    const get = await req(
      `/api/admin/templates?pointId=${encodeURIComponent(point.id)}`,
      { openid: adminOpenid }
    );
    get.json?.code === 0
      ? pass("模板读取 API", get.json?.data?.name)
      : fail("模板读取 API", JSON.stringify(get.json));

    const fields = Array.isArray(get.json?.data?.fields)
      ? get.json.data.fields
      : [];
    const put = await req("/api/admin/templates", {
      method: "PUT",
      openid: adminOpenid,
      body: JSON.stringify({
        pointId: point.id,
        name: get.json?.data?.name || `${point.name}表单`,
        fields,
      }),
    });
    put.json?.code === 0
      ? pass("模板保存 API", put.json?.msg)
      : fail("模板保存 API", JSON.stringify(put.json));
  }

  // —— 点位详情含记录 ——
  if (point) {
    const d = await req(`/api/admin/points/${point.id}`, {
      openid: adminOpenid,
    });
    d.json?.code === 0
      ? pass("点位详情 API")
      : fail("点位详情 API", JSON.stringify(d.json));
    const recs = await req(
      `/api/admin/records?pointId=${encodeURIComponent(point.id)}&page=1&pageSize=5`,
      { openid: adminOpenid }
    );
    recs.json?.code === 0
      ? pass("点位关联工作记录 API", `total=${recs.json?.data?.total}`)
      : fail("点位关联工作记录 API", JSON.stringify(recs.json));
  }

  // —— 后台核心 API ——
  for (const [name, path] of [
    ["仪表盘", "/api/admin/dashboard"],
    ["点位列表", "/api/admin/points?page=1&pageSize=20"],
    ["记录列表", "/api/admin/records?page=1&pageSize=20"],
    ["用户列表", "/api/admin/users?page=1&pageSize=20"],
    ["角色列表", "/api/admin/roles?pageSize=50"],
    ["权限目录", "/api/admin/permissions/catalog"],
    ["系统设置", "/api/admin/settings"],
    ["操作日志", "/api/admin/operation-logs?page=1&pageSize=10"],
  ] as const) {
    const r = await req(path, { openid: adminOpenid });
    r.json?.code === 0
      ? pass(`后台API ${name}`)
      : fail(`后台API ${name}`, JSON.stringify(r.json));
  }

  // —— 作业端 ——
  {
    const r = await req(
      `/api/submissions?openid=${encodeURIComponent(worker!.openid)}`
    );
    r.json?.code === 0
      ? pass("作业工单列表", `n=${r.json?.data?.list?.length}`)
      : fail("作业工单列表", JSON.stringify(r.json));
  }
  {
    const r = await req(
      `/api/submissions/active?scene=${encodeURIComponent(point!.code)}&openid=${encodeURIComponent(worker!.openid)}`
    );
    r.json?.code === 0
      ? pass("点位占用查询", `active=${r.json?.data?.active}`)
      : fail("点位占用查询", JSON.stringify(r.json));
  }
  {
    const r = await req(`/api/qrcode/${encodeURIComponent(point!.code)}`);
    r.json?.code === 0
      ? pass("扫码点位信息")
      : fail("扫码点位信息", JSON.stringify(r.json));
  }

  // —— 端到端：新建点位 → 打开模板页编译 → 保存模板 → 删除 ——
  {
    const created = await req("/api/admin/points", {
      method: "POST",
      openid: adminOpenid,
      body: JSON.stringify({
        name: `严谨自检${Date.now().toString().slice(-4)}`,
        status: "active",
      }),
    });
    if (created.json?.code !== 0 || !created.json?.data?.id) {
      fail("E2E创建点位", JSON.stringify(created.json));
    } else {
      const id = created.json.data.id as string;
      const code = created.json.data.code as string;
      pass("E2E创建点位", code);
      /^P\d+$/i.test(code)
        ? pass("E2E点位编码规范", code)
        : fail("E2E点位编码规范", code);

      await assertPageCompiles(`/admin/points/${id}/template`);

      const fields = [
        { id: "fld_001", label: "操作人", type: "text", required: true, order: 1 },
        { id: "fld_002", label: "备注", type: "textarea", required: false, order: 2 },
      ];
      const save = await req("/api/admin/templates", {
        method: "PUT",
        openid: adminOpenid,
        body: JSON.stringify({
          pointId: id,
          name: "严谨自检表单",
          fields,
        }),
      });
      save.json?.code === 0
        ? pass("E2E保存模板")
        : fail("E2E保存模板", JSON.stringify(save.json));

      const del = await req(`/api/admin/points/${id}`, {
        method: "DELETE",
        openid: adminOpenid,
      });
      del.json?.code === 0
        ? pass("E2E删除点位")
        : fail("E2E删除点位", JSON.stringify(del.json));
    }
  }

  // —— 终端日志不应再有 Transform failed（抽检服务健康） ——
  {
    const r = await req("/login");
    r.status === 200 ? pass("服务健康 /login") : fail("服务健康 /login", String(r.status));
  }

  const failed = checks.filter((c) => !c.ok);
  const passed = checks.filter((c) => c.ok);
  console.log("\n===== RIGOROUS CHECK REPORT =====");
  for (const c of checks) {
    console.log(
      `${c.ok ? "PASS" : "FAIL"} | ${c.name}${c.detail ? " | " + c.detail : ""}`
    );
  }
  console.log(
    `\nTOTAL ${checks.length} | PASS ${passed.length} | FAIL ${failed.length}`
  );
  if (failed.length) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
