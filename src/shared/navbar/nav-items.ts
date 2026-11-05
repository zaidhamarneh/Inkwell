// Links shown in the navbar, in order. Add a page here once it exists.
// Protected pages also need their prefix in PROTECTED_PREFIXES (src/proxy.ts).
export type NavItem = {
  href: string;
  label: string;
};

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
];
