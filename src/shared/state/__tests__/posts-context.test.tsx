/** @jest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react";

import { addComment, deleteComment, editComment } from "@/shared/actions/comment-actions";
import { setPostLike } from "@/shared/actions/like-actions";
import { apiDelete, apiPost, apiPut } from "@/shared/api/client";

import { PostsProvider, usePosts } from "../posts-context";

// tRPC is only used here for cache keys; a stable stand-in is enough.
const mockTrpc = {
  posts: {
    pathFilter: () => ({ queryKey: [["posts"]] }),
    list: { pathFilter: () => ({ queryKey: [["posts", "list"]] }) },
  },
};
jest.mock("@/shared/trpc/client", () => ({ useTRPC: () => mockTrpc }));
jest.mock("@/shared/api/client", () => ({
  apiPost: jest.fn(),
  apiPut: jest.fn(),
  apiDelete: jest.fn(),
}));
jest.mock("@/shared/actions/like-actions", () => ({ setPostLike: jest.fn() }));
jest.mock("@/shared/actions/comment-actions", () => ({
  addComment: jest.fn(),
  editComment: jest.fn(),
  deleteComment: jest.fn(),
}));

const ALL = { queryKey: [["posts"]] };
const LISTS = { queryKey: [["posts", "list"]] };
const apiPostRow = {
  id: "p1",
  title: "T",
  content: "C",
  authorId: "u1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};
const comment = {
  id: "c1",
  content: "Hi",
  author: { id: "u1", name: "Ada" },
  createdAt: new Date(),
  updatedAt: new Date(),
  isMine: true,
};
const failure = { ok: false as const, status: 403, error: { code: "FORBIDDEN" as const, message: "No" } };

function setup() {
  const queryClient = new QueryClient();
  const invalidate = jest.spyOn(queryClient, "invalidateQueries").mockResolvedValue();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <PostsProvider>{children}</PostsProvider>
    </QueryClientProvider>
  );
  const { result } = renderHook(() => usePosts(), { wrapper });
  return { posts: result, invalidate };
}

afterEach(cleanup);

describe("PostsContext: posts (REST API)", () => {
  it("createPost: posts to the API and refreshes all post data", async () => {
    jest.mocked(apiPost).mockResolvedValue({ ok: true, data: { post: apiPostRow } });
    const { posts, invalidate } = setup();

    const result = await act(() => posts.current.createPost({ title: "T", content: "C" }));

    expect(result.ok).toBe(true);
    expect(apiPost).toHaveBeenCalledWith("/posts", { title: "T", content: "C" });
    expect(invalidate).toHaveBeenCalledWith(ALL);
  });

  it("updatePost: PUTs to /posts/:id and refreshes all post data", async () => {
    jest.mocked(apiPut).mockResolvedValue({ ok: true, data: { post: apiPostRow } });
    const { posts, invalidate } = setup();

    await act(() => posts.current.updatePost("p1", { title: "T", content: "C" }));

    expect(apiPut).toHaveBeenCalledWith("/posts/p1", { title: "T", content: "C" });
    expect(invalidate).toHaveBeenCalledWith(ALL);
  });

  it("deletePost: refreshes only the lists (not the deleted post itself)", async () => {
    jest.mocked(apiDelete).mockResolvedValue({ ok: true, data: undefined });
    const { posts, invalidate } = setup();

    await act(() => posts.current.deletePost("p1"));

    expect(apiDelete).toHaveBeenCalledWith("/posts/p1");
    expect(invalidate).toHaveBeenCalledWith(LISTS);
    expect(invalidate).not.toHaveBeenCalledWith(ALL);
  });

  it("doesn't refresh anything when the API rejects the change (e.g. not the author)", async () => {
    jest.mocked(apiPut).mockResolvedValue(failure);
    jest.mocked(apiDelete).mockResolvedValue(failure);
    const { posts, invalidate } = setup();

    const updated = await act(() => posts.current.updatePost("p1", { title: "T", content: "C" }));
    const deleted = await act(() => posts.current.deletePost("p1"));
    expect(updated).toEqual(failure);
    expect(deleted).toEqual(failure);
    expect(invalidate).not.toHaveBeenCalled();
  });
});

describe("PostsContext: likes and comments (server actions)", () => {
  it("setLike: saves and waits for fresh post data before resolving", async () => {
    let finishRefresh: () => void = () => {};
    jest.mocked(setPostLike).mockResolvedValue({ ok: true, data: { liked: true, likeCount: 1 } });
    const { posts, invalidate } = setup();
    invalidate.mockImplementation(() => new Promise<void>((resolve) => (finishRefresh = resolve)));

    let settled = false;
    const pending = posts.current.setLike("p1", true).then((r) => {
      settled = true;
      return r;
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(invalidate).toHaveBeenCalledWith(ALL);
    expect(settled).toBe(false); // still waiting for the refetch

    finishRefresh();
    await expect(pending).resolves.toMatchObject({ ok: true });
  });

  it("setLike: turns a thrown action (e.g. proxy 401) into an error result", async () => {
    jest.mocked(setPostLike).mockRejectedValue(new Error("unexpected response"));
    const { posts, invalidate } = setup();

    const result = await act(() => posts.current.setLike("p1", true));
    expect(result).toMatchObject({
      ok: false,
      error: { code: "UNAUTHORIZED" },
    });
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("addComment / deleteComment refresh the lists (comment counts on cards)", async () => {
    jest.mocked(addComment).mockResolvedValue({ ok: true, data: { comment } });
    jest.mocked(deleteComment).mockResolvedValue({ ok: true, data: null });
    const { posts, invalidate } = setup();

    await act(() => posts.current.addComment("p1", { content: "Hi" }));
    expect(addComment).toHaveBeenCalledWith("p1", { content: "Hi" });
    expect(invalidate).toHaveBeenLastCalledWith(LISTS);

    invalidate.mockClear();
    await act(() => posts.current.deleteComment("c1"));
    expect(deleteComment).toHaveBeenCalledWith("c1");
    expect(invalidate).toHaveBeenCalledWith(LISTS);
  });

  it("editComment passes errors (e.g. not the author) straight through", async () => {
    const forbidden = { ok: false as const, error: { code: "FORBIDDEN" as const, message: "Not yours." } };
    jest.mocked(editComment).mockResolvedValue(forbidden);
    const { posts } = setup();

    const result = await act(() => posts.current.editComment("c1", { content: "x" }));
    expect(result).toEqual(forbidden);
  });
});

describe("usePosts", () => {
  it("throws a clear error outside PostsProvider", () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => usePosts())).toThrow(/PostsProvider/);
  });
});
