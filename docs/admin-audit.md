# Administrator audit — 2026-09-07

This change addresses administrator access, user credits and tiers, generation previews, order fulfilment, and print pricing. It does not change production accounts.

## Resolved findings

| Area | Problem | Result |
| --- | --- | --- |
| Authentication | A previous administrator profile could survive an account switch or a late Firestore callback. | Identity changes immediately invalidate the profile, including callbacks arriving before effect cleanup. |
| Order privacy | Customers could read internal notes through callable responses and direct Firestore reads. | Customer responses remove internal fields; direct order reads require a Firestore administrator role. Customer screens already use the callables. |
| Credits | Concurrent deductions could pass a stale balance check and produce a negative balance. | Validation, balance changes and ledger writes happen in one transaction and return the committed balance. |
| Statistics index | The production `type == bonus` credit sum requires a composite index that the emulator does not enforce. | Declare the `transactions` index on `type` and `amount`; deploy it and wait for the aggregation query to succeed before updating the statistics callable. |
| User management | Loading another page replaced earlier users; details stayed stale after updates. | Pages append without duplicates, selected users update in place, transaction history supports pagination, and stale responses are ignored. |
| Preview assets | Reusing preview filenames could overwrite a previously accepted model or image. | Every preview uses a unique path; confirmation and audit records commit atomically. |
| Preview workflow | Duplicate starts, late callbacks, missing Rodin subscription keys and abandoned startup claims could break generation. | Claims prevent duplicate starts, expired claims can be retried, polling retains provider metadata, and late callbacks cannot restore rejected previews. |
| Preview confirmation | Concurrent administrators could accept an unseen replacement; older textures could hide the accepted mesh. | Confirmation checks the reviewed storage path, stale previews can be reloaded for explicit review, and derived textures/optimization are invalidated. |
| Mesh optimization | Malformed parameters and stale model results could reach optimization or overwrite a newer source. | Validate source references, numeric options and output formats; recheck the current source before persistence. |
| Orders | Status, delivery rewards and refunds could diverge under retries or concurrent updates. | Status, history and delivery credits commit together; refund records also update payment state. |
| Fulfilment UI | Only the first 50 orders were reachable; failed shipping cleared input and quick shipping lacked tracking. | Add filtering/paging/error recovery, legal transitions, tracking forms, mutation locks and keyboard actions. |
| Revenue | Mixed currencies were displayed as USD and unpaid totals counted as revenue. | Order totals respect their currency; daily paid revenue is grouped by currency. |
| Print settings | Empty prices became zero, decimal typing was difficult, and disabled configurations broke complete-matrix saves. | Preserve textual drafts, validate every price, protect unsaved edits, report failed loads, and allow administrators to read disabled options. |
| Callable transport | Firebase encodes explicit `undefined` fields as `null`, conflicting with stricter validation. | Admin requests omit absent object fields; the server accepts optional nulls for existing clients while rejecting invalid required values. |
| Navigation | Orders and print settings had no administrator navigation entries. | Both destinations are available in desktop and mobile navigation. |

## Validation

All checks below passed on the final candidate. Frontend/build commands used Node 26.7.0; the backend regression suite also passed on the deployed Node 22.22.2 runtime:

- `npm --prefix app run lint`
- `npm --prefix app run build` — 32 static pages generated.
- `npm --prefix functions run build` — tracked generated JavaScript/declarations refreshed.
- `npm --prefix app test` — 33 tests covering hooks, identity races, callable payloads and pricing. The callable helper's final type narrowing was additionally checked with the 14-test admin hook suite.
- `npm --prefix functions test` — 35 tests covering authorization, credits, preview lifecycle, optimization validation, orders and print configuration.
- `FIRESTORE_EMULATOR_HOST=127.0.0.1:8188 node --test functions/tests/firestore-rules.integration.cjs` — 6 integration tests against Firestore emulator 1.22.0 using Java 21 and this repository's Rules. Start a local emulator with `firestore.rules` before running; the tests reject non-local hosts and use only the fixed demo project.
- Administrator translation-key parity: 131 matching keys across English and Traditional Chinese.
- `git diff --check`.

Browser checks used actual administrator components bundled with synthetic authentication/callable fixtures: mobile pricing at 390 × 844; desktop user and order management; empty/invalid pricing, save failure and retry, 50 + 3 user pagination, second-page credit updates, order filtering and shipping input retention, and anonymous/non-admin route guards. These checks do not validate deployed Firebase or provider behavior.

## Remaining verification and existing limitations

- No live paid generation, optimization engine, payment gateway, shipment or production deployment was exercised. Refund changes keep application records consistent; they do not introduce gateway refunds.
- Generation dashboard statistics retain the existing legacy `jobs` definition; they are not a combined count of jobs and pipelines.
- Some pre-existing administrator detail-dialog text remains Chinese in the English locale. Key parity is not a claim of complete English localization.
- Deploy the callable changes and Firestore Rules together with the application. Older integrations that read `/orders` directly must use the customer callables; browser routing alone is not an authorization boundary.
- Build Hosting with the registered production Firebase web app configuration. The existing deployed bundle omitted these values; deployment must provide the six `NEXT_PUBLIC_FIREBASE_*` variables and use the existing backend's R2 configuration. Keep local environment files out of Git.
