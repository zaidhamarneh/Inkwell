# Inkwell
blog posting website

Built with Next.js (App Router), React, TypeScript, Tailwind CSS and Bun.

## Getting Started

Install dependencies:

```bash
bun install
```

Set up the database: copy `.env.example` to `.env`, set `DATABASE_URL` to your PostgreSQL connection string and `BETTER_AUTH_SECRET` to a random value (`openssl rand -base64 32`), then apply migrations:

```bash
bun run db:migrate
```

Run the development server:

```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. Edit `src/app/page.tsx` and the page auto-updates.

## Scripts

- `bun dev` — start the dev server (Turbopack)
- `bun run build` — production build
- `bun start` — serve the production build
- `bun run lint` — run ESLint
- `bun run db:migrate` — create and apply a Prisma migration
- `bun run db:generate` — regenerate the Prisma client (also runs on `bun install`)
- `bun run db:studio` — browse the database in Prisma Studio
