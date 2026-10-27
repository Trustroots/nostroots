export function handleHealthRequest(
  request: Request,
  isReady: () => boolean,
): Response {
  if (new URL(request.url).pathname !== "/health") {
    return new Response("not found", { status: 404 });
  }
  return isReady()
    ? new Response("ok", { status: 200 })
    : new Response("starting", { status: 503 });
}

export function startHealthServer(
  options: { readonly port: number; readonly hostname: string },
  isReady: () => boolean,
): Deno.HttpServer<Deno.NetAddr> {
  return Deno.serve(
    { ...options, onListen: () => {} },
    (request) => handleHealthRequest(request, isReady),
  );
}
