const API_BASE = "https://api.inaturalist.org/v1";
const PROJECT_SLUG = "fungi-of-hokkaido";
const LOCAL_SPECIES_PATH = "./local-species.json";
const LOCAL_CACHE_KEY = "hokkaido-fungi-species-cache-v1";
const SPECIES_PER_PAGE = 200;
const PHOTO_LIMIT = 12;
const OBS_PER_PAGE = 200;
const MAX_OBS_PAGES = 3;

const DEFAULT_BOUNDS = { minLon: 139.2, maxLon: 146.4, minLat: 41.2, maxLat: 45.9 };
const MAP_CANVAS = { x: 20, y: 20, width: 560, height: 320 };

const state = {
  projectId: null,
  species: [],
  currentMode: "jp", // jp: 和名表示(五十音順) / scientific: 学名表示(アルファベット順)
  selectedTaxonId: null,
  mapBounds: { ...DEFAULT_BOUNDS },
  mapProjection: computeMapProjection(DEFAULT_BOUNDS),
};

const dom = {
  statusBar: document.getElementById("statusBar"),
  speciesList: document.getElementById("speciesList"),
  listTitle: document.getElementById("listTitle"),
  detailCard: document.getElementById("detailCard"),
  detailJaName: document.getElementById("detailJaName"),
  detailSciName: document.getElementById("detailSciName"),
  photoGrid: document.getElementById("photoGrid"),
  metaGenus: document.getElementById("metaGenus"),
  metaFamily: document.getElementById("metaFamily"),
  metaObsCount: document.getElementById("metaObsCount"),
  metaUpdated: document.getElementById("metaUpdated"),
  distributionSummary: document.getElementById("distributionSummary"),
  distributionLayer: document.getElementById("distributionLayer"),
  hokkaidoOutline: document.getElementById("hokkaidoOutline"),
  jpModeBtn: document.getElementById("jpSortBtn"),
  scientificModeBtn: document.getElementById("scientificSortBtn"),
  homeBtn: document.getElementById("homeBtn"),
};

initialize().catch((error) => {
  console.error(error);
  setStatus("データ取得に失敗しました。時間をおいて再読み込みしてください。");
});

async function initialize() {
  wireEvents();

  const localSpecies = await loadLocalSpecies();
  if (localSpecies.length > 0) {
    state.species = localSpecies;
    renderSpeciesList();
    setStatus(`ローカル保存済みの ${localSpecies.length} 種を表示中。最新データを確認します...`);
  }

  try {
    setStatus("iNaturalist プロジェクト情報を取得しています...");
    state.projectId = await fetchProjectIdBySlug(PROJECT_SLUG);

    setStatus("北海道の菌類種一覧を取得しています...");
    const remoteSpecies = await fetchAllSpecies(state.projectId);
    if (remoteSpecies.length > 0) {
      state.species = remoteSpecies;
      saveSpeciesCache(remoteSpecies);
    }
  } catch (error) {
    console.warn("オンライン取得に失敗したためローカル一覧を使用します", error);
  }

  if (state.species.length === 0) {
    setStatus("一覧を取得できませんでした。ローカル種名データを確認してください。");
    return;
  }

  setStatus("北海道境界データを取得しています...");
  await loadHokkaidoOutlineFromINat();

  updateToggleState();
  renderSpeciesList();
  setStatus(`${state.species.length}種を取得しました。左側の一覧から選択してください。`);
}

async function loadLocalSpecies() {
  const cached = loadSpeciesCache();
  if (cached.length > 0) return cached;

  try {
    const response = await fetchWithTimeout(LOCAL_SPECIES_PATH, {}, 3000);
    if (!response.ok) return [];
    const data = await response.json();
    const species = normalizeSpeciesArray(data?.species || []);
    if (species.length > 0) saveSpeciesCache(species);
    return species;
  } catch (error) {
    console.warn("local-species.json の読込に失敗", error);
    return [];
  }
}

