# Turning on Roblox sign-in

Ten minutes, all of it in two web dashboards. No code changes — the app is
already wired for it.

**The client secret never goes into this project.** Supabase performs the token
exchange with Roblox, so the secret is typed into Supabase once and lives only
there. It must never appear in `.env.local`, in any file in this repo, or in a
chat message. If it has been shown anywhere it should not have been, regenerate
it in the Roblox dashboard first and use the new one below.

---

## 1. Roblox — point the app back at Supabase

In the Roblox Creator Dashboard, open your OAuth app and set the redirect URL to
exactly this, including the `https://` and with no trailing slash:

```
https://bfmjslvpssufcujfhbce.supabase.co/auth/v1/callback
```

Scopes: **openid** and **profile**. Nothing else. MintPlaza never asks for
anything that can act on your account — no inventory write, no trading scope, no
password, no cookie.

## 2. Supabase — add Roblox as a custom provider

Dashboard → **Authentication** → **Providers** → **New Provider**.

| Field | Value |
| --- | --- |
| Configuration method | **Auto-discovery (OIDC)** |
| Identifier | `custom:roblox` |
| Name | `Roblox` |
| Client ID | `1899103046025415537` |
| Client Secret | the secret from the Roblox dashboard |
| Issuer URL | `https://apis.roblox.com/oauth/` |
| Scopes | `openid`, `profile` |
| **Email optional** | **ON** — see below |
| PKCE | leave on (the default) |

Then **Create and enable provider**.

### Email optional is not optional

Roblox does not hand out email addresses, and Supabase rejects a sign-in from a
provider that returns no email unless this is switched on. Miss it and every
sign-in fails with an error that does not mention email. It is the single most
likely thing to go wrong here.

### The identifier must be exactly `custom:roblox`

Supabase reads an identifier without the `custom:` prefix as one of its
built-in providers, and there is no built-in Roblox. The app sends
`custom:roblox`; see `ROBLOX_PROVIDER` in `src/lib/supabase/config.ts`.

## 3. Supabase — let your live site receive the sign-in

This step does not exist while developing on `localhost`, and it is the reason
a correctly configured Roblox app can still fail the moment the site is
deployed.

`SignInPanel` asks Supabase to return the player to
`https://<your-domain>/auth/callback`. Supabase checks that address against an
allow list and **silently substitutes the Site URL when it does not match** —
no error, no warning. The player approves on Roblox and lands on whatever the
Site URL points at, which by default is `http://localhost:3000`.

Dashboard → **Authentication** → **URL Configuration**:

| Field | Value |
| --- | --- |
| Site URL | `https://smart-rfid-and-password-door-lock-a.vercel.app` |
| Redirect URLs | `https://smart-rfid-and-password-door-lock-a.vercel.app/**` |

The `/**` matters. The callback carries a `next` query parameter, so the exact
address varies from sign-in to sign-in; a bare domain with no wildcard matches
none of them.

Add a second redirect entry for any custom domain later, and keep
`http://localhost:3000/**` if you still develop locally. The list holds many
entries; adding one does not remove another.

## 4. Sign in as yourself, once

The control panel is bound to your account by that first sign-in, not by
anything stored in this repo.

The allowlist is seeded with the username `alx22n`. The first sign-in matching
that name records your numeric Roblox id and stamps `bound_at`; every check
afterwards is against the number alone. A username can be changed and re-claimed
by somebody else, so it is used once and then never trusted again — anybody who
later renames themselves to `alx22n` matches nothing.

To confirm it worked:

```sql
select roblox_username, roblox_user_id, bound_at from mintplaza.admin_allowlist;
```

`roblox_user_id` should hold a number and `bound_at` a timestamp. Until then the
panel is invisible to everybody, including you.

## 5. Turn the development door off

Once the real sign-in works, in `.env.local`:

```
NEXT_PUBLIC_DEV_LOGIN=off
```

It already refuses to run in a production build, so this is belt and braces
rather than a live hole — but there is no reason to keep a password login once
Roblox works.

---

## If it does not work

Read the sign-in screen first. It now checks the project before sending you
anywhere, so a wrong value is named on MintPlaza's own page — in red, under the
button, with the variable in it — rather than becoming a Supabase error page
three redirects away. If it says `NEXT_PUBLIC_SUPABASE_URL` or
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, that is the variable to fix in Vercel, and
nothing in the table below applies.

| What you see | Almost always |
| --- | --- |
| `Unsupported provider` | Identifier is missing the `custom:` prefix |
| Sign-in fails right after approving on Roblox | **Email optional** is off |
| `redirect_uri_mismatch` | The Roblox redirect URL does not match §1 character for character |
| Roblox approved, then landed on `localhost` or a blank page | The live domain is not in Supabase's Redirect URLs — §3 |
| Signed in, but the panel is still invisible | Your Roblox username is not `alx22n`, or the allowlist is already bound to a different id |

### `No API key found in request`

Fixed in code, and worth knowing why it happened. supabase-js builds
`/auth/v1/authorize?provider=…` and navigates the browser straight to it — and a
top-level navigation carries no headers, so the `apikey` header that every other
Supabase call sends was simply absent from the one request that leaves the site.
Sign-in now takes that navigation over and puts the publishable key on the URL
itself, which is how Supabase documents the endpoint for exactly this reason.

If this message ever comes back, check `withApiKey` in
`src/lib/supabase/config.ts` is still on the path — `npm run proof` section 37
fails if it is not.

One thing I could not check from here: this machine cannot reach
`apis.roblox.com`, so the issuer URL above is from Roblox's published OAuth
documentation rather than a live read of the discovery document. If Supabase
rejects it, fetch `https://apis.roblox.com/oauth/.well-known/openid-configuration`
in a browser and use the `issuer` value it returns.
