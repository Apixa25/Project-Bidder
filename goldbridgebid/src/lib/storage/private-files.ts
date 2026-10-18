import type { SupabaseClient } from "@supabase/supabase-js";

export const BID_FILES_BUCKET = "bid-files";
export const CREDENTIAL_FILES_BUCKET = "credential-files";

const SIGNED_URL_SECONDS = 60 * 15;

/**
 * Stored values are either a bare storage path (new uploads) or an older
 * public object URL. Both point at the same object.
 */
export function storageObjectPath(
  bucket: string,
  stored: string | null | undefined
): string | null {
  if (!stored) return null;
  const trimmed = stored.trim();
  if (!trimmed) return null;

  if (!/^https?:\/\//i.test(trimmed)) {
    return decodeURIComponent(trimmed.replace(/^\/+/, ""));
  }

  try {
    const url = new URL(trimmed);
    const markers = [
      `/object/public/${bucket}/`,
      `/object/sign/${bucket}/`,
      `/object/authenticated/${bucket}/`,
    ];
    for (const marker of markers) {
      const index = url.pathname.indexOf(marker);
      if (index >= 0) {
        return decodeURIComponent(url.pathname.slice(index + marker.length));
      }
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Map each stored value to a URL the browser can open.
 * Prefers a short-lived signed URL. If signing is unavailable (the
 * private-bucket migration has not been applied yet), an existing https
 * URL is returned unchanged so current rows keep working.
 */
export async function signedUrlByStoredValue(
  supabase: SupabaseClient,
  bucket: string,
  storedValues: Array<string | null | undefined>
): Promise<Map<string, string>> {
  const entries = storedValues
    .filter((value): value is string => Boolean(value?.trim()))
    .map((stored) => ({
      stored,
      path: storageObjectPath(bucket, stored),
    }));

  const uniquePaths = [
    ...new Set(
      entries
        .map((entry) => entry.path)
        .filter((path): path is string => Boolean(path))
    ),
  ];
  const signedByPath = new Map<string, string>();

  if (uniquePaths.length > 0) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrls(uniquePaths, SIGNED_URL_SECONDS);

    if (!error && data) {
      for (const row of data) {
        if (row.signedUrl && row.path && !row.error) {
          signedByPath.set(row.path, row.signedUrl);
        }
      }
    }
  }

  const resolved = new Map<string, string>();
  for (const entry of entries) {
    const signed = entry.path ? signedByPath.get(entry.path) : undefined;
    if (signed) {
      resolved.set(entry.stored, signed);
    } else if (/^https?:\/\//i.test(entry.stored)) {
      resolved.set(entry.stored, entry.stored);
    }
  }

  return resolved;
}

export function lookupSignedUrl(
  signedUrls: Map<string, string>,
  stored: string | null | undefined
): string | null {
  if (!stored) return null;
  return signedUrls.get(stored) ?? null;
}
