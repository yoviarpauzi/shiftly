import AuthButton from "@/components/home/auth-button";
import Footer from "@/components/home/footer";
import Header from "@/components/home/header";
import Hero from "@/components/home/hero";
import HowItWorks from "@/components/home/how-it-works";
import Roles from "@/components/home/roles";
import Rules from "@/components/home/rules";
import SignInBand from "@/components/home/sign-in-band";
import WordsStrip from "@/components/home/words-strip";

export default function Page() {
  return (
    <>
      <Header
        action={
          <AuthButton className="h-11 rounded-lg px-4 sm:h-9 lg:h-8 lg:px-2.5" />
        }
      />
      <main className="pt-16">
        <Hero />
        <WordsStrip />
        <HowItWorks />
        <Rules />
        <Roles />
        <SignInBand />
      </main>
      <Footer />
    </>
  );
}
