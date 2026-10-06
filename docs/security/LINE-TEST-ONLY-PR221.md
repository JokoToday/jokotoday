# LINE new-customer test — PRIVATE PREVIEW ONLY

**DO NOT MERGE THIS BRANCH.** It is an ephemeral child of PR #221. The guarded unlink button is exclusively for the *AI Agent Ready* customer test and must **never** be deployed to `joko.today`.

## Known baseline (previously checked; reverify before changes)

- AI Agent Ready is a non-admin **test** customer with confirmed email login.
- It has an existing QR token and VIP short code, plus **26 test orders**.
- This test customer's personal LINE identity was successfully linked in the JOKO LINE OAuth pilot.
- Production JOKO TODAY has not been changed. This private preview still accesses the production Supabase project, so all test identities and profile rows are real.

## Stage A — unlink (human user confirmation)

Build the isolated private preview from `test/line-new-customer-pr221` with:

```env
VITE_ENABLE_LINE_LINKING=true
VITE_ENABLE_LINE_LOGIN=false
VITE_ENABLE_LINE_TEST_TOOLS=true
```

Use only the private Tailscale preview `https://nerd-server.taila5b608.ts.net:8443`; don't modify its production sibling. Retain the existing private preview's Supabase variables and actual-origin URL.

1. Sign into **AI Agent Ready** by existing **email OTP**. Verify it is the test customer (not admin) and still has its QR pass, short code and 26 test orders.
2. In **My Profile**, verify LINE shows connected. The **Test only: Disconnect LINE from AI Agent Ready** button must be hidden from all other accounts and completely absent unless `VITE_ENABLE_LINE_TEST_TOOLS=true`.
3. The button calls Supabase `auth.getUser()` and `auth.getUserIdentities()`; it will not unlink unless the verified session matches `aiagentready@gmail.com`, role is `customer`, profile name is exactly `AI Agent Ready`, **both** email and LINE identities exist and at least two identities are present. Confirm the typed phrase shown to the account holder before it calls `unlinkIdentity` on the **signed-in LINE identity only**.
4. After unlink, verify email identity still exists, LINE no longer appears linked, and the user's UUID, QR, VIP short code and test orders remain unchanged. **STOP if any checks fail.**
5. Sign out. Test account must remain recoverable by email OTP.

## Stage B — signup (only after Stage A passes)

Rebuild the **same isolated preview** with:

```env
VITE_ENABLE_LINE_LINKING=true
VITE_ENABLE_LINE_LOGIN=true
VITE_ENABLE_LINE_TEST_TOOLS=false
```

1. From the logged-out private preview, select **Continue with LINE** using the now-unlinked personal LINE account with LINE channel **Tester** access.
2. Verify a **distinct, newly created** Supabase `auth.users` ID and `user_profiles` row, blank email (if LINE has not supplied a verified email), profile completion required, new QR token and VIP short code, customer role, no preexisting orders or rewards.
3. Complete name, phone and one contact method. Verify the same new account persists across refresh, sign-out and repeat LINE login.
4. Record only the new test user's UUID privately for cleanup. Do not create orders or attach payment/loyalty activity.

## Stage C — cleanup and relink (do NOT skip)

1. First verify the new LINE-only account's UUID is different from AI Agent Ready and there are **zero associated orders or other live dependencies**.
2. Delete **only that test account** via an authenticated Supabase **Auth Admin** operation (Dashboard → Authentication → Users, or trusted Admin API). Do not delete records directly from `auth.users` or `auth.identities` with SQL, and never expose an API secret/client token. Verify deletion succeeds and the account cannot authenticate. If FK dependencies block deletion, **stop** and inspect them; never cascade-delete other users or real orders.
3. Return the preview to Stage A flags with test tools OFF:
   `VITE_ENABLE_LINE_LINKING=true`, `VITE_ENABLE_LINE_LOGIN=false`, `VITE_ENABLE_LINE_TEST_TOOLS=false`.
4. Sign into **AI Agent Ready** with email, use **Connect LINE** to relink the original LINE identity; ensure *same* original Supabase UUID, QR, VIP code and **26 test orders**.
5. Restore private preview to ordinary `feat/line-login-supabase-oauth-v1` at the locked SHA when complete; delete this temporary test branch when no longer needed.
6. If at any point cleanup or relinking fails, **stop**, preserve the relevant UUIDs for support and do not publish LINE Login.

## Invariants

- No changes to `joko.today` production frontend, Nginx production root, staff/admin accounts, or live payment flows.
- Do not enable public LINE sign-in until the existing-account-linking and new-customer signup/cleanup tests pass.
- Do not claim UI flags prevent direct Auth API signup. They only hide frontend buttons.
