'use strict';
const express = require('express');
const path    = require('path');
const fs      = require('fs');
const { marked } = require('marked');

const router = express.Router();

const MD_PATH = path.resolve(__dirname, '../../..', 'API.md');

// Rendered page is cached and invalidated by API.md's mtime, so edits to the
// markdown show up without a server restart.
let cache = { mtimeMs: 0, html: '' };

function slugify(text) {
  return text.toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[`*_]/g, '')
    .replace(/[^a-z0-9\s/:.?=-]/g, '')
    .trim()
    .replace(/[\s/:.?=]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function render() {
  const stat = fs.statSync(MD_PATH);
  if (stat.mtimeMs === cache.mtimeMs && cache.html) return cache.html;

  const md  = fs.readFileSync(MD_PATH, 'utf8');
  const toc = [];

  const renderer = new marked.Renderer();
  renderer.heading = ({ tokens, depth }) => {
    const text = tokens.map(t => t.raw).join('');
    const inline = marked.parseInline(text);
    const id = slugify(text);
    if (depth === 2 || depth === 3) toc.push({ depth, id, text });
    return `<h${depth} id="${id}"><a class="hlink" href="#${id}">${inline}</a></h${depth}>\n`;
  };

  const body = marked.parse(md, { renderer });

  const nav = toc.map(h =>
    `<a class="toc${h.depth === 3 ? ' toc3' : ''}" href="#${h.id}">${marked.parseInline(h.text)}</a>`
  ).join('\n');

  cache = { mtimeMs: stat.mtimeMs, html: page(body, nav) };
  return cache.html;
}

function page(body, nav) {
  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>API Reference — ProjectPlan</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300..700&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/shared.css">
<script src="/js/theme.js"></script>
<style>
.docwrap{display:grid;grid-template-columns:240px minmax(0,1fr);gap:var(--s8);max-width:1200px;margin-inline:auto;padding:var(--s8) var(--s6);width:100%}
.docnav{position:sticky;top:76px;align-self:start;max-height:calc(100dvh - 100px);overflow-y:auto;overflow-x:hidden;padding-right:var(--s3);font-size:var(--xs)}
.docnav .toc{word-break:break-word}
.docnav .toc{display:block;padding:var(--s1) var(--s3);color:var(--txtm);text-decoration:none;border-left:2px solid var(--div);transition:color var(--tr),border-color var(--tr)}
.docnav .toc:hover{color:var(--pri);border-color:var(--pri)}
.docnav .toc3{padding-left:var(--s5)}
.doc{min-width:0}
.doc h1{font-family:var(--fd);font-style:italic;font-size:var(--xl);color:var(--pri);margin-bottom:var(--s4)}
.doc h2{font-family:var(--fd);font-style:italic;font-size:var(--lg);margin:var(--s10) 0 var(--s3);padding-bottom:var(--s2);border-bottom:1px solid var(--div)}
.doc h3{font-size:var(--bs);font-weight:600;margin:var(--s8) 0 var(--s2)}
.doc h1 .hlink,.doc h2 .hlink,.doc h3 .hlink{color:inherit;text-decoration:none}
.doc h2 .hlink:hover::after,.doc h3 .hlink:hover::after{content:' #';color:var(--txtf)}
.doc p,.doc ul,.doc ol{margin-bottom:var(--s3);font-size:var(--sm)}
.doc ul,.doc ol{padding-left:var(--s6)}
.doc li{margin-bottom:var(--s1)}
.doc a{color:var(--blu)}
.doc code{font-family:ui-monospace,'Cascadia Code',Menlo,Consolas,monospace;font-size:.85em;background:var(--surfoff);border:1px solid var(--div);border-radius:var(--rsm);padding:1px var(--s1)}
.doc pre{background:var(--surfoff);border:1px solid var(--bdr);border-radius:var(--rmd);padding:var(--s4);margin-bottom:var(--s4);overflow-x:auto}
.doc pre code{background:none;border:none;padding:0;font-size:var(--xs)}
.doc .tblwrap{overflow-x:auto;margin-bottom:var(--s4)}
.doc table{border-collapse:collapse;width:100%;font-size:var(--sm)}
.doc th,.doc td{text-align:left;padding:var(--s2) var(--s3);border-bottom:1px solid var(--div)}
.doc th{font-size:var(--xs);text-transform:uppercase;letter-spacing:.05em;color:var(--txtm);border-bottom:1px solid var(--bdr)}
.doc td code{white-space:nowrap}
@media (max-width:860px){.docwrap{grid-template-columns:1fr}.docnav{display:none}}
</style>
</head>
<body>
<div class="shell">
<header class="topbar">
  <div class="tbl">
    <a href="/dashboard.html" class="logo">
      <span class="logotext">ProjectPlan</span>
    </a>
    <span class="badge b-done">API Reference</span>
  </div>
  <div class="tbr">
    <button class="tbtn" id="themeBtn" aria-label="Toggle theme"></button>
  </div>
</header>
<div class="docwrap">
  <nav class="docnav">
${nav}
  </nav>
  <main class="doc">
${body}
  </main>
</div>
</div>
<script>
// Markdown tables need their own horizontal scroll container on small screens.
document.querySelectorAll('.doc table').forEach(function (t) {
  var w = document.createElement('div');
  w.className = 'tblwrap';
  t.parentNode.insertBefore(w, t);
  w.appendChild(t);
});
</script>
</body>
</html>`;
}

// GET /api/docs — human-readable API reference rendered from API.md
router.get('/', (req, res) => {
  try {
    res.type('html').send(render());
  } catch (err) {
    console.error('Failed to render API docs:', err);
    res.status(500).json({ error: 'API.md could not be rendered' });
  }
});

module.exports = router;
