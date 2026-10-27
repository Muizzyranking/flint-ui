import type { NextRequest } from "next/server";
import { getApiKey, upstreamUrl } from "@/lib/flint-api";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

const FORWARD_HEADERS = ["content-type", "accept"] as const;

function errorEnvelope(message: string, status: number): Response {
  return Response.json(
    { message, data: null, errors: [{ message }], meta: null },
    { status },
  );
}

async function proxy(
  request: NextRequest,
  context: RouteContext,
): Promise<Response> {
  const { path } = await context.params;

  const url = upstreamUrl(path.join("/"), request.nextUrl.search.slice(1));
  if (!url) {
    return errorEnvelope(
      "The Flint API is not configured. Set API_URL in the environment.",
      503,
    );
  }

  const headers = new Headers();
  for (const name of FORWARD_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const apiKey = getApiKey();
  if (apiKey) headers.set("X-API-Key", apiKey);

  const method = request.method;
  const hasBody = method !== "GET" && method !== "HEAD";

  try {
    const upstream = await fetch(url, {
      method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      cache: "no-store",
      // Never exceed the SSE/window timeouts of the API itself; no retry.
      signal: AbortSignal.timeout(30_000),
    });

    const responseHeaders = new Headers();
    const contentType = upstream.headers.get("content-type");
    if (contentType) responseHeaders.set("content-type", contentType);

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.name === "TimeoutError"
        ? "The Flint API did not respond in time."
        : "Could not reach the Flint API.";
    return errorEnvelope(
      `Proxy failure: ${message} Is the server running?`,
      502,
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const HEAD = proxy;
