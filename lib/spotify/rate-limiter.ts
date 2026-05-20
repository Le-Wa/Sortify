const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Wrapper around fetch that injects the Bearer token and retries on 429.
 * Reads Retry-After (seconds) from the response header and waits before
 * each retry. Returns the last response if all retries are exhausted.
 */
export async function spotifyFetch(
  url: string,
  token: string,
  retries = 3,
  init: RequestInit = {}
): Promise<Response> {
  const { headers: extra, ...rest } = init;
  const headers = new Headers(extra);
  headers.set("Authorization", `Bearer ${token}`);

  let lastRes!: Response;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, { ...rest, headers });

    if (res.status !== 429) return res;

    lastRes = res;

    if (attempt < retries) {
      const waitSec = Number(res.headers.get("Retry-After") ?? "1");
      await sleep((waitSec + 1) * 1000); // +1 s safety buffer
    }
  }

  return lastRes;
}
