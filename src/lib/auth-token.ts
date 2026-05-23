const ACCESS_TOKEN_KEY = "wms_access_token";
const REFRESH_TOKEN_KEY = "wms_refresh_token";
const TENANT_ID_KEY = "tenant_id";

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

function isBrowser() {
  return typeof window !== "undefined";
}

export function getAccessToken() {
  return isBrowser() ? window.localStorage.getItem(ACCESS_TOKEN_KEY) : null;
}

export function getRefreshToken() {
  return isBrowser() ? window.localStorage.getItem(REFRESH_TOKEN_KEY) : null;
}

export function getTenantId(fallback: string) {
  return isBrowser()
    ? (window.localStorage.getItem(TENANT_ID_KEY) ?? fallback)
    : fallback;
}

export function setAuthTokens(tokens: AuthTokens) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

export function setTenantId(tenantId: string) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(TENANT_ID_KEY, tenantId);
}

export function clearAuthTokens() {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}
