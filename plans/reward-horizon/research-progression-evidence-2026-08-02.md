# Progression & reward design for a Danish 5–7 learning app — evidence review

Research-only report. No code changes. Every claim carries a URL. Sources are labelled
**[RESEARCH]** (peer-reviewed / meta-analysis), **[REGULATION]** (binding or official guidance),
**[ADVOCACY]** (NGO / rights framework), **[VENDOR]** (marketing — accurate on mechanics, unreliable
on effects), **[INDEPENDENT]** (journalism / review body).

---

## 0. The three-sentence answer

1. **The uncapped level number is the weakest idea in the brief** and fails on three independent
   grounds: a 5–7-year-old cannot read a large number as a magnitude, goal-gradient research says
   motivation lives in a *visible finite* target, and "long-term lure" is the exact vocabulary every
   children's-design regulator uses for the thing they are trying to stop.
2. **The underlying need is real** — what happens after slot 45 — and there are three better answers
   the codebase already half-contains: a *growing world* (bloom), *new finite chapters*, and
   *companion growth stages*. All three are uncapped in supply while staying bounded in view.
3. **The single highest-leverage change is not the level system at all** — it is (a) making the
   collectible *out of the curriculum* rather than decorative (reward-proximity effect), and (b) the
   wording of praise strings (process, not person). Both are cheap and both have direct
   child-age experimental support.

---

## 1. Motivation research: what the evidence actually says

### 1.1 The overjustification effect — this is the literature that applies, not the loot-box one

**Lepper, Greene & Nisbett (1973), "Undermining children's intrinsic interest with extrinsic reward,"
*JPSP* 28(1), 129–137.** [RESEARCH]
DOI 10.1037/h0035519 · https://www.semanticscholar.org/paper/abbcacaa273b8fea38d142e795e968051fa368ea

Nursery-school children (~3–5) who *already liked* felt-tip drawing were split into
**expected-reward** ("Good Player" certificate promised in advance), **unexpected-reward** (same
certificate, given only afterwards) and **no-reward**. Free-choice drawing measured unobtrusively
1–2 weeks later. **Only the expected-reward group declined.** The unexpected group looked like
controls.

> ⚠️ Citation correction for your PRD: *"Turning play into work"* is a **different** paper —
> Lepper & Greene (1975), *JPSP* 31(3), 479–486, full PDF at
> https://bingschool.stanford.edu/sites/bingschool/files/1975_leppergreene.pdf. It adds *adult
> surveillance* as a second undermining route.
> ⚠️ The widely-quoted percentages (8.59% vs 16.7%) appear only in **blogs**
> (https://thedecisionlab.com/biases/overjustification-effect, and
> https://yukaichou.com/behavioral-analysis/overjustification-effect-lepper-greene-intrinsic-motivation/
> which is **gamification-consultancy marketing**). The direction is solid; those numbers are unverified.

**Deci, Koestner & Ryan (1999), *Psychological Bulletin* 125(6), 627–668.** [RESEARCH] — the canonical
meta-analysis, k = 128 experiments.
https://pubmed.ncbi.nlm.nih.gov/10589297/ ·
PDF https://selfdeterminationtheory.org/wp-content/uploads/2014/04/1999_DeciKoestnerRyan_Meta.pdf

Effect on **free-choice behaviour** (does the person voluntarily come back once rewards stop):

| Reward structure | d (free choice) | d (self-reported interest) |
|---|---|---|
| Engagement-contingent (reward for *doing* the task) | **−0.40** | −0.15 |
| Completion-contingent (reward for *finishing*) | **−0.36** | −0.17 |
| Performance-contingent (reward for *doing well*) | **−0.28** | — |
| **Positive feedback / verbal praise** | **+0.33** | **+0.31** |

**The age moderator, verbatim from the abstract:** *"tangible rewards proved more harmful for
children than for college-aged participants, while verbal rewards showed less benefit for children."*
This is the single most design-relevant sentence in the whole literature for a 5–7 app — and note the
second half: the usual escape hatch (just praise instead) is **also weaker** for children.

**Boundary conditions — the actionable part.** Both camps agree on these:
- **Unexpected** tangible rewards do **not** undermine.
- **Task-noncontingent** rewards (for showing up, not for doing/finishing/performing) do **not** undermine.
- Undermining is **largest for tasks the person already found interesting**.
- The undermining cell is **expected + tangible + contingent**. XP-per-task → collectible-per-level
  sits squarely in it.

**Honest note on the controversy.** This is genuinely contested and the dispute is partly
ideological (behaviour-analytic vs SDT).
Cameron, Banko & Pierce (2001), *The Behavior Analyst* 24(1), 1–44, free full text
https://pmc.ncbi.nlm.nih.gov/articles/PMC2731358/ — *"in general, rewards are not harmful to
motivation to perform a task"*; negative effects occur only when rewards are *"tangible, expected
(offered beforehand), and loosely tied to level of performance."* Rebuttals both ways:
Deci/Koestner/Ryan (2001) *RER* 71(1) https://journals.sagepub.com/doi/10.3102/00346543071001001 ·
Cameron (2001) https://journals.sagepub.com/doi/10.3102/00346543071001029.
**What neither side disputes: the age moderator and the boundary conditions.**

Modern SDT has softened further — **Ryan & Deci (2020), *Contemporary Educational Psychology* 61,
101860**, https://selfdeterminationtheory.org/wp-content/uploads/2020/04/2020_RyanDeci_CEP_PrePrint.pdf
— treats *well-internalised extrinsic motivation* as a legitimate good outcome. The design target is
therefore **not "never reward"**; it is **"make the structure feel volitional and informational."**

### 1.2 Reward *proximity* — the most useful single finding for choosing what a collectible IS

**Marinak & Gambrell (2008), "Intrinsic Motivation and Rewards: What Sustains Young Children's
Engagement with Text?" *Literacy Research and Instruction* 47(1), 9–26.** [RESEARCH]
https://eric.ed.gov/?id=EJ811774

Third-graders rewarded with **a book**, and children rewarded with **nothing**, were subsequently
**more** motivated to read than children rewarded with a **token** (stickers/food/puzzles). Principle:
**the closer the reward is to the desired behaviour, the less undermining — possibly supportive.**

