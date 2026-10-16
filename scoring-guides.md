# Scoring Guide

The candidate is early-career and targets junior roles. Postings are wish lists, so only the core of the role is scored. Years of experience affect the ambition flag, never the score.

## 1. Pick the core (max 4)

Core = the skills the person uses day one and every week: those in the title, the first responsibilities, anything repeated or marked "must". Everything else is "other" and is not scored, only listed as gaps. A posting with 15+ skills is mostly "other". Ignore soft skills.

The role's headline domain must be one of the core items: the area the title and first responsibility are about (embedded, data engineering, ML, mobile, DevOps, security, and so on). Include it even if the candidate has nothing for it and it scores 0. Generic skills (C, algorithms) must not stand in for a domain the candidate has not worked in.

## 2. Rate each core item using only `about.me`

| Points | Meaning |
|---|---|
| 2 | Has it, shown in a job, internship, or project |
| 1 | Adjacent tool (Tableau for Power BI), fundamentals only, or mentioned without evidence |
| 0 | Nothing relevant |

## 3. Score

```
score = core points / (2 x core items) x 100
+ 10 if at least half of the "other" skills are covered
```

Caps: any core item at 0 → max 65. Half or more of the core at 0 → max 40.

**Language gate (applied last, overrides the rest).** The candidate's German is not working level yet. Set `language_blocker: true` when:
- the posting requires German in any wording: "gute Deutschkenntnisse", "Deutsch- und Englischkenntnisse", "fließend", "German required", "fluent German", "sichere Kommunikation auf Deutsch", a level of B1 or higher, and so on.

A posting that is merely written in German is NOT a blocker. Many German-language postings do not require German. Only an explicit requirement counts. When the posting is in German but states no requirement, list a `soft` gap ("posting is in German, team language may be German") and leave the score alone.

Then cap the score at 30 and set the verdict to Skip, whatever the skills score was. Put it first in `gaps`, labelled `hard`, with the quote.

Not a blocker: German "a plus", "von Vorteil", "nice to have", or basic knowledge only. List it as a `soft` gap, no cap.

## 4. Too senior?

Set `too_senior: true` only when the actual duties are beyond a junior: owning a team, budget, or strategy, leading others, or 5+ years of deep expertise. Judge the duties, not the title (a "junior" title with ownership duties counts). Give a one-line reason. 3-4 years asked with individual contributor duties is not too senior; list it as an `experience-years` gap.

## 5. Verdict

| Score | Verdict |
|---|---|
| 75+ | Strong fit: apply |
| 55-74 | Reach: apply, address the gap in the letter |
| 35-54 | Long shot: only if the company is a priority |
| under 35 | Skip |

`too_senior: true` caps the verdict at Long shot. Say so. `language_blocker: true` forces Skip.

## Return

`match_score`, `verdict`, `too_senior` (true/false, with reason only if true), `language_blocker` (true/false, with the quote only if true), `core` (each item with points), `top_skills`, `gaps` (core gaps first, then others, labelled `hard` / `soft` / `learnable` / `experience-years`), and any cap applied.

## Example

"Junior Data Analyst", asks 3 years, 18 skills listed. Core: SQL (2, uni project), Excel (2, internship), Tableau (1, has Power BI). 5/6 = 83. Covers 2 of 15 others, no bonus. Score 83, `too_senior: false` (individual contributor, so the 3 years is just an `experience-years` gap), verdict Strong fit.
