# brand/

Placeholder-grade identity drawn by `make-brand.mjs` (`node brand/make-brand.mjs` from the repo root): the wordmark "Rubaya" in Playfair Display (the theme's heading font, SIL Open Font License) in the default theme's ink `#141210` and gold `#C9A227`.

| File | Use |
|---|---|
| `rubaya-wordmark.png` | The logo to upload in Admin, Settings, Store, Brand (dark text on transparent). The header shows the name in text until one is uploaded |
| `rubaya-wordmark-light.png` | The same in white, for a dark header or an email |
| `rubaya-icon-512.png` | App-icon size; the 180 px touch icon and the `favicon.svg` of both apps are written to `apps/storefront/public` and `apps/admin/public` |

A designer's logo replaces these files; nothing else depends on them. An Urdu wordmark needs its own font (Noto Nastaliq Urdu is installed) and a separate decision.

## Launch picks (research of M7-09, sources checked on 2026-10-14)

- **Delivery fees:** take the real courier quote (TCS, Leopards, PostEx publish no current rate card; only 2016 figures were found). Peers give free delivery from Rs 1,500 (Junaid Jamshed), 2,000 (Dhanak) or 2,500 (Outfitters), and Alkaram charges a flat Rs 100; the seed's free-above Rs 5,000 is higher than all of them. `launch:check` blocks until the two placeholder zone names are fixed.
- **Returns:** 7 days (the Pakistani stores found offer 3 to 7).
- **Privacy and terms:** Pakistan had no enacted general data-protection law in the 2025 report found (a GDPR-like bill is pending): keep the drafted pages and have a Pakistani lawyer read them once. This is not legal advice.
- **Screen readers:** Guidepup (open source, drives real NVDA through Playwright on Windows) is the tool to automate one buy path; it needs NVDA installed on a Windows machine and a headed Firefox. TalkBack stays a manual pass (`plan/13-quality.md` §12.1).
- **Safari and phones:** Playwright WebKit in the end-to-end suite (done), then one purchase on the owner's own phone; a paid device cloud is not worth it for one flow.
