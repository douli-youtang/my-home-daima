/**
 * 管理后台「接口文档」数据源
 * 面向对接开发者：路径、鉴权、参数、示例、错误码
 */

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export type AuthKind =
  | "none"
  | "openid"
  | "admin"
  | "adminOnly"
  | "bodyIdentity";

export type ApiParam = {
  name: string;
  in: "path" | "query" | "header" | "body" | "form";
  type: string;
  required?: boolean;
  description: string;
};

export type ApiEndpoint = {
  id: string;
  method: HttpMethod;
  path: string;
  title: string;
  summary: string;
  auth: AuthKind;
  deprecated?: boolean;
  params?: ApiParam[];
  bodyExample?: unknown;
  responseExample?: unknown;
  notes?: string[];
  errors?: { status?: number; code?: number; msg: string }[];
};

export type ApiCategory = {
  id: string;
  title: string;
  description: string;
  endpoints: ApiEndpoint[];
};

export const AUTH_LABELS: Record<AuthKind, { label: string; tip: string }> = {
  none: { label: "无需登录", tip: "公开接口，可直接调用" },
  openid: {
    label: "需 openid",
    tip: "Query `openid` 或 Header `x-openid`，按角色鉴权",
  },
  bodyIdentity: {
    label: "Body 身份",
    tip: "通过请求体中的 openid / name(+password) 识别用户",
  },
  admin: {
    label: "后台角色",
    tip: "Header `x-openid`，角色须为 admin 或 maintainer",
  },
  adminOnly: {
    label: "仅管理员",
    tip: "Header `x-openid`，角色须为 admin",
  },
};

export const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: "bg-emerald-50 text-emerald-700 border-emerald-200",
  POST: "bg-blue-50 text-blue-700 border-blue-200",
  PUT: "bg-amber-50 text-amber-700 border-amber-200",
  DELETE: "bg-rose-50 text-rose-700 border-rose-200",
};

/** 通用响应包络 */
export const COMMON_RESPONSE = {
  success: { code: 0, data: {}, msg: "ok" },
  fail: { code: 1, data: null, msg: "错误说明" },
};

