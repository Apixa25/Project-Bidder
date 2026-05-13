export const IMPERSONATE_COOKIE = "x-impersonate-user-id";

export interface GlobalSearchResult {
  type: "user" | "project" | "bid" | "message";
  id: string;
  title: string;
  subtitle: string;
  href: string;
}
