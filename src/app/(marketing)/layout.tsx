import { SiteFooter } from "./components/site-footer";
import { SiteHeader } from "./components/site-header";

// Public pages for signed-out visitors. Signed-in visitors to "/" are sent
// to /dashboard by src/proxy.ts before this renders.
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <div className="flex flex-1 flex-col">{children}</div>
      <SiteFooter />
    </>
  );
}
