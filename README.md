# Fantasy GM AI

A private, mobile-friendly fantasy basketball workspace with functional manual tools and a server-side, read-only Yahoo integration. The hosted app is at https://fantasy-gm-ai.tart-deer-2116.chatgpt.site and is restricted to its owner.

## Available

- Roster editing, bulk name/CSV import, positions, player status, and expected active games.
- Nine-category matchup comparison with ties, unknown values, lower-is-better turnovers, and optional punt flags. All nine categories still count in the displayed score.
- Full-roster trade impact. Shooting percentages are recomputed from total makes and attempts, and percentage changes are shown in percentage points.
- Two-candidate waiver comparison by per-game inputs or expected weekly totals.
- Browser-local persistence, legacy roster migration, validated JSON backup/restore, and an isolated fictional demo.
- Read-only Yahoo OAuth authorization, state validation, encrypted HttpOnly session cookies, refresh-token rotation, owned-team discovery, roster snapshots, and current matchup imports.

## Current limits

Yahoo integration has been implemented and tested against representative fixtures and simulated OAuth responses. A live Yahoo login and import have **not** been verified. Production still needs `YAHOO_CLIENT_SECRET`, Fantasy Sports read permission on the Yahoo application, and the registered callback:

`https://fantasy-gm-ai.tart-deer-2116.chatgpt.site/api/yahoo/callback`

`YAHOO_CLIENT_ID`, `YAHOO_REDIRECT_URI`, and a generated `SESSION_SECRET` are configured as server runtime values. No credentials are stored in the repository. Configure the missing secret through private hosting settings; never paste it into source or browser code.

Yahoo imports run only when requested. No background monitoring, AI model, player news service, live waiver availability check, automated roster transactions, schedule forecasts, or category win probabilities are connected. The app is explicit about these limits. Existing external alerts remain separate.

Manual workspace records stay in the current browser. Use Export/Restore to move them between devices. Yahoo access tokens are encrypted in secure HttpOnly cookies, bound to the signed-in Site user, and expire after 30 days. Disconnect removes the local Yahoo session; permanent revocation is handled in Yahoo account settings. A token exceeding cookie capacity is rejected with a clear error instead of being silently truncated.

Player season counting stats are converted to per-game averages only when Yahoo supplies Games Played. Unknown values remain blank. Expected active games default to zero on import and must be entered before roster projections. The roster projection excludes O/IL/IL+/INJ/IR statuses, uses all other listed players, and does not model lineup slot limits.

## Development

Node.js 22 or newer. There are no runtime dependencies.

```bash
npm test
npm run dev -- --port 4173
npm run build
```

The local preview provides manual tools and shows Yahoo setup as pending; it does not load production secrets. `/__qa/mobile` is a development-only 390-pixel iframe harness and is not served by the production Worker.

The build embeds the five public assets in `dist/server/index.js`, a Cloudflare Worker ES module. `.openai/hosting.json` retains the registered Site identity. Source is versioned in the Site’s source repository; the original GitHub project remains connected as the upstream remote.

## Reference contracts

- OAuth: https://developer.yahoo.com/oauth2/guide/flows_authcode/
- Fantasy API: https://sports.yahoo.com/developer/docs/

The server requests only `fspt-r`; all Fantasy API resource requests use GET. The only POST to Yahoo is the OAuth token endpoint. The app has no Yahoo transaction or roster-write routes.

## Verification

Automated tests cover category math, volume-weighted shooting, missing stats, CSV validation, whole-roster trade effects, backup validation, OAuth state expiry and identity binding, cookie encryption, refresh rotation including downstream failure, owned-team authorization, and Yahoo response normalization. Browser QA covers roster persistence, demo isolation, category scoring, trade results, waiver comparison, and desktop/phone layouts. No production roster data is seeded.

Independent project, not affiliated with Yahoo or the NBA. Private use only.