This is the evidence-based answer to "what should the 45 rewards be." A reward *made of the activity*
(a new letter-friend, a new word-creature, a new number-character, a new page of a story) beats a
decorative sticker. See §3 for the product that already does this (Teach Your Monster's "Trickies").

### 1.3 Gamification meta-analyses — modest, and weakest in exactly this age band

- **Sailer & Homner (2020), *Educational Psychology Review* 32, 77–112**, [RESEARCH]
  https://link.springer.com/article/10.1007/s10648-019-09498-w — cognitive **g = 0.49**,
  motivational **g = 0.36**, behavioural **g = 0.25**. **Only the cognitive effect stayed stable
  under a high-methodological-rigour restriction** — i.e. the motivation claim is the *weakest* part
  of the gamification case.
- **Bai, Hew & Huang (2020), *Educational Research Review* 30, 100322**, [RESEARCH]
  https://www.semanticscholar.org/paper/4baea6e6ca74597feaa6ce691c41577a67e87b54 — overall
  **g = 0.504**, but **"no significant differences based on game element types, number of elements, or
  levels of research design control."** The popular "points good / badges okay / leaderboards bad"
  hierarchy is **not** supported quantitatively. Their qualitative arm found two reasons students
  *dislike* gamification: no added utility, and **causing anxiety or jealousy**.
- **Kurnaz (2025), K-12 meta-analysis, *Psychology in the Schools***, [RESEARCH]
  https://onlinelibrary.wiley.com/doi/10.1002/pits.70056 — motivation **g = 0.654** overall, but an
  age gradient in the wrong direction: secondary **1.015**, high school **0.821**,
  **primary school 0.309** (CI 0.033–0.584, barely excludes zero). Effect on **extrinsic** motivation
  (0.713) exceeded **intrinsic** (0.638). *Flag: numbers from the abstract, not the full text; single
  recent meta-analysis, not independently verified.*
- **Mekler et al. (2017), *Computers in Human Behavior* 71, 525–534**, [RESEARCH]
  https://doi.org/10.1016/j.chb.2015.08.048 — **points, levels and leaderboards did NOT significantly
  affect intrinsic motivation or perceived competence** vs control, but **did increase output
  quantity**. Reading: they buy volume, not engagement or quality.
- **SDT-specific: *ETR&D* (2023)**, https://link.springer.com/article/10.1007/s11423-023-10337-7 —
  intrinsic motivation g = 0.257, autonomy 0.638, relatedness 1.776 (CI is enormous — unstable),
  **competence 0.277, p = .049 — barely significant.** Gamification is *worst* at the thing it is
  supposed to be for.

**Take-away:** the honest expectation for a 5-year-old is a **small** effect, mostly on *extrinsic*
motivation, mostly on *quantity of output*. Do not build the product's motivational load-bearing wall
out of this.

### 1.4 Competence, autonomy, relatedness

**Ryan, Rigby & Przybylski (2006), "The motivational pull of video games," *Motivation and Emotion*
30(4), 344–360**, [RESEARCH] https://link.springer.com/article/10.1007/s11031-006-9051-8 —
in-game **autonomy and competence** predict enjoyment, preference, and pre/post wellbeing change; in
multiplayer, relatedness adds independently. Two transferable points:

- **Intuitive controls are a *competence* variable, not a usability variable.** Fumbling the interface
  reads to the child as "I am bad at this." (Directly relevant to your dnd spring-back rules and
  44px targets.)
- Enjoyment and *return play* are predicted by **need satisfaction, not reward density**.

⚠️ All PENS work is on adolescents and adults. **There is no PENS validation for 5–7-year-olds.**

### 1.5 Leaderboards / social comparison — avoid, but be honest about the evidence chain

- **Hanus & Fox (2015), *Computers & Education* 80, 152–161**, [RESEARCH]
  https://doi.org/10.1016/j.compedu.2014.08.019 — 16 weeks; a leaderboard+badges course showed
  **declining intrinsic motivation and lower final exam scores mediated by intrinsic motivation.**
  One quasi-experiment, university students.
- **Toda, Valle & Isotani (2018), "The dark side of gamification,"**
  https://link.springer.com/chapter/10.1007/978-3-319-97934-2_9 — catalogues loss of performance,
  indifference, undesired behaviour, several traced to ranking.
- ⚠️ **There is essentially no direct experimental evidence on leaderboards with 5–7-year-olds.**
  The case against them at this age is an *inference* from adult harm + the DKR child moderator +
  the developmental facts below. Well-motivated, not directly tested.
- Beware https://www.growthengineering.co.uk/dark-side-of-gamification/ — **corporate-LMS marketing**.

### 1.6 The positive alternative: *temporal* comparison

**Gürel, Brummelman et al. (2020), "Better Than My Past Self: Temporal Comparison Raises Children's
Pride," *J. Exp. Psychol. General*.** [RESEARCH]
https://eddiebrummelman.com/wp-content/uploads/2020/07/gc3bcrel-et-al.-2020-j-exp-psychol-gen.pdf

Downward *social* comparison and *temporal* comparison **both raise pride, but only temporal
comparison ("better than you were yesterday") does so without triggering superiority goals.**

**This is a citable empirical warrant for the "Ny rekord!" personal-best ribbon and for the book
filling up — and against any ranked or comparative display.** Keep and lean into it.

### 1.7 Praise wording — cheap, child-age evidence, directly actionable

- **Kamins & Dweck (1999), *Developmental Psychology* 35(3), 835–847**, [RESEARCH]
  https://eric.ed.gov/?id=EJ586556 · PDF
  http://rpforschools.net/articles/Mindsets/Dweck%20&%20Kamins%201999%20Person%20vs%20process%20praise%20and%20criticism%20-%20Implications%20for%20contingent%20self%20worth%20and%20coping.pdf
  — **kindergartners (5–6)**. **Person** praise ("du er dygtig", "du er en klog dreng") produced
  significantly more helpless responses after a later setback than **process** praise ("du fandt en god
  måde"). Outcome/product praise sat in between. *This is the right-age evidence.*
- **Cimpian et al. (2007), *Psychological Science* 18(4), 314–316**,
  https://pubmed.ncbi.nlm.nih.gov/17470255/ — even **4-year-olds** are demotivated by *generic*
  ("you're a good drawer") vs *non-generic* ("you did a good job drawing") praise. **The wording of a
  single narration line matters at this age.**
- **Henderlong & Lepper (2002), *Psychological Bulletin* 128(5), 774–795**,
  https://www.reed.edu/psychology/motivation/assets/downloads/Henderlong_Lepper_2002.pdf — the
  five-point checklist you can literally write narration strings against. Praise helps when it is:
  perceived as **sincere**; attributes to **controllable** causes; **promotes autonomy**; conveys
  **competence without social comparison**; conveys **attainable standards**.
- ⚠️ **Counter-evidence at preschool age:** Corpus & Lepper (2007), *Educational Psychology* 27(4),
  https://www.reed.edu/psychology/motivation/assets/downloads/Corpus_Lepper_2007.pdf — Study 2
  (preschoolers, n = 76): **person, product AND process praise all enhanced motivation** vs neutral.
  The person-praise harm may *emerge* later than 5. Don't overclaim.

### 1.8 Growth mindset — do NOT build on it

- **Sisk et al. (2018), *Psychological Science* 29(4)**, https://pubmed.ncbi.nlm.nih.gov/29505339/ —
  273 studies / N=365,915 and 43 interventions / N=57,155. *"Overall effects were weak for both
  meta-analyses."*
- **Yeager et al. (2019), *Nature* 573**, https://www.nature.com/articles/s41586-019-1466-y — real,
  pre-registered, replicable, **and tiny**: ~0.10 GPA points, lower-achieving students only.
- **Macnamara & Burgoyne (2023), *Psychological Bulletin* 149(3–4)**,
  https://pubmed.ncbi.nlm.nih.gov/36326645/ — 122 studies; **94% contained confounds**; authors with
  a financial incentive were **2.5×** as likely to report positive effects; among the best-designed
  studies the effect was **not significant**.
- **What Works Clearinghouse (IES, 2022)**,
  https://ies.ed.gov/ncee/wwc/Docs/InterventionReports/WWC_GrowthMindset_IR_report.pdf — only one
  study meeting WWC standards without reservations showed a significant positive effect.

**Keep the narrow behavioural rule (process not person). Drop the theory.**

---

## 2. Developmental constraints — why numbers fail here

This is the strongest, least contested part of the case, and it is the direct answer to
*"he counts to 60–70, so surely he understands level 37."*

### 2.1 Rote counting range ≫ number understanding

Rote counting is memorisation of a word sequence. Children routinely **cannot construct a set for
numerals well inside their counting range** — "many children who can count to 'five' cannot create
sets of five objects" (Give-N / cardinal-principle-knower literature).
https://escholarship.org/content/qt8dh3972h/qt8dh3972h.pdf ·
Baroody et al., https://pmc.ncbi.nlm.nih.gov/articles/PMC2998540/ ·
https://www.ncbi.nlm.nih.gov/pmc/articles/PMC2833140/

**"Level 37" is a count word to a 5-year-old, not a quantity.** He can say it. He cannot feel it,
cannot compare it to 34, and cannot tell whether it's close to anything.

### 2.2 Logarithmic-to-linear shift — positions on a line are unreadable until ~7–8

**Siegler & Booth (2004), *Child Development* 75(2), 428–444.** [RESEARCH]
https://onlinelibrary.wiley.com/doi/10.1111/j.1467-8624.2004.00684.x ·
PDF http://www.cs.cmu.edu/afs/cs/Web/People/jlbooth/sieglerbooth-cd04.pdf

On a **0–100 number line**, estimates go from consistently **logarithmic** (kindergarten, ~6y) → mixed
(Grade 1: still ~60% log-best-fit, only ~30% linear) → **primarily linear** (Grade 2: 55–70%).
Logarithmic = **small numbers spread far apart, large numbers squashed together**. To a 6-year-old the
gap 1→5 feels bigger than 40→90.

Even on a **0–20** line: Year 1 (mean age **6.4y**) showed **no dominant representation at all**
(White & Szűcs 2012, https://pmc.ncbi.nlm.nih.gov/articles/PMC3344704/).

⚠️ **Contested interpretation, same conclusion.** Barth/Slusser argue the curve reflects developing
*proportion-judgment* skill, not a log mental number line
(https://pmc.ncbi.nlm.nih.gov/articles/PMC5087800/). **Either way a 5–7-year-old cannot reliably map a
number onto a position on a line** — which is exactly what a progress bar and "37 of 45" ask.

### 2.3 Subitizing limit ≈ 4–5 — and your 9-dot chapter strip is past it

Perceptual subitizing (instant, count-free enumeration) tops out at **3–4 items**; most kindergartners
are exact only to ~3. Clements, https://link.springer.com/chapter/10.1007/978-3-030-00491-0_2 ·
https://hechingerreport.org/proof-points-subitizing/

Above that, children fall back on the **Approximate Number System**, which is **ratio-dependent and
gets less precise as magnitude grows**. Libertus/Halberda,
https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3173357/

**Design consequence:** ≤4–5 marks are read *at a glance and exactly*. **A 9-dot chapter strip is
already past the reliable limit; a 45-slot path is pure approximation.**

### 2.4 A progress bar is a proportion — and proportions fail until ~8–9

**Boyer & Levine, "Development of Proportional Reasoning: Where Young Children Go Wrong"**
https://bpb-us-w2.wpmucdn.com/voices.uchicago.edu/dist/5/1727/files/2019/06/boyer-levine-development-of-proportional.pdf

> **"When countable units are salient, children are seduced by counting errors until they are 8 or 9
> years of age."**

They **count the segments instead of judging the proportion** — precisely the failure mode of a
segmented progress bar. Part-whole proportion comparison emerges around **age 7**.

**But note the escape hatch, and it favours your existing design:** a **ring that visibly fills around
a picture of the actual next prize** is not a proportion to be read — it is a **spatial gestalt with a
concrete referent**. Keep the ring; never label it.

### 2.5 Symbolic progress bars have actually been tested with preschoolers

**Hiniker, Sobel, Hong, Suh, Irish & Kientz (2016), "Hidden symbols: How informal symbolism in digital
interfaces disrupts usability for preschoolers," *IJHCS* 90, 53–67.** [RESEARCH] — the bullseye source.
https://faculty.washington.edu/alexisr/HiddenSymbols.pdf

RCT with **34 preschoolers aged 2–5**, testing exactly two things: **symbolic progress bars** and
cartoon-hand gesture demos.
- These techniques are **"entirely inaccessible for children under 3"** and **require specific design
  choices to be understood by children aged 3–5**; children **"improve significantly by age 4."**
- **44% of 94 popular preschool apps** embed them anyway.
- **Embellishing symbolic elements with visual detail — standard practice in preschool apps —
  *increases* cognitive burden.** A decorated, illustrated, "beautiful" progress indicator is
  **harder** to read than a plain one. *(Directly relevant to your soft-3D depth treatment on the
  RewardRing.)*

### 2.6 Nielsen Norman Group — the observed anecdote worth quoting

**[OFFICIAL DESIGN GUIDANCE — research-based consultancy; the 156-guideline report is paywalled]**
https://www.nngroup.com/articles/kids-cognition/ ·
https://www.nngroup.com/articles/childrens-websites-usability-issues/ ·
Report: https://www.nngroup.com/reports/children-on-the-web/

- Testing *Puppy Quest*, **a 7-year-old kept asking "What does this '2' mean?"** — a bare number
  carried no meaning. NN/g's proposed fix: **replace or accompany the numeral with countable objects.**
  Note: a *7*-year-old, and the number was *2*.
- **Kids under 6 could not read character-expression feedback** — subtle/implicit feedback fails;
  explicit audio + visual works.
- **Age bands are mandatory**: "there's no such thing as designing for children 3–12." Split
  3–5 / 6–8 / 9–12. Your 5–7 range straddles a real boundary (Piagetian preoperational → concrete
  operational).
- Icons for young children should be **literal depictions of physical objects**; abstract glyphs are
  meaningless shapes.

⚠️ **Honesty:** NN/g's *public* material says **nothing** about reward economies, points, badges or
streaks for children. Do not let anyone cite NN/g as saying "don't use progress bars for kids."

### 2.7 Sesame Workshop — the best primary design source, and what it does *not* contain

**Sesame Workshop, *Best Practices: Designing Touch Tablet Experiences for Preschoolers* (2012),
based on 50+ internal studies.** [OFFICIAL DESIGN GUIDANCE, research-backed]
https://joanganzcooneycenter.org/publication/best-practices-designing-touch-tablet-experiences-for-preschoolers/ ·
PDF https://joanganzcooneycenter.org/wp-content/uploads/2020/02/SesameWorkshop-2012.pdf ·
readable summary https://global.comminit.com/content/best-practices-designing-touch-tablet-experiences-preschoolers

- **Payoffs must be *content-specific*, not generic** — "Nice job choosing the letter A!" — with an
  audio payoff **plus** a visual payoff.
- **A wrong answer is a "learning moment," not a penalty.** Three scaffolded levels: 1st wrong =
  identify wrong choice + encourage; 2nd = identify + restate objective + hint + encourage.
- **No text-based Help** — preschoolers can't read it.
- **Numerals appear only when spoken** — display the numeral when a character counts aloud. Numerals
  ride along with *counting*, never as a bare abstract quantity.
- Preschoolers hold tablets **landscape** and rest wrists along the **bottom edge**, so bottom-edge
  hotspots trigger accidental actions. ⚠️ *Your AdultCorner button is bottom-right.*
- Sound effects communicate input registration — Sesame's version of "every tap is felt."

⚠️ **It says nothing about scores, levels, streaks, leaderboards or collections.** Its *silence* is
not an endorsement either way — but it does show that a world-class preschool publisher wrote a
complete interaction spec **without ever needing a number**.

> ⚠️ I could find **no** Cooney Center report titled "Pint-Sized Apps" and **no** document called
> "Sesame Workshop Digital Design Principles." The 2012 Best Practices paper is what those phrases
> point at.
> ⚠️ There is **no published "PBS KIDS Design Principles" document** and PBS has **no** stated public
> position on competition or scoring for preschoolers. Their editorial standards
> (https://www.pbs.org/standards/childrens-content/) cover educational goals and pro-social content
> only. The closest thing to a PBS stance is their own evaluators' framing — children "practice
> skills until they had mastered them **at their own pace**"
> (EDC/CCT, https://cct.edc.org/publications/pbs-kids-transmedia-suites-gaming-study).

### 2.8 The framework that most directly indicts a reward layer

**Hirsh-Pasek, Zosh, Golinkoff, Gray, Robb & Kaufman (2015), "Putting Education in 'Educational'
Apps," *Psychological Science in the Public Interest* 16(1), 3–34.** [RESEARCH — the most-cited
framework in this space]
https://journals.sagepub.com/doi/abs/10.1177/1529100615569721 ·
PDF https://kathyhirshpasek.com/wp-content/uploads/sites/9/2019/06/HirshPasek_ScienceofLearningApps.pdf

Four pillars: **active, engaged, meaningful, socially interactive**, within a supported learning goal.
The pillar that bites: **"engaged"** warns explicitly against *"noise, movement, or **side games that
are unrelated to the learning goal**"* — they cause distraction and disrupt learning.

**A points economy, a shop, or a streak counter is a side game unless it *is* the learning goal.**
This is the theoretical basis for the reward-proximity recommendation in §1.2.

### 2.9 Rubric hooks

- **Children's Technology Review** (Warren Buckleitner, since 1993, no advertising):
  https://reviews.childrenstech.com/ctr/ratings.php — global variables weighting all five criteria
  include **child control** and **respecting a child's time** (easy to save work or progress).
  **"Respecting a child's time" and "child control" are the two rubric items a streak or daily-login
  mechanic fails.** Best rubric hook found.
- **Common Sense Media**, https://www.commonsensemedia.org/about-us/our-mission/about-our-ratings/apps —
  asks whether "bells and whistles" serve content or are a **"cheap gimmick."** No explicit item on
  reward economies, but reviewers flag them ad hoc (see ABCmouse, §3.1).
- **NAEYC + Fred Rogers Center position statement (2012)**,
  https://www.naeyc.org/files/naeyc/file/positions/ps_technology_web2.pdf — quality must "take into
  account the child, the content, and the **context of use**."

---

## 3. How comparable products actually do it — mechanics worth stealing

### 3.1 ABCmouse — the ticket + aquarium economy (closest analogue, and the cautionary tale)

**[VENDOR mechanics, INDEPENDENT criticism]**

- **Tickets** = an uncapped soft currency, numerically visible. Earned per activity; harder material
  pays more; milestone bonuses on finishing a Learning Path lesson.
  https://www.abcmouse.com/learn/abcmouse/earn-play-learn-the-magic-of-abcmouse-tickets/7827
- **Sinks:** avatar clothes, **My Room** furniture, **Aquarium** fish + decor, **Hamster Maze**,
  **Pet Park**. https://support.abcmouse.com/hc/en-us/articles/360048194433-What-are-Tickets-and-how-are-they-used
- **Seeded free:** the child is **given 2 fish** on first aquarium entry and a **free hamster** on
  first maze entry — the collection is never empty, so the *shape* of the container is visible before
  anything is earned. https://support.abcmouse.com/hc/en-us/articles/4411958622231-How-does-the-My-Hamster-section-work
- **⭐ Best single mechanic to steal: an activity only pays tickets for its first FIVE completions.**
  After the 5th replay it pays zero forever — anti-farming without banning replay.
  https://support.abcmouse.com/hc/en-us/articles/360048194473-Replaying-Activities-and-Earning-Tickets-in-ABCmouse-Classic
- No streak, no timer, no daily goal.

**⚠️ The independent criticism is the important part.** Common Sense Media,
https://www.commonsensemedia.org/website-reviews/abcmousecom — **"learning is rewarded by shopping"**;
the reward systems **distract kids from the learning activities**; "the ticket dispenser at the end of
each activity is distracting"; "learning is a reward in and of itself, especially for kids this young."
ABCmouse also appears in the **FTC's dark-patterns report** for cancellation sludge:
https://www.ftc.gov/system/files/ftc_gov/pdf/P214800%20Dark%20Patterns%20Report%209.14.2022%20-%20FINAL.pdf

> **The structural lesson:** every hostile review in this whole sweep attacks a **shop** — earn
> currency → *choose* a purchase. Nobody attacks Khan Kids' one-prize-per-activity or Teach Your
> Monster's cosmetics. **A deterministic ordered path with no player choice is structurally immune to
> "learning is rewarded by shopping."** Your Reward Book is already on the right side of this line.
> Do not add a shop or a spendable currency.

### 3.2 Khan Academy Kids — the "no economy" counter-example

**[VENDOR + INDEPENDENT]**

- **No child-facing currency, no XP, no score, no streak, no leaderboard.** Free, no ads, no IAP.
- One big green button = **Learning Path** (Kodi the bear sequences math / language / logic / SEL by
  mastery), plus a free-browse **Library**.
  https://khankids.zendesk.com/hc/en-us/articles/360048828572-Learn-more-about-the-Learning-Path
- **The collectible is a wardrobe.** Completing an activity awards **one prize** added to an animal
  friend's collection — bugs, hats, toys, clothes. Five characters (Kodi, Reya, Peck, Sandy, Ollo),
  each with a **room on the home screen**; tap to enter and **dress the character**.
  https://khankids.zendesk.com/hc/en-us/articles/360049358751-Learn-more-about-the-characters-inside-Khan-Academy-Kids
- **Progress = a place that fills + a dressed avatar.** No numbers anywhere child-facing.
- **Mastery states are ADULT-facing only** ("mastery / in progress / developing"); Common Sense notes
  parents get "limited feedback to track progress, but not so much as to feel overwhelming."
  https://www.commonsensemedia.org/app-reviews/khan-academy-kids

**⭐ The load-bearing evidence is the contrast within one company.** Main Khan Academy (8+) has energy
points, badges, course levels and streaks — removed streaks in Jan 2021
(https://support.khanacademy.org/hc/en-us/community/posts/360075847492-Update-Streaks-are-going-away-on-January-4-2021),
then reintroduced Streaks **and Levels** later
(https://support.khanacademy.org/hc/en-us/community/posts/28945393485581-Update-Introducing-Streaks-and-Levels).
**None of it was ported into Khan Academy Kids.** The same company ships numeric streaks/levels for
older learners and deliberately withholds them from the 2–6 product. That's a stronger signal than
any quote.

> ⚠️ Correction: I could find **no public statement** from Khan Academy Kids or Caroline Hu Flexer
> saying "we avoid extrinsic rewards." That framing appears only in third-party blogs. The *behaviour*
> is documented; the *stated policy* is not.

### 3.3 Teach Your Monster to Read — the companion-avatar model, and the best idea in the sweep

**[VENDOR + INDEPENDENT]**

- Child **builds a monster first**, before any learning. Then a linear journey:
  **First Steps (8 islands) → Fun With Words (7 villages) → Champion Reader.**
  Vendor estimate ~**43 weeks at 20 min/week** to complete.
  https://www.teachyourmonster.org/tymtr-mini-games
- **Stars** = uncapped currency, deliberately unified into **one wallet across all three games**.
- **Two separate collectible systems**, and the split is the clever bit:
  1. **Stars → a shop** that **appears at intervals** (not always available): wings, top hat, tie,
     Santa costume — purely cosmetic, **no IAP**.
     https://www.teachyourmonster.org/monster-news/shop-till-you-drop
  2. **⭐⭐ "Trickies" — collectible characters that ARE the sight words.** The curriculum item doubles
     as the collectible, viewable any time in the Monster Customiser.
- **Progress visible three ways:** map position (islands/villages), the monster's accumulated
  appearance (a wearable history of work), the Trickies gallery.
- No streaks, no timers, no daily goals, no leaderboard.
- ⚠️ Criticism [INDEPENDENT, Common Sense]: **strictly linear — you can't jump to a specific skill**;
  mini-games get repetitive. https://www.commonsensemedia.org/app-reviews/teach-your-monster-to-read
  Sibling *Number Skills* is criticised for **no progress reports at all**:
  https://www.commonsense.org/education/reviews/teach-your-monster-number-skills

**"Trickies" is the single strongest idea to steal.** It is Marinak & Gambrell's reward-proximity
principle implemented as a game mechanic.

### 3.4 Duolingo ABC vs main Duolingo — the deliberate omission

**Duolingo ABC** (ages 3–8, free, no ads, no IAP): 700+ ~5-min lessons in **9 levels**; stars on
completion; **no gems, no hearts, no leagues, no leaderboards, no social features.** Duolingo's own
engineering blog frames the motivation source as **animation and audio narration** — *"animations to
provide intrinsic motivation"* — not economies.
https://blog.duolingo.com/a-good-read-building-duolingo-abc-for-android/ · https://www.duolingo.com/abc

⚠️ **I could not find a Duolingo statement that ABC deliberately omits streaks.** Treat the omission as
*observed*, not *stated policy*. App Store reviewers report an update **removed the stars that tracked
daily usage**; parents describe ABC as "clean, calm" in contrast to the main app whose "social
features, leaderboards, and streak pressure are too much for younger age groups."
https://www.internetmatters.org/advice/apps-and-platforms/skills-building/duolingo/

**Main Duolingo** (the catalogue of what NOT to build for a 5-year-old): XP → daily goal → **streak**;
gems (Streak Freeze at 200 gems); hearts (5, gates play); weekly promotion/demotion leagues. Excellent
teardown with Duolingo's own numbers: https://duolingo.deconstructoroffun.com/mechanics/streaks
- Streak is committed to **during onboarding, before account creation**.
- Milestones at 7/30/100/365 days; redesigning the day-7 animation alone moved day-7 retention **+1.7%**.
- **Streak Freezes are applied silently, without asking** — "bounded forgiveness" by design.
- **Friend Streaks**: users with one are **22% more likely** to complete a daily lesson.
- ~**32M DAU** hold 7+ day streaks; a 10pm "last chance" push is the closer.

**Criticism [INDEPENDENT + ACADEMIC]:**
- The Decision Lab, "Streak Creep" — streaks **convert intrinsic motivation into extrinsic
  reward-seeking**; users prioritise the streak over the goal and **abandon the platform entirely when
  a streak breaks.** https://thedecisionlab.com/insights/consumer-insights/streak-creep-the-perils-of-too-much-gamification
- Parent-facing: watch for "panic attacks or tears when the streak is threatened," kids grinding "the
  easiest possible lesson" to protect the number.
  https://screenwiseapp.com/guides/duolingo-streaks-and-anxiety-in-kids
- Espinosa Ospina, "Gamification, Motivation, and Contradiction: A Critical Analysis of Duolingo" —
  hearts/streaks/leagues identified as sources of anxiety, pressure, frustration.
  https://papers.ssrn.com/sol3/papers.cfm?abstract_id=6846283
- ⚠️ **Honesty: there is no peer-reviewed empirical study of Duolingo streaks and children.** The
  mechanism (loss aversion over an accumulated asset) is well-founded in prospect theory; the specific
  child-harm claim is **not** established.

### 3.5 Prodigy Math — what a levelling system becomes once it's an upsell lever

**[ADVOCACY, well-documented]** Fairplay (ex-CCFC) + **21 partner organisations**, FTC complaint
19 Feb 2021. https://fairplayforkids.org/feb-19-2021-advocates-to-ftc-prodigy-math-game-preys-on-kids-and-families/ ·
complaint PDF https://fairplayforkids.org/wp-content/uploads/2021/02/Prodigy_Complaint_Feb21.pdf

The named dark pattern, worth remembering: after every math battle the child is offered **two treasure
chests — one plain wooden, one sparkly jewel-encrusted**. A non-member who taps the sparkly one is
**denied** and shown "members get amazing things." *A choice presented as real and then revoked, aimed
at a child.*

Also documented: **16 membership ads vs 4 math problems in 19 minutes**; members **level up faster**
on identical tasks; visible status classes ("children can see who has the cool stuff and who
doesn't") **persisting during school play**; a virtual mall ("Lamplight Town") with shopping wheels;
**888 questions ≈ 1 point on a standardised test**; teachers shown an ad-free version.
https://www.edweek.org/technology/popular-interactive-math-game-prodigy-is-target-of-complaint-to-federal-trade-commission/2021/02

**⚠️ Every allegation is monetisation-driven.** The levelling system only became the problem once it
was the upsell lever. That is the reassuring finding for a free, purchase-free app — and the warning
about what the mechanic becomes if money is ever added.

### 3.6 The rest, briefly

| Product | Progression loop | Numbers? | Collectible | Non-reader visibility | FOMO |
|---|---|---|---|---|---|
| **Lingokids** (2–8) | free browse, adapts to performance | 1 star/activity | **5 stars = 1 gift**: stickers for an **album** + scenes for a **book** | album + book fill | none found |
| **Endless Alphabet** (2–7) | pick word → drag letters home → animation | none | 70+ words, finite | "which words have I opened" | none — vendor: *"no high scores, failures, limits or stress"* |
| **Todo Math** (3–8) | **Daily Adventure = a fixed 10–15 min dose**; Missions; Monster Quizzes | stars | **collectible monsters** | ⭐ **levels A–H are COLOUR-CODED** (blue/green/yellow/red/purple), not numbered | bounded dose, no streak |
| **Pok Pok Playroom** (2–8) | none by design — one evolving playroom, 20+ toys | **none** | **none** | **none, deliberately** — "toys grow as kids do" via updates | explicitly anti; Apple Design Award |
| **Osmo** | physical tiles + camera; content difficulty ramps | minimal | — | physical objects | none |
| **Starfall** | free tapping in any order | none | — | ⚠️ **no progress indicators at all** — criticised for it | none |
| **Montessorium / Busy Shapes** | digital Montessori materials | **none** | **none** | — | none |
| **Bluey: Let's Play!** | doll's-house sandbox | none | none | **no progression system at all** | ⚠️ pop-up ads for other Budge apps mid-play |

Sources: https://help.lingokids.com/hc/en-us/articles/18393545177874-Rewards ·
https://www.commonsensemedia.org/app-reviews/lingokids-play-and-learn ·
https://www.originatorkids.com/endless-alphabet/ ·
https://www.commonsensemedia.org/app-reviews/endless-alphabet ·
https://www.commonsensemedia.org/app-reviews/todo-math ·
https://www.gettingsmart.com/2016/07/18/todo-math-is-a-great-daily-adventure/ ·
https://playpokpok.com/ · https://www.sketch.com/blog/pok-pok/ ·
https://www.sheknows.com/parenting/articles/1234989533/pok-pok-montessori-inspired-app/ ·
https://pastory.app/articles/is-starfall-good-and-safe-for-kids/ ·
https://www.commonsensemedia.org/app-reviews/intro-to-math-by-montessorium ·
https://childrenandmedia.org.au/app-reviews/apps/bluey-lets-play

**Toca Boca / Sago Mini** are the loudest published anti-competition stance —
Toca Boca: play *"instead of gaming (competition, getting stuck on a level, and addiction)"*
(https://www.tocaboca.com/about); Sago Mini: *"no instructions, no rules to follow"*
(https://sagomini.com/article/sago-mini-letter-to-parents/). **[MARKETING — and the transfer is
weak]**: both are sandboxes with **no learning objective and no right answers**. "No scores" is
trivial when there is nothing to be right about. Use them for *tone*, not as proof that a curriculum
app needs no progress representation.

**⚠️ The documented failure mode of the pure no-reward stance:** Endless Alphabet is criticised for
**"no checks for understanding"** and for building no persistence ("designed to avoid failure and
stress rather than ask for struggle", https://newliteracies.ai/guides/endless-alphabet/); Starfall for
**no progress indicators**; Teach Your Monster Number Skills for **no progress reports**; Bluey for
being **thin**. A finite, ordered, non-purchasable collection is the middle path, and **nothing in this
sweep criticises that shape.**

---

## 4. Uncapped progression without a treadmill

### 4.1 The core finding: motivation lives in a *visible, finite* target

- **Goal-gradient: Kivetz, Urminsky & Zheng (2006), *JMR* 43(1), 39–58.** [RESEARCH]
  https://home.uchicago.edu/ourminsky/Goal-Gradient_Illusionary_Goal_Progress.pdf — effort
  **accelerates as a visible, finite goal nears**, drops immediately after a reward ("post-reward
  resetting"), and re-accelerates toward the next. **An uncapped counter has no gradient to climb.**
- **Endowed progress: Nunes & Drèze (2006), *JCR* 32(4), 504–512.** [RESEARCH]
  https://doi.org/10.1086/500480 — 8-stamp card: 19% completion. 10-stamp card with **2 pre-stamped**
  (identical real effort): **34%**, and faster. **Framing relative to a finite end point is the active
  ingredient.**
- ⚠️ **Zeigarnik is largely debunked** in its famous memory form. Meta-analysis (2025),
  *Humanities and Social Sciences Communications* 12, https://doi.org/10.1057/s41599-025-05000-w — 59
  publications, **no reliable memory advantage for unfinished tasks**; a modest *resumption tendency*
  (Ovsiankina effect) survives. Don't cite the memory claim.
- ⚠️ **There is no study comparing an endless counter against a completable goal in a children's
  product.** Say so plainly. But every adjacent line of evidence points the same way.

### 4.2 The dark-pattern name for an uncapped counter is GRINDING

**Zagal, Björk & Lewis, "Dark Patterns in the Design of Games," FDG 2013.** [RESEARCH]
http://www.fdg2013.org/program/papers/paper06_zagal_etal.pdf

Definition: *"a pattern used **intentionally** by a game creator to cause **negative experiences** for
players which are **against their best interests** and likely to happen **without their consent**."*
Three categories by what the player is deceived into spending: **time, money, social capital.**

- **GRINDING** — *"performing repetitive and tedious tasks in order to make progress… a way of coercing
  the player into needlessly spending time… 'repeatedly kill the same enemies over and over… just to
  gain an experience level.' … **many players – especially young or new ones – may have difficulties
  judging exactly how much time the game will actually demand.**"*
  **This is the gold-duplicate wrap, described exactly.**
- **PLAYING BY APPOINTMENT** (the FarmVille withering mechanic) — with the crucial qualifier:
  *"**The darkness of this pattern is nullified if completing appointments is not required for
  progression.**"* This is the rule that makes a *non-decaying* companion safe and a *decaying* one not.
- **§6, the consent/literacy test:** *"once players are literate enough to understand the effects of a
  pattern so that they can give consent… the pattern is no longer dark."* ⚠️ **A 5–7-year-old can
  never be the literate party.** The parent must be — which is an argument for making the mechanic
  legible in "Til de voksne."

### 4.3 Randomness / variable-ratio — what is and isn't supported

- **Drummond & Sauer (2018), *Nature Human Behaviour* 2(8), 530–532.**
  https://doi.org/10.1038/s41562-018-0360-1 — a **structural audit of 22 games** against Griffiths'
  five gambling criteria: (1) exchange of **money or something of value**; (2) unknown outcome;
  (3) chance; (4) losses avoidable by not participating; (5) **winners gain at the sole expense of
  losers**. 10 of 22 met all five.
  > **Load-bearing:** a free reward that costs nothing, cannot be lost, and takes nothing from anyone
  > **fails criteria 1 and 5 — the very criteria this paper uses to establish the resemblance.**
  > Citing Drummond & Sauer against a free progression path is a misuse of the source.
- **Zendle & Cairns (2018/2019)**, https://doi.org/10.1371/journal.pone.0206767 ·
  https://doi.org/10.1371/journal.pone.0213194 — loot-box **spend** ↔ problem gambling, η² ≈ .05;
  adolescents 16–18 roughly double (η² = .120, https://doi.org/10.1098/rsos.190049). Meta-analyses
  r ≈ .26–.27 (https://doi.org/10.1080/14459795.2021.1914705 ·
  https://doi.org/10.1177/14614448211027175). **The invariant across all of it is the payment, not the
  randomness** (https://www.sciencedirect.com/science/article/abs/pii/S0747563219302468).
- **UK DCMS (2022)** official appraisal: an association exists but *"research has not established
  whether a causal relationship exists."*
  https://www.gov.uk/government/calls-for-evidence/loot-boxes-in-video-games-call-for-evidence/outcome/government-response-to-the-call-for-evidence-on-loot-boxes-in-video-games
- **Nielsen & Grabarczyk (2019), *Trans. DiGRA* 4(3)**,
  https://todigra.org/index.php/todigra/article/view/1774 — classifies random reward mechanisms by
  whether they are *embedded in* or *isolated from* real-world economies. **Only the embedded class is
  genuine gambling.** A free in-app collectible is the maximally isolated class.
- **But the case *against* randomness in a learning app is different and stronger:**
  **Shen, Fishbach & Hsee (2015), *JCR* 41(5), 1301–1315**, https://doi.org/10.1086/679418 — people
  worked harder for a coin-flip between $1 and $2 than for a guaranteed $2, **but only when attention
  was on the *process*; the effect reverses when attention is on the *outcome*.** Randomness buys
  effort by **making the pursuit itself the entertainment** — precisely the mechanism a *learning* app
  should refuse, because it moves attention off the learning.
  Also: **a deterministic path where the next prize is shown and always arrives has no near-miss
  surface at all** (near-miss effects require an outcome that *could* have been the prize but wasn't —
  https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7214505/).
- Free random rewards *are* arousing even with no money — Larche et al. (2021),
  https://doi.org/10.1007/s10899-019-09913-5 — legendary vs rare: arousal η²p = .73. Large effects,
  small samples.
- **Odds disclosure is a weak remedy** (only 16.4% of players shown disclosures spent less,
  https://doi.org/10.1371/journal.pone.0286681). **Removing randomness is a strong remedy; disclosing
  it isn't.**

**Verdict: keep the path deterministic.** The existing `REWARD_PATH` order-never-shuffled invariant is
already the right call, and now has a defensible rationale beyond "so the ring can preview the prize."

### 4.4 Streaks and daily quests

- **Snapchat streaks**, n = 2,483 Belgian early adolescents,
  https://www.sciencedirect.com/science/article/pii/S2772503023000476 — streak engagement correlated
  with problematic smartphone use and FOMO, **but associations were weak** and cross-sectional. The
  transferable finding is qualitative: streaks generate **obligation-driven, content-empty maintenance
  behaviour** ("streak snaps") — *the mechanic degrades the quality of the activity it exists to
  promote.*
- **Frommel & Mandryk (2022), "Daily Quests or Daily Pests?" *PACM HCI / CHI PLAY***,
  https://doi.org/10.1145/3549489 — n = 178, validated motivation-regulation scales. Genuinely
  **dualistic**: players describe daily quests as motivating *and* as FOMO-inducing obligation/chore.

### 4.5 Ranking of uncapped mechanics for THIS app

| Mechanic | Verdict | Why | Evidence strength |
|---|---|---|---|
| **A. Growing world (bloom)** — the scene gains ambient objects as sections bloom | ⭐ **BEST** | Uncapped in supply, spatial not numeric, **no loss surface**, no proportion to read, already in the codebase (`bloomFor(section)`, `PersistentWorld`). Precedent: ABCmouse aquarium/room, Khan Kids character rooms. | Indirect (RITEC competence/identity; non-reader spatial representation; strong precedent) |
| **B. New finite chapters** — chapter 6, 7, 8… each itself completable | ⭐ **BEST** | **Bounded in view, unbounded in supply.** Preserves the goal gradient at every moment while the total is open-ended. Cost: art. | Strong (goal-gradient, endowed progress) |
| **C. Companion growth stages** — `companionStageForCollected` already exists | **GOOD, with a hard rule** | Avatar/pet growth is the most legible non-numeric progress there is (Teach Your Monster, Khan Kids). **Hard rule: the companion must NEVER decay, never ask to be fed, never look sad, never regress.** The moment it needs care, it becomes Zagal's PLAYING BY APPOINTMENT and manufactures guilt. | Precedent strong; the decay rule is Zagal's explicit qualifier |
| **D. Adult-facing mastery meters** per section | **GOOD** | Khan Kids' exact split: child sees the book, adult sees mastery. Satisfies CTR's "child control" and the Commission's time-management-visibility ask without putting a number in front of the child. | Precedent + regulatory alignment |
| **E. Gold duplicate wrap** (current) | **WEAK — replace or de-emphasise** | No new information. Textbook GRINDING: repetition for a counter. "Skinnende, ikke nyt" is honest but the child gains nothing they didn't have. | Zagal GRINDING |
| **F. Seasonal / rotating collections** | ⚠️ **AVOID as normally built** | Inherently scarcity/FOMO. Commission Art. 28 Guidelines ¶61(b) names *"signs communicating scarcity and/or urgency."* **If ever used: rotating but NEVER expiring** — a "this month's chapter" that remains available forever is a content-release schedule, not a season pass. | Regulatory, explicit |
| **G. Infinite level number** | ❌ **AVOID — worst option** | Fails on three independent grounds (§5.1). | Strong and convergent |

---

## 5. Applying this to the specific decisions in the brief

### 5.1 (a) The uncapped/infinite level indicator — recommend **not shipping it**

Three independent failure modes:

1. **The child cannot read it.** "Level 37" is a count word, not a magnitude, at 5–7 (§2.1–2.2). NN/g
   watched a **7**-year-old fail to interpret the number **2** on screen. A number the child can't
   interpret is not a lure; it's decoration that competes with the learning content
   (Hirsh-Pasek's "engaged" pillar, §2.8).
2. **It removes the mechanism that actually motivates.** Goal-gradient and endowed-progress are
   real-behaviour field experiments showing motivation lives in a **visible finite target** and drops
   after each reward until the next comes into range (§4.1). An endless counter has no gradient.
3. **"Long-term lure" is the regulated vocabulary.** EU Commission Art. 28(1) Guidelines
   (C/2025/5519, OJ 10.10.2025) ¶61(b) asks providers to ensure minors are *"not exposed to persuasive
   design features that are aimed predominantly at engagement… This includes… **the creation of
   virtual rewards for performing (repeated) actions on the platform.**"*
   https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:C_202505519

   ⚠️ **Honest scoping:** those Guidelines bind *online platforms* under DSA Art. 28, and a preschool
   learning app that stores no user content for public dissemination is **not an online platform**
   (DSA Art. 3(i)). **Almost nothing here is binding law for this app.** But it is the standard the
   category is being judged against, and Denmark is explicitly pushing a ban on
   *fastholdelsesmekanismer* into the coming **Digital Fairness Act** (Digitaliseringsministeriet
   hvidbog, Oct 2025:
   https://www.digmin.dk/Media/638954161947353382/Publikation%20-%20En%20tryg%20barndom%20i%20en%20digital%20virkelighed.pdf
   — *"selv om regeringen gerne vil… forbyde visse digitale fastholdelsesmekanismer, sætter EU-regler
   grænser for, hvordan vi nationalt kan regulere"*). DFA proposal expected Q3/Q4 2026.

**What to build instead** — the underlying need (a horizon beyond slot 45) is legitimate:

- **Bounded-in-view, unbounded-in-supply:** ship **chapter 6+ as real new 9-slot chapters**. The child
  always sees a finite, near, completable target; the supply is open-ended. This is option B in §4.5
  and it is the single recommendation that preserves the goal gradient.
- **Let the growing world carry the long horizon**, not a counter. The bloom system is already the
  right shape: uncapped, spatial, gestalt, no number, no loss surface.
- **If you want something that is literally never-ending**, make it the world and the companion — both
  of which a 5-year-old reads instantly and neither of which has a magnitude to misinterpret.

### 5.2 (b) How the album and the level relate and are accessed

**Recommendation: collapse the level out of the child's model entirely. Make the book BE the level.**

The child-facing level number is already absent (the ring shows "no number"). **Do not reintroduce
one.** Concretely:

- **Make the ring the door to the book.** Tapping the RewardRing should open Min Bog at the current
  chapter. One object that fills, one object that holds what you filled — currently they are two
  places connected only by an adult's mental model. Precedent: Khan Kids' character rooms *are* the
  home screen; ABCmouse's aquarium *is* the progress display.
- **Keep the silhouette preview.** It is the thing that makes the whole system legible to a
  pre-reader, and it is what lets the ring be read as a *gestalt with a concrete referent* rather than
  a proportion (§2.4). ⚠️ **But own the tension honestly:** a previewed reward is an *announced*
  reward, which is the undermining cell in Lepper 1973 / DKR 1999. Mitigations that keep the
  legibility and reduce the announcement:
  - **Never quantify the distance.** No "3 more to go", no number, no percentage, no countdown. The
    ring's fill is the only signal. (This is already the rule — make it a hard invariant with a test.)
  - **Keep the *arrival* a surprise** even when the *identity* isn't — the ceremony, the art reveal,
    the chapter-completion tier.
  - Accept that this is a **tradeoff, not a solved problem**: legibility for a pre-reader vs the
    overjustification literature. The literature's own escape hatch (unexpected rewards) is in direct
    conflict with the pre-reader's need to see what's coming. Choose legibility, and reduce the
    announcement everywhere else.
- **Reconsider the 9-dot chapter strip.** Nine is past the subitizing limit (§2.3) and invites
  Boyer & Levine's "seduced by counting" failure (§2.4). Options: read the chapter as a **shape that
  completes** (a picture assembling, a scene filling) rather than nine countable dots; or group into
  3×3 so each row is subitizable.
- **Simplify the ring's visual treatment.** Hiniker 2016 found that **embellishing symbolic elements
  with visual detail increases cognitive burden** for preschoolers (§2.5). Your soft-3D depth
  treatment is beautiful and may be actively hurting comprehension *on the progress indicator
  specifically*. Worth an A/B with your own 5-year-old.
- **Adult-facing: put mastery per section in "Til de voksne."** Khan Kids' split. Satisfies the
  time-management-visibility ask and Zagal's consent test (the parent is the literate party).

### 5.3 (c) The highest-leverage evidence-based changes (independent of the level question)

1. **⭐ Make the collectible out of the curriculum.** Reward proximity (Marinak & Gambrell 2008,
   §1.2) is the best-supported guidance for *what a reward should be*, and Teach Your Monster's
   "Trickies" is the proof it works as a mechanic. A reward that is *a new letter-friend, a new
   word-creature, a new number-character* is nearer the behaviour than a decorative sticker. Your 45
   rewards are already art; the question is whether they are **art of the thing being learned**.
2. **⭐ Audit every praise string for person-vs-process.** Kamins & Dweck (1999) is *kindergarten-age*
   evidence; Cimpian (2007) shows it at **4**. Danish: prefer **"Du fandt den rigtige!"** /
   **"Du talte dem alle sammen!"** over **"Du er dygtig!"** / **"Sikke en klog dreng!"**. This is a
   narration-string change — cheap, testable, and it hits the *one* reward channel the meta-analysis
   found positive (verbal praise, d = +0.31 to +0.33). ⚠️ Caveat: Corpus & Lepper (2007) found no
   person-praise harm at preschool age specifically.
3. **⭐ Protect `RoundResultScreen` as a stopping cue.** The EP's addictive-design resolution names
   *"removing all intuitive moments to end or finish a task, also known as **stopping cues**"* as the
   core addictive move (P9_TA(2023)0459 recital J,
   https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:52023IP0459). A bounded round that
   ends on a screen with a real exit is the **opposite** of that, and is worth writing down as a
   deliberate design commitment rather than an implementation detail.
4. **Check the RoundResultScreen button wording for loss framing.** ICO Standard 5:
   *"present options to continue playing… **neutrally without suggesting that children will lose out
   if they don't**."*
   https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/5-detrimental-use-of-data/
5. **Anti-farming: consider ABCmouse's "first N completions pay" rule** for round games, mirroring the
   `markBrowsed` gate that already exists for browses. Prevents the reward path degenerating into
   grinding the easiest game.
6. **Consider colour-coded rather than named/numbered difficulty** (Todo Math A–H → colours). You
   already removed the only child-facing difficulty name ("Hukommelse 20 (svær)") — this is the
   general form of that fix.

---

## 6. The DO NOT DO list

Each item is named by the source that condemns it.

**Never, on any surface a child sees:**

1. **A streak, a daily goal, or a login reward.** EU Commission Art. 28 Guidelines §6.3.1(viii) says
   *"streaks"* should be **off by default** for minors
   (https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:C_202505519); the Danish government
   hvidbog names *"streaks"* explicitly as a *fastholdelsesmekanisme*; The Decision Lab documents
   streaks converting intrinsic motivation into extrinsic reward-seeking. **Streaks have no defender
   in a preschool context anywhere in this sweep — even Duolingo's own kids product appears to drop
   them.**
2. **Anything that can be LOST, decay, expire, or regress.** ICO Standard 5: present continuation
   *"without suggesting that children will lose out if they don't."* Zagal: withering is exactly what
   makes PLAYING BY APPOINTMENT dark. **This includes a companion that gets sad or hungry.**
3. **Timers, countdowns, "limited time", "only today", or any scarcity/urgency cue.** OECD's "Urgency"
   dark-pattern category (https://www.oecd.org/content/dam/oecd/en/publications/reports/2022/10/dark-commercial-patterns_9f6169cd/44f5e846-en.pdf);
   Commission ¶61(b) *"signs communicating scarcity and/or urgency"*; Forbrugerombudsmanden endorses
   the Swedish ban on *"innan det är för sent!"* for child audiences
   (https://www.forbrugerombudsmanden.dk/longreads/boern-unge-og-markedsfoering/).
4. **Random/variable-ratio rewards, loot boxes, mystery boxes, spin-wheels.** Commission §6.6(l)
   *"intermittent or random rewards"*; ICO games tips: *"risk assess any randomised rewards"*
   (https://ico.org.uk/for-organisations/childrens-code-hub/top-tips-for-games-designers-how-to-comply-with-the-children-s-code).
   And the learning-specific reason: Shen/Fishbach/Hsee — randomness buys effort by making **the
   pursuit** the entertainment.
5. **Leaderboards, rankings, or any comparison to another child.** At 5, children systematically
   over-estimate their own performance and largely don't do social comparison; comparing performances
   *"may be too difficult for most first-graders."* Introducing a ranking **manufactures** a
   social-comparison frame the child would not otherwise apply. Use **temporal** comparison instead
   (Gürel/Brummelman 2020).
6. **A shop, a spendable currency, or a choice of what to buy.** Every hostile review in this sweep
   attacks a shop — Common Sense on ABCmouse: **"learning is rewarded by shopping."** A deterministic
   ordered path with no player choice is structurally immune to that critique.
7. **Any number the child is meant to read as a magnitude** — level number, XP total, percentage,
   "37 of 45", a segmented bar with countable units. §2.1–2.4. If a numeral appears at all, follow
   Sesame's rule: **only when it is being spoken while counting**.
8. **A reward or prompt flashed at the moment the child might disengage.** Radesky's "lures" —
   **45.1% of preschool apps, 93.1% of children exposed** (Meyer/Radesky et al., *JAMA Netw Open*
   2022;5(6):e2217641, https://jamanetwork.com/journals/jamanetworkopen/fullarticle/2793493). The
   defining move of manipulative kids' design. Note **80.4% of apps had manipulative design; 98.8% of
   children encountered at least one**; free apps significantly worse than paid.
9. **Parasocial pressure** — the mascot must never say "Vil du give op?" or look disappointed when the
   child leaves. Radesky coded this at 24.8% of apps / 70.6% of children.
10. **Push notifications to bring the child back.** Not currently in scope (no SW), but worth writing
    down as a permanent exclusion. CARU's proposed line at the FTC was rewards for *"remaining on"* or
    *"frequenting"* a service.
11. **An endless level counter presented as a goal.** Zagal's GRINDING, verbatim: *"many players —
    especially young or new ones — may have difficulties judging exactly how much time the game will
    actually demand."*

**The affirmative side of the same guidance** (things regulators explicitly ask *for*, which you
mostly already have — worth claiming credit for in a PRD):

- **Pause and save without losing progress.** ICO Standard 13's age table for **0–5 and 6–9** both
  say: *"Provide tools to support wellbeing enhancing behaviours (such as mid-level pause and save
  features)."* Your `progressStore` `pagehide` flush is exactly this.
- **Natural stopping points between rounds.** ICO games tips: *"Introduce checkpoints, automatic
  periodic saving of progress, or natural breaks in play between game matches."* `RoundResultScreen`
  is this.
- **Neutral continuation framing.**
- **Adult visibility of time and progress.** Commission ¶61(c); EP resolution §11 (weekly summaries);
  D4CR Principle 6 *"Make it easy for children and their care givers to set limits."*
  https://d4cr.org/design-guide
- **Friction works:** Konkurrence- og Forbrugerstyrelsen found a **six-second wait before opening cut
  social-media use 36%**; a self-set time budget with a reminder cut it 31%.
  https://kfst.dk/analyser/kfst/publikationer/dansk/2025/20250206-young-consumers-and-social-media

---

## 7. Rights frameworks worth citing in a PRD

- **UNICEF RITEC-8** (UNICEF Innocenti + LEGO Foundation + Cooney Center + Games for Change).
  [ADVOCACY, but the closest thing to an affirmative design standard for children's digital play.]
  https://www.unicef.org/innocenti/media/4681/file/UNICEF-RITEC-Digital-technology-play-child-wellbeing-2022.pdf ·
  https://digitalthrivingplaybook.org/big-idea/designing-for-childrens-well-being-in-digital-play-the-ritec-8-framework/

  Eight wellbeing outcomes: **Safety and Security · Diversity, Equity and Inclusion · Autonomy ·
  Emotions · Competence · Relationships · Creativity · Identities.**
  The structure is itself the argument: **Autonomy** = *"Children freely choose how to engage"*;
  **Competence** = *"perceptions of their effectiveness, ability, and skills, facilitating a sense of
  mastery."* A progression system that *pulls the child back* is in direct tension with Autonomy; one
  that makes the child feel they're **getting better at reading** is squarely Competence. RITEC gives
  you a defensible way to say **"the reward should signal mastery, not attendance."**

- **UN CRC General Comment No. 25 (2021)** — authoritative interpretation of a treaty Denmark is party
  to. https://www.ohchr.org/en/documents/general-comments-and-recommendations/general-comment-no-25-2021-childrens-rights-relation
  ¶110: *"Leisure time spent in the digital environment may expose children to risks of harm, for
  example, through opaque or misleading advertising or **highly persuasive or gambling-like design
  features**."* ¶108 is the affirmative duty: encourage innovation in digital play that *"support[s]
  children's autonomy, personal development and enjoyment."*

- **Designing for Children's Rights (D4CR), 10 principles.** https://d4cr.org/design-guide —
  Principle 6 ("Create a balanced environment") is the one that bites; Principle 4 is the counterweight:
  *"Let me grow at my own pace… encourage them to take on **self-driven challenges**."*

- **OECD, *Dark commercial patterns* (2022)** — the best citation for *why* young children are more
  exposed, summarising Radesky (2021): *"five differences from adults make children more susceptible
  to dark patterns: having **immature executive function**; **forming imaginative relationships with
  characters**; **being susceptible to rewards**; being indifferent or unfamiliar with data privacy;
  and lack of understanding of virtual currencies."*
  https://www.oecd.org/content/dam/oecd/en/publications/reports/2022/10/dark-commercial-patterns_9f6169cd/44f5e846-en.pdf
  The report is also honest: *"Concrete evidence of consumer detriment from dark patterns is lacking
  in many cases."*

- **IEEE 2089-2021, Age Appropriate Digital Services Framework** — voluntary standard, built on the
  5Rights principles. Requires *processes*, not design rules: recognise the user is a child; consider
  their capacity and rights; age-appropriate terms; age-appropriate information; validation of design
  decisions; a **risk-based age-appropriate register**.
  https://standards.ieee.org/standard/2089-2021.html
  ⚠️ **Clause text unverified** — paywalled, public mirror is image-encoded. Summary-level only.

**Regulatory scoping, stated plainly:** DSA Arts. 25/28 don't reach this app (not an online platform).
Danish **markedsføringsloven** doesn't reach it (no *handelspraksis* — no commercial practice).
**COPPA** doesn't reach it (non-US, non-commercial). The Danish under-15 social-media age limit is
scoped to *platforms allowing public user profiles* and is unpassed as of Aug 2026
(https://www.altinget.dk/digital/artikel/regeringen-starter-forfra-med-at-lave-en-aldersgraense-paa-sociale-medier).
**The real Danish/EU exposure is data, not design** — GDPR + cookiebekendtgørelsen (parental consent
under 15 for non-essential device storage/access). Instructive: Digitaliseringsstyrelsen found
**47.5% of 40 paid Danish learning apps** send data to third parties for marketing/statistics, and
**"ingen af de analyserede apps har en decideret samtykkeerklæring."**
https://digst.dk/media/ijgjzbkq/laeringsapps-hvad-betaler-du-med.pdf

⚠️ Denmark has **no** screen-time hour limits. Sundhedsstyrelsen explicitly declined to set any:
*"har… ikke fundet det muligt at udlede lignende tidsmæssige anbefalinger."* The "max 1–2 hours"
figure in Danish media is **not** theirs.
https://www.sst.dk/media/13bkv0up/baggrundsnotat-sundhedsstyrelsens-anbefalinger-om-skaermbrug-06102023.pdf

---

## 8. Where the evidence is SOLID vs THIN vs CONTESTED

**Solid — build on these:**
- Rote counting range ≫ number understanding; large numbers are not magnitudes at 5–7.
- Proportions/progress bars are not readable until ~8–9 ("seduced by counting errors").
- Subitizing tops out at 4–5.
- Symbolic progress bars specifically tested with preschoolers and found largely inaccessible;
  **decorating them makes them worse** (Hiniker 2016).
- Goal-gradient and endowed-progress: motivation lives in a **visible finite** target.
- Verbal/positive feedback is the one reward channel with a **positive** effect (d ≈ +0.31–0.33).
- Temporal comparison raises pride without superiority goals.
- Process-vs-person praise at kindergarten age.
- Regulatory convergence on: no streaks, no scarcity, no loss framing, no randomness for minors,
  pause-and-save, natural breaks.

**Contested — state both sides:**
- The **magnitude** of the overjustification effect (SDT vs behaviour-analytic camps). Both agree on
  the boundary conditions and the age moderator; they disagree on how much it matters in practice.
- The **interpretation** of the log-to-linear shift (mental number line vs proportion-judgment skill).
  The design conclusion survives either reading.
- Whether person-praise harm exists at *preschool* age (Corpus & Lepper 2007 dissents).
- **Growth mindset** — treat as effectively refuted as a design mechanism.

**Thin or absent — say so, don't fake it:**
- **No study compares a bounded vs endless progression in a children's product.** The
  recommendation against the infinite counter rests on adjacent evidence, not a head-to-head test.
- **No direct experimental evidence on leaderboards with 5–7-year-olds.**
- **No peer-reviewed empirical study of Duolingo streaks and children.** The mechanism is
  well-founded; the specific child-harm claim is not established.
- **No study shows that a free, non-monetary, non-losable random reward produces problem gambling or
  compulsive use in children.** All the loot-box headline findings measure **spending**.
- **No PENS validation for 5–7-year-olds.** All SDT game-design work is adolescents/adults.
- **Nobody official has published "here is how to represent progress to a non-reader."** The field's
  *practice* (Sesame, Khan Kids, PBS, Teach Your Monster) converges on **characters, collections, and
  concrete pictures of what you earned** — and pointedly not numbers — but none of them wrote down
  why. **The developmental research explains why it works; the design guidance never connects the
  two.** That connection is what a PRD here would be contributing.

**Sources to distrust:** thedecisionlab.com, yukaichou.com, growthengineering.co.uk,
structural-learning.com, grokipedia.com — all **blog/SEO/consultancy marketing**, several of which
circulate specific numbers I could not verify against primary sources. Toca Boca / Sago Mini /
Pok Pok design statements are **company marketing** — accurate about what those products *do*,
unevidenced about effects, and from products with **no learning objective**, so the transfer is weak.

---

## 9. Verification caveats on this report

- Web-search budget (200 calls) was exhausted; a few threads rest on secondary citation: the
  Radesky (2021) five-vulnerabilities chapter that OECD cites, and any 2026 revision of the Danish
  Forbrugerombudsmand vejledning.
- Several publisher PDFs (Nature, Springer, ACM DL, ScienceDirect, SDT site) blocked automated fetch.
  Effect sizes marked with ⚠️ come from abstracts/snippets, not full-text tables. Specifically:
  the children-vs-adults **numeric cells** in Deci/Koestner/Ryan (1999) could not be extracted — the
  *direction* is in the published abstract and is uncontested, but **do not quote a number for it**
  without opening the PDF.
- IEEE 2089-2021 clause text is unverified (paywalled, image-encoded mirror).
- Kurnaz (2025) age-gradient numbers are from search-surfaced abstract text behind a 402; single
  recent meta-analysis, not independently verified.
