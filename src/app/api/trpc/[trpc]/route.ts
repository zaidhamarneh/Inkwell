import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { createContext } from "@/shared/trpc/init";
import { appRouter } from "@/shared/trpc/routers/_app";

function handler(request: Request) {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: request,
    router: appRouter,
    createContext: () => createContext({ headers: request.headers }),
    onError({ error, path }) {
      if (error.code === "INTERNAL_SERVER_ERROR") {
        console.error(`[trpc] ${path} failed:`, error.cause ?? error);
      }
    },
    // Responses depend on who's signed in, so they must never be cached.
    responseMeta: () => ({ headers: { "Cache-Control": "no-store" } }),
  });
}

export { handler as GET, handler as POST };
