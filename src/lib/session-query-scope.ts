import type { SessionUser } from "@/lib/auth";

export function getSessionQueryScope(
  user: SessionUser | null | undefined,
): string {
  if (!user) {
    return "anonymous";
  }

  return [
    user.tenantId,
    user.id,
    [...user.roles].sort((left, right) => left.localeCompare(right)).join(","),
  ].join(":");
}
