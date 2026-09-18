import Link from "next/link";
import type { Metadata } from "next";
import { LegalDoc, Section, Important } from "@/components/LegalDoc";
import { LEGAL_CONTACT, SERVICE_NAME } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `What ${SERVICE_NAME} knows about you, why, and how to make it forget.`,
};

/**
 * The Privacy Policy.
 *
 * Written against what the code actually does, not against a template. Every
 * field named in §1 is a real column in supabase/schema.sql, and the "does not
 * collect" list in §2 is the more useful half — a privacy policy that only
 * lists what is taken reads as a confession, while one that says what is
 * deliberately NOT taken says something about how the thing was built.
 *
 * The children's section is not boilerplate either. MintPlaza's users are
 * mostly minors, which in India makes nearly all of them "children" under the
 * DPDP Act and puts real obligations on the operator — parental consent, no
 * behavioural tracking, no advertising profiles. The site is built to make
 * those easy to keep by not collecting the things that would make them hard.
 */
export default function PrivacyPage() {
  return (
    <LegalDoc
      title="Privacy Policy"
      summary={
        <>
          <p>
            MintPlaza knows your Roblox username and id, whatever you write on
            the site, and roughly when you were last online. It does not know
            your real name, your email, your address, your age, or your card
            details — it never asks and never sees them.
          </p>
          <p>
            Nothing is sold, and nothing is used to advertise to you. Ask at{" "}
            {LEGAL_CONTACT} and everything will be deleted.
          </p>
        </>
      }
    >
      <Section n={1} title="What MintPlaza knows about you">
        <p>
          <strong className="font-semibold text-ink">From Roblox, when you sign in.</strong>{" "}
          Your Roblox user id, your username, your display name, your avatar
          picture, and the date your Roblox account was created. Roblox hands
          these over when you approve the sign-in. MintPlaza never sees your
          Roblox password and cannot act on your Roblox account.
        </p>
        <p>
          <strong className="font-semibold text-ink">What you write here.</strong>{" "}
          Your listings, the items on your have and want lists, your bio,
          screenshots you upload as proof, private messages you send, reports
          you make, and anything you send through the support screen.
        </p>
        <p>
          <strong className="font-semibold text-ink">A little about how you use it.</strong>{" "}
          When you were last active, so other people can see whether you are
          online — and you can turn that off in Settings. Whether you have
          agreed to the current terms. Whether you have a Level Up subscription,
          when it ends, and the country you chose when buying it.
        </p>
        <p>
          <strong className="font-semibold text-ink">Ordinary server records.</strong>{" "}
          The companies that host MintPlaza keep short-lived technical logs,
          which include IP addresses, so the site can be kept running and
          protected from attack. MintPlaza does not build anything on top of
          those logs.
        </p>
      </Section>

      <Section n={2} title="What it deliberately does not know">
        <p>This list matters as much as the one above.</p>
        <ul className="ml-4 list-disc space-y-1.5">
          <li>
            <strong className="font-semibold text-ink">Your real name, address, phone number or date of birth.</strong>{" "}
            You are never asked for any of them, and you should not put them in
            a message or a bio.
          </li>
          <li>
            <strong className="font-semibold text-ink">Your email address</strong>,
            unless you choose to write to {LEGAL_CONTACT} yourself.
          </li>
          <li>
            <strong className="font-semibold text-ink">Your card details.</strong>{" "}
            Payments are handled entirely on a payment company&rsquo;s own page.
            MintPlaza receives confirmation that a payment happened and a
            reference number, and never sees a card number.
          </li>
          <li>
            <strong className="font-semibold text-ink">Your Roblox password.</strong>{" "}
            Sign-in happens on Roblox&rsquo;s own site.
          </li>
          <li>
            <strong className="font-semibold text-ink">Anything for advertising.</strong>{" "}
            There are no advertising trackers, no advertising cookies, no
            analytics that follow you between websites, and no profile of you
            built for advertising or sold to anybody who builds one.
          </li>
        </ul>
      </Section>

      <Section n={3} title="Why it keeps any of it">
        <p>
          To run the service you asked for: to show your listings to the right
          people, to deliver your messages, to keep your Level Up working for
          the days you paid for, and to know it is you when you sign back in.
        </p>
        <p>
          To keep people safe: to investigate reports, to stop scams and spam,
          and to enforce the rules in the{" "}
          <Link href="/terms" className="font-semibold underline">Terms of Service</Link>.
        </p>
        <p>
          To meet legal obligations, including keeping a record that you agreed
          to the terms and keeping payment records for as long as tax rules
          require.
        </p>
        <p>
          Where the law asks for a legal basis by name: performing the agreement
          with you, MintPlaza&rsquo;s legitimate interest in a safe and working
          service, and — for anybody under 18 — consent given by a parent or
          guardian.
        </p>
      </Section>

      <Section n={4} title="Who else sees it">
        <p>
          <strong className="font-semibold text-ink">Other players</strong> see your
          username, display name, avatar, bio, listings, lists, screenshots you
          post, whether you are online (unless you hide it), and any message you
          send them. That is the point of the site. They do not see your email,
          your Level Up status, or anything you say to support.
        </p>
        <p>
          <strong className="font-semibold text-ink">Companies that keep it running</strong>{" "}
          — the database and hosting providers, and a payment company if you buy
          Level Up. They process it on MintPlaza&rsquo;s behalf, under their own
          agreements, and may store it outside your country. They are not
          allowed to use it for their own purposes.
        </p>
        <p>
          <strong className="font-semibold text-ink">Nobody else.</strong> Your
          information is not sold, rented, or handed to advertisers or data
          brokers — not now and not as a change of plan later. If MintPlaza is
          ever taken over or shut down, you will be told before anything moves,
          and you will have the chance to delete everything first.
        </p>
        <p>
          The one exception is a genuine legal requirement — a court order or a
          proper request from the police. Where it is allowed, you will be told
          it happened.
        </p>
      </Section>

      <Section n={5} title="If you are under 18">
        <p>
          MintPlaza is for people aged 13 and over. It is not for children under
          13, and accounts belonging to them are deleted when found.
        </p>
        <p>
          Most people using MintPlaza are teenagers, and the site is built
          around that rather than in spite of it. It asks for as little as it
          can, it does not track anybody around the internet, it does not build
          advertising profiles, and it shows no advertising at all.
        </p>
        <Important>
          <strong className="font-bold text-ink">Parents and guardians:</strong>{" "}
          you can ask to see everything held about your child, have it corrected,
          or have the account and all of its contents permanently deleted. Email{" "}
          {LEGAL_CONTACT} with the Roblox username. There is no form and no
          argument — it will just be done.
        </Important>
        <p>
          If you are in India, the law treats everybody under 18 as a child, and
          your parent or guardian needs to agree before your information is
          processed. By using MintPlaza you are confirming they have.
        </p>
      </Section>

      <Section n={6} title="Cookies, and what is stored in your browser">
        <p>
          MintPlaza uses no advertising cookies and no third-party tracking
          cookies. There is no cookie banner because there is nothing to consent
          to beyond what makes the site work.
        </p>
        <p>What is stored in your browser is:</p>
        <ul className="ml-4 list-disc space-y-1.5">
          <li>
            a sign-in cookie, so you stay signed in. It is set by the database
            provider, cannot be read by scripts on the page, and is essential —
            without it there is no way to know it is you.
          </li>
          <li>
            one small note remembering that you have dismissed the safety
            reminder, so it does not reappear forever. It never leaves your
            device and MintPlaza cannot read it.
          </li>
        </ul>
      </Section>

      <Section n={7} title="How long it is kept">
        <p>
          Your profile, listings and messages are kept while your account exists.
          Listings expire on their own — after a day, or three days with Level
          Up — and expired ones are cleared out.
        </p>
        <p>
          When you delete your account, your profile, listings, lists,
          screenshots and messages are deleted with it. Two things outlive it on
          purpose: a record that a payment happened, because tax rules require
          it, and reports made about you, because deleting an account should not
          erase the evidence that it scammed somebody.
        </p>
        <p>Server logs are kept briefly by the hosting providers and then rotate away.</p>
      </Section>

      <Section n={8} title="What you can ask for">
        <p>You can ask, at any time, to:</p>
        <ul className="ml-4 list-disc space-y-1.5">
          <li>see everything MintPlaza holds about you, as a file you can keep;</li>
          <li>correct anything wrong — your bio and display name you can change yourself in Settings;</li>
          <li>delete your account and everything in it;</li>
          <li>object to how something is used, or ask for it to be paused while a complaint is looked at;</li>
          <li>complain to your country&rsquo;s data protection authority if you are not happy with the answer.</li>
        </ul>
        <p>
          Email <a href={`mailto:${LEGAL_CONTACT}`} className="font-semibold underline">{LEGAL_CONTACT}</a>{" "}
          from any address, with your Roblox username. You will get an answer
          within 30 days and usually within a few days. There is no charge.
        </p>
      </Section>

      <Section n={9} title="Keeping it safe, and what happens if that fails">
        <p>
          Sign-in is handled by Roblox, so there is no password here to steal.
          Every piece of data is protected at the database level by rules that
          decide who may read what, which is checked automatically on every
          change to the site — a player cannot read somebody else&rsquo;s
          messages even if the website itself had a bug. Traffic is encrypted.
          The control panel is reachable by one account and needs a second code
          on top.
        </p>
        <p>
          No site is perfectly safe, and anybody who tells you otherwise is
          selling something. If there is ever a breach that puts you at risk,
          you will be told promptly, in plain language, with what actually
          happened and what to do — and the authorities will be notified where
          the law requires it.
        </p>
      </Section>

      <Section n={10} title="Changes, and how to complain">
        <p>
          If this policy changes in a way that matters, the version at the top
          of this page changes and you will be asked to agree again when you
          next sign in.
        </p>
        <p>
          For any complaint about privacy, write to{" "}
          <a href={`mailto:${LEGAL_CONTACT}`} className="font-semibold underline">{LEGAL_CONTACT}</a>.
          That address is the grievance contact required by Indian
          information-technology and data-protection rules. Formal complaints
          get a decision within fifteen days.
        </p>
      </Section>
    </LegalDoc>
  );
}
