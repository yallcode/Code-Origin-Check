# Code Origin Check

A little website that looks at some code and tells you if it reads more like AI wrote it or a person did. You paste code (or open a file), it gives a score from human to AI, and it shows which lines and habits made it say that.

It all runs in the browser. No backend, no uploads.

## It's a guess, not proof

This can't prove who wrote anything. It checks for habits that show up a lot in AI code and habits that show up a lot in human code, then adds them up. Clean human code can look like AI, and AI code that someone edited can look human. So use it as a "maybe look closer" thing and never to accuse somebody. Really short snippets (under 12 lines) are the worst, and the page warns you about that.

## What it looks for

Points toward AI:

- lots of comments
- comments that just repeat the code ("Initialize the list", "Loop through each user")
- comments that sound like a tutorial ("This function...", "Note:", "Step 1")
- full docblocks (`@param`, `Args:`, `Returns:`)
- stock boilerplate (`if __name__ == "__main__"`, "Example usage", catch-all exceptions, generic error prints)
- emoji in code or logs
- banner comments that split the file into sections
- a lot of input validation
- long generic names

Points toward human:

- TODO / FIXME notes with a name on them
- commented-out code
- leftover debug prints
- annoyed or casual comments
- issue numbers, links or teammate names in comments
- comments with "I" or "my"
- trailing spaces
- tabs and spaces mixed together

Every signal adds or removes points from a starting score of 50. The final score stays between 8 and 92 so it never acts 100% sure, and short snippets get pulled toward the middle.

## Files

- `index.html` is the page
- `style.css` is the styling
- `script.js` has the checker and the button stuff

`script.js` finds things by id, so if you change the HTML keep these ids: `src`, `run`, `file`, `s1`, `s2`, `result`, `verdict`, `summary`, `marker`, `scoreTxt`, `warn`, `aiList`, `huList`, `code`.

## Run it locally

Just open `index.html` in a browser. No build, no installs.

If you'd rather use a server:

```bash
python3 -m http.server 8000
```

then go to http://localhost:8000

## Put it on GitHub Pages

1. Put the three files in the root of the repo.
2. Go to Settings, then Pages.
3. Pick "Deploy from a branch", choose your main branch and the root folder, and save.
4. Wait a minute or two. It ends up at `https://<username>.github.io/<repo>/`

The fonts come from Google Fonts. If they don't load it falls back to whatever the browser has.

## Changing the checks

All the checks are in the `analyze()` function in `script.js`. Each one is a regex and a message:

```js
r = hits(/console\.log\(\s*["'`]here/i);
if (r.length) add("hu", "Leftover debug output", "why it matters", Math.min(8, r.length * 5), r);
```

- `"ai"` or `"hu"` is which side it pushes toward
- the number is how many points it's worth
- `r` is the list of lines to highlight

If you want to change the verdict wording or the cutoffs, look at `verdictFor()`.

## Maybe later

- different rules for each language
- a link to share a result
- showing how many points each signal added
- a dark theme

## Credits

Made by [BerriesArmy](https://github.com/BerriesArmy) with YallCode.

## License

Haven't picked one yet. MIT is probably fine.
