# Zernio panel

Companion to `nombre-vaas-closer-engine`, branch `feature/zernio-onboarding`.

The member sees three steps: connect WhatsApp through hosted Zernio signup, save profile/prices, activate or pause. Administrator controls show integration readiness, per-account state and a global send switch. Provider API keys no longer reach the browser.

Server actions forward the authenticated member's Supabase access token to the engine; the engine independently checks ownership and administrator privileges. The panel verifies `/health` identifies the Zernio engine before invoking it, so a preview cannot silently use legacy unauthenticated engine operations.

Deploy only with the companion engine migration and variables described in its `ZERNIO.md`. `BOT_ENGINE_URL` is server-only. No Zernio API key belongs in this app. Use a separate Supabase project for previews that people will interact with; existing production data must not be used as test fixtures.

Verified locally: Next production build; browser login, redirect/return from a simulated provider, activation, pause, and administrator's global pause. No real WhatsApp, Meta, Zernio or Tracker account was exercised. The actual provider integration must be checked with a designated test number before any real contact queue is enabled.

The existing creator pricing, lead queue and Discord review remain available. Auto-importing every Discord contact and negotiating without the required recipient permission is not enabled by this change.