function loadSpeciesCache() {
  try {
    const raw = localStorage.getItem(LOCAL_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return normalizeSpeciesArray(parsed?.species || []);
  } catch {
    return [];
  }
}

function saveSpeciesCache(species) {
  try {
    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), species }));
  } catch {
    // ignore
  }
}

function normalizeSpeciesArray(arr) {
  return arr
    .filter((taxon) => taxon?.id && taxon?.name)
    .map((taxon) => ({
      ...taxon,
      japaneseName: japaneseNameOrFallback(taxon.preferred_common_name),
      count: taxon.count || 0,
    }));
}

function wireEvents() {
  dom.jpModeBtn.addEventListener("click", () => {
    state.currentMode = "jp";
    updateToggleState();
    renderSpeciesList();
  });

  dom.scientificModeBtn.addEventListener("click", () => {
    state.currentMode = "scientific";
    updateToggleState();
    renderSpeciesList();
  });

  dom.homeBtn.addEventListener("click", () => {
    state.selectedTaxonId = null;
    dom.detailCard.classList.add("hidden");
    dom.distributionLayer.innerHTML = "";
    renderSpeciesList();
    setStatus(`${state.species.length}種を取得しました。左側の一覧から選択してください。`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

function updateToggleState() {
  dom.jpModeBtn.classList.toggle("active", state.currentMode === "jp");
  dom.scientificModeBtn.classList.toggle("active", state.currentMode === "scientific");
}

function renderSpeciesList() {
  dom.speciesList.innerHTML = "";

  const inJpMode = state.currentMode === "jp";
  dom.listTitle.textContent = inJpMode ? "和名順（五十音）" : "学名順（アルファベット）";

  const sorted = [...state.species].sort((a, b) => {
    if (inJpMode) {
      return a.japaneseName.localeCompare(b.japaneseName, "ja");
    }

    const aSci = (a.name || "").toLocaleLowerCase("en");
    const bSci = (b.name || "").toLocaleLowerCase("en");
    return aSci.localeCompare(bSci, "en");
  });

  for (const taxon of sorted) {
    dom.speciesList.appendChild(createListButton(taxon));
  }
}

function createListButton(taxon) {
  const button = document.createElement("button");
  button.className = "list-item";
  button.type = "button";

  const inJpMode = state.currentMode === "jp";
  const primary = inJpMode ? taxon.japaneseName : taxon.name;
  const secondary = inJpMode ? taxon.name : taxon.japaneseName;

  button.textContent = primary;

  const sub = document.createElement("small");
  sub.textContent = secondary;
  button.appendChild(sub);

  if (state.selectedTaxonId === taxon.id) {
    button.classList.add("selected");
  }

  button.addEventListener("click", () => {
    selectTaxon(taxon).catch((error) => {
      console.error(error);
      setStatus("観察データの取得に失敗しました。");
    });
  });

  return button;
}

async function selectTaxon(taxon) {
  state.selectedTaxonId = taxon.id;
  renderSpeciesList();

  dom.detailCard.classList.remove("hidden");
  dom.detailJaName.textContent = taxon.japaneseName;
  dom.detailSciName.textContent = taxon.name;
  dom.metaGenus.textContent = extractGenus(taxon.name);
  dom.metaFamily.textContent = await familyNameFromTaxon(taxon.id);
  dom.metaObsCount.textContent = String(taxon.count || "-");
  dom.metaUpdated.textContent = new Date().toLocaleDateString("ja-JP");
  dom.photoGrid.innerHTML = "<p>観察記録を読み込み中...</p>";
  dom.distributionSummary.textContent = "分布ポイントを読み込み中...";
  dom.distributionLayer.innerHTML = "";

  setStatus(`「${taxon.japaneseName}」の観察記録を取得しています...`);

  const observations = state.projectId ? await fetchObservationsForTaxon(taxon.id) : [];
  renderPhotos(observations);
  renderDistribution(observations);

  if (!state.projectId) {
    dom.distributionSummary.textContent = "ローカル表示中のため分布ポイント取得はスキップしました。";
    setStatus("ローカル種名一覧を表示中です。ネットワーク復帰後に観察データを取得します。");
    return;
  }

  setStatus(`観察記録 ${observations.length} 件を表示しています。`);
}

function renderPhotos(observations) {
  dom.photoGrid.innerHTML = "";
  const photoUrls = observations
    .flatMap((obs) => obs.photos || [])
    .map((photo) => photo.url?.replace("square", "medium"))
    .filter(Boolean)
    .slice(0, PHOTO_LIMIT);

  if (photoUrls.length === 0) {
    dom.photoGrid.innerHTML = "<p>写真付き観察が見つかりませんでした（ローカル表示モード）。</p>";
    return;
  }

  for (const url of photoUrls) {
    const img = document.createElement("img");
    img.src = url;
    img.alt = "iNaturalist observation photo";
    img.loading = "lazy";
    dom.photoGrid.appendChild(img);
  }
}

function renderDistribution(observations) {
  dom.distributionLayer.innerHTML = "";

  const projectedPoints = observations
    .map((obs) => obs.geojson?.coordinates)
    .filter((coords) => Array.isArray(coords) && coords.length === 2)
    .map(([lon, lat]) => projectLonLatToMap(lon, lat, state.mapProjection))
    .filter(Boolean);

  if (projectedPoints.length === 0) {
    dom.distributionSummary.textContent = "座標付き観察が見つかりませんでした。";
    return;
  }

  const grid = new Map();
  const cellSize = 5;

  for (const p of projectedPoints) {
    const gx = Math.round(p.x / cellSize);
    const gy = Math.round(p.y / cellSize);
    const key = `${gx},${gy}`;
    const existing = grid.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      grid.set(key, { x: gx * cellSize, y: gy * cellSize, count: 1 });
    }
  }

  const cells = [...grid.values()];
  const maxCount = Math.max(...cells.map((c) => c.count));

  for (const cell of cells) {
    const intensity = cell.count / maxCount;
    const radius = 7 + Math.sqrt(cell.count) * 2.2;

    const halo = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    halo.setAttribute("cx", String(cell.x));
    halo.setAttribute("cy", String(cell.y));
    halo.setAttribute("r", radius.toFixed(2));
    halo.setAttribute("fill", "#55ff88");
    halo.setAttribute("fill-opacity", String(0.08 + intensity * 0.22));
    dom.distributionLayer.appendChild(halo);

    const core = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    core.setAttribute("cx", String(cell.x));
    core.setAttribute("cy", String(cell.y));
    core.setAttribute("r", String(1.8 + intensity * 2.6));
    core.setAttribute("fill", "#b6ffcf");
    core.setAttribute("fill-opacity", String(0.7 + intensity * 0.25));
    dom.distributionLayer.appendChild(core);
  }

  dom.distributionSummary.textContent = `座標付き観察 ${projectedPoints.length}件（表示点 ${cells.length}）`;
}

async function loadHokkaidoOutlineFromINat() {
  try {
    const geometry = await fetchHokkaidoGeometryFromINat();
    if (!geometry) return;

    const polygon = chooseLargestPolygon(geometry);
    if (!polygon || polygon.length < 3) return;

    const bounds = boundsFromCoordinates(polygon);
    state.mapBounds = expandBounds(bounds, 0.08);
    const referenceLat = (bounds.minLat + bounds.maxLat) / 2;
    state.mapProjection = computeMapProjection(state.mapBounds, referenceLat);

    const path = buildSvgPathFromLonLat(polygon, state.mapProjection);
    if (path) {
      dom.hokkaidoOutline.setAttribute("d", path);
    }
  } catch (error) {
    console.warn("北海道境界の取得に失敗したため既定形状を使用します", error);
  }
}

async function fetchHokkaidoGeometryFromINat() {
  const candidates = [];
  for (const query of ["北海道", "Hokkaido"]) {
    const autocompleteUrl = new URL(`${API_BASE}/places/autocomplete`);
    autocompleteUrl.searchParams.set("q", query);
    autocompleteUrl.searchParams.set("locale", "ja");

    const autocompleteRes = await fetchWithTimeout(autocompleteUrl, {}, 8000);
    if (!autocompleteRes.ok) continue;

    const autocompleteData = await autocompleteRes.json();
    candidates.push(...(autocompleteData.results || []));
  }

  if (candidates.length === 0) return null;

  const preferred =
    candidates.find((c) => /北海道/.test(c.display_name || c.name || "")) ||
    candidates.find((c) => /Hokkaido/i.test(c.display_name || c.name || "")) ||
    candidates[0];

  const placeUrl = new URL(`${API_BASE}/places/${preferred.id}`);
  placeUrl.searchParams.set("locale", "ja");

  const placeRes = await fetchWithTimeout(placeUrl, {}, 8000);
  if (!placeRes.ok) return null;

  const placeData = await placeRes.json();
  return placeData?.results?.[0]?.geometry_geojson || null;
}

function chooseLargestPolygon(geometry) {
  if (!geometry) return null;

  if (geometry.type === "Polygon") {
    return geometry.coordinates?.[0] || null;
  }

  if (geometry.type === "MultiPolygon") {
    const polygons = geometry.coordinates || [];
    let best = null;
    let bestArea = -Infinity;

    for (const poly of polygons) {
      const ring = poly?.[0];
      if (!ring || ring.length < 3) continue;
      const area = Math.abs(signedArea(ring));
      if (area > bestArea) {
        bestArea = area;
        best = ring;
      }
    }
    return best;
  }

  return null;
}

function signedArea(coords) {
  let sum = 0;
  for (let i = 0; i < coords.length; i += 1) {
    const [x1, y1] = coords[i];
    const [x2, y2] = coords[(i + 1) % coords.length];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

function boundsFromCoordinates(coords) {
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  for (const [lon, lat] of coords) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  return { minLon, maxLon, minLat, maxLat };
}

function expandBounds(bounds, ratio) {
  const lonPad = (bounds.maxLon - bounds.minLon) * ratio;
  const latPad = (bounds.maxLat - bounds.minLat) * ratio;
  return {
    minLon: bounds.minLon - lonPad,
    maxLon: bounds.maxLon + lonPad,
    minLat: bounds.minLat - latPad,
    maxLat: bounds.maxLat + latPad,
  };
}

function buildSvgPathFromLonLat(coords, projection) {
  const points = coords
    .map(([lon, lat]) => projectLonLatToMap(lon, lat, projection))
    .filter(Boolean);

  if (points.length < 3) return null;

  const [first, ...rest] = points;
  const segments = [`M${first.x.toFixed(2)} ${first.y.toFixed(2)}`];
  for (const p of rest) {
    segments.push(`L${p.x.toFixed(2)} ${p.y.toFixed(2)}`);
  }
  segments.push("Z");
  return segments.join(" ");
}

function computeMapProjection(bounds, referenceLat = (bounds.minLat + bounds.maxLat) / 2) {
  const refLatRad = (referenceLat * Math.PI) / 180;
  const minX = lonToProjectedX(bounds.minLon, refLatRad);
  const maxX = lonToProjectedX(bounds.maxLon, refLatRad);
  const xRange = maxX - minX;
  const latRange = bounds.maxLat - bounds.minLat;

  if (xRange <= 0 || latRange <= 0) {
    return {
      ...bounds,
      referenceLat,
      refLatRad,
      scale: 1,
      offsetX: MAP_CANVAS.x,
      offsetY: MAP_CANVAS.y,
      minX,
      maxX,
    };
  }

  const scaleX = MAP_CANVAS.width / xRange;
  const scaleY = MAP_CANVAS.height / latRange;
  const scale = Math.min(scaleX, scaleY);

  const drawWidth = xRange * scale;
  const drawHeight = latRange * scale;
  const offsetX = MAP_CANVAS.x + (MAP_CANVAS.width - drawWidth) / 2;
  const offsetY = MAP_CANVAS.y + (MAP_CANVAS.height - drawHeight) / 2;

  return {
    ...bounds,
    referenceLat,
    refLatRad,
    minX,
    maxX,
    scale,
    offsetX,
    offsetY,
  };
}

function lonToProjectedX(lon, refLatRad) {
  return lon * Math.cos(refLatRad);
}

function projectLonLatToMap(lon, lat, projection) {
  const xRange = projection.maxX - projection.minX;
  const latRange = projection.maxLat - projection.minLat;
  if (xRange <= 0 || latRange <= 0) return null;

  const projectedX = lonToProjectedX(lon, projection.refLatRad);
  const x = projection.offsetX + (projectedX - projection.minX) * projection.scale;
  const y = projection.offsetY + (projection.maxLat - lat) * projection.scale;

  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchProjectIdBySlug(slug) {
  const url = new URL(`${API_BASE}/projects/${slug}`);
  url.searchParams.set("locale", "ja");

  const response = await fetchWithTimeout(url, {}, 10000);
  if (!response.ok) throw new Error("Failed to fetch project");

  const data = await response.json();
  const id = data?.results?.[0]?.id;
  if (!id) throw new Error("Project ID not found");

  return id;
}

async function fetchAllSpecies(projectId) {
  const firstPage = await fetchSpeciesPage(projectId, 1);
  const all = [...firstPage.results];
  const total = firstPage.total_results || all.length;
  const pages = Math.ceil(total / SPECIES_PER_PAGE);

  for (let page = 2; page <= pages; page += 1) {
    const nextPage = await fetchSpeciesPage(projectId, page);
    all.push(...nextPage.results);
  }

  const normalized = all
    .map((entry) => ({ ...entry.taxon, count: entry.count }))
    .filter((taxon) => taxon?.rank === "species");

  return normalizeSpeciesArray(normalized);
}

async function fetchSpeciesPage(projectId, page) {
  const url = new URL(`${API_BASE}/observations/species_counts`);
  url.searchParams.set("project_id", String(projectId));
  url.searchParams.set("verifiable", "true");
  url.searchParams.set("per_page", String(SPECIES_PER_PAGE));
  url.searchParams.set("page", String(page));
  url.searchParams.set("locale", "ja");

  const response = await fetchWithTimeout(url, {}, 12000);
  if (!response.ok) throw new Error(`Failed to fetch species page ${page}`);

  return response.json();
}

async function fetchObservationsForTaxon(taxonId) {
  const all = [];

  for (let page = 1; page <= MAX_OBS_PAGES; page += 1) {
    const url = new URL(`${API_BASE}/observations`);
    url.searchParams.set("project_id", String(state.projectId));
    url.searchParams.set("taxon_id", String(taxonId));
    url.searchParams.set("photos", "true");
    url.searchParams.set("per_page", String(OBS_PER_PAGE));
    url.searchParams.set("page", String(page));
    url.searchParams.set("order_by", "created_at");
    url.searchParams.set("order", "desc");
    url.searchParams.set("locale", "ja");

    const response = await fetchWithTimeout(url, {}, 12000);
    if (!response.ok) throw new Error("Failed to fetch observations");

    const data = await response.json();
    const results = data.results || [];
    all.push(...results);

    if (results.length < OBS_PER_PAGE) break;
  }

  return all;
}

async function familyNameFromTaxon(taxonId) {
  const url = new URL(`${API_BASE}/taxa/${taxonId}`);
  url.searchParams.set("locale", "ja");

  const response = await fetchWithTimeout(url, {}, 10000);
  if (!response.ok) return "-";

  const data = await response.json();
  const ancestors = data?.results?.[0]?.ancestors || [];
  const family = ancestors.find((node) => node.rank === "family");
  return family?.name || "-";
}

function japaneseNameOrFallback(name) {
  if (!name) return "和名未登録";
  return isLikelyJapanese(name) ? name : "和名未登録";
}

function isLikelyJapanese(text) {
  return /[\u3040-\u309F\u30A0-\u30FF\u3400-\u9FFF]/.test(text);
}

function extractGenus(scientificName) {
  return (scientificName || "").split(" ")[0] || "Unknown";
}

function setStatus(message) {
  dom.statusBar.textContent = message;
}