export const API_DOC_CATEGORIES: ApiCategory[] = [
  {
    id: "auth",
    title: "公开 / 认证",
    description: "登录、改密、公开配置，对接时通常最先调用。",
    endpoints: [
      {
        id: "public-settings",
        method: "GET",
        path: "/api/public/settings",
        title: "获取公开配置",
        summary: "返回系统名称与填表策略，前端展示提示文案时使用。",
        auth: "none",
        responseExample: {
          code: 0,
          data: {
            systemName: "扫码填表管理系统",
            policy: {
              maxSubmissionEdits: 2,
              pointLockHours: 6,
              editWindowHours: 6,
            },
          },
          msg: "ok",
        },
      },
      {
        id: "login",
        method: "POST",
        path: "/api/login",
        title: "登录 / 会话恢复",
        summary:
          "支持账号密码登录，或仅传 openid 做会话恢复。管理后台登录请带 scope=admin。",
        auth: "bodyIdentity",
        params: [
          {
            name: "name",
            in: "body",
            type: "string",
            description: "姓名或工号（账号密码登录时必填其一）",
          },
          {
            name: "password",
            in: "body",
            type: "string",
            description: "密码（账号密码登录时必填）",
          },
          {
            name: "openid",
            in: "body",
            type: "string",
            description: "用户 openid（仅传 openid 时做会话恢复，不校验密码）",
          },
          {
            name: "scope",
            in: "body",
            type: '"admin" | "worker" | ""',
            description: "admin=仅允许管理员/维护员；作业端可传 worker 或不传",
          },
        ],
        bodyExample: {
          name: "管理员",
          password: "123456",
          scope: "admin",
        },
        responseExample: {
          code: 0,
          data: {
            role: "admin",
            name: "管理员",
            openid: "admin_test",
            mustChangePassword: false,
          },
          msg: "success",
        },
        errors: [
          { msg: "请提供 openid 或 name" },
          { msg: "用户不存在，请联系管理员" },
          { msg: "密码错误" },
          { msg: "作业人员无法登录管理后台，请通过扫码进入" },
        ],
        notes: [
          "扫码端作业人员请勿使用 scope=admin",
          "返回 mustChangePassword=true 时需引导用户改密",
        ],
      },
      {
        id: "password-change",
        method: "POST",
        path: "/api/password/change",
        title: "修改密码",
        summary:
          "常规改密需验证当前密码；首次登录强制改密（mustChangePassword）可不传当前密码。",
        auth: "bodyIdentity",
        params: [
          {
            name: "openid / name",
            in: "body",
            type: "string",
            required: true,
            description: "用户标识（openid 或姓名/工号）",
          },
          {
            name: "oldPassword",
            in: "body",
            type: "string",
            description: "当前密码（非首次改密必填）",
          },
          {
            name: "newPassword",
            in: "body",
            type: "string",
            required: true,
            description: "新密码",
          },
          {
            name: "confirmPassword",
            in: "body",
            type: "string",
            description: "确认新密码",
          },
          {
            name: "firstLogin",
            in: "body",
            type: "boolean",
            description: "true 表示首次强制改密流程",
          },
        ],
        bodyExample: {
          openid: "worker_test",
          firstLogin: true,
          newPassword: "abcdef",
          confirmPassword: "abcdef",
        },
        responseExample: {
          code: 0,
          data: {
            openid: "worker_test",
            name: "张工",
            mustChangePassword: false,
          },
          msg: "密码设置成功",
        },
        errors: [
          { msg: "请输入当前密码" },
          { msg: "当前密码错误" },
          { msg: "新密码不能与当前密码相同" },
          { msg: "两次输入的新密码不一致" },
        ],
      },
    ],
  },
  {
    id: "scan",
    title: "扫码填表",
    description: "点位二维码、表单提交/修改、占用查询、移动端历史记录。",
    endpoints: [
      {
        id: "qrcode-scene",
        method: "GET",
        path: "/api/qrcode/{scene}",
        title: "获取点位与表单模板",
        summary: "扫码后加载点位名称与动态表单字段定义。",
        auth: "none",
        params: [
          {
            name: "scene",
            in: "path",
            type: "string",
            required: true,
            description: "点位编码（Point.code）",
          },
        ],
        responseExample: {
          code: 0,
          data: {
            pointName: "聚德办公楼一楼卫生间",
            templateVersion: 7,
            templateFields: [
              {
                id: "field_1",
                label: "操作人",
                type: "multi_select_with_custom",
                required: true,
                order: 1,
              },
            ],
          },
          msg: "success",
        },
      },
      {
        id: "qrcode-download",
        method: "GET",
        path: "/api/qrcode/download/{code}",
        title: "下载点位二维码 PNG",
        summary: "生成指向扫码页的 PNG 二维码文件（attachment 下载）。",
        auth: "none",
        params: [
          {
            name: "code",
            in: "path",
            type: "string",
            required: true,
            description: "点位编码",
          },
          {
            name: "origin",
            in: "query",
            type: "string",
            description: "公网 Origin，如 https://example.com；影响二维码内嵌 URL",
          },
        ],
        notes: [
          "成功时返回 image/png 二进制，非 JSON",
          "响应头 X-QR-Content 为二维码实际内容 URL",
        ],
        errors: [
          { status: 404, msg: "点位不存在" },
          { status: 400, msg: "点位编码不能为空" },
        ],
      },
      {
        id: "submissions-active",
        method: "GET",
        path: "/api/submissions/active",
        title: "查询点位占用状态",
        summary:
          "同一二维码在占用窗口内若已有提交，返回详情供展示；否则可进入空白表单。",
        auth: "openid",
        params: [
          {
            name: "scene",
            in: "query",
            type: "string",
            required: true,
            description: "点位编码（也可用 point）",
          },
          {
            name: "openid",
            in: "query",
            type: "string",
            required: true,
            description: "作业人员 openid（或 Header x-openid）",
          },
        ],
        responseExample: {
          code: 0,
          data: {
            active: true,
            policy: {
              maxSubmissionEdits: 2,
              pointLockHours: 6,
              editWindowHours: 6,
            },
            pointLockHint: "同一二维码 6 小时内仅可提交一次",
            submission: {
              id: "e92a...",
              canEdit: true,
              isOwner: true,
              remainingEdits: 2,
            },
          },
          msg: "ok",
        },
        notes: ["仅 worker 可调用", "非本人时 canEdit=false，仅可查看"],
      },
      {
        id: "submissions-list",
        method: "GET",
        path: "/api/submissions",
        title: "工单列表",
        summary: "作业人员看本人工单；管理员/维护员看全部。",
        auth: "openid",
        params: [
          {
            name: "openid",
            in: "query",
            type: "string",
            required: true,
            description: "当前用户 openid",
          },
        ],
        responseExample: {
          code: 0,
          data: {
            scope: "mine",
            policy: { maxSubmissionEdits: 2, pointLockHours: 6, editWindowHours: 6 },
            list: [
              {
                id: "...",
                pointName: "测试点位",
                submittedAt: "2026-08-10T07:00:00.000Z",
                canEdit: true,
                remainingEdits: 2,
              },
            ],
          },
          msg: "ok",
        },
      },
      {
        id: "submissions-create",
        method: "POST",
        path: "/api/submissions",
        title: "提交表单",
        summary: "作业人员提交点位填报；若点位处于占用窗口会拒绝并返回占用信息。",
        auth: "openid",
        params: [
          {
            name: "scene",
            in: "body",
            type: "string",
            required: true,
            description: "点位编码",
          },
          {
            name: "openid",
            in: "body",
            type: "string",
            required: true,
            description: "提交人 openid",
          },
          {
            name: "data",
            in: "body",
            type: "object",
            required: true,
            description: "字段值映射 { fieldId: value }",
          },
          {
            name: "images",
            in: "body",
            type: "string[]",
            description: "图片 fileKey 列表",
          },
          {
            name: "submittedBy",
            in: "body",
            type: "string",
            description: "填写人显示名（可从字段自动提取）",
          },
        ],
        bodyExample: {
          scene: "qr_test_001",
          openid: "worker_test",
          submittedBy: "张工",
          data: { field_1: ["张工"], field_3: "20", field_4: "10" },
          images: [],
        },
        errors: [
          { msg: "仅作业人员可提交表单" },
          {
            msg: "该二维码 6 小时内已由「张工」填写，暂不可再次提交",
          },
          { msg: "请填写xxx" },
        ],
        notes: [
          "占用拒绝时 data 可能含 activeSubmissionId、lockedUntil",
          "前端应跳转展示已有详情",
        ],
      },
      {
        id: "submissions-get",
        method: "GET",
        path: "/api/submissions/{id}",
        title: "工单详情",
        summary: "查看单条提交详情；管理员端强制只读。",
        auth: "openid",
        params: [
          {
            name: "id",
            in: "path",
            type: "string",
            required: true,
            description: "提交记录 ID",
          },
          {
            name: "openid",
            in: "query",
            type: "string",
            required: true,
            description: "当前用户 openid",
          },
        ],
        responseExample: {
          code: 0,
          data: {
            id: "...",
            pointName: "测试点位",
            data: {},
            images: [],
            fieldsSnapshot: [],
            canEdit: true,
            remainingEdits: 1,
            editLockMessage: "",
            submittedAt: "2026-08-10T07:00:00.000Z",
          },
          msg: "ok",
        },
      },
      {
        id: "submissions-put",
        method: "PUT",
        path: "/api/submissions/{id}",
        title: "修改工单",
        summary: "作业人员修改本人提交，受修改次数与可改时间窗口限制。",
        auth: "openid",
        params: [
          {
            name: "id",
            in: "path",
            type: "string",
            required: true,
            description: "提交记录 ID",
          },
          {
            name: "openid",
            in: "body",
            type: "string",
            required: true,
            description: "当前用户 openid",
          },
          {
            name: "data",
            in: "body",
            type: "object",
            required: true,
            description: "更新后的字段值",
          },
          {
            name: "images",
            in: "body",
            type: "string[]",
            description: "图片 fileKey 列表",
          },
        ],
        bodyExample: {
          openid: "worker_test",
          data: { field_1: ["张工"], field_3: "25", field_4: "8" },
          images: [],
        },
        errors: [
          { msg: "只能修改自己提交的记录" },
          { msg: "已达到修改次数上限（最多 2 次）" },
          { msg: "已超过可修改时间（提交后 6 小时内可改）" },
        ],
      },
      {
        id: "records-scene",
        method: "GET",
        path: "/api/records/{scene}",
        title: "点位历史记录（移动端）",
        summary: "管理员/维护员按点位查看历史填写记录。",
        auth: "openid",
        params: [
          {
            name: "scene",
            in: "path",
            type: "string",
            required: true,
            description: "点位编码",
          },
          {
            name: "openid",
            in: "query",
            type: "string",
            required: true,
            description: "管理员/维护员 openid",
          },
        ],
        notes: ["角色必须是 admin 或 maintainer"],
      },
      {
        id: "submit-deprecated",
        method: "POST",
        path: "/api/submit",
        title: "旧提交接口（已废弃）",
        summary: "请改用 POST /api/submissions。",
        auth: "none",
        deprecated: true,
        errors: [{ status: 410, msg: "接口已迁移，请使用 POST /api/submissions" }],
      },
    ],
  },
  {
    id: "file",
    title: "文件上传 / 访问",
    description: "图片上传到私有 OSS，浏览器通过本站代理或签名 URL 访问。",
    endpoints: [
      {
        id: "upload",
        method: "POST",
        path: "/api/upload",
        title: "上传图片",
        summary: "multipart 上传图片，返回 OSS fileKey。",
        auth: "none",
        params: [
          {
            name: "file",
            in: "form",
            type: "File (image/*)",
            required: true,
            description: "图片文件",
          },
        ],
        responseExample: {
          code: 0,
          data: "uploads/1723xxx-现场.jpg",
          msg: "上传成功",
        },
        notes: ["Content-Type: multipart/form-data", "仅接受 image/*"],
      },
      {
        id: "file-proxy",
        method: "GET",
        path: "/api/file",
        title: "图片代理访问",
        summary: "通过本站代理读取私有 OSS 对象，供浏览器直接展示。",
        auth: "none",
        params: [
          {
            name: "fileKey",
            in: "query",
            type: "string",
            required: true,
            description: "上传返回的 fileKey，须以 uploads/ 开头",
          },
        ],
        notes: ["成功返回文件流；错误返回 JSON"],
      },
      {
        id: "signed-url",
        method: "GET",
        path: "/api/signed-url",
        title: "生成临时签名 URL",
        summary: "生成 OSS 预签名链接；内网 endpoint 时浏览器可能无法直连，优先用 /api/file。",
        auth: "none",
        params: [
          {
            name: "fileKey",
            in: "query",
            type: "string",
            required: true,
            description: "有效 fileKey",
          },
        ],
        responseExample: {
          code: 0,
          data: "https://oss.example/uploads/...?X-Amz-Signature=...",
          msg: "ok",
        },
        errors: [
          { status: 400, msg: "fileKey 不能为空" },
          { status: 400, msg: "无效的 fileKey" },
        ],
      },
    ],
  },
  {
    id: "admin",
    title: "管理后台",
    description:
      "PC 管理端接口。统一在 Header 传 x-openid。部分接口仅管理员（admin）可调用。",
    endpoints: [
      {
        id: "admin-dashboard",
        method: "GET",
        path: "/api/admin/dashboard",
        title: "仪表盘数据",
        summary: "点位/提交统计、近 7 天趋势、最新动态。",
        auth: "admin",
        responseExample: {
          code: 0,
          data: {
            stats: {
              totalPoints: 2,
              activePoints: 2,
              todaySubmissions: 7,
              totalSubmissions: 7,
            },
            trend: [{ day: "08-10", count: 7 }],
            activities: [
              {
                id: "sub-...",
                time: "1 小时前",
                text: "张工 提交了「测试点位」",
                kind: "submission",
              },
            ],
          },
          msg: "ok",
        },
      },
      {
        id: "admin-points-list",
        method: "GET",
        path: "/api/admin/points",
        title: "点位列表",
        summary: "分页查询点位，含关联模板摘要。",
        auth: "admin",
        params: [
          { name: "keyword", in: "query", type: "string", description: "名称/编码搜索" },
          { name: "status", in: "query", type: "active|inactive", description: "状态筛选" },
          { name: "page", in: "query", type: "number", description: "页码，默认 1" },
          {
            name: "pageSize",
            in: "query",
            type: "number",
            description: "每页条数，最大 500",
          },
        ],
      },
      {
        id: "admin-points-create",
        method: "POST",
        path: "/api/admin/points",
        title: "创建点位",
        summary: "创建点位并初始化空表单模板。仅管理员。",
        auth: "adminOnly",
        bodyExample: {
          name: "一楼毒饵站",
          description: "可选备注",
          status: "active",
        },
      },
      {
        id: "admin-points-one",
        method: "GET",
        path: "/api/admin/points/{id}",
        title: "点位详情",
        summary: "按 ID 获取单个点位。",
        auth: "admin",
        params: [
          {
            name: "id",
            in: "path",
            type: "string",
            required: true,
            description: "点位 ID",
          },
        ],
      },
      {
        id: "admin-points-update",
        method: "PUT",
        path: "/api/admin/points/{id}",
        title: "更新点位",
        summary: "更新名称/描述/状态。仅管理员。",
        auth: "adminOnly",
        bodyExample: { name: "新名称", status: "inactive" },
      },
      {
        id: "admin-points-delete",
        method: "DELETE",
        path: "/api/admin/points/{id}",
        title: "删除点位",
        summary: "软删除点位。仅管理员。",
        auth: "adminOnly",
      },
      {
        id: "admin-templates-get",
        method: "GET",
        path: "/api/admin/templates",
        title: "获取表单模板",
        summary: "按点位 ID 获取动态字段定义。",
        auth: "admin",
        params: [
          {
            name: "pointId",
            in: "query",
            type: "string",
            required: true,
            description: "点位 ID",
          },
        ],
      },
      {
        id: "admin-templates-put",
        method: "PUT",
        path: "/api/admin/templates",
        title: "保存表单模板",
        summary: "更新字段定义并 version+1。仅管理员。",
        auth: "adminOnly",
        bodyExample: {
          pointId: "7f94...",
          fields: [
            {
              id: "field_1",
              label: "操作人",
              type: "multi_select_with_custom",
              required: true,
              order: 1,
              options: ["张工", "李工"],
            },
          ],
        },
      },
      {
        id: "admin-records-list",
        method: "GET",
        path: "/api/admin/records",
        title: "填报记录列表",
        summary: "后台数据记录分页；内容摘要取自表单备注字段。",
        auth: "admin",
        params: [
          { name: "pointId", in: "query", type: "string", description: "点位筛选" },
          { name: "keyword", in: "query", type: "string", description: "关键词" },
          { name: "startDate", in: "query", type: "YYYY-MM-DD", description: "开始日期" },
          { name: "endDate", in: "query", type: "YYYY-MM-DD", description: "结束日期" },
          {
            name: "isDeleted",
            in: "query",
            type: "true|false|all",
            description: "删除状态；维护员强制只能看未删除",
          },
          { name: "page", in: "query", type: "number", description: "页码" },
          { name: "pageSize", in: "query", type: "number", description: "每页条数" },
        ],
      },
      {
        id: "admin-records-delete",
        method: "DELETE",
        path: "/api/admin/records/{id}",
        title: "软删除记录",
        summary: "标记填报记录为已删除。",
        auth: "admin",
      },
      {
        id: "admin-records-restore",
        method: "PUT",
        path: "/api/admin/records/{id}/restore",
        title: "恢复记录",
        summary: "恢复已软删记录。仅管理员。",
        auth: "adminOnly",
      },
      {
        id: "admin-records-edits",
        method: "GET",
        path: "/api/admin/records/{id}/edits",
        title: "修改历史",
        summary: "查看某条记录的历次修改快照。",
        auth: "admin",
      },
      {
        id: "admin-users-list",
        method: "GET",
        path: "/api/admin/users",
        title: "用户列表",
        summary: "分页查询系统用户。仅管理员。",
        auth: "adminOnly",
        params: [
          { name: "keyword", in: "query", type: "string", description: "姓名/工号" },
          {
            name: "role",
            in: "query",
            type: "worker|maintainer|admin",
            description: "角色筛选",
          },
          { name: "page", in: "query", type: "number", description: "页码" },
          { name: "pageSize", in: "query", type: "number", description: "每页条数" },
        ],
      },
      {
        id: "admin-users-create",
        method: "POST",
        path: "/api/admin/users",
        title: "创建用户",
        summary: "新增用户，强制首次改密。仅管理员。",
        auth: "adminOnly",
        bodyExample: {
          openid: "worker_new",
          name: "新工人",
          password: "123456",
          role: "worker",
          status: "active",
        },
      },
      {
        id: "admin-users-update",
        method: "PUT",
        path: "/api/admin/users/{id}",
        title: "更新用户",
        summary: "更新姓名/角色/状态，或重置密码。仅管理员。",
        auth: "adminOnly",
        bodyExample: {
          name: "王五",
          role: "worker",
          status: "active",
          password: "123456",
        },
        notes: ["传入 password 会重置密码并设置 mustChangePassword=true"],
      },
      {
        id: "admin-users-delete",
        method: "DELETE",
        path: "/api/admin/users/{id}",
        title: "停用用户",
        summary: "软停用用户（status=inactive）。不可删除自己。仅管理员。",
        auth: "adminOnly",
      },
      {
        id: "admin-settings-get",
        method: "GET",
        path: "/api/admin/settings",
        title: "获取系统设置",
        summary: "系统名、会话天数、填表策略等。仅管理员。",
        auth: "adminOnly",
        responseExample: {
          code: 0,
          data: {
            systemName: "扫码填表管理系统",
            sessionDays: 7,
            maxSubmissionEdits: 2,
            pointLockHours: 6,
            editWindowHours: 6,
          },
          msg: "success",
        },
      },
      {
        id: "admin-settings-put",
        method: "PUT",
        path: "/api/admin/settings",
        title: "保存系统设置",
        summary: "更新系统配置，保存后立即生效。仅管理员。",
        auth: "adminOnly",
        bodyExample: {
          systemName: "扫码填表管理系统",
          sessionDays: 7,
          maxSubmissionEdits: 2,
          pointLockHours: 6,
          editWindowHours: 6,
        },
        notes: [
          "sessionDays 仅支持 7 / 14 / 30",
          "pointLockHours=0 表示不限制重复提交",
          "editWindowHours=0 表示不限制修改时间（仍受次数限制）",
          "maxSubmissionEdits=0 表示提交后不可修改",
        ],
      },
      {
        id: "admin-logs",
        method: "GET",
        path: "/api/admin/operation-logs",
        title: "操作日志",
        summary: "后台操作审计分页。仅管理员。",
        auth: "adminOnly",
        params: [
          { name: "action", in: "query", type: "string", description: "操作类型" },
          { name: "page", in: "query", type: "number", description: "页码" },
          { name: "pageSize", in: "query", type: "number", description: "每页条数" },
        ],
      },
    ],
  },
];

export function countEndpoints() {
  return API_DOC_CATEGORIES.reduce((n, c) => n + c.endpoints.length, 0);
}

export function buildCurl(
  method: HttpMethod,
  path: string,
  opts?: { openid?: string; body?: unknown; form?: boolean }
) {
  const url = path.replace(/\{(\w+)\}/g, "VALUE");
  const parts = [`curl -X ${method} 'https://YOUR_HOST${url}'`];
  if (opts?.openid) {
    parts.push(`  -H 'x-openid: ${opts.openid}'`);
  }
  if (opts?.form) {
    parts.push(`  -F 'file=@./photo.jpg'`);
  } else if (opts?.body !== undefined) {
    parts.push(`  -H 'Content-Type: application/json'`);
    parts.push(`  -d '${JSON.stringify(opts.body)}'`);
  }
  return parts.join(" \\\n");
}
