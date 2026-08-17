import { adminAuthHeaders, getAdminSession } from "@/lib/admin-auth";
import type { ApiResponse } from "@/lib/api-response";
import type { FormFieldDefinition } from "@/lib/types/form-fields";

async function adminRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const session = getAdminSession();
  const res = await fetch(url, {
    ...init,
    headers: {
      ...adminAuthHeaders(session?.openid),
      ...(init?.headers || {}),
    },
  });
  const json = (await res.json()) as ApiResponse<T>;
  if (json.code !== 0) {
    throw new Error(json.msg || "请求失败");
  }
  return json.data;
}

export type AdminPointItem = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
  template: {
    id: string;
    name: string;
    version: number;
  } | null;
};

export type PointsListResult = {
  list: AdminPointItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type AdminTemplateDetail = {
  id: string;
  pointId: string;
  name: string;
  fields: FormFieldDefinition[];
  version: number;
  pointName: string;
  pointCode: string;
};

export function fetchAdminPoints(params: {
  keyword?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const qs = new URLSearchParams();
  if (params.keyword) qs.set("keyword", params.keyword);
  if (params.status) qs.set("status", params.status);
  if (params.page) qs.set("page", String(params.page));
  if (params.pageSize) qs.set("pageSize", String(params.pageSize));
  return adminRequest<PointsListResult>(`/api/admin/points?${qs.toString()}`);
}

export function fetchAdminPoint(id: string) {
  return adminRequest<AdminPointItem>(`/api/admin/points/${encodeURIComponent(id)}`);
}

export function createAdminPoint(body: {
  name: string;
  description?: string;
  status?: "active" | "inactive";
}) {
  return adminRequest<AdminPointItem>("/api/admin/points", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateAdminPoint(
  id: string,
  body: {
    name?: string;
    description?: string;
    status?: "active" | "inactive";
  }
) {
  return adminRequest<AdminPointItem>(`/api/admin/points/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function deleteAdminPoint(id: string) {
  return adminRequest<{ id: string }>(`/api/admin/points/${id}`, {
    method: "DELETE",
  });
}

export function fetchAdminTemplate(pointId: string) {
  return adminRequest<AdminTemplateDetail>(
    `/api/admin/templates?pointId=${encodeURIComponent(pointId)}`
  );
}

export function saveAdminTemplate(pointId: string, fields: FormFieldDefinition[]) {
  return adminRequest<{ version: number }>("/api/admin/templates", {
    method: "PUT",
    body: JSON.stringify({ pointId, fields }),
  });
}

export type AdminRecordItem = {
  id: string;
  pointId: string;
  pointName: string;
  pointCode: string;
  submittedBy: string;
  /** 登录账号姓名（提交人） */
  submitterName?: string;
  submitterOpenid?: string;
  submitterType: "system_user" | "custom";
  submittedAt: string;
  data: Record<string, unknown>;
  images: string[];
  fieldsSnapshot: FormFieldDefinition[];
  templateVersion: number;
  isDeleted: boolean;
  editCount: number;
  summary: string;
  imageCount: number;
};

export type AdminRecordEditItem = {
  id: string;
  sequence: number;
  beforeData: Record<string, unknown>;
  afterData: Record<string, unknown>;
  beforeImages: string[];
  afterImages: string[];
  beforeSubmittedBy: string;
  afterSubmittedBy: string;
  editedByName: string;
  editedAt: string;
};

export type AdminRecordEditsResult = {
  submissionId: string;
  editCount: number;
  submittedAt: string;
  currentSubmittedBy: string;
  fieldsSnapshot: FormFieldDefinition[];
  original: {
    data: Record<string, unknown>;
    images: string[];
    submittedBy: string;
    at: string;
  };
  edits: AdminRecordEditItem[];
};

export function fetchAdminRecordEdits(id: string) {
  return adminRequest<AdminRecordEditsResult>(
    `/api/admin/records/${encodeURIComponent(id)}/edits`
  );
}

export type RecordsListResult = {
  list: AdminRecordItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export function fetchAdminRecords(params: {
  pointId?: string;
  keyword?: string;
  startDate?: string;
  endDate?: string;
  isDeleted?: "true" | "false" | "all";
  page?: number;
  pageSize?: number;
}) {
  const qs = new URLSearchParams();
  if (params.pointId) qs.set("pointId", params.pointId);
  if (params.keyword) qs.set("keyword", params.keyword);
  if (params.startDate) qs.set("startDate", params.startDate);
  if (params.endDate) qs.set("endDate", params.endDate);
  if (params.isDeleted) qs.set("isDeleted", params.isDeleted);
  if (params.page) qs.set("page", String(params.page));
  if (params.pageSize) qs.set("pageSize", String(params.pageSize));
  return adminRequest<RecordsListResult>(`/api/admin/records?${qs.toString()}`);
}

export function deleteAdminRecord(id: string) {
  return adminRequest<{ id: string }>(`/api/admin/records/${id}`, {
    method: "DELETE",
  });
}

export function restoreAdminRecord(id: string) {
  return adminRequest<{ id: string }>(`/api/admin/records/${id}/restore`, {
    method: "PUT",
  });
}

export type AdminUserItem = {
  id: string;
  openid: string;
  name: string;
  role: "worker" | "maintainer" | "admin";
  status: "active" | "inactive";
  createdAt: string;
};

export type UsersListResult = {
  list: AdminUserItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export function fetchAdminUsers(params: {
  keyword?: string;
  role?: string;
  page?: number;
  pageSize?: number;
}) {
  const qs = new URLSearchParams();
  if (params.keyword) qs.set("keyword", params.keyword);
  if (params.role) qs.set("role", params.role);
  if (params.page) qs.set("page", String(params.page));
  if (params.pageSize) qs.set("pageSize", String(params.pageSize));
  return adminRequest<UsersListResult>(`/api/admin/users?${qs.toString()}`);
}

export function createAdminUser(body: {
  openid: string;
  name: string;
  role: "worker" | "maintainer" | "admin";
  status: "active" | "inactive";
  password: string;
}) {
  return adminRequest<AdminUserItem>("/api/admin/users", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateAdminUser(
  id: string,
  body: {
    name?: string;
    role?: "worker" | "maintainer" | "admin";
    status?: "active" | "inactive";
    password?: string;
  }
) {
  return adminRequest<AdminUserItem>(`/api/admin/users/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function deleteAdminUser(id: string) {
  return adminRequest<AdminUserItem>(`/api/admin/users/${id}`, {
    method: "DELETE",
  });
}

export type SystemSettingsDTO = {
  systemName: string;
  sessionDays: number;
  /** 单条提交允许修改次数；0 = 不可修改 */
  maxSubmissionEdits: number;
  /** 同一二维码占用窗口（小时）；0 = 不限制 */
  pointLockHours: number;
  /** 提交后可修改时间窗口（小时）；0 = 不限制时间 */
  editWindowHours: number;
};

export type DashboardData = {
  stats: {
    totalPoints: number;
    activePoints: number;
    todaySubmissions: number;
    totalSubmissions: number;
  };
  trend: { day: string; count: number }[];
  activities: {
    id: string;
    time: string;
    text: string;
    at: string;
    kind: "log" | "submission";
  }[];
};

export function fetchAdminDashboard() {
  return adminRequest<DashboardData>("/api/admin/dashboard");
}

export function fetchAdminSettings() {
  return adminRequest<SystemSettingsDTO>("/api/admin/settings");
}

export function saveAdminSettings(body: Partial<SystemSettingsDTO>) {
  return adminRequest<SystemSettingsDTO>("/api/admin/settings", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export type OperationLogItem = {
  id: string;
  action: string;
  actionLabel: string;
  targetId: string | null;
  pointId: string | null;
  detail: unknown;
  createdAt: string;
  operatorName: string;
  operatorOpenid: string;
};

export type OperationLogsResult = {
  list: OperationLogItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export function fetchOperationLogs(params: {
  action?: string;
  page?: number;
  pageSize?: number;
}) {
  const qs = new URLSearchParams();
  if (params.action) qs.set("action", params.action);
  if (params.page) qs.set("page", String(params.page));
  if (params.pageSize) qs.set("pageSize", String(params.pageSize));
  return adminRequest<OperationLogsResult>(
    `/api/admin/operation-logs?${qs.toString()}`
  );
}

