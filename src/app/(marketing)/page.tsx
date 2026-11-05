import { ArrowRightIcon, HeartIcon, MessagesSquareIcon, PenLineIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/shared/ui/button";

import { PostPreview } from "./components/post-preview";

export const metadata: Metadata = {
  title: { absolute: "Inkwell · Where ideas find their words" },
};

const FEATURES = [
  {
    icon: PenLineIcon,
    title: "Write without friction",
    body: "A clean editor for a title and your words. Edit or delete your posts whenever you like.",
  },
  {
    icon: MessagesSquareIcon,
    title: "Conversation built in",
    body: "Every post gets its own comment thread, so readers can reply and you can answer them.",
  },
  {
    icon: HeartIcon,
    title: "Appreciation, not algorithms",
    body: "Like the posts that stay with you. The feed is simply the newest posts first.",
  },
] as const;

export default function LandingPage() {
  return (
    // overflow-x-clip: the hero glow and tilted cards must not cause sideways scroll.
    <main className="flex-1 overflow-x-clip">
      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-14 px-4 pt-14 pb-20 sm:px-6 sm:pt-20 lg:grid-cols-[1.1fr_1fr] lg:gap-10 lg:pt-28 lg:pb-28">
        <div className="grid justify-items-start gap-6">
          <p className="rounded-full border bg-card/70 px-3 py-1 text-xs font-medium text-muted-foreground shadow-xs">
            Open to every writer
          </p>
          <h1 className="font-serif text-5xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-6xl lg:text-7xl">
            Where ideas find{" "}
            <em className="font-medium text-primary">their words.</em>
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-muted-foreground text-pretty">
            Inkwell is a quiet place to write. Publish your posts, read what
            others are thinking, and talk it through in the comments.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button asChild size="lg">
              <Link href="/register">
                Start writing
                <ArrowRightIcon aria-hidden data-icon="inline-end" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">Log in</Link>
            </Button>
          </div>
        </div>

        {/* Illustration: two example posts, slightly fanned. */}
        <div aria-hidden className="relative mx-auto w-full max-w-md select-none lg:max-w-none">
          <div className="absolute -inset-8 -z-10 rounded-[3rem] bg-primary/10 blur-3xl" />
          <PostPreview
            className="rotate-[-2deg]"
            title="Notes on the Analytical Engine"
            excerpt="The engine might act upon other things besides number, were objects found whose mutual relations could be expressed by the abstract science of operations."
            author="Ada Lovelace"
            initials="AL"
            date="Nov 4"
            minutes={4}
            likes={12}
            comments={5}
            liked
          />
          <PostPreview
            className="mt-4 ml-6 rotate-[1.5deg] sm:ml-12"
            title="We found an actual bug in the machine"
            excerpt="A moth was stuck in relay #70, Panel F. We taped it into the logbook with the note “first actual case of bug being found.”"
            author="Grace Hopper"
            initials="GH"
            date="Nov 3"
            minutes={2}
            likes={8}
            comments={3}
          />
        </div>
      </section>

      {/* Features */}
      <section aria-labelledby="features-heading" className="border-y bg-card/50">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2
            id="features-heading"
            className="max-w-2xl font-serif text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-4xl"
          >
            Everything a post needs. Nothing it doesn&apos;t.
          </h2>
          <ul className="mt-12 grid gap-10 sm:grid-cols-3 sm:gap-8">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <li key={title} className="grid content-start gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground">
                  <Icon aria-hidden className="size-5" />
                </span>
                <h3 className="text-base font-semibold">{title}</h3>
                <p className="leading-relaxed text-muted-foreground">{body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Closing call to action */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-primary px-6 py-14 text-center text-primary-foreground shadow-xl shadow-primary/20 sm:px-12">
          <div
            aria-hidden
            className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,white_18%,transparent),transparent_60%)]"
          />
          <div className="relative grid justify-items-center gap-5">
            <h2 className="max-w-xl font-serif text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-4xl">
              Your first post is a few minutes away.
            </h2>
            <p className="max-w-md text-primary-foreground/80">
              Create a free account and publish whenever you&apos;re ready.
            </p>
            <Button asChild size="lg" variant="secondary" className="mt-2 shadow-md">
              <Link href="/register">Create your account</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
