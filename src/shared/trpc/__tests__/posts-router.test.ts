import { TRPCError } from "@trpc/server";

import { getPost, listPosts } from "@/shared/repositories/post-repository";

import { createCallerFactory } from "../init";
import { appRouter } from "../routers/_app";

jest.mock("@/shared/auth/auth", () => ({ auth: { api: { getSession: jest.fn() } } }));
jest.mock("@/shared/repositories/post-repository", () => ({
  listPosts: jest.fn(),
  getPost: jest.fn(),
}));

const createCaller = createCallerFactory(appRouter);
const callerFor = (userId: string | null) =>
  createCaller({ session: (userId ? { user: { id: userId } } : null) as never });

describe("posts.list", () => {
  it("rejects signed-out users with UNAUTHORIZED", async () => {
    await expect(callerFor(null).posts.list({ scope: "all" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(listPosts).not.toHaveBeenCalled();
  });

  it("'all' lists everyone's posts for the viewer", async () => {
    jest.mocked(listPosts).mockResolvedValue({ items: [], nextCursor: null });
    await callerFor("ada").posts.list({ scope: "all" });
    expect(listPosts).toHaveBeenCalledWith({ viewerId: "ada", authorId: undefined, cursor: undefined });
  });

  it("'mine' only lists the viewer's own posts, and passes the cursor", async () => {
    jest.mocked(listPosts).mockResolvedValue({ items: [], nextCursor: null });
    await callerFor("ada").posts.list({ scope: "mine", cursor: "c123" });
    expect(listPosts).toHaveBeenCalledWith({ viewerId: "ada", authorId: "ada", cursor: "c123" });
  });

  it("rejects an invalid scope with BAD_REQUEST", async () => {
    const error: unknown = await callerFor("ada")
      .posts.list({ scope: "everyone" as "all" })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(TRPCError);
    expect(error).toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("posts.byId", () => {
  it("rejects signed-out users", async () => {
    await expect(callerFor(null).posts.byId({ postId: "p1" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("returns the post for the viewer, or null", async () => {
    jest.mocked(getPost).mockResolvedValueOnce(null);
    await expect(callerFor("ada").posts.byId({ postId: "missing" })).resolves.toBeNull();
    expect(getPost).toHaveBeenCalledWith("missing", "ada");
  });

  it("rejects an empty id", async () => {
    await expect(callerFor("ada").posts.byId({ postId: "" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});
