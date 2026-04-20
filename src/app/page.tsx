import { LandingNavbar } from "@/components/landing/navbar";
import { LandingHero } from "@/components/landing/hero";
import { LandingSocialProof } from "@/components/landing/social-proof";
import { LandingHowItWorks } from "@/components/landing/how-it-works";
import { LandingFeatures } from "@/components/landing/features";
import { LandingTestimonials } from "@/components/landing/testimonials";
import { LandingPricing } from "@/components/landing/pricing";
import { LandingFaq } from "@/components/landing/faq";
import { LandingCta } from "@/components/landing/cta";
import { LandingFooter } from "@/components/landing/footer";

export default function LandingPage() {
  return (
    <main className="min-h-dvh bg-background">
      <LandingNavbar />
      <LandingHero />
      <LandingSocialProof />
      <LandingHowItWorks />
      <LandingFeatures />
      <LandingTestimonials />
      <LandingPricing />
      <LandingFaq />
      <LandingCta />
      <LandingFooter />
    </main>
  );
}
