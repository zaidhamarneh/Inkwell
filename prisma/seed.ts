/**
 * Demo data for local development: 3 users, 8 posts, comments and likes.
 *
 *   bun run db:seed
 *
 * Safe to re-run: it first deletes the demo users (and, by cascade, their
 * sessions, posts, comments and likes), then recreates everything. Other
 * users and their content are not touched.
 *
 * All demo users share the password below. Passwords are hashed with Better
 * Auth's own hasher, so they sign in through the normal login form.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";

import { PrismaClient } from "../src/generated/prisma/client";

export const DEMO_PASSWORD = "inkwell-demo-123";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const users = [
  { id: "seed-user-ada", name: "Ada Lovelace", email: "ada@example.com" },
  { id: "seed-user-grace", name: "Grace Hopper", email: "grace@example.com" },
  { id: "seed-user-alan", name: "Alan Turing", email: "alan@example.com" },
] as const;

type UserKey = "ada" | "grace" | "alan";
const userId = (key: UserKey) => `seed-user-${key}`;

const posts: {
  key: string;
  author: UserKey;
  daysAgo: number;
  title: string;
  content: string;
}[] = [
  {
    key: "notes-on-the-engine",
    author: "ada",
    daysAgo: 1,
    title: "Notes on the Analytical Engine",
    content:
      "The engine might act upon other things besides number, were objects found whose mutual relations could be expressed by those of the abstract science of operations.\n\nI keep coming back to this idea: the machine doesn't care what the symbols mean. That's the interesting part.",
  },
  {
    key: "first-bug",
    author: "grace",
    daysAgo: 2,
    title: "We found an actual bug in the machine",
    content:
      "A moth was stuck in relay #70, Panel F. We taped it into the logbook with the note \"first actual case of bug being found.\"\n\nDebugging has never been more literal.",
  },
  {
    key: "can-machines-think",
    author: "alan",
    daysAgo: 3,
    title: "Can machines think?",
    content:
      "I propose to consider the question, \"Can machines think?\" The question is too vague to be useful, so let's replace it with a game: can a machine imitate a person well enough that an interrogator can't tell the difference?",
  },
  {
    key: "compilers",
    author: "grace",
    daysAgo: 5,
    title: "Why I keep building compilers",
    content:
      "People told me computers could only do arithmetic. But if a machine can do arithmetic, it can turn words into code.\n\nLet people write programs in something close to English, and let the machine do the translating.",
  },
  {
    key: "bernoulli",
    author: "ada",
    daysAgo: 7,
    title: "Computing Bernoulli numbers, step by step",
    content:
      "I wrote out the full sequence of operations for computing Bernoulli numbers on the engine.\n\nNote G is long, but every step is there. If the machine is ever built, this should run.",
  },
  {
    key: "morphogenesis",
    author: "alan",
    daysAgo: 9,
    title: "Patterns in nature",
    content:
      "How does a zebra get its stripes? Two chemicals that diffuse at different rates and react with each other can produce spots and stripes on their own.\n\nSimple rules, complicated patterns.",
  },
  {
    key: "nanosecond",
    author: "grace",
    daysAgo: 12,
    title: "What a nanosecond looks like",
    content:
      "I hand out pieces of wire 11.8 inches long: the distance light travels in a nanosecond.\n\nWhen someone asks why satellite messages take so long, I show them a coil of wire for a microsecond.",
  },
  {
    key: "short-post",
    author: "ada",
    daysAgo: 14,
    title: "A short one",
    content: "Imagination is the discovering faculty, pre-eminently.",
  },
];

const comments: { post: string; author: UserKey; content: string }[] = [
  { post: "notes-on-the-engine", author: "alan", content: "This is the heart of it. Symbols, not numbers." },
  { post: "notes-on-the-engine", author: "grace", content: "And once it works on symbols, it can work on programs." },
  { post: "first-bug", author: "ada", content: "Please tell me the moth is still in the logbook." },
  { post: "first-bug", author: "alan", content: "The most honest bug report I've ever read." },
  { post: "can-machines-think", author: "ada", content: "I'd argue it can only do what we know how to order it to do." },
  { post: "can-machines-think", author: "alan", content: "That objection deserves a whole section of its own. Working on it." },
  { post: "compilers", author: "ada", content: "Translating words into operations: exactly the right ambition." },
  { post: "morphogenesis", author: "grace", content: "Simple rules, complicated output. Sounds like most software." },
];

const likes: { post: string; user: UserKey }[] = [
  { post: "notes-on-the-engine", user: "alan" },
  { post: "notes-on-the-engine", user: "grace" },
  { post: "first-bug", user: "ada" },
  { post: "first-bug", user: "alan" },
  { post: "can-machines-think", user: "ada" },
  { post: "can-machines-think", user: "grace" },
  { post: "compilers", user: "ada" },
  { post: "bernoulli", user: "alan" },
  { post: "morphogenesis", user: "grace" },
  { post: "nanosecond", user: "ada" },
];

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

async function main() {
  const emails = users.map((user) => user.email);

  // Start clean: removes the demo users and everything they own (cascade).
  const removed = await prisma.user.deleteMany({ where: { email: { in: emails } } });

  const passwordHash = await hashPassword(DEMO_PASSWORD);

  for (const user of users) {
    await prisma.user.create({
      data: {
        ...user,
        emailVerified: true,
        // The same credential account Better Auth creates on sign-up.
        accounts: {
          create: {
            id: `${user.id}-credential`,
            accountId: user.id,
            providerId: "credential",
            password: passwordHash,
          },
        },
      },
    });
  }

  const postIds = new Map<string, string>();
  for (const post of posts) {
    const created = await prisma.post.create({
      data: {
        title: post.title,
        content: post.content,
        authorId: userId(post.author),
        createdAt: daysAgo(post.daysAgo),
        updatedAt: daysAgo(post.daysAgo),
      },
      select: { id: true },
    });
    postIds.set(post.key, created.id);
  }

  const postId = (key: string) => {
    const id = postIds.get(key);
    if (!id) throw new Error(`Unknown seed post: ${key}`);
    return id;
  };

  await prisma.comment.createMany({
    data: comments.map((comment, index) => ({
      postId: postId(comment.post),
      authorId: userId(comment.author),
      content: comment.content,
      // Spread out so they show in a stable order.
      createdAt: new Date(Date.now() - (comments.length - index) * 60 * 60 * 1000),
    })),
  });

  await prisma.like.createMany({
    data: likes.map((like) => ({ postId: postId(like.post), userId: userId(like.user) })),
  });

  console.log(
    `Seeded ${users.length} users, ${posts.length} posts, ${comments.length} comments, ${likes.length} likes` +
      (removed.count > 0 ? ` (replaced ${removed.count} existing demo users).` : "."),
  );
  console.log(`Demo login: ${emails.join(", ")}. Password: ${DEMO_PASSWORD}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
