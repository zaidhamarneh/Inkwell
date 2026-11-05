import "server-only";

import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { z } from "zod";

import { auth } from "@/shared/auth/auth";

/** Context for requests coming in over HTTP (/api/trpc). */
export async function createContext({ headers }: { headers: Headers }) {
  // Read straight from the database (no cookie cache), so a revoked session
  // is rejected immediately, same as everywhere else.
  const session = await auth.api.getSession({
    headers,
    query: { disableRefresh: true },
  });
  return { session };
}

export type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create({
  // superjson keeps Dates as Dates between server and browser.
  transformer: superjson,
  errorFormatter({ shape, error }) {
    const zodError = error.cause instanceof z.ZodError ? error.cause : null;

    return {
      ...shape,
      // Never send internal error details (SQL, stack traces) to the browser,
      // and replace Zod's raw issue list with a readable message.
      message:
        error.code === "INTERNAL_SERVER_ERROR"
          ? "Something went wrong on our end."
          : zodError
            ? "Some fields are invalid."
            : shape.message,
      data: {
        ...shape.data,
        stack: undefined,
        fieldErrors: zodError ? z.flattenError(zodError).fieldErrors : undefined,
      },
    };
  },
});

export const router = t.router;
export const createCallerFactory = t.createCallerFactory;

/** A procedure that requires a signed-in user; adds `ctx.user`. */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You need to be logged in.",
    });
  }
  return next({ ctx: { session: ctx.session, user: ctx.session.user } });
});
