import { auth } from "@/shared/auth/auth";
import {
  createPost,
  deletePost,
  getPostAuthorId,
  updatePost,
} from "@/shared/repositories/post-repository";

import { DELETE, PUT } from "../[postId]/route";
import { POST } from "../route";

jest.mock("@/shared/auth/auth", () => ({ auth: { api: { getSession: jest.fn() } } }));
// Repositories are mocked; the real ownership check (ownership.ts) runs.
jest.mock("@/shared/repositories/post-repository", () => ({
  createPost: jest.fn(),
  updatePost: jest.fn(),
  deletePost: jest.fn(),
  getPostAuthorId: jest.fn(),
}));
jest.mock("@/shared/repositories/comment-repository", () => ({ getCommentOwnership: jest.fn() }));

const signInAs = (id: string | null) =>
  jest.mocked(auth.api.getSession).mockResolvedValue((id ? { user: { id } } : null) as never);

const now = new Date("2026-02-03T04:05:06Z");
const row = { id: "p1", title: "T", content: "C", authorId: "ada", createdAt: now, updatedAt: now };

const request = (method: string, body?: unknown) =>
  new Request("http://test.local/api/v1/posts/p1", {
    method,
    headers: body === undefined ? {} : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const ctx = (postId = "p1") => ({ params: Promise.resolve({ postId }) });

describe("POST /api/v1/posts", () => {
  it("rejects signed-out users (401)", async () => {
    signInAs(null);
    const res = await POST(request("POST", { title: "T", content: "C" }), undefined);
    expect(res.status).toBe(401);
    expect(createPost).not.toHaveBeenCalled();
  });

  it("validates the body (422)", async () => {
    signInAs("ada");
    const res = await POST(request("POST", { title: "" }), undefined);
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({
      error: { fieldErrors: { title: ["Enter a title"], content: ["Write something"] } },
    });
  });

  it("creates the post as the signed-in user (201)", async () => {
    signInAs("ada");
    jest.mocked(createPost).mockResolvedValue(row);
    const res = await POST(request("POST", { title: " T ", content: "C" }), undefined);
    expect(res.status).toBe(201);
    expect(createPost).toHaveBeenCalledWith("ada", { title: "T", content: "C" });
    expect(await res.json()).toEqual({
      data: { post: { ...row, createdAt: now.toISOString(), updatedAt: now.toISOString() } },
    });
  });
});

describe("PUT /api/v1/posts/:postId", () => {
  const body = { title: "New", content: "Body" };

  it("rejects signed-out users (401)", async () => {
    signInAs(null);
    expect((await PUT(request("PUT", body), ctx())).status).toBe(401);
  });

  it("forbids editing someone else's post (403)", async () => {
    signInAs("ben");
    jest.mocked(getPostAuthorId).mockResolvedValue("ada");
    const res = await PUT(request("PUT", body), ctx());
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: { code: "FORBIDDEN", message: "You can only edit or delete your own posts." },
    });
    expect(updatePost).not.toHaveBeenCalled();
  });

  it("returns 403 to non-authors even when the body is invalid", async () => {
    signInAs("ben");
    jest.mocked(getPostAuthorId).mockResolvedValue("ada");
    expect((await PUT(request("PUT", {}), ctx())).status).toBe(403);
  });

  it("returns 404 for a missing post", async () => {
    signInAs("ada");
    jest.mocked(getPostAuthorId).mockResolvedValue(null);
    expect((await PUT(request("PUT", body), ctx("missing"))).status).toBe(404);
  });

  it("requires both title and content (422)", async () => {
    signInAs("ada");
    jest.mocked(getPostAuthorId).mockResolvedValue("ada");
    expect((await PUT(request("PUT", { title: "Only title" }), ctx())).status).toBe(422);
  });

  it("lets the author replace the post (200)", async () => {
    signInAs("ada");
    jest.mocked(getPostAuthorId).mockResolvedValue("ada");
    jest.mocked(updatePost).mockResolvedValue({ ...row, ...body });
    const res = await PUT(request("PUT", body), ctx());
    expect(res.status).toBe(200);
    expect(updatePost).toHaveBeenCalledWith("p1", "ada", body);
  });

  it("returns 404 if the post is deleted between the check and the update", async () => {
    signInAs("ada");
    jest.mocked(getPostAuthorId).mockResolvedValue("ada");
    jest.mocked(updatePost).mockResolvedValue(null);
    expect((await PUT(request("PUT", body), ctx())).status).toBe(404);
  });
});

describe("DELETE /api/v1/posts/:postId", () => {
  it("rejects signed-out users (401)", async () => {
    signInAs(null);
    expect((await DELETE(request("DELETE"), ctx())).status).toBe(401);
    expect(deletePost).not.toHaveBeenCalled();
  });

  it("forbids deleting someone else's post (403)", async () => {
    signInAs("ben");
    jest.mocked(getPostAuthorId).mockResolvedValue("ada");
    expect((await DELETE(request("DELETE"), ctx())).status).toBe(403);
    expect(deletePost).not.toHaveBeenCalled();
  });

  it("returns 404 for a missing post", async () => {
    signInAs("ada");
    jest.mocked(getPostAuthorId).mockResolvedValue(null);
    expect((await DELETE(request("DELETE"), ctx("missing"))).status).toBe(404);
  });

  it("lets the author delete (204)", async () => {
    signInAs("ada");
    jest.mocked(getPostAuthorId).mockResolvedValue("ada");
    jest.mocked(deletePost).mockResolvedValue(true);
    const res = await DELETE(request("DELETE"), ctx());
    expect(res.status).toBe(204);
    expect(deletePost).toHaveBeenCalledWith("p1", "ada");
  });
});
