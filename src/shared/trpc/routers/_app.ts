import "server-only";

import { router } from "../init";
import { postsRouter } from "./posts";

export const appRouter = router({
  posts: postsRouter,
});

/** Type-only export for the browser client; no server code is bundled. */
export type AppRouter = typeof appRouter;
