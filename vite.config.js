import { defineConfig } from 'vite';
import { profile, stops } from './src/content.js';
import { renderClassic, icons, batLogo, esc } from './src/ui/templates.js';

// Pre-renders the classic (plain HTML) view, icons and structured data into index.html,
// so crawlers, screen readers and no-WebGL visitors get the full portfolio without running the 3D app.
function portfolioHtml() {
  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: profile.name,
    jobTitle: profile.role,
    url: profile.site,
    email: `mailto:${profile.email}`,
    image: `${profile.site}${profile.avatar}`,
    address: { '@type': 'PostalAddress', addressLocality: 'Chicago', addressRegion: 'IL', addressCountry: 'US' },
    alumniOf: [
      { '@type': 'CollegeOrUniversity', name: 'Lahore University of Management Sciences' },
      { '@type': 'CollegeOrUniversity', name: 'University of Illinois Chicago' },
    ],
    award: 'Fulbright Master’s Scholarship (2026)',
    sameAs: [profile.links.linkedin, profile.links.github],
  };
  return {
    name: 'portfolio-html',
    transformIndexHtml(html) {
      return html
        .replace('<!--CLASSIC-->', renderClassic(profile, stops))
        .replace('<!--JSONLD-->', `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>`)
        .replace(/\{\{icon:(\w+)\}\}/g, (_, n) => icons[n] || '')
        .replace(/\{\{bat\}\}/g, batLogo())
        .replace(/\{\{(name|headline|tagline|motto|email)\}\}/g, (_, k) => esc(profile[k]))
        .replace(/\{\{link:(\w+)\}\}/g, (_, k) => esc(profile.links[k]));
    },
  };
}

export default defineConfig({
  base: '/',
  plugins: [portfolioHtml()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1500,
  },
  server: { host: true },
});
