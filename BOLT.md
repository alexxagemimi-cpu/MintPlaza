# Running MintPlaza on bolt.new

## 1. Upload

Unzip and open the folder in bolt.new. It installs and starts on its own —
Next.js 16, React 19, Tailwind v4, nothing unusual.

## 2. Paste two values

bolt.new has a place for environment variables. Add these two:

```
NEXT_PUBLIC_SUPABASE_URL=https://bfmjslvpssufcujfhbce.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from Supabase → Settings → API → anon / public>
```

The anon key is meant to be public — it ships inside the browser bundle on
every site that uses Supabase, and row-level security is what protects the
data, not that key. The **service role** key is the opposite: it bypasses every
security rule there is. It is not used anywhere in this project, and it should
never be pasted into bolt, into a file, or into a chat.

Optional, for trying the signed-in half before Roblox sign-in is switched on:

```
NEXT_PUBLIC_DEV_LOGIN=on
NEXT_PUBLIC_DEV_PASSWORD=<the password on the two dev accounts>
```

## 3. What you can look at without signing in

Everything visible. The boards render example content, clearly badged DEMO, so
the design can be judged before there are real players. Turn it off with
`NEXT_PUBLIC_DEMO_MODE=off`, and **turn it off before anybody real sees the
site** — a new visitor who spots a fake listing concludes the whole thing is
fake.

## 4. Getting into the control panel

Three locks, all three required:

1. Be signed in as the Roblox account the panel is bound to.
2. In the **Explore search bar**, type exactly:
   ```
   /openadminpanel2192
   ```
   Every character, including the number. One letter out and nothing appears —
   no button, no hint, no "close, try again".
3. Enter the passcode `1927`.

To anybody else, on any account, the panel does not exist. There is no link to
it and nothing on the page hints that it is there.

Roblox sign-in has to be configured first — see `docs/roblox-sign-in.md`.
