import type { Metadata } from "next";
import { LegalDoc, Section, Important } from "@/components/LegalDoc";
import {
  LEGAL_CONTACT,
  REFUND,
  REFUND_EXCEPTIONS,
  SERVICE_NAME,
  SUBSCRIPTION,
} from "@/lib/legal";

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy",
  description: `${SUBSCRIPTION.name} lasts ${SUBSCRIPTION.days} days and is not refundable. The three exceptions, and how long a refund takes when one applies.`,
};

/**
 * The Refund & Cancellation Policy.
 *
 * ---------------------------------------------------------------------------
 * Why this is a page and not a paragraph
 * ---------------------------------------------------------------------------
 *
 * The words were all in §7 of the terms and that was not enough. A payment
 * provider reviewing this site before it may take money looks in the footer
 * for a policy named "Refund" and does not go hunting through a terms page for
 * one — so the absence of this page reads as the absence of a policy, and the
 * account does not get activated.
 *
 * ---------------------------------------------------------------------------
 * Why "not refundable" still has three exceptions on it
 * ---------------------------------------------------------------------------
 *
 * Not softness. Each one costs more to refuse than to pay: an unauthorised
 * charge is won at the bank regardless and arrives as a chargeback, with a fee
 * and a mark against the payment account attached; a payment that never
 * delivered is a fault rather than a purchase; and keeping money for days of a
 * service that has stopped existing is not a position worth defending.
 *
 * Everything else is no, and says so in the first line rather than the last.
 */
export default function RefundsPage() {
  return (
    <LegalDoc
      title="Refund & Cancellation Policy"
      summary={
        <>
          <p>
            <strong className="font-semibold text-ink">
              {SUBSCRIPTION.name} is not refundable.
            </strong>{" "}
            It is a single payment that gives you {SUBSCRIPTION.days} days, and
            once those days start they are yours whether or not you use them.
          </p>
          <p>
            There is nothing to cancel either — it does not renew and will never
            charge you again. Three narrow exceptions are in §3, and a parent
            who did not agree to the charge is one of them.
          </p>
        </>
      }
    >
      <Section n={1} title="There is nothing to cancel">
        <p>
          {SUBSCRIPTION.name} costs one payment and runs for{" "}
          <strong className="font-semibold text-ink">
            {SUBSCRIPTION.days} days
          </strong>
          . It is not a recurring subscription: nothing is stored to charge
          again, no card is kept on file by {SERVICE_NAME}, and no second
          payment is ever taken.
        </p>
        <p>
          When the {SUBSCRIPTION.days} days are up it simply stops and your
          account returns to the free limits. There is no cancel button because
          there is nothing for one to switch off, and no way to be charged by
          accident next month.
        </p>
        <p>
          Buying again while it is still running adds {SUBSCRIPTION.days} days
          on top of what is left rather than replacing it.
        </p>
      </Section>

      <Section n={2} title="It is not refundable">
        <p>
          The {SUBSCRIPTION.days} days are delivered the moment the payment
          clears. There is no trial, no cooling-off window, and no partial
          refund for days you did not use.
        </p>
        <p>
          Changing your mind is not a refund. Nor is not trading as much as you
          expected to, not finding the trade you wanted, or deciding the extra
          listings were not worth it — none of those are faults, and all of them
          are things to weigh up{" "}
          <strong className="font-semibold text-ink">before</strong> paying.
          Everything {SUBSCRIPTION.name} does and does not give you is set out
          on the{" "}
          <a href="/upgrade" className="font-semibold text-ink underline">
            pricing page
          </a>{" "}
          and in §7 of the{" "}
          <a href="/terms#s7" className="font-semibold text-ink underline">
            terms
          </a>
          , in full, before the money moves.
        </p>
        <Important>
          If your account is suspended for breaking the rules in §5 of the terms
          — scamming, spam, phishing, real-money trading — nothing is refunded.
          That is the point of it.
        </Important>
      </Section>

      <Section n={3} title="The three exceptions">
        <p>Money comes back in exactly these cases and no others:</p>
        <ul className="ml-4 list-decimal space-y-2">
          {REFUND_EXCEPTIONS.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
        <p>
          The first one matters more than it looks. If you are under 18 and the
          card is not yours,{" "}
          <strong className="font-semibold text-ink">
            ask whoever owns it first
          </strong>
          . A charge they did not agree to is refunded in full when they ask —
          but it is a far worse afternoon for everybody than a question asked
          beforehand.
        </p>
      </Section>

      <Section n={4} title="How to ask, and how long it takes">
        <p>
          Email{" "}
          <a
            href={`mailto:${LEGAL_CONTACT}`}
            className="font-semibold text-ink underline"
          >
            {LEGAL_CONTACT}
          </a>{" "}
          from any address, or use the{" "}
          <a href="/support" className="font-semibold text-ink underline">
            contact form
          </a>
          . Say which Roblox account paid, roughly when, and which of the three
          applies. You do not need an order number.
        </p>
        <Important>
          Where one of the three applies, the refund is sent within{" "}
          <strong className="font-bold text-ink">
            {REFUND.issuedWithinDays} working days
          </strong>
          . Your bank then takes a further{" "}
          <strong className="font-bold text-ink">{REFUND.bankDays}</strong> to
          put it back on the card, which is out of {SERVICE_NAME}&rsquo;s hands
          — the money has left before it appears.
        </Important>
        <p>
          Refunds go back to the card or account that paid. There is no other
          route, and nobody at {SERVICE_NAME} will ever ask you for card
          details, a one-time code, or your Roblox password in order to send
          one.
        </p>
      </Section>

      <Section n={5} title="Delivery">
        <p>
          {SUBSCRIPTION.name} is digital and nothing is shipped. It is applied
          to your account automatically as soon as the payment clears, usually
          within a minute.
        </p>
        <p>
          If you have paid and it has not appeared after an hour, email{" "}
          {LEGAL_CONTACT}. That is exception two, not a wait — it gets fixed or
          refunded.
        </p>
      </Section>
    </LegalDoc>
  );
}
