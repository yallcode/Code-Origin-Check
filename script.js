"use strict";
const $ = id => document.getElementById(id);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

const SAMPLE_AI = `import json
from typing import List, Dict


def process_user_data(users: List[Dict]) -> List[Dict]:
    """
    Process a list of user dictionaries and return the active ones.

    Args:
        users: A list of user dictionaries.

    Returns:
        A list containing only the active users.
    """
    # Initialize the result list
    result = []

    # Loop through each user in the list
    for user in users:
        # Check if the user is active
        if not isinstance(user, dict):
            raise ValueError("Each user must be a dictionary")
        if user.get("active", False):
            result.append(user)

    # Return the filtered result
    return result


# Example usage
if __name__ == "__main__":
    try:
        data = [{"name": "Ada", "active": True}, {"name": "Bob", "active": False}]
        print("\u2705 Active users:", process_user_data(data))
    except Exception as e:
        print(f"Error: {e}")
`;

const SAMPLE_HUMAN = `// fix for #212, don't touch the delay
let t = null;
function go(el){
  console.log("here")
  if(!el) return;   
  // el.style.display = "none";
  clearTimeout(t)
  t = setTimeout(()=>{
    el.classList.add('x') // idk why this needs to be async but it does
  }, 40)
  // TODO(sam) rewrite this, it's hacky af
  return t
}
module.exports = go
`;

