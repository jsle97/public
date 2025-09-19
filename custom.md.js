/*
  Simple, dependency-free Markdown → HTML parser with 16 core features and safe defaults.	
  ------------------------------------------------------------------------------
  License: MIT
  Dependencies: none
  Copyright (c) 2025 Jakub Śledzikowski <jakub@jsle.eu>
*/


export const md={_defaults:{allowHTML:false,linkTargetBlank:true,linkRel:"nofollow noopener noreferrer",allowImageDataURI:false,returnAST:true},parse(a,b={}){const c={...this._defaults,...b};const d={opts:c,footDefs:new Map(),footOrder:[],usedFoot:new Set(),re:this._util.re()};const e=this._block.tokenize(a,d);const f=this._render.toHTML(e,d);return c.returnAST?{html:f,ast:e}:{html:f}},_util:{re(){return{atx:/^(#{1,6})\s+(.+?)\s*#*\s*$/,hr:/^(?:-{3,}|\*{3,}|_{3,})\s*$/,ulist:/^([*+-])\s+(.+)$/,olist:/^(\d{1,9})\.\s+(.+)$/,task:/^\[( |x|X)\]\s+/,fence:/^```(\w+)?\s*$/,bq:/^> ?/,tableSep:/^\s*\|?:?-+:?\s*\|(?:\s*:?-+:?\s*\|)*\s*$/,pipeSplit:/(?<!\\)\|/,unescPipe:/\\\|/g,footDef:/^\[\^([^\]]+)\]:\s*(.+)$/}},esc(a){return a.replace(/[&<>"']/g,b=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[b]))},isBlank(a){return /^\s*$/.test(a)},sanitizeURL(a,b,c){try{const d=new URL(a,'http://x.invalid');const e=(d.protocol||'').toLowerCase();if(e==='http:'||e==='https:'||e==='mailto:')return a;if(b==='img'&&c&&/^data:image\/(png|jpeg|gif|webp);base64,/i.test(a))return a;return null}catch{return null}},hardBreaks(a){return a.replace(/ {2,}\n/g,"<br>\n")},normalizeSoft(a){return a.replace(/\n(?!\n)/g," ")},splitTableRow(a,b){const c=a.split(b.pipeSplit).map(d=>d.trim());if(c[0]==="")c.shift();if(c[c.length-1]==="")c.pop();return c.map(d=>d.replace(b.unescPipe,"|"))}},_block:{tokenize(a,b){const c=b.re,d=md._util;const e=String(a).replace(/\r\n?/g,"\n").split("\n");const f=[];let g=0;for(let h=0;h<e.length;h++){const i=c.footDef.exec(e[h]);if(i){b.footDefs.set(i[1],i[2]);e[h]="";}}while(g<e.length){let h=e[g];if(d.isBlank(h)){g++;continue}let i=c.fence.exec(h);if(i){const j=i[1]||"";const k=[];g++;while(g<e.length&&!c.fence.test(e[g])){k.push(e[g]);g++}if(g<e.length)g++;f.push({type:"code",lang:j,code:k.join("\n")});continue}i=c.atx.exec(h);if(i){f.push({type:"heading",depth:i[1].length,text:i[2]});g++;continue}if(c.hr.test(h)){f.push({type:"hr"});g++;continue}if(h.includes("|")&&g+1<e.length&&c.tableSep.test(e[g+1])){const j=e[g],k=e[g+1];g+=2;const l=[];while(g<e.length&&e[g].includes("|")&&!d.isBlank(e[g])){l.push(e[g]);g++}const m=d.splitTableRow(j,c);const n=d.splitTableRow(k,c);const o=n.map(p=>{const q=p.trim();return q.startsWith(":")&&q.endsWith(":")?"center":q.endsWith(":")?"right":q.startsWith(":")?"left":null});const p=l.map(q=>d.splitTableRow(q,c));f.push({type:"table",header:m,align:o,rows:p});continue}if(c.bq.test(h)){const j=[];while(g<e.length&&c.bq.test(e[g])){j.push(e[g].replace(/^> ?/,""));g++}f.push({type:"blockquote",children:this.tokenize(j.join("\n"),b)});continue}if(c.ulist.test(h)||c.olist.test(h)){const j=[];let k=null,l=1;const m=h.match(/^\s*/)[0].length;const n=p=>{if(d.isBlank(p))return null;if(c.olist.test(p))return"ol";if(c.ulist.test(p))return"ul";return null};while(g<e.length){const p=n(e[g]);if(!p)break;if(k===null)k=(p==="ol");else if(k&&p==="ul")break;else if(!k&&p==="ol")break;const q=e[g];let r="";let s=false,t=false;const u=c.olist.exec(q),v=c.ulist.exec(q);if(u){if(j.length===0){l=parseInt(u[1],10)||1}r=u[2]}else if(v){r=v[2]}g++;const w=q.match(/^\s*/)[0].length;const x=[];while(g<e.length){const y=e[g];if(d.isBlank(y)){x.push("");g++;continue}const z=y.match(/^\s*/)[0].length;if(z>w){x.push(y.slice(w+1));g++;continue}break}if(c.task.test(r)){s=true;t=/^\[(x|X)\]/.test(r);r=r.replace(c.task,"")}const A=[r].concat(x).join("\n");const B=this.tokenize(A,b);j.push({type:"list_item",task:s,checked:t,children:B})}f.push({type:"list",ordered:!!k,start:k?l:void 0,items:j});continue}const j=[];while(g<e.length){const k=e[g];if(d.isBlank(k))break;if(c.atx.test(k)||c.hr.test(k)||c.fence.test(k)||c.bq.test(k)||c.ulist.test(k)||c.olist.test(k)||(k.includes("|")&&g+1<e.length&&c.tableSep.test(e[g+1])))break;j.push(k);g++}if(j.length){f.push({type:"paragraph",text:j.join("\n")});continue}g++}return f}},_inline:{toHTML(a,b){if(!a)return"";const c=md._util.esc,d=md._util;let e=0,f="";const g=h=>{f+=h};const h=(i,j,k)=>{const l=i.indexOf(k,j);return l<0?-1:l};const i=()=>{let j=e;while(j<a.length&&a[j]==='`')j++;const k=j-e;const l=a.indexOf("`".repeat(k),j);if(l<0){g(c(a.slice(e)));e=a.length;return}g("<code>"+c(a.slice(j,l))+"</code>");e=l+k};const j=(k,l)=>{let m=0,n=e,o=false;while(n<a.length){const p=a[n++];if(o){o=false;continue}if(p==='\\'){o=true;continue}if(p===k)m++;else if(p===l){m--;if(m===0)return n}}return-1};const k=m=>{const n=j('[',']');if(n<0){g(c(a[e]));e++;return}const o=a.slice(e+(m?2:1),n-1);let p=n;if(a[p]!=='('){g(c(a.slice(e,n)));e=n;return}p++;let q="",r="",s=false,t="";while(p<a.length){const u=a[p];if(!s&&u===')'){p++;break}if(!s&&/\s/.test(u)){while(p<a.length&&/\s/.test(a[p]))p++;if(a[p]==='"'||a[p]==="'"){s=true;t=a[p++]}continue}if(s){const v=h(a,p,t);if(v<0){r="";break}r=a.slice(p,v);p=v+1;s=false;continue}else{const v=h(a,p,')'),w=h(a,p,' ');const x=w===-1?v:(v===-1?w:Math.min(v,w));q=a.slice(p,x<0?a.length:x);p=x<0?a.length:x;continue}}const v=d.sanitizeURL(q,m?'img':'a',b.opts.allowImageDataURI);if(m){if(!v){g(c(o));e=p;return}let w=` src="${c(v)}" alt="${c(o)}"`;if(r)w+=` title="${c(r)}"`;g(`<img${w}>`);e=p;return}else{if(!v){g(c(o));e=p;return}let w=` href="${c(v)}"`;if(r)w+=` title="${c(r)}"`;if(b.opts.linkTargetBlank)w+=` target="_blank"`;if(b.opts.linkRel)w+=` rel="${b.opts.linkRel}"`;g(`<a${w}>${md._inline.toHTML(o,b)}</a>`);e=p;return}};const l=m=>{let n=e;while(n<a.length&&a[n]===m)n++;const o=Math.min(n-e,3);const p=m.repeat(o);const q=h(a,n,p);if(q<0){g(c(a.slice(e,n)));e=n;return}const r=a.slice(n,q);if(o===3){g(`<strong><em>${md._inline.toHTML(r,b)}</em></strong>`);e=q+3;return}if(o===2){g(`<strong>${md._inline.toHTML(r,b)}</strong>`);e=q+2;return}g(`<em>${md._inline.toHTML(r,b)}</em>`);e=q+1};const m=()=>{const n=h(a,e+2,"~~");if(n<0){g(c(a.slice(e,e+2)));e+=2;return}const o=a.slice(e+2,n);g(`<del>${md._inline.toHTML(o,b)}</del>`);e=n+2};const n=()=>{const o=h(a,e+2,"]");if(o<0){g(c(a[e]));e++;return}const p=a.slice(e+2,o);if(b.footDefs.has(p)&&!b.usedFoot.has(p)){b.usedFoot.add(p);b.footOrder.push(p)}const q=b.footOrder.indexOf(p)+1;g(`<sup><a href="#fn-${md._util.esc(p)}" id="fnref-${md._util.esc(p)}">${q||""}</a></sup>`);e=o+1};while(e<a.length){const o=a[e];if(o==='`'){i();continue}if(o==='!'&&a[e+1]==='['){k(true);continue}if(o==='['){if(a[e+1]==='^'){n();continue}k(false);continue}if(o==='*'||o==='_'){l(o);continue}if(o==='~'&&a[e+1]==='~'){m();continue}if(o==='\n'){f+="\n";e++;continue}f+=c(o);e++}f=d.hardBreaks(f);f=d.normalizeSoft(f);return f}},_render:{toHTML(a,b){let c="";const d=md._util.esc;for(const e of a){if(e.type==="heading"){c+=`<h${e.depth}>${md._inline.toHTML(e.text,b)}</h${e.depth}>\n`;continue}if(e.type==="paragraph"){c+=`<p>${md._inline.toHTML(e.text,b)}</p>\n`;continue}if(e.type==="hr"){c+=`<hr>\n`;continue}if(e.type==="code"){const f=e.lang?` class="language-${d(e.lang)}"`:"";c+=`<pre><code${f}>${d(e.code)}</code></pre>\n`;continue}if(e.type==="blockquote"){c+=`<blockquote>\n${this.toHTML(e.children,b)}</blockquote>\n`;continue}if(e.type==="list"){const f=e.ordered?"ol":"ul";const g=e.ordered&&e.start&&e.start!==1?` start="${e.start}"`:"";c+=`<${f}${g}>\n`;for(const h of e.items){let i=this.toHTML(h.children,b);if(h.task){const j=h.checked?` checked`:"";if(/^<p>/.test(i))i=i.replace(/^<p>/,`<p><input type="checkbox" disabled${j}> `);else i=`<input type="checkbox" disabled${j}> `+i}c+=`<li>${i}</li>\n`}c+=`</${f}>\n`;continue}if(e.type==="table"){const f=e.header.map((g,h)=>`<th${e.align[h]?` align="${e.align[h]}"`:""}>${md._inline.toHTML(g,b)}</th>`).join("");let g="";for(const h of e.rows){const i=h.map((j,k)=>`<td${e.align[k]?` align="${e.align[k]}"`:""}>${md._inline.toHTML(j,b)}</td>`).join("");g+=`<tr>\n${i}</tr>\n`}c+=`<table>\n<thead>\n<tr>\n${f}</tr>\n</thead>\n${g?`<tbody>\n${g}</tbody>\n`:""}</table>\n`;continue}}if(b.footOrder.length){c+=`<section class="footnotes">\n<ol>\n`;for(const e of b.footOrder){const f=md._inline.toHTML(b.footDefs.get(e)||"",b);const g=d(e);c+=`<li id="fn-${g}">${f} <a href="#fnref-${g}" aria-label="Back to content">↩</a></li>\n`}c+=`</ol>\n</section>\n`}return c}}};
export default md;


/*
  SIMPLE MARKDOWN PARSER  
  SUPPORTS:
    - Headings (# H1 ... ###### H6)
    - Bold (**text** / __text__)
    - Italic (*text* / _text_)
    - Bold + Italic (***text***)
    - Strikethrough (~~text~~)
    - Inline code (`code`)
    - Code blocks (```lang ... ```)
    - Horizontal rules (--- *** ___)
    - Blockquotes (> text, zagnieżdżone też)
    - Ordered lists (1. 2. 3.)
    - Unordered lists (- * +)
    - Task lists (- [x] / - [ ])
    - Links [text](url "title")
    - Images ![alt](url "title")
    - Tables | col1 | col2 | z wyrównaniem
    - Footnotes [^id] i definicje [^id]: opis

  Configuration options when calling md.parse(src, opts):

  - allowHTML (bool, default false)  
    Whether to allow raw HTML from Markdown → HTML. For security reasons, it is better to leave it as false.

  - linkTargetBlank (bool, default true)  
    Whether <a> links should open in a new tab (target="_blank").

  - linkRel (string, default "nofollow noopener noreferrer")  
    The value of the rel attribute added to <a>. Can be changed according to SEO/security requirements.

  - allowImageDataURI (bool, default false)  
    Whether to allow embedding images with data:image/... base64. By default blocked for security.

  - returnAST (bool, default true)  
    If true → md.parse returns { html, ast }.  
    If false → md.parse returns only { html }.

  Example usage:
    const { html } = md.parse(markdown, { linkTargetBlank: false, returnAST: false });
*/
