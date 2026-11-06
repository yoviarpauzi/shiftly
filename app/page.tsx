import AuthButton from "@/components/home/auth-button";
import Footer from "@/components/home/footer";
import Header from "@/components/home/header";
import Hero from "@/components/home/hero";
import HowItWorks from "@/components/home/how-it-works";
import Roles from "@/components/home/roles";
import Rules from "@/components/home/rules";
import SignInBand from "@/components/home/sign-in-band";

export default function Page() {
  return (
    <>
      <noscript>
        <style>{"[data-reveal]{opacity:1!important;transform:none!important}"}</style>
      </noscript>
      <Header
        action={
          <AuthButton className="hidden h-9 rounded-lg px-4 md:inline-flex md:pointer-coarse:h-11 lg:h-8 lg:pointer-coarse:h-11 lg:px-2.5" />
        }
        mobileAction={<AuthButton className="h-11 w-full rounded-lg" />}
      />
      <main id="top" className="pt-16">
        <Hero />
        <Rules />
        <HowItWorks />
        <Roles />
        <SignInBand />
      </main>
      <Footer />
    </>
  );
}
