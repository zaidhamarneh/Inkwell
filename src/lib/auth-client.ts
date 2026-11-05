import { createAuthClient } from "better-auth/react";

// The client talks to /api/auth on the same origin by default.
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;
