# Costs and tooling for gamification and "juice" (2025-2026)

Scope: a priced menu of tools, assets, services and freelancers for a free Danish React 19 + Vite + Framer Motion PWA on Vercel, targeting iPad Pro 2nd gen (A10X) on iPadOS 17.7 / Safari 17, no native SDKs, no service worker. Research date 2026-10-13.

Currency note: the USD→DKK conversions below use roughly 6.5-7 DKK per USD. That rate is an assumption, not a sourced figure, so check the day's rate. Many pricing figures come from third-party aggregators that disagree with each other, and every such conflict is flagged.

## 1. Character animation on the web (Rive, Lottie/dotLottie, Spine, sprites, PixiJS/Phaser)

### Takeaway
Rive is the strongest fit for a reactive mascot: it has state machines and data binding, and an interactive character can be built for one Cadet seat (about $108/yr, roughly 700-750 DKK). The catch is a WASM runtime of about 222-648 KB brotli. Lottie is cheaper to adopt and has huge free libraries, but each free animation carries its own creator licence and Lottie is not a state machine. Spine costs $69/$369 once and suits skeletal game characters, but it is a game-engine workflow.

### Cited Findings
- **Rive plans (official docs):**
  - Free: $0, 3 collaborative files, and it includes State Machines, Data Binding and Scripting. It is "intended for learning and personal projects".
  - Cadet: $17/seat/month or $108/seat/year, capped at 3 seats, with "unlimited files and exports for runtime".
  - Voyager: $39/seat/month or $304/seat/year, adding Libraries and CDN asset hosting.
  - Enterprise: $1,440/seat/year, aimed at organisations with $10M+ revenue.
  - Runtime exports are listed only on Cadet and up, so shipping a .riv in production effectively needs a paid plan.
  - Source: [Rive docs – pricing](https://rive.app/docs/account-admin/pricing)
- Third-party listings put Cadet at $9/seat/month billed yearly and Voyager at $32/$49, which conflicts with the docs' own table. Rive's own blog announced that "creating new exports will move to our paid plans". — [comparetiers](https://comparetiers.com/tools/rive); [Rive blog – $9/mo plan](https://rive.app/blog/rive-s-new-9-mo-plan)
- **Rive web runtime sizes** (Rive's Runtime Sizes page, January 2026, brotli -9): canvas-lite is 222 KB compressed, canvas 567 KB and webgl2 648 KB. Most of that is the WASM. — [Rive runtime sizes](https://rive.app/docs/runtimes/runtime-sizes.md)
- Rive's renderer guidance: the canvas renderer has "no context limit by the browser (as opposed to WebGL)". canvas-single inlines the WASM into the JS, which removes a separate request but makes the bundle larger. — [Rive: Canvas vs WebGL2](https://rive.app/docs/runtimes/web/canvas-vs-webgl)
- **LottieFiles:** free public animations carry a licence that "varies by creator", and premium animations are licensed for commercial use under the Premium plan. — [LottieFiles docs – premium animations](https://docs.lottiefiles.com/en/integrations/after-effects/02_explore/premium-animations)
- The LottieFiles free workspace has a 5-file export limit and 20 MB of storage, per docs dated June 2026. — [LottieFiles docs – plans and limits](https://docs.lottiefiles.com/en/integrations/figma/03_workspace/plans-and-limits)
- LottieFiles paid pricing conflicts across aggregators:
  - Individual about $19.99/user/month and Team about $24.99 (annual) — [zoftwarehub](https://zoftwarehub.com/products/lottiefiles/pricing)
  - Pro $12/user/month — [Vendr](https://www.vendr.com/marketplace/lottiefiles)
  - One aggregator claims there is no free plan at all, which contradicts the official docs — [comparetiers](https://comparetiers.com/tools/lottiefiles)
- **Spine** (one-time licences, lifetime updates):
  - Essential $69 and Professional $369, shown as discounts from struck-through $99 and $439. Meshes are Professional-only.
  - Each named user needs a licence. Businesses with revenue over $500k need an Enterprise licence.
  - Source: [Esoteric Software – Purchase Spine](https://esotericsoftware.com/spine-purchase)

### Inferences
- **Cheapest path to an interactive mascot:** Rive Cadet at about 730 DKK/yr. The free tier can author the mascot, but production exports are paid. The mascot's moods (idle, happy, sad, cheer, sleepy) map directly onto a Rive state machine driven from the existing `mascotBus`. This fits the 0-500 DKK tier only if the plan is cancelled after export, which is possible but leaves the file locked for later edits.
- **Bundle cost:** the 222 KB canvas-lite runtime is the right variant for a mascot with no Rive Text. The WASM must be lazy-loaded. With no service worker, it downloads on every cold start unless HTTP caching holds it.
- **Lottie as a free option:** good for one-shot celebrations such as stars, confetti or a sticker pop, which also fit the existing "one-shot = framer" split. It is poor at a reactive pet, because a "state machine" means swapping segments by hand. Free Lottie animations need a per-file licence check, and many are not under a blanket commercial licence.
- **Unsourced claims (from prior knowledge, not verified in this pass):**
  - CSS sprite sheets via `steps()` keyframes are zero-cost and fit the repo's "continuous motion = CSS keyframes" rule.
  - PixiJS and Phaser are MIT-licensed. Phaser is heavy (around 1 MB min) for a mini-game inside React.
  - Spine's web runtime needs a Spine licence to use.

### Gaps
- Safari 17 / iPadOS 17.7 compatibility of the current Rive WASM runtime (WebGL2 vs canvas) was not confirmed by any source. It needs a rung-2/3 test.
- The official dotLottie runtime size and LottieFiles' current official pricing page were not fetched.
- PixiJS/Phaser bundle sizes and their A10X performance were not researched with sources.

## 2. Game feel / "juice": particles, haptics, SFX packs, procedural audio

### Takeaway
iPad web has no usable haptics. `navigator.vibrate` is listed as unsupported on iOS, and the reported checkbox-switch hack is unreliable and possibly patched. SFX can be essentially free: Sonniss GDC bundles are royalty-free with no attribution required, and Kenney is CC0. Paid music libraries such as Epidemic Sound cost about $10-40/month, with conflicting figures.

### Cited Findings
- **`navigator.vibrate` on iOS:**
  - Reported as "always unsupported on iPhones and iPads" — [bugnet](https://bugnet.io/blog/fix-web-game-vibrate-api-not-available-ios-safari)
  - Conflicting anecdote: an MDN browser-compat-data issue claims it works on a current iOS build. That report is unconfirmed, and MDN/caniuse still list it as unsupported — [mdn/browser-compat-data#29166](https://github.com/mdn/browser-compat-data/issues/29166)
  - A hidden `<input type=checkbox switch>` trick (Safari 17.4+) reportedly produces haptics on iOS 17.4-26.4 and was reportedly patched in 26.5. This is a single, unverified source — [rapidtoolset iOS haptics tester](https://rapidtoolset.com/en/tool/ios-haptics-tester)
- **Sonniss GDC 2026 bundle:**
  - Free, about 7.47 GB from 17 vendors. Royalty-free, no attribution required, unlimited projects for life — [Rekkerd](https://rekkerd.org/sonniss-releases-gdc-2026-game-audio-bundle/)
  - Use for AI/ML training is prohibited — [Zeli](https://zeli.app/en/story/49262841)
  - Sounds cannot be redistributed or resold as standalone SFX — [LicenseOrg](https://licenseorg.com/guide/music-audio/sonniss)
- **Kenney audio** is CC0 ("clean game-ready UI clicks, impacts, retro SFX"). This is a secondary source, not Kenney's own licence page. — [Cinevva guide](https://app.cinevva.com/guides/free-sound-effects-music)
- **Epidemic Sound** pricing conflicts across aggregators:
  - Creator $17.99/month or $119.88/yr, Pro $39.99/month or $203.88/yr — [Recurdash, verified 31 Jul 2026](https://recurdash.com/subscription-pricing/epidemic-sound)
  - Personal $11 and Commercial $23 — [BityClips](https://bityclips.com/tool/epidemicsound/pricing)
  - A single-track licence exists for one-off projects — [Wyzowl](https://www.wyzowl.com/epidemic-sound-review/)

### Inferences
- **Haptics:** treat iPad web haptics as **none**. The target device is an iPad, and iPads lack a Taptic Engine for this kind of feedback, which is a further reason the switch hack is moot. That last point is an inference and was not sourced. Juice therefore has to be visual (squash/stretch, particles, screen-shake of the board) plus SFX.
- **Licence fit:** the Sonniss and Kenney packs fit the 0 DKK tier. Files must be transcoded to MP3, per the repo's "never Ogg" rule. The Sonniss licence's ban on AI/ML training does not affect shipping the sounds in an app.
- **Epidemic Sound licence fit:** its subscription licences target creators and video. Whether embedding tracks in an app is covered is unclear, so it is risky for in-app music.
- **Unsourced claims (from prior knowledge, not verified):**
  - canvas-confetti (ISC licence, a few KB) is the lightest burst library.
  - tsParticles is MIT but much heavier.
  - Procedural SFX via WebAudio oscillators (jsfxr/ZzFX, tiny and MIT) costs nothing and avoids the network.

### Gaps
- Soundly pricing was not found ([getsoundly.com](https://getsoundly.com) needs a direct check).
- The freesound.org per-file licence mix (CC0 vs CC-BY) was not sourced in this pass.
- Bundle sizes for canvas-confetti and tsParticles were not sourced.
- Whether Epidemic Sound's licence covers in-app use was not confirmed.

## 3. Art: generative tools, free asset packs, freelance illustrators and animators

### Takeaway
AI image tools are cheap (Midjourney is $10-120/month with commercial rights on paid plans), but ownership is legally weak and Midjourney gives no indemnity. Freelance character work costs roughly $35-100/hour. A single interactive Rive character with 4-6 states runs about $750-2,500, and lip sync adds $500-2,000.

### Cited Findings
- **Midjourney licensing:**
  - Paid plans carry commercial rights: Basic $10, Standard $30, Pro $60 and Mega $120 per month.
  - Free-trial images are CC BY-NC 4.0.
  - Companies with over $1M revenue must use Pro or Mega.
  - Stealth mode is Pro/Mega only, and there is no indemnity.
  - The Disney/Universal v. Midjourney case is pending.
  - Source: secondary legal blog — [terms.law Midjourney 2026 guide](https://terms.law/2026/01/15/midjourney-commercial-use-rights-complete-2026-guide/)
- AI outputs are owned only "to the fullest extent possible under applicable law". The US Copyright Office requires human authorship. — [terms.law](https://terms.law/2026/01/15/midjourney-commercial-use-rights-complete-2026-guide/)
- **Rive animator rates:**
  - A Contra listing charges $75/hr with a 10-hour minimum. Most interactive components take 10-25 hours, from $750 — [Contra](https://contra.com/s/7WXo7bMv-interactive-rive-animation-for-apps-and-web)
  - A Contra retainer costs $4,000/month for up to 40 hours, about $100/hr — [Contra](https://contra.com/s/MQAbkAqL-b2-b-monthly-retainer)
  - Mascot projects scope 4-6 states (idle, hover, success, error, wave), with phoneme lip sync as an add-on of +$500-2,000 — [Contra – animated mascot](https://contra.com/s/UPrAm6lm-animated-mascot); [Contra hire Rive animators](https://contra.com/hire/rive-animators)
- Upwork's general animator range is $20-38/hr. It is not Rive-specific. — [Upwork animator cost](https://www.upwork.com/hire/animators/cost/)
- **Children's illustrators** usually price per image, page or book rather than per character:
  - Mid-level freelancers charge "a few thousand USD per book", and award-winning illustrators up to about $25,000. Some figures in the source were garbled, so treat them as uncertain — [Neolemon cost guide](https://neolemon.com/blog/childrens-book-illustration-costs)
  - One freelancer charges $35/hr for character design — [Hubstaff Talent](https://hubstafftalent.net/profiles/matthew-baldaccini)

### Inferences
- **Free/near-free tier:**
  - Continue the Gemini pipeline the app already uses.
  - Kenney 2D packs are CC0, per prior knowledge and unverified in this pass.
  - OpenGameArt and itch.io packs need a per-pack licence check, since they are a mix of CC0, CC-BY and CC-BY-SA, and the SA licence is viral for art.
- **Premium tier (rough budget):**
  - A character sheet plus a 5-state Rive mascot from a freelancer comes to about $1,000-3,000 (≈7,000-20,000 DKK).
  - A full commissioned set covering mascot, reaction poses and 10+ sticker illustrations plausibly lands in the 20,000-50,000 DKK range. That figure is extrapolated, not sourced.
- **Legal caveat:** AI art in a kids' app is commercially allowed on paid plans, but the owner cannot register copyright and receives no indemnity. Character resemblance to existing IP is the real risk.

### Gaps
- Recraft's commercial terms were not found in this pass.
- Google Imagen/Gemini output terms were not re-checked; the repo already uses them.
- Danish freelance illustrator rates were not found. The Danish illustrators' association guidance (e.g. Danske Illustratorer) is a next lookup.
- No source gave a "per character" price.

## 4. Audio: voice actors, composers, Azure TTS, ElevenLabs

### Takeaway
Azure neural TTS is about $15 per 1M characters, with a 0.5M-character monthly free tier, so a prebaked closed set costs effectively nothing. Danish union DR rates put a voice actor at about 4,041 DKK per 8-hour day, or about 503 DKK/hour with a 4-hour minimum. ElevenLabs costs $5-99/month for commercial use, and its Danish quality is unverified.

### Cited Findings
- **Azure Speech official free tier (F0):** 0.5M neural TTS characters per month and 5 hours of speech-to-text. The page's paid rates rendered as "$-" placeholders, so they could not be read. — [Azure Speech pricing](https://azure.microsoft.com/en-us/pricing/details/cognitive-services/speech-services/)
- **Azure paid rates** (third-party):
  - Neural $15 per 1M characters — [speechactors](https://speechactors.com/article/microsoft-azure-pricing-and-plans)
  - Custom neural voice $24 per 1M characters, plus training up to $52 per compute hour — [speechactors](https://speechactors.com/article/microsoft-azure-pricing-and-plans)
  - One comparison lists Neural HD at $22 per 1M characters, which is unverified — [inventivehq calculator](https://inventivehq.com/tools/developer/tts-stt-api-cost-calculator)
  - Custom Neural Voice is approval-gated — [Speechify comparison](https://speechify.ai/compare/build/text-to-speech/azure)
  - The official page also lists Personal Voice as a separate line, with free voice creation and paid synthesis and profile storage, amounts unreadable — [Azure pricing](https://azure.microsoft.com/en-us/pricing/details/cognitive-services/speech-services/)
- **ElevenLabs:**
  - Free: 10k credits, no commercial rights.
  - Starter: $5-6/month, about 30k credits, commercial licence.
  - Creator: $22 for about 100-121k.
  - Pro: $99 for 500-600k.
  - Scale: $299-330.
  - Business: $990-1,320.
  - Sources conflict on these tiers — [activepieces](https://www.activepieces.com/blog/elevenlabs-pricing-2026-plans-credits-and-costs); [smallest.ai](https://smallest.ai/blog/elevenlabs-pricing-plans-cost-what-you-get-in-2026)
  - API pay-as-you-go is $0.05 per 1k characters (Flash/Turbo) and $0.10 per 1k (Multilingual v2/v3) — [ElevenLabs API pricing](https://elevenlabs.io/pricing/api)
- **Danish union rates (Dansk Skuespillerforbund, DR tariffs from 1 Jan 2025):**
  - About 4,041 DKK per 8-hour day, and a minimum of about 503 DKK/hour (4 hours minimum) — [DR tariffer 2025 (14)](https://skuespillerforbundet.dk/wp-content/uploads/2025/04/DR_tariffer_2025_14.pdf)
  - Audio/radio/internet productions have a minimum participation fee of about 920 DKK — [DR tariffer 2025 (11)](https://skuespillerforbundet.dk/wp-content/uploads/2025/04/DR_tariffer_2025_11.pdf)
- **Danish voice marketplaces** quote per project. One Danish voice on Voicecrafters starts at $200. — [Voicecrafters Danish](https://www.voicecrafters.com/language/danish-voice-actors/); [Voicebooking](https://www.voicebooking.com/en/voiceactor-needed/native-danish-voice-actors/JBM551)

### Inferences
- **Azure:** the whole prebaked narration set is far below 0.5M characters, so ongoing Azure cost is about 0 DKK. A Custom Neural Voice for a mascot "character voice" needs approval and training, and is impractical for a solo developer.
- **Hiring a Danish actor:** a half-day session to record a mascot's reaction barks (about 50-100 short lines) costs roughly 2,000-4,000 DKK at union-level DR rates. A buyout/usage fee for an app is likely on top. That buyout is unknown, since the DR tariff is broadcast-specific.
- **ElevenLabs:** a Starter month ($5) is enough to trial Danish character voices for one-off prebaked barks. Quality must be judged by ear on the owner's iPad.

### Gaps
- ElevenLabs Danish voice quality was not assessed by any source found.
- Composer rates (per minute of music) were not researched.
- The Danish union's general (non-DR) rate card and app/game buyout terms were not found.
- Azure's official paid figures could not be read off the page.

## 5. Advanced/expensive options: AR, 3D, handwriting, speech, LLM stories, multiplayer

### Takeaway
WebXR is not shipped in iPad Safari 17. AR Quick Look via `<a rel="ar">` + USDZ works with no SDK, but it hands off to a system viewer. Handwriting tracing is free with the $1/$P recognizer family. LLM stories cost fractions of a cent each. Real-time co-play is now possible on Vercel Functions (WebSockets in public beta) or on Cloudflare Durable Objects' free tier.

### Cited Findings
- **WebXR:** WebKit's status has long been "In Development" behind experimental flags, first seen in the iOS 15.4 beta. — [zenn.dev citing caniuse](https://zenn.dev/ikkou/articles/8ffc1c3ea92e9f); [RoadToVR](https://roadtovr.com/?p=170884)
- **AR Quick Look:**
  - `<a rel="ar" href="x.usdz"><img></a>` launches Apple's AR viewer from Safari on iPad. Feature-detect with `a.relList.supports("ar")`. Serve the file as `model/vnd.usdz+zip` — [WebKit blog](https://webkit.org/blog/8421/viewing-augmented-reality-assets-in-safari-for-ios/); [Monstar Lab](https://engineering.monstar-lab.com/en/post/2020/09/07/Easy-web-augmented-reality-with-ar-quick-look/)
  - Apple provides a free USDZ model gallery — [Apple AR Quick Look gallery](https://developer.apple.com/augmented-reality/quick-look/)
- **Handwriting:** the $1/$N/$P recognizers from the University of Washington are published with JavaScript source. They are designed for rapid prototyping of gesture UIs, and npm ports exist. — [UW $-family](https://depts.washington.edu/acelab/proj/dollar/index.html); [unistroke npm](https://www.npmjs.org/package/unistroke)
- **Claude API prices (official):**
  - Haiku 5.5: $0.10 input / $0.50 output per MTok (prompts ≤100k)
  - Haiku 4.5: $1 / $5
  - Sonnet 5 and 5.5: $2 / $10
  - Opus 5.5: $4 / $20
  - Source: [Claude pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- **Vercel WebSockets:**
  - Functions now support WebSockets in public beta. Billing runs on Fluid compute's Active CPU (idle time is not billed), and each connection is pinned to one instance — [Vercel WebSockets docs](https://vercel.com/docs/functions/websockets); [Vercel changelog](https://vercel.com/changelog/websocket-support-is-now-in-public-beta)
  - Connections end at the function duration limit; one test saw a drop at about 5 minutes. Shared room state needs Redis — [Classmethod test](https://dev.classmethod.jp/en/articles/vercel-functions-websocket-public-beta-verification/); [Vercel KB](https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections)
- **Cloudflare Durable Objects** (which PartyKit runs on): free tier of 100k requests/day and 13,000 GB-s/day; paid requests $0.15 per million. — [Cloudflare Durable Objects](https://www.cloudflare.com/developer-platform/products/durable-objects/)
- **Pusher and Ably:**
  - Pusher Sandbox is $0 for 200 connections and 200k messages/day; Startup is $49/month. Another source says 100 free connections — [Cadence review](https://cadence.withremote.ai/blog/pusher-review); [PkgPulse](https://www.pkgpulse.com/guides/best-npm-packages-realtime-2026)
  - Ably's free tier is 6M messages/month (secondary source) — [PkgPulse](https://www.pkgpulse.com/guides/best-npm-packages-realtime-2026)

### Inferences
- **LLM stories:** a 300-word Danish story is about 600 output tokens. On Haiku 5.5 that is about $0.0003 per story, and on Sonnet 5 about $0.006. Cost is negligible. The real costs are safety review and TTS: live Azure synthesis breaks the "everything prebaked" rule. The safest pattern is to generate a curated story bank offline, review it as an adult, then prebake.
- **AR Quick Look:** a cheap "wow" option, since it only needs USDZ assets. It leaves the app UI, so it does not fit an in-game reward loop.
- **3D:** three.js/R3F on an A10X is plausible for a single low-poly scene. No source measured it, and it competes with the repo's documented idle-CPU budget.
- **Multiplayer/parent co-play:** the free tiers (Vercel beta, Durable Objects, Pusher Sandbox) easily cover a family-scale app.

### Gaps
- No benchmark of three.js/R3F on an A10X iPad was found.
- PartyKit's own current pricing was not found.
- No kids-specific letter-tracing library was found.
- Ably's official pricing was not fetched.
- Speech recognition was skipped by design: the mic game was removed.

## 6. Game designer / UX playtesting services for kids

### Takeaway
No agency price lists for child playtesting were found. Academic studies pay families $5-50 per session. For a solo developer, informal sessions with friends' children in the 5-7 age group, using pair sessions for ages 6-8, are effectively free.

### Cited Findings
- Academic child-study incentives:
  - $10-50 per caregiver session — [clinicaltrials.gov protocol](https://cdn.clinicaltrials.gov/large-docs/89/NCT02813889/Prot_SAP_000.pdf)
  - $10 per session plus a toy — [NCT03782493](https://cdn.clinicaltrials.gov/large-docs/93/NCT03782493/Prot_SAP_001.pdf)
  - $5-20 gift cards per session — [UCSC CRECE lab](https://crecelab.sites.ucsc.edu/?p=115)
- Nielsen Norman Group found pair sessions work best for ages 6-8. For under-6s, individual sessions were just as good and cheaper. — [NN/g children's websites](https://nngroup.com/articles/childrens-websites-usability-issues)
- Aalborg University has published methods for usability testing with children (Danish academic source). — [AAU VBN](https://vbn.aau.dk/en/publications/considerations-and-methods-for-usability-testing-with-children)

### Inferences
- **Free tier:** 3-5 home sessions with 5-7-year-olds, compensated with a small gift (about 100 DKK each).
- **Paid tier:** a freelance game designer at Upwork/Contra rates of about $50-100/hr, for a 10-20 hour design review, would cost roughly 3,500-14,000 DKK. That is extrapolated, not sourced.

### Gaps
- No commercial UX agency or kids'-game-designer rates were found, Danish or international.
- No Danish recruitment-panel pricing was found.
