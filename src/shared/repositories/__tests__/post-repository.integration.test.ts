import { createUser, prisma, resetDatabase } from "@/shared/db/__tests__/test-db";

import {
  createPost,
  deletePost,
  getPost,
  getPostAuthorId,
  getPostForEdit,
  listPosts,
  POSTS_PAGE_SIZE,
  updatePost,
} from "../post-repository";

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

async function seedPosts(authorId: string, count: number) {
  const ids: string[] = [];
  for (let i = 1; i <= count; i++) {
    const post = await prisma.post.create({
      data: {
        title: `Post ${i}`,
        content: `Body ${i} `.repeat(40),
        authorId,
        createdAt: new Date(Date.UTC(2026, 0, 1, 0, i)), // later = newer
      },
    });
    ids.push(post.id);
  }
  return ids;
}

describe("createPost / getPost", () => {
  it("creates a post and reads it back with counts and viewer flags", async () => {
    const ada = await createUser("ada");
    const ben = await createUser("ben");
    const created = await createPost(ada.id, { title: "Hello", content: "World" });

    expect(created).toMatchObject({ title: "Hello", content: "World", authorId: ada.id });

    await prisma.like.create({ data: { postId: created.id, userId: ben.id } });
    await prisma.comment.create({ data: { postId: created.id, authorId: ben.id, content: "Hi" } });

    await expect(getPost(created.id, ben.id)).resolves.toMatchObject({
      likeCount: 1,
      commentCount: 1,
      readingMinutes: 1,
      likedByMe: true,
      isMine: false,
      author: { id: ada.id, name: "User ada", image: null },
    });
    await expect(getPost(created.id, ada.id)).resolves.toMatchObject({ likedByMe: false, isMine: true });
  });

  it("returns null for a missing post", async () => {
    const ada = await createUser("ada");
    await expect(getPost("missing", ada.id)).resolves.toBeNull();
  });

  it("never exposes author emails", async () => {
    const ada = await createUser("ada");
    const { id } = await createPost(ada.id, { title: "T", content: "C" });
    expect(JSON.stringify(await getPost(id, ada.id))).not.toContain("@test.local");
  });
});

describe("listPosts", () => {
  it("lists newest first, 20 per page, with a cursor for the rest", async () => {
    const ada = await createUser("ada");
    await seedPosts(ada.id, POSTS_PAGE_SIZE + 3);

    const first = await listPosts({ viewerId: ada.id });
    expect(first.items).toHaveLength(POSTS_PAGE_SIZE);
    expect(first.items[0]?.title).toBe("Post 23");
    expect(first.nextCursor).toBe(first.items.at(-1)?.id);

    const second = await listPosts({ viewerId: ada.id, cursor: first.nextCursor ?? undefined });
    expect(second.items.map((p) => p.title)).toEqual(["Post 3", "Post 2", "Post 1"]);
    expect(second.nextCursor).toBeNull();
  });

  it("filters to one author for the feed", async () => {
    const ada = await createUser("ada");
    const ben = await createUser("ben");
    await seedPosts(ada.id, 2);
    await seedPosts(ben.id, 3);

    const feed = await listPosts({ viewerId: ben.id, authorId: ben.id });
    expect(feed.items).toHaveLength(3);
    expect(feed.items.every((p) => p.isMine)).toBe(true);
  });

  it("builds a short excerpt from the content", async () => {
    const ada = await createUser("ada");
    await seedPosts(ada.id, 1);
    const [post] = (await listPosts({ viewerId: ada.id })).items;
    expect(post?.excerpt.length).toBeLessThanOrEqual(201);
    expect(post?.excerpt.endsWith("…")).toBe(true);
  });
});

describe("updatePost / deletePost (second guard: authorId filter)", () => {
  it("lets the author update and delete", async () => {
    const ada = await createUser("ada");
    const { id } = await createPost(ada.id, { title: "Old", content: "Old" });

    await expect(updatePost(id, ada.id, { title: "New", content: "New" })).resolves.toMatchObject({
      title: "New",
    });
    await expect(deletePost(id, ada.id)).resolves.toBe(true);
    await expect(getPostAuthorId(id)).resolves.toBeNull();
  });

  it("can't change someone else's post even without the ownership check", async () => {
    const ada = await createUser("ada");
    const ben = await createUser("ben");
    const { id } = await createPost(ada.id, { title: "Ada's", content: "Mine" });

    await expect(updatePost(id, ben.id, { title: "Hijack", content: "x" })).resolves.toBeNull();
    await expect(deletePost(id, ben.id)).resolves.toBe(false);
    await expect(getPostForEdit(id)).resolves.toMatchObject({ title: "Ada's", authorId: ada.id });
  });

  it("deleting a post also deletes its comments and likes", async () => {
    const ada = await createUser("ada");
    const ben = await createUser("ben");
    const { id } = await createPost(ada.id, { title: "T", content: "C" });
    await prisma.like.create({ data: { postId: id, userId: ben.id } });
    await prisma.comment.create({ data: { postId: id, authorId: ben.id, content: "Hi" } });

    await deletePost(id, ada.id);
    await expect(prisma.comment.count()).resolves.toBe(0);
    await expect(prisma.like.count()).resolves.toBe(0);
  });
});
