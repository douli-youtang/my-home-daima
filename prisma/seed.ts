import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createId } from "../lib/id";
import type { FormFieldDefinition } from "../lib/types/form-fields";

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = "123456";

const TEMPLATE_FIELDS: FormFieldDefinition[] = [
  {
    id: "field_1",
    label: "操作人",
    type: "multi_select_with_custom",
    options: ["张工", "李工", "王工"],
    required: true,
    order: 1,
  },
  {
    id: "field_group_yao",
    label: "鼠药",
    type: "group",
    required: false,
    order: 2,
  },
  {
    id: "field_2",
    label: "鼠药名称",
    type: "text",
    required: true,
    order: 3,
    parentId: "field_group_yao",
  },
  {
    id: "field_3",
    label: "投放克数",
    type: "number",
    required: true,
    order: 4,
    parentId: "field_group_yao",
  },
  {
    id: "field_4",
    label: "剩余克数",
    type: "number",
    required: true,
    order: 5,
    parentId: "field_group_yao",
  },
  {
    id: "field_5",
    label: "备注",
    type: "textarea",
    required: false,
    order: 6,
  },
  {
    id: "field_6",
    label: "现场照片",
    type: "image_upload",
    multiple: true,
    required: false,
    order: 7,
  },
];

const SYSTEM_ROLES = [
  {
    id: "a1000000000000000000000000000001",
    code: "admin",
    name: "管理员",
    description: "系统内置：拥有全部后台权限",
  },
  {
    id: "a1000000000000000000000000000002",
    code: "maintainer",
    name: "维护员",
    description: "系统内置：点位与记录维护",
  },
  {
    id: "a1000000000000000000000000000003",
    code: "worker",
    name: "作业人员",
    description: "系统内置：仅扫码填表，无后台菜单",
  },
] as const;

async function ensureSystemRoles() {
  for (const r of SYSTEM_ROLES) {
    await prisma.role.upsert({
      where: { code: r.code },
      create: {
        id: r.id,
        code: r.code,
        name: r.name,
        description: r.description,
        isSystem: true,
        status: "active",
      },
      update: {
        name: r.name,
        description: r.description,
        isSystem: true,
        status: "active",
      },
    });
  }
}

async function roleIdByCode(code: string) {
  const role = await prisma.role.findUnique({ where: { code } });
  if (!role) {
    throw new Error(`角色不存在: ${code}（请先运行 migrate-roles 或确保角色已创建）`);
  }
  return role.id;
}

async function upsertUser(
  openid: string,
  name: string,
  roleId: string,
  hashedPassword: string
) {
  const existing = await prisma.user.findUnique({ where: { openid } });
  if (existing) {
    return prisma.user.update({
      where: { openid },
      data: {
        name,
        roleId,
        status: "active",
        password: hashedPassword,
        mustChangePassword: true,
      },
      include: { role: true },
    });
  }
  return prisma.user.create({
    data: {
      id: createId(),
      openid,
      name,
      roleId,
      status: "active",
      password: hashedPassword,
      mustChangePassword: true,
    },
    include: { role: true },
  });
}

async function main() {
  const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  await ensureSystemRoles();
  const workerRoleId = await roleIdByCode("worker");
  const adminRoleId = await roleIdByCode("admin");

  const worker = await upsertUser(
    "worker_test",
    "张工",
    workerRoleId,
    hashedPassword
  );
  // 兼容旧种子账号
  const admin = await upsertUser(
    "admin_test",
    "管理员",
    adminRoleId,
    hashedPassword
  );
  // 超级管理员：账号 admin，默认密码 123456
  const superAdmin = await upsertUser(
    "admin",
    "admin",
    adminRoleId,
    hashedPassword
  );

  // 超级管理员首次可用，不强制改密
  await prisma.user.update({
    where: { openid: "admin" },
    data: { mustChangePassword: false, name: "admin" },
  });

  const existingPoint = await prisma.point.findUnique({
    where: { code: "qr_test_001" },
    include: { template: true },
  });

  let pointId = existingPoint?.id;
  let templateId = existingPoint?.template?.id;

  if (!existingPoint) {
    pointId = createId();
    templateId = createId();

    await prisma.point.create({
      data: {
        id: pointId,
        code: "qr_test_001",
        name: "测试毒饵站",
        description: "种子数据：用于联调扫码填表",
        status: "active",
        template: {
          create: {
            id: templateId!,
            name: "鼠药投放记录表",
            version: 1,
            fields: TEMPLATE_FIELDS,
          },
        },
      },
    });
  } else {
    await prisma.point.update({
      where: { id: existingPoint.id },
      data: {
        name: "测试毒饵站",
        description: "种子数据：用于联调扫码填表",
        status: "active",
        deletedAt: null,
      },
    });

    if (existingPoint.template) {
      await prisma.formTemplate.update({
        where: { id: existingPoint.template.id },
        data: {
          name: "鼠药投放记录表",
          fields: TEMPLATE_FIELDS,
        },
      });
    } else {
      templateId = createId();
      await prisma.formTemplate.create({
        data: {
          id: templateId,
          pointId: existingPoint.id,
          name: "鼠药投放记录表",
          version: 1,
          fields: TEMPLATE_FIELDS,
        },
      });
    }
  }

  const settings = [
    {
      key: "system_name",
      value: "扫码填表管理系统",
      description: "系统名称",
    },
    {
      key: "session_days",
      value: 7,
      description: "会话有效期（天）",
    },
    {
      key: "max_submission_edits",
      value: 2,
      description: "表单修改次数上限",
    },
    {
      key: "point_lock_hours",
      value: 6,
      description: "同一二维码占用窗口（小时）",
    },
    {
      key: "edit_window_hours",
      value: 6,
      description: "提交后可修改时间窗口（小时）",
    },
  ] as const;

  // 路人欢迎语已废弃（扫码需登录），清理历史配置
  await prisma.systemSetting.deleteMany({
    where: { key: "welcome_message" },
  });

  for (const item of settings) {
    await prisma.systemSetting.upsert({
      where: { key: item.key },
      create: {
        key: item.key,
        value: item.value,
        description: item.description,
      },
      update: {
        value: item.value,
        description: item.description,
      },
    });
  }

  console.log("Seed completed:");
  console.log({
    pointCode: "qr_test_001",
    pointId,
    templateId,
    defaultPassword: DEFAULT_PASSWORD,
    worker: {
      id: worker.id,
      openid: worker.openid,
      roleId: worker.roleId,
      role: worker.role.code,
    },
    admin: {
      id: admin.id,
      openid: admin.openid,
      roleId: admin.roleId,
      role: admin.role.code,
    },
    superAdmin: {
      id: superAdmin.id,
      openid: superAdmin.openid,
      roleId: superAdmin.roleId,
      role: superAdmin.role.code,
      name: superAdmin.name,
    },
    settings: settings.map((s) => s.key),
  });
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
