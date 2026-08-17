import prisma from "@/lib/prisma";

export const SETTING_KEYS = {
  systemName: "system_name",
  sessionDays: "session_days",
  maxSubmissionEdits: "max_submission_edits",
  pointLockHours: "point_lock_hours",
  editWindowHours: "edit_window_hours",
} as const;

/** 填表相关策略（可由系统设置灵活调整） */
export type SubmissionPolicy = {
  /** 单条提交允许修改次数；0 = 不可修改 */
  maxSubmissionEdits: number;
  /** 同一二维码占用窗口（小时）；0 = 不限制，允许多次提交 */
  pointLockHours: number;
  /** 提交后可修改时间窗口（小时）；0 = 不限制时间，仅受次数限制 */
  editWindowHours: number;
};

export type SystemSettingsDTO = {
  systemName: string;
  sessionDays: number;
} & SubmissionPolicy;

export const DEFAULT_SUBMISSION_POLICY: SubmissionPolicy = {
  maxSubmissionEdits: 2,
  pointLockHours: 6,
  editWindowHours: 6,
};

export const DEFAULT_SETTINGS: SystemSettingsDTO = {
  systemName: "扫码填表管理系统",
  sessionDays: 7,
  ...DEFAULT_SUBMISSION_POLICY,
};

const SESSION_DAY_OPTIONS = [7, 14, 30] as const;

function asNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

/** 规范化并校验填表策略字段 */
export function normalizeSubmissionPolicy(
  input: Partial<SubmissionPolicy>
): SubmissionPolicy {
  return {
    maxSubmissionEdits:
      input.maxSubmissionEdits === undefined
        ? DEFAULT_SUBMISSION_POLICY.maxSubmissionEdits
        : clampInt(Number(input.maxSubmissionEdits), 0, 20),
    pointLockHours:
      input.pointLockHours === undefined
        ? DEFAULT_SUBMISSION_POLICY.pointLockHours
        : clampInt(Number(input.pointLockHours), 0, 720),
    editWindowHours:
      input.editWindowHours === undefined
        ? DEFAULT_SUBMISSION_POLICY.editWindowHours
        : clampInt(Number(input.editWindowHours), 0, 720),
  };
}

export function toSubmissionPolicy(
  settings: Pick<
    SystemSettingsDTO,
    "maxSubmissionEdits" | "pointLockHours" | "editWindowHours"
  >
): SubmissionPolicy {
  return {
    maxSubmissionEdits: settings.maxSubmissionEdits,
    pointLockHours: settings.pointLockHours,
    editWindowHours: settings.editWindowHours,
  };
}

export async function getSystemSettings(): Promise<SystemSettingsDTO> {
  const rows = await prisma.systemSetting.findMany({
    where: {
      key: {
        in: Object.values(SETTING_KEYS),
      },
    },
  });

  const map = new Map(rows.map((row) => [row.key, row.value]));

  const sessionRaw = asNumber(
    map.get(SETTING_KEYS.sessionDays),
    DEFAULT_SETTINGS.sessionDays
  );
  const policy = normalizeSubmissionPolicy({
    maxSubmissionEdits: asNumber(
      map.get(SETTING_KEYS.maxSubmissionEdits),
      DEFAULT_SETTINGS.maxSubmissionEdits
    ),
    pointLockHours: asNumber(
      map.get(SETTING_KEYS.pointLockHours),
      DEFAULT_SETTINGS.pointLockHours
    ),
    editWindowHours: asNumber(
      map.get(SETTING_KEYS.editWindowHours),
      DEFAULT_SETTINGS.editWindowHours
    ),
  });

  return {
    systemName:
      typeof map.get(SETTING_KEYS.systemName) === "string"
        ? (map.get(SETTING_KEYS.systemName) as string)
        : DEFAULT_SETTINGS.systemName,
    sessionDays: (SESSION_DAY_OPTIONS as readonly number[]).includes(sessionRaw)
      ? sessionRaw
      : DEFAULT_SETTINGS.sessionDays,
    ...policy,
  };
}

export async function getSubmissionPolicy(): Promise<SubmissionPolicy> {
  const settings = await getSystemSettings();
  return toSubmissionPolicy(settings);
}

export async function upsertSystemSettings(input: Partial<SystemSettingsDTO>) {
  const ops = [];

  if (input.systemName !== undefined) {
    ops.push(
      prisma.systemSetting.upsert({
        where: { key: SETTING_KEYS.systemName },
        create: {
          key: SETTING_KEYS.systemName,
          value: input.systemName,
          description: "系统名称",
        },
        update: { value: input.systemName, description: "系统名称" },
      })
    );
  }

  if (input.sessionDays !== undefined) {
    ops.push(
      prisma.systemSetting.upsert({
        where: { key: SETTING_KEYS.sessionDays },
        create: {
          key: SETTING_KEYS.sessionDays,
          value: input.sessionDays,
          description: "会话有效期（天）",
        },
        update: {
          value: input.sessionDays,
          description: "会话有效期（天）",
        },
      })
    );
  }

  if (input.maxSubmissionEdits !== undefined) {
    ops.push(
      prisma.systemSetting.upsert({
        where: { key: SETTING_KEYS.maxSubmissionEdits },
        create: {
          key: SETTING_KEYS.maxSubmissionEdits,
          value: input.maxSubmissionEdits,
          description: "表单修改次数上限",
        },
        update: {
          value: input.maxSubmissionEdits,
          description: "表单修改次数上限",
        },
      })
    );
  }

  if (input.pointLockHours !== undefined) {
    ops.push(
      prisma.systemSetting.upsert({
        where: { key: SETTING_KEYS.pointLockHours },
        create: {
          key: SETTING_KEYS.pointLockHours,
          value: input.pointLockHours,
          description: "同一二维码占用窗口（小时）",
        },
        update: {
          value: input.pointLockHours,
          description: "同一二维码占用窗口（小时）",
        },
      })
    );
  }

  if (input.editWindowHours !== undefined) {
    ops.push(
      prisma.systemSetting.upsert({
        where: { key: SETTING_KEYS.editWindowHours },
        create: {
          key: SETTING_KEYS.editWindowHours,
          value: input.editWindowHours,
          description: "提交后可修改时间窗口（小时）",
        },
        update: {
          value: input.editWindowHours,
          description: "提交后可修改时间窗口（小时）",
        },
      })
    );
  }

  if (ops.length) {
    await prisma.$transaction(ops);
  }

  return getSystemSettings();
}
