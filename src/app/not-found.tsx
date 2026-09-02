import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col items-center justify-center px-5 text-center">
      <p className="label">404</p>
      <h1 className="display mt-4 text-[2rem]">That page doesn&rsquo;t exist.</h1>
      <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-soft">
        The link may be out of date, or the game may not be one MintPlaza covers.
      </p>
      <Link href="/" className="pill pill-mint mt-8 py-3">Back to home</Link>
    </div>
  );
}
