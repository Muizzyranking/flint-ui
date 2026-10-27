import { Capabilities } from "@/components/landing/capabilities";
import { ClosingCta } from "@/components/landing/closing-cta";
import { Guarantees } from "@/components/landing/guarantees";
import { Hero } from "@/components/landing/hero";
import { Lifecycle } from "@/components/landing/lifecycle";
import { Observability } from "@/components/landing/observability";
import { Quickstart } from "@/components/landing/quickstart";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <Guarantees />
        <Lifecycle />
        <Capabilities />
        <Observability />
        <Quickstart />
        <ClosingCta />
      </main>
      <SiteFooter />
    </div>
  );
}
