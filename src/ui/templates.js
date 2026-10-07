// Pure string templates (no DOM access) so they run both in the browser and in
// vite.config.js, which pre-renders the classic view into index.html for SEO / no-JS.

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

// Tiny inline markup: **bold** and *italic*.
export const md = (s = '') =>
  esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');

const opensNewTab = (href) => /^https?:/.test(href) || /\.pdf$/.test(href);
const linkAttrs = (href) => `href="${esc(href)}"${opensNewTab(href) ? ' target="_blank" rel="noopener"' : ''}`;

const svg = (body, vb = '0 0 24 24') =>
  `<svg class="i" viewBox="${vb}" aria-hidden="true" focusable="false">${body}</svg>`;

export const icons = {
  mail: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>'),
  doc: svg('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>'),
  linkedin: svg('<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 10v7M8 7v.01M12 17v-4a2 2 0 0 1 4 0v4M12 10v7"/>'),
  github: svg('<path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21"/>'),
  code: svg('<path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 4l-4 16"/>'),
  ext: svg('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
  arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  back: svg('<path d="M19 12H5M11 6l-6 6 6 6"/>'),
  close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  moon: svg('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
  map: svg('<path d="m9 4-6 2v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>'),
  route: svg('<circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19H15a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h6.5"/>'),
  sound: svg('<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>'),
  mute: svg('<path d="M11 5 6 9H3v6h3l5 4z"/><path d="m22 9-6 6M16 9l6 6"/>'),
  read: svg('<path d="M4 5h16M4 10h16M4 15h10M4 20h7"/>'),
  help: svg('<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.7-2.5 2-2.5 4M12 17v.01"/>'),
  home: svg('<path d="M4 11.5 12 5l8 6.5"/><path d="M6 10v9h12v-9"/><path d="M10 19v-5h4v5"/>'),
  car: svg('<path d="M3 15l2-5 3-3h8l3 3 2 5v3H3z"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="16.5" cy="17.5" r="1.5"/>'),
  play: svg('<path d="M7 4.5v15l12-7.5z"/>'),
  check: svg('<path d="m5 12 5 5 9-10"/>'),
  pin: svg('<path d="M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/>'),
};

// The bat silhouette, described once for canvas, THREE.Shape and SVG.
// Unit space: x ∈ [-1,1], y down (canvas convention). Right half, mirrored for the left.
export const BAT_HALF = [
  ['M', 0, -0.1],
  ['L', 0.045, -0.13],
  ['L', 0.078, -0.31],
  ['L', 0.105, -0.12],
  ['Q', 0.16, -0.1, 0.22, -0.16],
  ['Q', 0.55, -0.42, 1.0, -0.2],
  ['Q', 0.83, -0.1, 0.86, 0.06],
  ['Q', 0.7, -0.05, 0.6, 0.08],
  ['Q', 0.48, 0.0, 0.4, 0.16],
  ['Q', 0.27, 0.08, 0.17, 0.24],
  ['Q', 0.08, 0.22, 0.0, 0.4],
  ['Z'],
];

export function batSvgPath(scale = 1, cx = 0, cy = 0) {
  const out = [];
  for (const sx of [1, -1]) {
    for (const c of BAT_HALF) {
      const p = (x, y) => `${(cx + x * sx * scale).toFixed(3)} ${(cy + y * scale).toFixed(3)}`;
      if (c[0] === 'M') out.push(`M${p(c[1], c[2])}`);
      else if (c[0] === 'L') out.push(`L${p(c[1], c[2])}`);
      else if (c[0] === 'Q') out.push(`Q${p(c[1], c[2])} ${p(c[3], c[4])}`);
      else out.push('Z');
    }
  }
  return out.join('');
}

export const batLogo = (cls = 'bat') =>
  `<svg class="${cls}" viewBox="-1.05 -0.5 2.1 1" aria-hidden="true" focusable="false"><path d="${batSvgPath(1)}"/></svg>`;

// ---------------------------------------------------------------------------
// Stop bodies (used by the 3D panel and the classic page)

const tagList = (tags) =>
  tags?.length ? `<ul class="tags">${tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : '';

const linkRow = (links) =>
  links?.length
    ? `<div class="links">${links
        .map((l) => `<a class="link" ${linkAttrs(l.href)}>${esc(l.label)} ${icons.ext}</a>`)
        .join('')}</div>`
    : '';

function block(b) {
  switch (b.type) {
    case 'entry':
      return `<article class="entry">
        <header>
          <h3>${esc(b.title)}</h3>
          ${b.org ? `<p class="org">${esc(b.org)}${b.role ? ` · <span>${esc(b.role)}</span>` : ''}</p>` : ''}
          ${b.dates || b.place ? `<p class="when">${[b.dates, b.place].filter(Boolean).map(esc).join(' <span aria-hidden="true">/</span> ')}</p>` : ''}
          ${b.meta ? `<p class="meta">${esc(b.meta)}</p>` : ''}
        </header>
        ${b.bullets?.length ? `<ul class="bullets">${b.bullets.map((x) => `<li>${md(x)}</li>`).join('')}</ul>` : ''}
        ${tagList(b.tags)}
        ${linkRow(b.links)}
      </article>`;
    case 'story':
      return `<section class="story">${b.heading ? `<h3 class="sub">${esc(b.heading)}</h3>` : ''}${b.paragraphs
        .map((p) => `<p>${md(p)}</p>`)
        .join('')}</section>`;
    case 'note':
      return `<aside class="note">${b.heading ? `<h3 class="sub">${esc(b.heading)}</h3>` : ''}<p>${md(b.text)}</p></aside>`;
    case 'list':
      return `<section class="list">${b.heading ? `<h3 class="sub">${esc(b.heading)}</h3>` : ''}<ul>${b.items
        .map(
          (it) => `<li>
            <div class="li-head">${
              it.href ? `<a ${linkAttrs(it.href)}>${esc(it.title)} ${icons.ext}</a>` : `<strong>${esc(it.title)}</strong>`
            }${it.meta ? `<span class="li-meta">${esc(it.meta)}</span>` : ''}</div>
            ${it.desc ? `<p>${md(it.desc)}</p>` : ''}
          </li>`,
        )
        .join('')}</ul></section>`;
    case 'pub':
      return `<section class="pubs">${b.heading ? `<h3 class="sub">${esc(b.heading)}</h3>` : ''}<ol>${b.items
        .map(
          (p) => `<li>
            <p class="pub-title">${p.href ? `<a ${linkAttrs(p.href)}>${esc(p.title)} ${icons.ext}</a>` : esc(p.title)}</p>
            <p class="pub-authors">${md(p.authors)}</p>
            <p class="pub-venue">${esc(p.venue)}</p>
          </li>`,
        )
        .join('')}</ol></section>`;
    case 'chips':
      return `<section class="chipgroups">${b.groups
        .map((g) => `<div class="chipgroup"><h3 class="sub">${esc(g.label)}</h3>${tagList(g.items)}</div>`)
        .join('')}</section>`;
    case 'contact':
      return `<ul class="contact">${b.items
        .map(
          (c) => `<li><a ${linkAttrs(c.href)}>${icons[c.icon] || ''}<span><small>${esc(c.label)}</small>${esc(c.value)}</span>${icons.arrow}</a></li>`,
        )
        .join('')}</ul>`;
    case 'cta':
      return `<div class="cta">${b.links
        .map(
          (l) =>
            `<a class="btn ${l.primary ? 'btn-primary' : 'btn-ghost'}" ${linkAttrs(l.href)}>${icons[l.icon] || ''}<span>${esc(l.label)}</span></a>`,
        )
        .join('')}</div>`;
    default:
      return '';
  }
}

export function renderStats(stop) {
  if (!stop.stats?.length) return '';
  return `<dl class="stats">${stop.stats
    .map((s) => `<div><dt>${esc(s.l)}</dt><dd>${esc(s.v)}</dd></div>`)
    .join('')}</dl>`;
}

export function renderStopBody(stop) {
  return `${renderStats(stop)}${stop.blocks.map(block).join('')}`;
}

// ---------------------------------------------------------------------------
// Classic (single page) view

export function renderClassic(profile, stops) {
  const nav = stops
    .map((s) => `<li><a href="#sec-${s.id}" data-section="${s.id}">${esc(s.label)}</a></li>`)
    .join('');
  const sections = stops
    .map(
      (s, i) => `<section class="c-section" id="sec-${s.id}" style="--stop:${s.color}" aria-labelledby="h-${s.id}">
        <p class="kicker"><span class="num">${String(i + 1).padStart(2, '0')}</span>${esc(s.kicker)}</p>
        <h2 id="h-${s.id}">${esc(s.id === 'hq' ? 'About Me' : s.title)}</h2>
        ${s.lede ? `<p class="lede">${md(s.lede)}</p>` : ''}
        ${renderStopBody(s)}
      </section>`,
    )
    .join('');
  return `<div class="classic-inner">
    <header class="c-top">
      <button class="c-brand js-home" type="button" aria-label="Back to home">${batLogo('bat c-bat')}<span>${esc(profile.name)}</span></button>
      <div class="c-actions">
        <button class="btn btn-ghost js-home" type="button" aria-label="Back to home">${icons.home}<span>Home</span></button>
        <button class="btn btn-ghost js-theme" type="button" aria-label="Toggle day / night">${icons.sun}${icons.moon}<span class="js-theme-label">Theme</span></button>
        <button class="btn btn-primary js-enter-3d" type="button">${icons.car}<span>Explore in 3D</span></button>
      </div>
    </header>
    <div class="c-hero">
      <img src="${esc(profile.avatar)}" alt="Portrait of ${esc(profile.name)}" width="320" height="320" loading="lazy">
      <div>
        <p class="kicker">${esc(profile.location)} · ${esc(profile.motto)}</p>
        <h1>${esc(profile.name)}</h1>
        <p class="c-headline">${esc(profile.headline)}</p>
        <p class="c-tagline">${esc(profile.tagline)}</p>
        <div class="cta">
          <a class="btn btn-primary" ${linkAttrs(profile.resume)}>${icons.doc}<span>Résumé</span></a>
          <a class="btn btn-ghost" ${linkAttrs(profile.cv)}>${icons.doc}<span>Academic CV</span></a>
          <a class="btn btn-ghost" href="mailto:${esc(profile.email)}">${icons.mail}<span>${esc(profile.email)}</span></a>
          <a class="btn btn-ghost" ${linkAttrs(profile.links.linkedin)}>${icons.linkedin}<span>LinkedIn</span></a>
          <a class="btn btn-ghost" ${linkAttrs(profile.links.github)}>${icons.github}<span>GitHub</span></a>
        </div>
      </div>
    </div>
    <nav class="c-nav" aria-label="Sections"><ul>${nav}</ul></nav>
    <main class="c-main">${sections}</main>
    <footer class="c-foot">
      <p>© ${new Date().getFullYear()} ${esc(profile.name)} · Built with Three.js · Chicago by day, Gotham by night.</p>
    </footer>
  </div>`;
}
