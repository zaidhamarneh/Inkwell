import { NewPostForm } from "./components/new-post-form";

export default function NewPostPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="mb-8 font-serif text-3xl font-semibold tracking-tight">New post</h1>
      <NewPostForm />
    </main>
  );
}
