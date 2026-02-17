#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';

const API_BASE = 'https://api.inaturalist.org/v1';
const PROJECT_SLUG = 'fungi-of-hokkaido';
const PER_PAGE = 200;

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}: ${url}`);
  }
  return res.json();
}

function buildUrl(path, params) {
  const url = new URL(`${API_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }
  return url.toString();
}

function normalizeSpecies(results) {
  return results
    .map((entry) => ({ ...entry.taxon, count: entry.count }))
    .filter((taxon) => taxon?.rank === 'species')
    .map((taxon) => ({
      id: taxon.id,
      name: taxon.name || '',
      preferred_common_name: taxon.preferred_common_name || '',
      count: taxon.count || 0,
      default_photo: taxon.default_photo?.medium_url || taxon.default_photo?.url || '',
      wikipedia_url: taxon.wikipedia_url || ''
    }));
}

const project = await getJson(buildUrl(`/projects/${PROJECT_SLUG}`, { locale: 'ja' }));
const projectId = project?.results?.[0]?.id;
if (!projectId) throw new Error('Project ID not found');

const first = await getJson(buildUrl('/observations/species_counts', {
  project_id: projectId,
  verifiable: true,
  per_page: PER_PAGE,
  page: 1,
  locale: 'ja'
}));

const total = first.total_results || 0;
const pages = Math.ceil(total / PER_PAGE);
const combined = [...(first.results || [])];

for (let page = 2; page <= pages; page += 1) {
  const next = await getJson(buildUrl('/observations/species_counts', {
    project_id: projectId,
    verifiable: true,
    per_page: PER_PAGE,
    page,
    locale: 'ja'
  }));
  combined.push(...(next.results || []));
}

const species = normalizeSpecies(combined).sort((a, b) => a.name.localeCompare(b.name, 'en'));

const output = {
  project_slug: PROJECT_SLUG,
  project_id: projectId,
  generated_at: new Date().toISOString(),
  species
};

await writeFile('local-species.json', `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(`Wrote ${species.length} species to local-species.json`);
