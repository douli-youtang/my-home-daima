export type ApiResponse<T = unknown> = {
  code: number;
  data: T;
  msg: string;
};

export function success<T>(data: T, msg = "ok"): ApiResponse<T> {
  return { code: 0, data, msg };
}

export function fail(msg: string, code = 1, data: unknown = null): ApiResponse {
  return { code, data, msg };
}