// analysis
function analyze(raw) {
  const L = raw.replace(/\r\n?/g, "\n").split("\n").slice(0, 3000);
  while (L.length && !L[L.length - 1].trim()) L.pop();
  const nb = L.filter(l => l.trim()).length;
  const isC = i => /^\s*(\/\/|#(?!!)|--|\/\*|\*\s|\*\/)/.test(L[i]);
  const cText = i => L[i].replace(/^\s*(\/\/+|#+|--|\/\*+|\*+)\s?/, "");
  const hits = (re, only) => L.map((l, i) => (!only || only(i)) && re.test(l) ? i : -1).filter(i => i >= 0);
  const commentIdx = L.map((_, i) => i).filter(isC);
  const inlineC = i => /\S.*\s(\/\/|#)\s+\S/.test(L[i]);
  const S = [];
  const add = (dir, name, why, pts, lines) => { if (pts > 0 && lines.length) S.push({ dir, name, why, pts, lines }); };

  // ai stuff
  const density = nb ? commentIdx.length / nb : 0;
  if (nb >= 12 && density >= 0.25)
    add("ai", "Heavily commented", `Around ${Math.round(density * 100)}% of the lines are comments. AI tools like to explain every single step.`, Math.min(14, Math.round((density - 0.15) * 50)), commentIdx);

  const restate = /^\s*(?:\/\/|#|\*|\/\*+)\s*(?:initiali[sz]e|loop (?:through|over)|iterate (?:over|through)|return (?:the|a)\b|check (?:if|whether)|create (?:a|an|the)\b|define (?:a|the)\b|import\b|set (?:the|up)\b|get (?:the|a)\b|calculate (?:the|a)\b|print (?:the|a)\b|add (?:the|a)\b|update (?:the|a)\b|helper function|main function|example usage|handle\b)/i;
  let r = hits(restate);
  if (r.length >= 2) add("ai", "Comments that restate the code", `${r.length} comments just repeat what the next line already does (like "Initialize...", "Loop through...", "Return the...").`, Math.min(18, r.length * 4), r);

  r = hits(/(?:\/\/|#|\*)\s*(?:note:|here[’']?s\b|this (?:function|method|class|script|code) (?:will |is used to |is responsible|takes|returns|handles)|make sure\b|step \d|first,|next,|finally,)/i, isC);
  if (r.length >= 2) add("ai", "Tutorial-style voice", `${r.length} comments sound like a tutorial ("This function...", "Note:", "Step 1").`, Math.min(10, r.length * 3), r);

  r = hits(/(?:@param\b|@returns?\b|:param\s|:returns?:|^\s*(?:Args|Arguments|Parameters|Returns|Raises):)/);
  if (r.length >= 3) add("ai", "Complete docblocks", `${r.length} lines describe params or return values in the same full format every time.`, Math.min(14, r.length * 2), r);

  r = hits(/__name__\s*==\s*['"]__main__['"]|example usage|except\s+Exception\s+as\s+\w+:|console\.error\(\s*["'`](?:Error|Failed)|print\(\s*f?["']Error/i);
  if (r.length) add("ai", "Stock boilerplate", `Found ${r.length} super common template pattern${r.length > 1 ? "s" : ""}: a main guard, "Example usage", a catch-all exception or a generic error print.`, Math.min(12, r.length * 4), r);

  r = hits(/[\u{1F300}-\u{1FAFF}\u2705\u274C\u26A0\u2728]/u);
  if (r.length) add("ai", "Emoji in code or logs", `${r.length} line${r.length > 1 ? "s use" : " uses"} emoji like check marks or rockets. AI loves these in logs, people rarely put them in real code.`, Math.min(10, r.length * 4), r);

  r = hits(/^\s*(?:\/\/|#)\s*(?:[-=_*\u2500\u2501]{3,}|[-=_*\u2500\u2501]{2,}\s*\S.*?\s*[-=_*\u2500\u2501]{2,})\s*$/);
  if (r.length) add("ai", "Decorative section dividers", "Banner comments like '# ---- Helpers ----' chop the file into tidy sections.", Math.min(8, r.length * 4), r);

  r = hits(/\b(?:raise\s+(?:ValueError|TypeError)|throw\s+new\s+(?:Error|TypeError)|isinstance\(|Number\.isFinite|typeof\s+\w+\s*[!=]==)/);
  if (r.length >= 3) add("ai", "Heavy input validation", `${r.length} type or value checks. That is more defensive than most quick hand-written code.`, Math.min(8, r.length * 2), r);

  const decl = /\b(?:const|let|var|def|function|fn|func|class)\s+([A-Za-z_]\w*)/;
  const names = L.map((l, i) => { const m = l.match(decl); return m ? { i, n: m[1] } : null; }).filter(Boolean);
  if (names.length >= 4) {
    const avg = names.reduce((s, x) => s + x.n.length, 0) / names.length;
    const long = names.filter(x => x.n.length >= 14).map(x => x.i);
    if (avg >= 13 && long.length) add("ai", "Long, very descriptive names", `Declared names average ${avg.toFixed(0)} characters.`, 6, long);
    const generic = names.filter(x => /^(?:process|handle|validate|calculate|compute|generate|parse)_?(?:Data|Input|Result|Request|Response|Items?|Users?)/i.test(x.n)).map(x => x.i);
    if (generic.length >= 2) add("ai", "Generic helper naming", "Names like process_data or handleRequest follow a really common template.", 5, generic);
  }

  // human stuff
  r = hits(/\b(?:FIXME|HACK|XXX)\b|TODO\s*\(\w+\)|TODO:?\s+\S+.*(?:later|fix|why|idk|hack)/i, i => isC(i) || inlineC(i));
  if (r.length) add("hu", "Personal TODO / FIXME notes", "Notes with a name on them, or marked as a hack, usually come from real developers.", Math.min(8, r.length * 4), r);

  const codey = /[;{}]\s*$|^\W*\w+(?:\.\w+)+\(|^\W*\w+\s*=\s*\S|^\W*(?:if|for|while|return|print|console)\b/;
  r = commentIdx.filter(i => codey.test(cText(i)) && !restate.test(L[i]));
  if (r.length >= 2) add("hu", "Commented-out code", `${r.length} comment lines look like old code that got switched off, not an explanation.`, Math.min(10, r.length * 3), r);

  r = hits(/console\.log\(\s*["'`](?:here|test|hi|asdf|wtf|\d+|debug|works)[^)]*\)|print\(\s*["'](?:here|test|hi|asdf|wtf|\d+|debug|works)[^)]*\)|\bdebugger\b|pdb\.set_trace/i);
  if (r.length) add("hu", "Leftover debug output", "Print or log lines like 'here' or 'test' are what people forget to delete while debugging.", Math.min(8, r.length * 5), r);

  r = hits(/\b(?:wtf|ugh|idk|dunno|lol|hmm+|damn|shit|fuck\w*|stupid|no idea|workaround|please work|kinda|gonna|hacky|af|temp(?:orary)? fix|why does|don[’']t touch)\b/i, i => isC(i) || inlineC(i));
  if (r.length) add("hu", "Informal comments", "Casual or annoyed wording in comments is rare in AI output.", Math.min(10, r.length * 5), r);

  r = hits(/(?:#\d{1,5}\b|issue\s*#?\d+|https?:\/\/\S+|@(?!param|returns?|type|example|throws|see)\w+)/i, i => isC(i) || inlineC(i));
  if (r.length) add("hu", "Issue numbers, links or names", "Tickets, links or teammate names point to a real project with real history.", Math.min(5, r.length * 3), r);

  r = hits(/\b(?:I|I[’']m|I[’']ll|my)\b/, i => isC(i) || inlineC(i));
  if (r.length) add("hu", "First-person comments", "Comments that say 'I' or 'my' sound like a person talking to themselves.", Math.min(5, r.length * 2), r);

  r = hits(/\S[ \t]+$/);
  if (r.length >= 2) add("hu", "Trailing spaces", "Extra spaces at the end of lines usually get cleaned up by AI tools and formatters.", Math.min(6, r.length * 2), r);

  const tabs = hits(/^\t/), sp = hits(/^ {2,}\S/);
  if (tabs.length && sp.length) add("hu", "Mixed tabs and spaces", "Indentation switches style in the middle of the file.", 6, tabs.slice(0, 20));

  // score
  const ai = S.filter(s => s.dir === "ai").reduce((a, s) => a + s.pts, 0);
  const hu = S.filter(s => s.dir === "hu").reduce((a, s) => a + s.pts, 0);
  let score = Math.max(8, Math.min(92, 50 + ai - hu));
  const short = nb < 12;
  if (short) score = 50 + (score - 50) * 0.5;
  return { L, nb, S, ai, hu, score: Math.round(score), short };
}

// showing the results
function verdictFor(s) {
  if (s >= 66) return "Likely AI-generated";
  if (s >= 55) return "Leans AI-generated";
  if (s >= 45) return "Unclear";
  if (s >= 34) return "Leans human-written";
  return "Likely human-written";
}

function lineRef(lines) {
  const n = lines.map(i => i + 1);
  return "line" + (n.length > 1 ? "s " : " ") + n.slice(0, 6).join(", ") + (n.length > 6 ? " ..." : "");
}

function render(res) {
  $("result").hidden = false;
  $("verdict").textContent = verdictFor(res.score);
  const na = res.S.filter(s => s.dir === "ai").length, nh = res.S.filter(s => s.dir === "hu").length;
  $("summary").textContent = res.S.length
    ? `${na} signal${na === 1 ? "" : "s"} toward AI, ${nh} toward human. Score ${res.score} of 100 on the AI side.`
    : "No clear signals either way, so the score stays in the middle.";
  $("scoreTxt").textContent = "";
  requestAnimationFrame(() => { $("marker").style.left = res.score + "%"; });

  const w = $("warn");
  w.hidden = !res.short && res.S.length > 0;
  if (res.short) w.textContent = "This snippet is really short (under 12 lines), so the result is weak. Try pasting more code.";
  else if (!res.S.length) w.textContent = "Nothing in this code matched the habits I look for. That does not prove who wrote it.";

  const fill = (ul, dir) => {
    ul.replaceChildren();
    const list = res.S.map((s, k) => ({ ...s, k })).filter(s => s.dir === dir).sort((a, b) => b.pts - a.pts);
    if (!list.length) { const li = el("li"); li.append(el("p", "none", "Nothing found.")); ul.append(li); return; }
    list.forEach(s => {
      const li = el("li"), b = el("button", "sig " + dir);
      b.type = "button";
      b.append(el("b", null, s.name), el("span", null, s.why), el("span", null, ""));
      b.lastChild.append(el("i", null, lineRef(s.lines)));
      b.addEventListener("click", () => focusSig(s.k, b));
      li.append(b); ul.append(li);
    });
  };
  fill($("aiList"), "ai"); fill($("huList"), "hu");

  const box = $("code"); box.replaceChildren();
  const tag = res.L.map(() => ({ ai: [], hu: [] }));
  res.S.forEach((s, k) => s.lines.forEach(i => tag[i][s.dir].push(k)));
  res.L.forEach((line, i) => {
    const row = el("div", "row" + (tag[i].ai.length ? " ai" : tag[i].hu.length ? " hu" : ""));
    row.dataset.sigs = [...tag[i].ai, ...tag[i].hu].join(",");
    row.append(el("span", "n", String(i + 1)), el("span", null, line || " "));
    box.append(row);
  });
  $("result").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
}

let activeSig = null;
function focusSig(k, btn) {
  const rows = [...document.querySelectorAll(".row")];
  const off = activeSig === k;
  activeSig = off ? null : k;
  rows.forEach(r => r.classList.toggle("dim", !off && !r.dataset.sigs.split(",").includes(String(k))));
  if (!off) { const first = rows.find(r => !r.classList.contains("dim")); if (first) first.scrollIntoView({ block: "center", behavior: "auto" }); }
}

// buttons
$("run").addEventListener("click", () => {
  const v = $("src").value;
  if (!v.trim()) { $("src").focus(); return; }
  activeSig = null;
  render(analyze(v));
});
$("s1").addEventListener("click", () => { $("src").value = SAMPLE_AI; $("run").click(); });
$("s2").addEventListener("click", () => { $("src").value = SAMPLE_HUMAN; $("run").click(); });
$("file").addEventListener("change", e => {
  const f = e.target.files[0]; if (!f) return;
  if (f.size > 500000) { alert("That file is over 500 KB. Paste the part you want checked instead."); return; }
  const fr = new FileReader();
  fr.onload = () => { $("src").value = fr.result; $("run").click(); };
  fr.readAsText(f);
});
