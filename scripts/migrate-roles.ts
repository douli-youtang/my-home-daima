/**
 * 角色 RBAC 数据迁移（纯 SQL，兼容旧枚举列）
 * 1) 创建 roles / role_permissions
 * 2) users 增加 role_id 并回填
 * 3) 删除 users.role 枚举列
 *
 * Run BEFORE or AFTER prisma generate:
 *   npx tsx scripts/migrate-roles.ts
 *   npx prisma db push
 *   npx prisma generate
 */
import { PrismaClient } from "@prisma/client";
import { createHash, randomBytes } from "crypto";
import {
  ALL_PERMISSION_KEYS,
  MAINTAINER_DEFAULT_PERMISSIONS,
} from "../shared/permissions";

const prisma = new PrismaClient();

function id32() {
  return createHash("md5").update(randomBytes(16)).digest("hex");
}

const ROLE_IDS = {
  admin: "role_admin_system_________", // pad? need 32 chars
  maintainer: "role_maintainer_system___",
  worker: "role_worker_system________",
};

// fix to exactly use createId-like 32 hex
const FIXED = {
  admin: "a1000000000000000000000000000001",
  maintainer: "a1000000000000000000000000000002",
  worker: "a1000000000000000000000000000003",
};

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS roles (
      id VARCHAR(32) NOT NULL,
      code VARCHAR(64) NOT NULL,
      name VARCHAR(50) NOT NULL,
      description VARCHAR(255) NULL,
      is_system BOOLEAN NOT NULL DEFAULT false,
      status ENUM('active','inactive') NOT NULL DEFAULT 'active',
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY roles_code_key (code),
      KEY roles_status_idx (status)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      id VARCHAR(32) NOT NULL,
      role_id VARCHAR(32) NOT NULL,
      permission_key VARCHAR(100) NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY role_permissions_role_id_permission_key_key (role_id, permission_key),
      KEY role_permissions_role_id_idx (role_id),
      CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE ON UPDATE CASCADE
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);

  const roles = [
    {
      id: FIXED.admin,
      code: "admin",
      name: "管理员",
      description: "系统内置：拥有全部后台权限",
      keys: [...ALL_PERMISSION_KEYS],
    },
    {
      id: FIXED.maintainer,
      code: "maintainer",
      name: "维护员",
      description: "系统内置：点位与记录维护",
      keys: [...MAINTAINER_DEFAULT_PERMISSIONS],
    },
    {
      id: FIXED.worker,
      code: "worker",
      name: "作业人员",
      description: "系统内置：仅扫码填表，无后台菜单",
      keys: [] as string[],
    },
  ];

  for (const r of roles) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO roles (id, code, name, description, is_system, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, true, 'active', NOW(3), NOW(3))
       ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description), is_system=true, updated_at=NOW(3)`,
      r.id,
      r.code,
      r.name,
      r.description
    );
    // resolve actual id by code
    const rows: Array<{ id: string }> = await prisma.$queryRawUnsafe(
      `SELECT id FROM roles WHERE code = ? LIMIT 1`,
      r.code
    );
    const roleId = rows[0]?.id || r.id;
    await prisma.$executeRawUnsafe(
      `DELETE FROM role_permissions WHERE role_id = ?`,
      roleId
    );
    for (const key of r.keys) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO role_permissions (id, role_id, permission_key) VALUES (?, ?, ?)`,
        id32(),
        roleId,
        key
      );
    }
  }

  const cols: Array<{ COLUMN_NAME: string }> = await prisma.$queryRawUnsafe(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'`
  );
  const names = new Set(cols.map((c) => c.COLUMN_NAME));

  if (!names.has("role_id")) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE users ADD COLUMN role_id VARCHAR(32) NULL`
    );
  }

  if (names.has("role")) {
    for (const code of ["admin", "maintainer", "worker"]) {
      await prisma.$executeRawUnsafe(
        `UPDATE users u
         JOIN roles r ON r.code = ?
         SET u.role_id = r.id
         WHERE u.role = ?`,
        code,
        code
      );
    }
  }

  await prisma.$executeRawUnsafe(
    `UPDATE users u
     JOIN roles r ON r.code = 'worker'
     SET u.role_id = r.id
     WHERE u.role_id IS NULL OR u.role_id = ''`
  );

  await prisma.$executeRawUnsafe(
    `ALTER TABLE users MODIFY COLUMN role_id VARCHAR(32) NOT NULL`
  );

  const cols2: Array<{ COLUMN_NAME: string }> = await prisma.$queryRawUnsafe(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'`
  );
  if (cols2.some((c) => c.COLUMN_NAME === "role")) {
    // drop index on role if any
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE users DROP INDEX users_role_idx`);
    } catch {
      /* ignore */
    }
    await prisma.$executeRawUnsafe(`ALTER TABLE users DROP COLUMN role`);
  }

  try {
    await prisma.$executeRawUnsafe(
      `CREATE INDEX users_role_id_idx ON users (role_id)`
    );
  } catch {
    /* ignore */
  }

  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE users
       ADD CONSTRAINT users_role_id_fkey
       FOREIGN KEY (role_id) REFERENCES roles(id)
       ON DELETE RESTRICT ON UPDATE CASCADE`
    );
  } catch {
    /* ignore */
  }

  const userCount: Array<{ c: bigint }> = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) as c FROM users`
  );
  const roleCount: Array<{ c: bigint }> = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) as c FROM roles`
  );
  console.log(
    "migrate-roles OK users=",
    String(userCount[0]?.c),
    "roles=",
    String(roleCount[0]?.c)
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
