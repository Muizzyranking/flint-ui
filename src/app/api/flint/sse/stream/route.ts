import type { NextRequest } from "next/server";
import { getApiKey, upstreamUrl } from "@/lib/flint-api";

type RouteContext = {
  params: Promise<Record<string, never>>;
};

function errorEnvelope(message: string, status: number): Response {
  return Response.json(
    { message, data: null, errors: [{ message }], meta: null },
    { status },
  );
}

export async function GET(
  _request: NextRequest,
  _context: RouteContext,
): Promise<Response> {
  const url = upstreamUrl("sse/stream");
  if (!url) {
    return errorEnvelope(
      "The Flint API is not configured. Set API_URL in the environment.",
      503,
    );
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    return errorEnvelope(
      "The Flint API key is not configured. Set API_KEY in the environment.",
      503,
    );
  }

  try {
    const upstream = await fetch(
      `${url}?api_key=${encodeURIComponent(apiKey)}`,
      {
        method: "GET",
        cache: "no-store",
        headers: {
          accept: "text/event-stream",
          "X-API-Key": apiKey,
        },
        // No timeout signal: the connection must stay open for the lifetime of
        // the subscription; upstream keepalives (every 15s) hold it alive.
      },
    );

    const headers = new Headers({
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    });

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers,
    });
  } catch {
    return errorEnvelope(
      "Could not reach the Flint API event stream. Is the server running?",
      502,
    );
  }
}
