import { assertCommentAuthor, assertPostAuthor } from "@/shared/auth/ownership";
import { createUser, prisma, resetDatabase } from "@/shared/db/__tests__/test-db";

import {
  createComment,
  deleteComment,
  getCommentOwnership,
  listComments,
  updateComment,
} from "../comment-repository";
import { setLike } from "../like-repository";
import { createPost } from "../post-repository";

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

async function setup() {
  const ada = await createUser("ada");
  const ben = await createUser("ben");
  const post = await createPost(ada.id, { title: "Ada's post", content: "Hi" });
  return { ada, ben, post };
}

describe("comments", () => {
  it("anyone can comment; comments list oldest first with isMine", async () => {
    const { ada, ben, post } = await setup();
    await createComment(post.id, ben.id, "First");
    await createComment(post.id, ada.id, "Second");

    const comments = await listComments(post.id, ben.id);
    expect(comments.map((c) => [c.content, c.isMine])).toEqual([
      ["First", true],
      ["Second", false],
    ]);
  });

  it("returns null when commenting on a deleted post", async () => {
    const { ben } = await setup();
    await expect(createComment("missing-post", ben.id, "Hi")).resolves.toBeNull();
  });

  it("the author can edit (updatedAt changes) and delete", async () => {
    const { ben, post } = await setup();
    const comment = await createComment(post.id, ben.id, "Original");
    if (!comment) throw new Error("not created");

    await new Promise((r) => setTimeout(r, 10));
    const edited = await updateComment(comment.id, ben.id, "Edited");
    expect(edited?.content).toBe("Edited");
    expect(edited!.updatedAt.getTime()).toBeGreaterThan(comment.createdAt.getTime());

    await expect(deleteComment(comment.id, ben.id)).resolves.toBe(true);
    await expect(getCommentOwnership(comment.id)).resolves.toBeNull();
  });

  it("can't change someone else's comment even without the ownership check", async () => {
    const { ada, ben, post } = await setup();
    const comment = await createComment(post.id, ben.id, "Ben's");
    if (!comment) throw new Error("not created");

    await expect(updateComment(comment.id, ada.id, "Hijack")).resolves.toBeNull();
    await expect(deleteComment(comment.id, ada.id)).resolves.toBe(false);
    await expect(prisma.comment.findUnique({ where: { id: comment.id } })).resolves.toMatchObject({
      content: "Ben's",
    });
  });
});

describe("ownership checks on real data", () => {
  it("post: author passes, others get 403, missing gets 404", async () => {
    const { ada, ben, post } = await setup();
    await expect(assertPostAuthor(post.id, ada.id)).resolves.toBeUndefined();
    await expect(assertPostAuthor(post.id, ben.id)).rejects.toMatchObject({ status: 403 });
    await expect(assertPostAuthor("missing", ada.id)).rejects.toMatchObject({ status: 404 });
  });

  it("comment: author passes, others get 403 (including the post's author)", async () => {
    const { ada, ben, post } = await setup();
    const comment = await createComment(post.id, ben.id, "Ben's");
    if (!comment) throw new Error("not created");

    await expect(assertCommentAuthor(comment.id, ben.id)).resolves.toEqual({ postId: post.id });
    await expect(assertCommentAuthor(comment.id, ada.id)).rejects.toMatchObject({ status: 403 });
  });
});

describe("likes", () => {
  it("likes once even when sent twice, and unlikes", async () => {
    const { ben, post } = await setup();
    await expect(setLike(post.id, ben.id, true)).resolves.toEqual({ status: "ok", liked: true, likeCount: 1 });
    await expect(setLike(post.id, ben.id, true)).resolves.toEqual({ status: "ok", liked: true, likeCount: 1 });
    await expect(setLike(post.id, ben.id, false)).resolves.toEqual({ status: "ok", liked: false, likeCount: 0 });
    await expect(setLike(post.id, ben.id, false)).resolves.toEqual({ status: "ok", liked: false, likeCount: 0 });
  });

  it("authors can like their own posts", async () => {
    const { ada, post } = await setup();
    await expect(setLike(post.id, ada.id, true)).resolves.toMatchObject({ liked: true, likeCount: 1 });
  });

  it("reports a missing post", async () => {
    const { ben } = await setup();
    await expect(setLike("missing", ben.id, true)).resolves.toEqual({ status: "not_found" });
  });

  it("concurrent likes from one user still count once", async () => {
    const { ben, post } = await setup();
    await Promise.all(Array.from({ length: 5 }, () => setLike(post.id, ben.id, true)));
    await expect(prisma.like.count({ where: { postId: post.id } })).resolves.toBe(1);
  });
});
