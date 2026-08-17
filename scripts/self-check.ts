/**
 * Comprehensive API + page smoke self-check
 * Run: npx tsx scripts/self-check.ts
 */
import prisma from "../lib/prisma";

const BASE = process.env.BASE_URL || "http://127.0.0.1:8080";

type Check = { name: string; ok: boolean; detail?: string };

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
  const buf = await res.arrayBuffer();
  return {
    status: res.status,
    text: Buffer.from(buf).slice(0, 32).toString("hex"),
    headers: res.headers,
  };
}

function pass(name: string, detail?: string): Check {
  return { name, ok: true, detail };
}
function fail(name: string, detail?: string): Check {
  return { name, ok: false, detail };
}

async function main() {
  const checks: Check[] = [];

  const admin =
    (await prisma.user.findFirst({
      where: { openid: "admin", status: "active" },
      include: { role: true },
    })) ||
    (await prisma.user.findFirst({
      where: { role: { code: "admin" }, status: "active" },
      include: { role: true },
    }));
  const worker = await prisma.user.findFirst({
    where: { role: { code: "worker" }, status: "active", openid: "worker_test" },
    include: { role: true },
  });
  const worker2 = await prisma.user.findFirst({
    where: {
      role: { code: "worker" },
      status: "active",
      openid: { not: "worker_test" },
    },
    include: { role: true },
  });
  const point = await prisma.point.findFirst({
    where: { deletedAt: null, status: "active", code: "qr_test_001" },
    include: { template: true },
  });
  const anyPoint =
    point ||
    (await prisma.point.findFirst({
      where: { deletedAt: null, status: "active" },
      include: { template: true },
    }));

  if (!admin) checks.push(fail("前置:管理员账号存在"));
  else checks.push(pass("前置:管理员账号存在", admin.name));
  if (!worker) checks.push(fail("前置:作业账号存在"));
  else checks.push(pass("前置:作业账号存在", worker.name));
  if (!anyPoint) checks.push(fail("前置:生效点位存在"));
  else checks.push(pass("前置:生效点位存在", anyPoint.code));

  // Pages
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
    "/worker",
    "/viewer",
    `/scan?scene=${encodeURIComponent(anyPoint?.code || "qr_test_001")}`,
  ];
  for (const p of pages) {
    const res = await fetch(`${BASE}${p}`);
    const html = await res.text();
    const ok =
      res.status === 200 &&
      !html.includes("Application error") &&
      !html.includes("Internal Server Error");
    checks.push(
      ok
        ? pass(`页面 ${p}`, `HTTP ${res.status}`)
        : fail(`页面 ${p}`, `HTTP ${res.status}`)
    );
  }

  // Public APIs
  {
    const r = await req("/api/public/settings");
    checks.push(
      r.json?.code === 0 && r.json?.data?.systemName
        ? pass("公开配置", r.json.data.systemName)
        : fail("公开配置", JSON.stringify(r.json))
    );
    checks.push(
      r.json?.data?.policy?.maxSubmissionEdits !== undefined
        ? pass("公开配置含填表策略")
        : fail("公开配置含填表策略")
    );
  }

  {
    const r = await req(`/api/qrcode/${encodeURIComponent(anyPoint!.code)}`);
    checks.push(
      r.json?.code === 0 && Array.isArray(r.json?.data?.templateFields)
        ? pass("二维码点位信息", `${r.json.data.pointName} fields=${r.json.data.templateFields.length}`)
        : fail("二维码点位信息", JSON.stringify(r.json))
    );
  }

  {
    const r = await req(
      `/api/qrcode/download/${encodeURIComponent(anyPoint!.code)}?origin=${encodeURIComponent(BASE)}`
    );
    const ct = r.headers?.get("content-type") || "";
    checks.push(
      r.status === 200 && ct.includes("image/png")
        ? pass("下载二维码 PNG", ct)
        : fail("下载二维码 PNG", `${r.status} ${ct} ${r.json ? JSON.stringify(r.json) : ""}`)
    );
  }

  // Login scopes
  {
    const r = await req("/api/login", {
      method: "POST",
      body: JSON.stringify({
        name: worker!.name,
        password: "123456",
        scope: "admin",
      }),
    });
    checks.push(
      r.json?.code !== 0
        ? pass("作业人员禁止后台登录", r.json?.msg)
        : fail("作业人员禁止后台登录", "不应成功")
    );
  }
  {
    const r = await req("/api/login", {
      method: "POST",
      body: JSON.stringify({
        name: admin!.name,
        password: "123456",
        scope: "admin",
      }),
    });
    checks.push(
      r.json?.code === 0 &&
        (r.json?.data?.role === "admin" || r.json?.data?.roleCode === "admin") &&
        Array.isArray(r.json?.data?.permissions)
        ? pass("管理员后台登录", `perms=${r.json.data.permissions.length}`)
        : fail("管理员后台登录", JSON.stringify(r.json))
    );
  }
  {
    const r = await req("/api/login", {
      method: "POST",
      body: JSON.stringify({
        name: worker!.name,
        password: "123456",
        scope: "worker",
      }),
    });
    checks.push(
      r.json?.code === 0 && r.json?.data?.role === "worker"
        ? pass("作业人员作业端登录")
        : fail("作业人员作业端登录", JSON.stringify(r.json))
    );
  }

  const adminOpenid = admin!.openid;
  const workerOpenid = worker!.openid;

  // Admin APIs
  const adminApis: { name: string; path: string }[] = [
    { name: "仪表盘", path: "/api/admin/dashboard" },
    { name: "点位列表", path: "/api/admin/points?page=1&pageSize=20" },
    { name: "记录列表", path: "/api/admin/records?page=1&pageSize=20" },
    { name: "用户列表", path: "/api/admin/users?page=1&pageSize=20" },
    { name: "系统设置", path: "/api/admin/settings" },
    { name: "操作日志", path: "/api/admin/operation-logs?page=1&pageSize=10" },
  ];
  for (const api of adminApis) {
    const r = await req(api.path, { openid: adminOpenid });
    checks.push(
      r.json?.code === 0
        ? pass(`后台API ${api.name}`)
        : fail(`后台API ${api.name}`, JSON.stringify(r.json))
    );
  }

  // worker cannot call admin dashboard
  {
    const r = await req("/api/admin/dashboard", { openid: workerOpenid });
    checks.push(
      r.json?.code !== 0 || r.status === 403
        ? pass("作业人员无法访问后台仪表盘API")
        : fail("作业人员无法访问后台仪表盘API", JSON.stringify(r.json))
    );
  }

  // Template
  if (anyPoint) {
    const r = await req(
      `/api/admin/templates?pointId=${encodeURIComponent(anyPoint.id)}`,
      { openid: adminOpenid }
    );
    checks.push(
      r.json?.code === 0
        ? pass("模板读取", r.json?.data?.name)
        : fail("模板读取", JSON.stringify(r.json))
    );
  }

  // User update (edit save)
  {
    const list = await req("/api/admin/users?page=1&pageSize=50", {
      openid: adminOpenid,
    });
    const target =
      (list.json?.data?.list || []).find((u: any) => u.openid === "admin") ||
      (list.json?.data?.list || []).find(
        (u: any) => u.role === "admin" || u.roleCode === "admin"
      );
    if (!target) {
      checks.push(fail("编辑用户保存", "找不到可编辑的管理员"));
    } else {
      const put = await req(`/api/admin/users/${target.id}`, {
        method: "PUT",
        openid: adminOpenid,
        body: JSON.stringify({
          name: target.name,
          roleId: target.roleId,
          status: target.status,
        }),
      });
      checks.push(
        put.json?.code === 0
          ? pass("编辑用户保存", put.json?.msg)
          : fail("编辑用户保存", JSON.stringify(put.json))
      );
    }
  }

  // Roles CRUD + grant
  {
    const list = await req("/api/admin/roles?pageSize=50", {
      openid: adminOpenid,
    });
    checks.push(
      list.json?.code === 0 && Array.isArray(list.json?.data?.list)
        ? pass("角色列表", `n=${list.json.data.list.length}`)
        : fail("角色列表", JSON.stringify(list.json))
    );
    const catalog = await req("/api/admin/permissions/catalog", {
      openid: adminOpenid,
    });
    checks.push(
      catalog.json?.code === 0 && catalog.json?.data?.catalog
        ? pass("权限目录")
        : fail("权限目录", JSON.stringify(catalog.json))
    );
    const code = `chk_${Date.now().toString(36).slice(-6)}`;
    const created = await req("/api/admin/roles", {
      method: "POST",
      openid: adminOpenid,
      body: JSON.stringify({
        code,
        name: "自检角色",
        permissions: ["menu:dashboard"],
      }),
    });
    checks.push(
      created.json?.code === 0
        ? pass("创建角色", code)
        : fail("创建角色", JSON.stringify(created.json))
    );
    if (created.json?.data?.id) {
      const grant = await req(
        `/api/admin/roles/${created.json.data.id}/permissions`,
        {
          method: "PUT",
          openid: adminOpenid,
          body: JSON.stringify({
            permissions: ["menu:dashboard", "menu:points", "btn:points.create"],
          }),
        }
      );
      checks.push(
        grant.json?.code === 0
          ? pass("角色授权")
          : fail("角色授权", JSON.stringify(grant.json))
      );
      const del = await req(`/api/admin/roles/${created.json.data.id}`, {
        method: "DELETE",
        openid: adminOpenid,
      });
      checks.push(
        del.json?.code === 0
          ? pass("删除角色")
          : fail("删除角色", JSON.stringify(del.json))
      );
    }
  }

  // Settings save roundtrip (restore same values)
  {
    const get = await req("/api/admin/settings", { openid: adminOpenid });
    const s = get.json?.data;
    if (s) {
      const put = await req("/api/admin/settings", {
        method: "PUT",
        openid: adminOpenid,
        body: JSON.stringify({
          systemName: s.systemName,
          sessionDays: s.sessionDays,
          maxSubmissionEdits: s.maxSubmissionEdits,
          pointLockHours: s.pointLockHours,
          editWindowHours: s.editWindowHours,
        }),
      });
      checks.push(
        put.json?.code === 0
          ? pass("系统设置保存回写")
          : fail("系统设置保存回写", JSON.stringify(put.json))
      );
    } else {
      checks.push(fail("系统设置保存回写", "读取失败"));
    }
  }

  // Dashboard stats sanity vs DB
  {
    const r = await req("/api/admin/dashboard", { openid: adminOpenid });
    const stats = r.json?.data?.stats;
    const totalPoints = await prisma.point.count({ where: { deletedAt: null } });
    const totalSubs = await prisma.formSubmission.count({
      where: { isDeleted: false },
    });
    checks.push(
      stats &&
        stats.totalPoints === totalPoints &&
        stats.totalSubmissions === totalSubs
        ? pass("仪表盘与数据库一致", `points=${totalPoints} subs=${totalSubs}`)
        : fail(
            "仪表盘与数据库一致",
            `api=${JSON.stringify(stats)} db=${totalPoints}/${totalSubs}`
          )
    );
    checks.push(
      Array.isArray(r.json?.data?.trend) && r.json.data.trend.length === 7
        ? pass("仪表盘近7天趋势")
        : fail("仪表盘近7天趋势")
    );
  }

  // Records summary uses remark
  {
    const r = await req("/api/admin/records?page=1&pageSize=5", {
      openid: adminOpenid,
    });
    const list = r.json?.data?.list || [];
    if (!list.length) {
      checks.push(pass("记录摘要(无数据跳过)"));
    } else {
      let ok = true;
      let detail = "";
      for (const item of list.slice(0, 5)) {
        const fields = Array.isArray(item.fieldsSnapshot)
          ? item.fieldsSnapshot
          : [];
        const remarkField = fields.find(
          (f: any) => (f.label || "").trim() === "备注"
        );
        if (!remarkField) continue;
        const raw = item.data?.[remarkField.id];
        const expected =
          raw === undefined || raw === null || String(raw).trim() === ""
            ? "-"
            : String(raw).trim().slice(0, 40);
        const actual = String(item.summary || "");
        if (!actual.startsWith(expected.slice(0, Math.min(20, expected.length))) && !(expected === "-" && actual === "-")) {
          // allow truncation with ellipsis
          if (expected !== "-" && !actual.includes(String(raw).trim().slice(0, 10))) {
            ok = false;
            detail = `id=${item.id} summary=${actual} remark=${raw}`;
            break;
          }
        }
      }
      checks.push(ok ? pass("记录内容摘要取备注") : fail("记录内容摘要取备注", detail));
    }
  }

  // Submissions list / active / detail
  {
    const r = await req(`/api/submissions?openid=${encodeURIComponent(workerOpenid)}`);
    checks.push(
      r.json?.code === 0 && Array.isArray(r.json?.data?.list)
        ? pass("作业工单列表", `n=${r.json.data.list.length}`)
        : fail("作业工单列表", JSON.stringify(r.json))
    );
  }
  {
    const r = await req(
      `/api/submissions/active?scene=${encodeURIComponent(anyPoint!.code)}&openid=${encodeURIComponent(workerOpenid)}`
    );
    checks.push(
      r.json?.code === 0 && typeof r.json?.data?.active === "boolean"
        ? pass("点位占用查询", `active=${r.json.data.active}`)
        : fail("点位占用查询", JSON.stringify(r.json))
    );
    if (r.json?.data?.active && r.json?.data?.submission?.id) {
      const id = r.json.data.submission.id;
      const d = await req(
        `/api/submissions/${id}?openid=${encodeURIComponent(workerOpenid)}`
      );
      checks.push(
        d.json?.code === 0
          ? pass("工单详情", id.slice(0, 8))
          : fail("工单详情", JSON.stringify(d.json))
      );
    }
  }

  // Staff submissions list
  {
    const r = await req(`/api/submissions?openid=${encodeURIComponent(adminOpenid)}`);
    checks.push(
      r.json?.code === 0 && r.json?.data?.scope === "all"
        ? pass("管理员查看全部工单API", `n=${r.json.data.list.length}`)
        : fail("管理员查看全部工单API", JSON.stringify(r.json))
    );
  }

  // Password change endpoint reachable
  {
    const r = await req("/api/password/change", {
      method: "POST",
      body: JSON.stringify({
        openid: workerOpenid,
        firstLogin: true,
        newPassword: "123456",
        confirmPassword: "123456",
      }),
    });
    // may fail if mustChangePassword false or same password - endpoint should respond structured
    checks.push(
      r.json?.code !== undefined
        ? pass("改密接口可达", r.json?.msg || `code=${r.json.code}`)
        : fail("改密接口可达")
    );
  }

  // Point lock: if active, second worker cannot create
  if (worker2 && anyPoint) {
    const active = await req(
      `/api/submissions/active?scene=${encodeURIComponent(anyPoint.code)}&openid=${encodeURIComponent(worker2.openid)}`
    );
    if (active.json?.data?.active) {
      const post = await req("/api/submissions", {
        method: "POST",
        body: JSON.stringify({
          scene: anyPoint.code,
          openid: worker2.openid,
          submittedBy: worker2.name,
          data: { field_1: [worker2.name], field_3: "1", field_4: "1", fld_hp9t: "1", fld_rlzh: "1" },
          images: [],
        }),
      });
      checks.push(
        post.json?.code !== 0
          ? pass("占用窗口禁止重复提交", post.json?.msg)
          : fail("占用窗口禁止重复提交", "不应成功")
      );
      checks.push(
        active.json?.data?.submission?.canEdit === false
          ? pass("非本人占用仅可查看")
          : fail("非本人占用仅可查看", JSON.stringify(active.json?.data?.submission?.canEdit))
      );
    } else {
      checks.push(pass("占用窗口(当前无占用，跳过重复提交校验)"));
    }
  }

  // Signed url / file endpoints shouldn't 500 on empty
  {
    const r = await req("/api/signed-url?fileKey=nonexistent");
    checks.push(
      r.status < 500
        ? pass("signed-url 错误处理", `${r.status}`)
        : fail("signed-url 错误处理", `${r.status}`)
    );
  }

  const failed = checks.filter((c) => !c.ok);
  const passed = checks.filter((c) => c.ok);
  console.log("\n===== SELF CHECK REPORT =====");
  for (const c of checks) {
    console.log(`${c.ok ? "PASS" : "FAIL"} | ${c.name}${c.detail ? " | " + c.detail : ""}`);
  }
  console.log(`\nTOTAL ${checks.length} | PASS ${passed.length} | FAIL ${failed.length}`);
  if (failed.length) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
