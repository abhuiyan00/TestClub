# Contributing

Thank you for helping other students. Most contributions are new notes and questions for a
lecture; code changes follow the usual pull-request flow.

## Found a mistake?

You do not need to write code to help. [Open an issue](https://github.com/abhuiyan00/TestClub/issues/new/choose)
and pick the form that fits: a mistake in the material, something that does not work, or a privacy
problem. Point to the slide that supports a fix when you can.

## Workflow

1. Fork the repository (or create a branch from `main` if you have write access).
2. Make your change and run `npm run check` (content check, unit tests, production build).
3. Open a pull request. CI runs the same checks; the site deploys when the pull request is merged.

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/), for example
`content(adb): add lecture 6 notes` or `fix(practice): keep focus after answering`.

## Adding a lecture

### 1. Catalog entry

In `public/content/catalog.json`, find the course and set the lecture to `"status": "available"`.
Add `"slides"` (page count of the lecture PDF) so mock exams can weight lectures fairly.
For courses that publish several lectures in one PDF, use `"pages": [first, last]` instead;
slide numbers are then page numbers of that combined PDF.

Test dates go in `events`, with the time-zone offset when there is a time:

```json
{ "date": "2027-01-26T13:15:00+01:00", "title": "Final test", "kind": "test", "where": "room" }
```

### 2. Notes and questions

Add the lecture to `public/content/<course>/course.json`:

```json
"lectures": {
  "6": {
    "summary": "One or two sentences on what the lecture covers.",
    "facts": [{ "t": "Short title", "d": "The fact in one or two sentences.", "slide": 4, "weight": "high" }],
    "formulas": [{ "name": "Little's law", "expr": "N = X · R", "slide": 9 }],
    "traps": ["Two things that are easy to confuse, and how they differ."]
  }
}
```

Questions are either multiple choice:

```json
{ "id": "L6-01", "l": 6, "topic": "Little's law", "q": "…?", "o": ["right", "wrong", "wrong", "wrong"],
  "c": 0, "hint": "…", "r": "Slide 9: why the answer is right and the others are not.",
  "slide": 9, "pattern": "calculation", "lk": "high" }
```

or open, graded by the student against a model answer (lines starting with `- ` become a list):

```json
{ "id": "L6-02", "l": 6, "type": "open", "topic": "…", "q": "…?", "a": "Model answer.\n- point\n- point",
  "slide": 9, "pattern": "explain", "lk": "high" }
```

Fields: `l` lecture number, `slide` the slide the answer comes from, `pattern` one of
`definition, acronym, true-statement, not-statement, numeric, calculation, compare, classify,
order, fact, explain, exercise`, and `lk` (`high`, `medium`, `low`) how likely the item is on the test.
Options are shuffled when shown, so the position of the right answer does not matter.

### 3. Writing rules

- Write from the slides. When a slide is wrong or ambiguous, say so in a trap or explanation.
- One idea per question. Distractors should be plausible siblings from the same lecture.
- Keep options of similar length: the content check fails when the right answer can be guessed
  from option length alone (more than 28 % for any length-based strategy).
- Hints point the way without giving the answer away.
- Explanations start with the slide number and say why the distractors are wrong.
- Plain text only; no HTML or Markdown beyond `- ` list lines in open answers.

### 4. Slide snapshots

Lecture PDFs stay on your machine and are never committed (`*.pdf` is ignored). Render only the
slides your notes reference:

```bash
pip install -r tools/requirements.txt
python tools/slides.py --course adb --lecture 6 --pdf "path/to/lecture.pdf"
```

Crops per course are in `tools/crops.json` and remove header bands, footers and logos.
If a slide shows a person's name, an e-mail address, a login, an internal hostname or a
third-party screenshot, add a box to `tools/redactions.json` and render again with `--force`.
Open every new image before committing it.

### 5. Check

```bash
npm run check:content
```

It validates the schema, slide numbers and images, option-length balance, and the privacy rules.

## Privacy rules

- Never publish names of teachers or students, e-mail addresses, logins, student IDs or internal
  hostnames, in text or in images. The content check always rejects e-mail addresses. Names are
  checked against a hashed denylist that never enters the repository, because hashes of names are
  easy to reverse: maintainers keep it in `tools/privacy-denylist.json` (ignored by Git) and in the
  `PRIVACY_DENYLIST` Actions secret. Images must be checked by eye.
- Never commit lecture PDFs or full slide decks.
- Do not mention or link the official course portal in content; TestClub is independent.

## Code style

- Angular standalone components, signals and the built-in control flow; `OnPush` everywhere.
- Styles use the design tokens in `src/styles/_tokens.scss`; no raw colours in components.
- Format with `npm run format` (Prettier). Keep components small and focused.
- New logic in `src/app/core` comes with a unit test.
