/** HTTP status codes the app reacts to. */
export const HTTP_STATUS = {
  badRequest: 400,
  unauthorized: 401,
  forbidden: 403,
  tooManyRequests: 429,
} as const;
