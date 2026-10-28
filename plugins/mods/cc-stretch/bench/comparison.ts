// Shows saved outputs without judging them. The closed and expanded views use
// the same parser as the plugin; the source view keeps the original reply.
import { render, words } from "./measure.ts";

export type ComparisonAnswer =
  | { arm: string; text: string }
  | { arm: string; unavailable: string };

export type Comparison = {
  title: string;
  description: string;
  guides: { name: string; text: string }[];
  cases: { name: string; input: string; answers: ComparisonAnswer[] }[];
};

export function comparisonHtml(comparison: Comparison): string {
  if (
    comparison.guides.length !== 2 ||
    new Set(comparison.guides.map((g) => g.name)).size !== 2
  ) {
    throw new Error("a side-by-side comparison needs two distinct guides");
  }
  const names = comparison.guides.map((g) => g.name);
  const data = {
    ...comparison,
    guides: comparison.guides.map((g) => ({ ...g, words: words(g.text) })),
    cases: comparison.cases.map((c) => {
      if (
        c.answers.length !== 2 ||
        names.some(
          (name) => c.answers.filter((a) => a.arm === name).length !== 1,
        )
      ) {
        throw new Error(`${c.name} does not have an outcome for each guide`);
      }
      return {
        ...c,
        answers: c.answers.map((a) =>
          "text" in a
            ? {
                ...a,
                closed: render(a.text, new Set()),
                expanded: render(a.text, "all"),
              }
            : a,
        ),
      };
    }),
  };
  const encoded = JSON.stringify(data).replaceAll("<", "\\u003c");
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Guide comparison</title>
<style>
:root{color-scheme:dark;--bg:#14161c;--panel:#1c1f28;--ink:#ebe9f0;--muted:#b5b4c4;--line:#454956;--accent:#d5c17e}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}main{max-width:1400px;margin:auto;padding:28px 30px 80px}h1,h2,h3{font-family:Menlo,Consolas,monospace}h1{font-size:25px;margin:0 0 12px}h2{font-size:19px}h3{font-size:15px;margin:0 0 14px;color:var(--accent)}p{max-width:85ch}.muted{color:var(--muted);font-size:14px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:24px}pre{margin:0;font:14px/1.65 Menlo,Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere}.answer{background:var(--panel);border:1px solid var(--line);padding:20px;min-width:0}.case{border-top:1px solid var(--line);margin-top:32px;padding-top:12px}details{margin:14px 0}summary{cursor:pointer;color:var(--muted)}details>pre,details>.pair{margin-top:14px}.toolbar{position:sticky;top:0;background:var(--bg);padding:14px 0;display:flex;gap:12px;align-items:center;flex-wrap:wrap;border-bottom:1px solid var(--line);z-index:1}select,button{font:inherit;color:var(--ink);background:var(--panel);border:1px solid #747685;padding:7px 10px}a{color:#abc9eb}a:focus-visible,select:focus-visible,summary:focus-visible{outline:2px solid var(--accent);outline-offset:3px}.empty{color:var(--muted)}@media(max-width:700px){main{padding:20px 16px 55px}.pair{grid-template-columns:1fr;gap:12px}.answer{padding:16px}h1{font-size:21px}pre{font-size:13px}.toolbar{gap:8px}}
</style><main><h1 id="title"></h1><p id="description"></p><p class="muted">No scores or rankings. Each row keeps both outputs for the same input.</p><p><a href="#outputs">Jump to generated replies</a></p><details open><summary>System prompts used in this run</summary><div class="pair" id="guides"></div></details><div class="toolbar" id="outputs"><label for="view">Show</label><select id="view"><option value="closed">First reading</option><option value="expanded">All stretches expanded</option><option value="text">Original stretch syntax</option></select><label for="case">Jump to</label><select id="case"></select></div><div id="cases"></div></main>
<script id="data" type="application/json">${encoded}</script><script>
const D=JSON.parse(document.querySelector('#data').textContent),nodes=[];
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n};
document.querySelector('#title').textContent=D.title;document.querySelector('#description').textContent=D.description;
for(const g of D.guides){const n=el('div',undefined,'answer');n.append(el('h3',g.name+' · '+g.words+' words'),el('pre',g.text));document.querySelector('#guides').append(n)}
D.cases.forEach((c,i)=>{const section=el('section',undefined,'case');section.id='case-'+i;section.append(el('h2',c.name));const input=el('details');input.append(el('summary','Read the input'),el('pre',c.input));section.append(input);const pair=el('div',undefined,'pair');for(const g of D.guides){const a=c.answers.find(a=>a.arm===g.name),box=el('div',undefined,'answer');box.append(el('h3',g.name));const text=el('pre');if('unavailable'in a){text.textContent=a.unavailable;text.className='empty'}else{nodes.push({text,answer:a});text.textContent=a.closed}box.append(text);pair.append(box)}section.append(pair);document.querySelector('#cases').append(section);const option=el('option',c.name);option.value=section.id;document.querySelector('#case').append(option)});
document.querySelector('#view').onchange=e=>{for(const n of nodes)n.text.textContent=n.answer[e.target.value]};
document.querySelector('#case').onchange=e=>{document.getElementById(e.target.value).scrollIntoView({block:'start'});window.scrollBy(0,-document.querySelector('.toolbar').getBoundingClientRect().height)};
</script></html>`;
}
