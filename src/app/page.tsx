// H1.1 收尾：`/` 转 Server（静态壳）；导航交互收拢于 HomeNav 岛，
// StatsStrip 为数据岛；其余 home section 均为 Server。
import { HomeNav } from "@/components/home/HomeNav";
import { Footer } from "@/components/layout/Footer";
import {
  HeroSection,
  FeaturesSection,
  DemoSection,
  StatsStrip,
  PricingSection,
  AboutSection,
  CtaSection
} from "@/components/home";

export default function HomePage() {
  return (
    <>
      {/* Top Navigation (client island) */}
      <HomeNav />

      <main className="pt-32 pb-16 px-6 lg:px-16 max-w-7xl mx-auto flex flex-col gap-32 responsive-container">
        <HeroSection />
        <FeaturesSection />
        <DemoSection />
        <StatsStrip />
        <PricingSection />
        <AboutSection />
        <CtaSection />
      </main>

      <Footer />
    </>
  );
}
