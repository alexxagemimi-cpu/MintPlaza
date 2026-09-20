import Link from "next/link";
import type { Metadata } from "next";
import { LegalDoc, Section, Important } from "@/components/LegalDoc";
import {
  BUILD_CREDIT,
  GAME_CREDITS,
  HOUSE_RULES,
  LEGAL_CONTACT,
  PLATFORM_OWNER,
  REFUND_EXCEPTIONS,
  SERVICE_NAME,
  SUBSCRIPTION,
  SUBSCRIPTION_EXCLUDES,
} from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `The rules for using ${SERVICE_NAME}, what it does and does not do, and what ${SUBSCRIPTION.name} is.`,
};

/**
 * The Terms of Service.
 *
 * Structure follows the order somebody actually needs the answers in: what
 * this is, who may use it, what it does NOT do (the section that matters most
 * and is usually buried), the rules, the money, then the legal machinery.
 *
 * The section that carries the most weight is §4. Every serious dispute a site
 * like this ever has comes down to somebody believing MintPlaza was part of
 * their trade. It is not, it never touches an item, and it cannot get one
 * back — and that has to be said before anybody trades rather than after.
 */
export default function TermsPage() {
  return (
    <LegalDoc
      title="Terms of Service"
      summary={
        <>
          <p>
            MintPlaza is a noticeboard where Roblox players find each other to
            trade. The trades themselves happen inside the game, between the two
            of you. MintPlaza is never part of one, never holds your items, and
            cannot get anything back if it goes wrong.
          </p>
          <p>
            Never swap game things for real money — Roblox bans people for it.
            Be 13 or older. Do not scam, spam or ask anybody for a password.
            Level Up is a {SUBSCRIPTION.days}-day subscription that gives you
            more room to post and nothing else.
          </p>
        </>
      }
    >
      <Section n={1} title="What MintPlaza is">
        <p>
          MintPlaza is a website where players of six Roblox games post what
          they have and what they want, find people whose lists match theirs,
          and message each other to arrange a trade.
        </p>
        <p>That is the whole service. In plain terms, MintPlaza:</p>
        <ul className="ml-4 list-disc space-y-1.5">
          <li>lets you publish a listing saying what you would swap;</li>
          <li>shows you other people&rsquo;s listings and suggests ones that fit your lists;</li>
          <li>lets you message those people;</li>
          <li>lets you report anybody behaving badly;</li>
          <li>points you at other websites when you want to know what something is worth.</li>
        </ul>
        <p>
          Using MintPlaza means agreeing to these terms. If you do not agree,
          the right thing to do is not use it — and there is no hard feeling in
          that.
        </p>
      </Section>

      <Section n={2} title="Who runs it, and how to reach a person">
        <p>
          MintPlaza is run by Albert Whitestroke (Shashwat), an independent
          creator in India, in his own name and on his own responsibility. He
          is an adult. He is the person responsible for the service, for any
          payment it takes, and for the personal information it holds, and he
          is the person these terms are an agreement with.
        </p>
        <p>
          Payments for {SUBSCRIPTION.name} may be collected through a payment
          account held by a family member, because that is how the payment
          company&rsquo;s own rules work for a service this size. That changes
          nothing about who is responsible or who to write to: it is still the
          person named above, at the address below, and a refund is still
          settled here.
        </p>
        <p>
          For anything at all — a complaint, a legal notice, a question about
          your data, a security problem, or a refund — write to{" "}
          <a href={`mailto:${LEGAL_CONTACT}`} className="font-semibold underline">
            {LEGAL_CONTACT}
          </a>
          . That address is monitored, and it is also the grievance contact for
          the purposes of Indian information-technology and data-protection
          rules. You can expect a reply within a few days and, for a formal
          complaint, a decision within fifteen days.
        </p>
        <p>
          You can also use the <Link href="/support" className="font-semibold underline">Tell us your problem</Link>{" "}
          screen while signed in, which reaches the same person and arrives with
          your username attached.
        </p>
      </Section>

      <Section n={3} title="Who may use it">
        <p>
          <strong className="font-semibold text-ink">You must be at least 13 years old.</strong>{" "}
          If you are under 13, you may not use MintPlaza, create an account, or
          send a message here. This is not a formality: it is the age below
          which children&rsquo;s privacy laws in several countries require a
          level of parental verification MintPlaza is not able to carry out
          properly, so it does not accept those accounts at all.
        </p>
        <p>
          If you are under 18, you should read these terms with a parent or
          guardian, and you should only pay for anything with their knowledge
          and permission. If you are in India, your parent or guardian must
          agree on your behalf before your information is processed. By
          continuing, you are confirming that this permission exists.
        </p>
        <Important>
          If you are a parent or guardian and you would like your child&rsquo;s
          account and everything in it deleted, email {LEGAL_CONTACT} and it
          will be done, with no questions about why and no attempt to talk you
          out of it.
        </Important>
        <p>
          You also need a Roblox account in good standing, because MintPlaza
          signs you in with it. If Roblox bans you, MintPlaza is not the place
          to appeal.
        </p>
      </Section>

      <Section n={4} title="What MintPlaza does NOT do — read this one">
        <p>This is the most important section on the page.</p>
        <Important>
          <strong className="font-bold text-ink">
            MintPlaza is not part of your trade.
          </strong>{" "}
          It never holds, touches, transfers or sees your items. There is no
          middleman service, no escrow, no insurance, and no way for MintPlaza
          to reverse a trade or get something back for you. Every trade happens
          inside the game, directly between you and the other player, entirely
          at your own risk.
        </Important>
        <p>Specifically, MintPlaza does not:</p>
        <ul className="ml-4 list-disc space-y-1.5">
          <li>
            <strong className="font-semibold text-ink">check that anybody is who they say they are.</strong>{" "}
            A username on MintPlaza is a Roblox username, and nothing more has
            been verified about the person behind it.
          </li>
          <li>
            <strong className="font-semibold text-ink">check that anybody actually owns what they list.</strong>{" "}
            A listing is a claim made by a stranger. Screenshots people post are
            evidence, not proof, and an old screenshot proves nothing about now.
          </li>
          <li>
            <strong className="font-semibold text-ink">decide what anything is worth.</strong>{" "}
            MintPlaza does not publish values and does not run a
            win/fair/lose calculator. When you want a value it sends you to a
            community value site, which is somebody else&rsquo;s website with
            somebody else&rsquo;s numbers on it.
          </li>
          <li>
            <strong className="font-semibold text-ink">guarantee anybody will trade fairly, turn up, or reply.</strong>
          </li>
          <li>
            <strong className="font-semibold text-ink">promise to be available.</strong>{" "}
            The site may be down, slow, or changed without notice, and listings
            may be lost.
          </li>
        </ul>
        <p>
          If a trade goes wrong, please report it — reports are read, and
          accounts are removed over them. But reporting is not compensation, and
          nobody at MintPlaza can make a stranger give something back.
        </p>
      </Section>

      <Section n={5} title="The rules">
        <p>
          Break any of these and your listings may be removed and your account
          restricted or permanently suspended, without warning and without a
          refund of anything you have paid.
        </p>
        <ol className="space-y-3">
          {HOUSE_RULES.map((r, i) => (
            <li key={r.title}>
              <p className="font-semibold text-ink">
                <span className="font-mono text-[0.8125rem] text-ink-faint">{i + 1}. </span>
                {r.title}
              </p>
              <p className="mt-0.5">{r.detail}</p>
            </li>
          ))}
        </ol>
        <p>
          Anything illegal where you live is also against these rules, whether
          or not it is listed above.
        </p>
      </Section>

      <Section n={6} title="What you post, and what happens to it">
        <p>
          What you write stays yours. By posting a listing, a message or a
          screenshot, you give MintPlaza permission to store it and show it to
          the people it is meant for, for as long as your account exists. That
          permission exists only so the site can work; nothing you post is sold,
          licensed onward, or used to advertise.
        </p>
        <p>
          You are responsible for what you post, and you confirm you have the
          right to post it. Anything may be removed at any time, and reported
          content is kept for a while after removal so the report can be dealt
          with fairly.
        </p>
        <p>
          MintPlaza does not read private messages routinely. They are read when
          somebody reports one, and they can be read when investigating a report,
          a security problem, or a legal request.
        </p>
      </Section>

      <Section n={7} title={`${SUBSCRIPTION.name}: the subscription`}>
        <p>
          {SUBSCRIPTION.name} costs a single payment and lasts{" "}
          <strong className="font-semibold text-ink">{SUBSCRIPTION.days} days</strong>. The price
          depends on the country you choose at checkout and is shown in full,
          with no tax or fee added afterwards, before you pay anything.
        </p>
        <p>
          <strong className="font-semibold text-ink">It does not renew by itself.</strong>{" "}
          There is no recurring charge, nothing stored to charge again, and
          nothing to cancel. After {SUBSCRIPTION.days} days it simply stops and
          your account goes back to the free limits. Buying again while it is
          still running adds {SUBSCRIPTION.days} days on top of what is left.
        </p>
        <p>What it gives you, and the whole of what it gives you:</p>
        <ul className="ml-4 list-disc space-y-1.5">
          <li>
            {SUBSCRIPTION.listingsPerGame} listings live at once in each game,
            instead of {SUBSCRIPTION.freeListingsPerGame}.
          </li>
          <li>
            Your listings last {SUBSCRIPTION.listingDays} days each, instead of{" "}
            {SUBSCRIPTION.freeListingHours} hours.
          </li>
        </ul>
        <p className="font-semibold text-ink">What it is not:</p>
        <ul className="ml-4 list-disc space-y-1.5">
          {SUBSCRIPTION_EXCLUDES.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
        <Important>
          <strong className="font-bold text-ink">If you are under 18, ask
          whoever owns the card first.</strong>{" "}
          A payment made without the cardholder&rsquo;s permission will be
          refunded in full when they ask, and the account that bought it may be
          suspended.
        </Important>
        <p>
          <strong className="font-semibold text-ink">
            {SUBSCRIPTION.name} is not refundable.
          </strong>{" "}
          The {SUBSCRIPTION.days} days are delivered the moment the payment
          clears, so there is no cooling-off window and no partial refund for
          days you did not use. Changing your mind is not a refund, and neither
          is not trading as much as you expected to. If your account is
          suspended for breaking the rules in §5, nothing is refunded.
        </p>
        <p>Money comes back in exactly three cases and no others:</p>
        <ul className="ml-4 list-decimal space-y-1.5">
          {REFUND_EXCEPTIONS.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
        <p>
          Email {LEGAL_CONTACT} if one of those applies. The full policy,
          including how long the money then takes to arrive, is the{" "}
          <Link href="/refunds" className="font-semibold text-ink underline">
            Refund &amp; Cancellation Policy
          </Link>
          .
        </p>
        <p>
          <strong className="font-semibold text-ink">If prices change</strong>, the
          new price applies to new purchases only, never to one already running.
        </p>
        <p>
          <strong className="font-semibold text-ink">If MintPlaza shuts down</strong>{" "}
          while your subscription is running, you will be told by email or on the
          site, and the unused part of what you paid will be refunded. That is a
          promise worth making because the site is small enough for it to be
          kept.
        </p>
      </Section>

      <Section n={8} title="Suspension, and getting your account back">
        <p>
          Accounts can be restricted — which stops you sending messages and
          posting — or suspended entirely. This happens when the rules in §5 are
          broken, when a report is upheld, or when something looks like it is
          putting other players at risk.
        </p>
        <p>
          If you think a decision was wrong, email {LEGAL_CONTACT} and say so.
          It will be looked at again by a person. There is no formal appeals
          process and no promised timescale, because MintPlaza is run by one
          family rather than a company, and pretending otherwise would be the
          kind of promise that gets broken.
        </p>
        <p>
          You can stop using MintPlaza at any time and ask for your account and
          everything in it to be deleted. See the{" "}
          <Link href="/privacy" className="font-semibold underline">Privacy Policy</Link>.
        </p>
      </Section>

      <Section n={9} title="The games, and who owns them">
        <p>
          MintPlaza is a fan-made site. It is{" "}
          <strong className="font-semibold text-ink">
            not affiliated with, endorsed by, sponsored by, or connected to
          </strong>{" "}
          {PLATFORM_OWNER} or any of the game developers below. It names their
          games because there is no useful way to talk about trading in a game
          without naming it.
        </p>
        <p>
          All game names, item names, artwork and trade marks belong to their
          owners. Nothing on MintPlaza transfers any right in them to anybody.
        </p>
        <ul className="ml-4 list-disc space-y-1.5">
          {GAME_CREDITS.map((g) => (
            <li key={g.slug}>
              <strong className="font-semibold text-ink">{g.name}</strong> is owned
              and developed by {g.owner}.{g.note ? ` ${g.note}` : ""}
            </li>
          ))}
          <li>
            <strong className="font-semibold text-ink">Roblox</strong>, the Roblox
            logo and Robux are trade marks of {PLATFORM_OWNER}. MintPlaza uses
            Roblox sign-in but is not a Roblox product.
          </li>
        </ul>
        <p>
          If you own one of these games and would like something on MintPlaza
          changed or removed, email {LEGAL_CONTACT}. It will be dealt with
          quickly and without argument.
        </p>
        <p>
          Everything else on the site — the design, the writing, the code, the
          catalogue as it is organised here — belongs to MintPlaza. Please do
          not copy it wholesale.
        </p>
      </Section>

      <Section n={10} title="Other people's websites">
        <p>
          When you want to know what something is worth, MintPlaza links you to
          a community value site. Those are other people&rsquo;s websites.
          MintPlaza does not control them, does not check their numbers, and is
          not responsible for what they publish or what happens to you there.
        </p>
        <p>
          Some of those links may one day earn MintPlaza a small commission. If
          and when that happens, the link will say so plainly, right next to it,
          before you click. It will never change which site you are sent to.
        </p>
      </Section>

      <Section n={11} title="What MintPlaza is not responsible for">
        <p>
          MintPlaza is provided as it is, with no promises that it will work, be
          available, be free of mistakes, or be fit for anything in particular.
        </p>
        <p>
          As far as the law allows, MintPlaza and the people who run it are not
          responsible for anything you lose through a trade, a scam, a broken
          promise by another player, a ban from a game, downtime, lost listings,
          or anything you do because of something you read here.
        </p>
        <p>
          Where responsibility cannot be excluded by law, it is limited to the
          amount you have actually paid MintPlaza in the twelve months before
          the problem — which for most people is nothing.
        </p>
        <p>
          Nothing here takes away rights you have under consumer law where you
          live, and nothing excludes responsibility for death, personal injury,
          or anything caused dishonestly. Those exclusions would not be valid
          and are not attempted.
        </p>
        <p>
          If something you do causes MintPlaza to be sued or fined — for
          example, by using it to scam somebody or to break Roblox&rsquo;s rules
          — you are responsible for the cost of that.
        </p>
      </Section>

      <Section n={12} title="Changes, law, and the small print">
        <p>
          <strong className="font-semibold text-ink">These terms can change.</strong>{" "}
          When they change in a way that matters, the version at the top of this
          page changes and you will be asked to agree again the next time you
          sign in. Minor corrections happen without asking.
        </p>
        <p>
          <strong className="font-semibold text-ink">The law that applies</strong>{" "}
          is the law of India, and the courts of India will hear any dispute.
          If you are a consumer somewhere else, you keep the protections of your
          own country&rsquo;s law and can bring a claim there — this clause does
          not take that away.
        </p>
        <p>
          <strong className="font-semibold text-ink">Please email first.</strong>{" "}
          Almost every problem is settled in a day by writing to{" "}
          {LEGAL_CONTACT}. Going to court over a trading noticeboard costs both
          of us more than the thing being argued about.
        </p>
        <p>
          If any part of these terms turns out to be unenforceable, the rest
          still applies. Not enforcing a rule once does not mean giving it up.
          These terms, together with the{" "}
          <Link href="/privacy" className="font-semibold underline">Privacy Policy</Link>, are the
          whole agreement between you and MintPlaza. You may not transfer your
          account or your rights under these terms to anybody else.
        </p>
      </Section>

      <section className="border-t border-line-soft pt-6">
        <h2 className="text-[1.0625rem] font-bold tracking-[-0.02em] text-ink">Credits</h2>
        <p className="mt-1 font-mono text-[0.6875rem] tracking-[0.07em] text-ink-faint">
          NOT PART OF THE AGREEMENT ABOVE
        </p>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-soft">{BUILD_CREDIT}</p>
      </section>
    </LegalDoc>
  );
}
