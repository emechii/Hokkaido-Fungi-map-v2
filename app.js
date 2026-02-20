const API_BASE = "https://api.inaturalist.org/v1";
const PROJECT_SLUG = "fungi-of-hokkaido";
const LOCAL_SPECIES_PATH = "./local-species.json";
const LOCAL_CACHE_KEY = "hokkaido-fungi-species-cache-v1";
const SPECIES_DB_NAME = "hokkaido-fungi-db";
const SPECIES_STORE = "species";
const SPECIES_DB_VERSION = 1;
const SPECIES_PER_PAGE = 200;
const FEATURED_PHOTO_COUNT = 1;
const THUMBNAIL_GRID_TOTAL = 14;
const OBS_PER_PAGE = 200;
const MAX_OBS_PAGES = 3;
const RECENT_OBS_SLIDES = 5;
const RECENT_OBS_FETCH = 30;
const RECENT_SLIDE_INTERVAL_MS = 4000;

const DEFAULT_BOUNDS = { minLon: 139.2, maxLon: 146.4, minLat: 41.2, maxLat: 45.9 };
const MAP_CANVAS = { x: 20, y: 20, width: 560, height: 320 };

const GOJUON_ORDER = [
  "あ", "い", "う", "え", "お",
  "か", "き", "く", "け", "こ",
  "さ", "し", "す", "せ", "そ",
  "た", "ち", "つ", "て", "と",
  "な", "に", "ぬ", "ね", "の",
  "は", "ひ", "ふ", "へ", "ほ",
  "ま", "み", "む", "め", "も",
  "や", "ゆ", "よ",
  "ら", "り", "る", "れ", "ろ",
  "わ", "を", "ん",
];

const GOJUON_JUMP_GRID = [
  ["わ", "ら", "や", "ま", "は", "な", "た", "さ", "か", "あ"],
  ["", "り", "", "み", "ひ", "に", "ち", "し", "き", "い"],
  ["を", "る", "ゆ", "む", "ふ", "ぬ", "つ", "す", "く", "う"],
  ["", "れ", "", "め", "へ", "ね", "て", "せ", "け", "え"],
  ["ん", "ろ", "よ", "も", "ほ", "の", "と", "そ", "こ", "お"],
];

const GOJUON_NORMALIZE_MAP = {
  "ぁ": "あ", "ぃ": "い", "ぅ": "う", "ぇ": "え", "ぉ": "お",
  "が": "か", "ぎ": "き", "ぐ": "く", "げ": "け", "ご": "こ",
  "ざ": "さ", "じ": "し", "ず": "す", "ぜ": "せ", "ぞ": "そ",
  "だ": "た", "ぢ": "ち", "づ": "つ", "で": "て", "ど": "と",
  "ば": "は", "び": "ひ", "ぶ": "ふ", "べ": "へ", "ぼ": "ほ",
  "ぱ": "は", "ぴ": "ひ", "ぷ": "ふ", "ぺ": "へ", "ぽ": "ほ",
  "ゃ": "や", "ゅ": "ゆ", "ょ": "よ", "ゎ": "わ", "ゔ": "う",
};

const SCIENTIFIC_JUMP_GRID = [
  ["A", "B", "C", "D", "E", "F", "G"],
  ["H", "I", "J", "K", "L", "M", "N"],
  ["O", "P", "Q", "R", "S", "T", "U"],
  ["V", "W", "X", "Y", "Z", "", ""],
];

const EMBEDDED_LOCAL_SPECIES = [
  { id: 47170, name: "Amanita muscaria", preferred_common_name: "ベニテングタケ", count: 12 },
  { id: 121883, name: "Amanita vaginata", preferred_common_name: "ツルタケ", count: 7 },
  { id: 48731, name: "Boletus edulis", preferred_common_name: "ヤマドリタケ", count: 8 },
  { id: 118260, name: "Cantharellus cibarius", preferred_common_name: "アンズタケ", count: 10 },
  { id: 55601, name: "Coprinopsis atramentaria", preferred_common_name: "ヒトヨタケ", count: 6 },
  { id: 48496, name: "Flammulina velutipes", preferred_common_name: "エノキタケ", count: 14 },
  { id: 56813, name: "Hericium erinaceus", preferred_common_name: "ヤマブシタケ", count: 5 },
  { id: 48702, name: "Hypsizygus marmoreus", preferred_common_name: "ブナシメジ", count: 9 },
  { id: 55582, name: "Laccaria amethystina", preferred_common_name: "ムラサキアブラシメジモドキ", count: 4 },
  { id: 49546, name: "Lentinula edodes", preferred_common_name: "シイタケ", count: 8 },
  { id: 124057, name: "Pleurotus ostreatus", preferred_common_name: "ヒラタケ", count: 6 },
  { id: 55693, name: "Trametes versicolor", preferred_common_name: "カワラタケ", count: 7 },
];

const state = {
  projectId: null,
  species: [],
  currentMode: "jp", // jp: 和名表示(五十音順) / scientific: 学名表示(アルファベット順)
  selectedTaxonId: null,
  mapBounds: { ...DEFAULT_BOUNDS },
  mapProjection: computeMapProjection(DEFAULT_BOUNDS),
  listScrollByMode: { jp: 0, scientific: 0 },
  recentSlideshowTimer: null,
};

const dom = {
  speciesList: document.getElementById("speciesList"),
  listTitle: document.getElementById("listTitle"),
  speciesCount: document.getElementById("speciesCount"),
  jumpNav: document.getElementById("jumpNav"),
  content: document.querySelector(".content"),
  recentObsCard: document.getElementById("recentObsCard"),
  recentObsSlideshow: document.getElementById("recentObsSlideshow"),
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
  northernTerritoriesOutline: document.getElementById("northernTerritoriesOutline"),
  jpModeBtn: document.getElementById("jpSortBtn"),
  scientificModeBtn: document.getElementById("scientificSortBtn"),
  homeBtn: document.getElementById("homeBtn"),
  obsLinkBtn: document.getElementById("obsLinkBtn"),
  seasonalityChart: document.getElementById("seasonalityChart"),
};

initialize().catch((error) => {
  console.error(error);
  setStatus("データ取得に失敗しました。時間をおいて再読み込みしてください。");
});

async function initialize() {
  wireEvents();
  dom.detailCard?.classList.add("hidden");
  dom.recentObsCard?.classList.remove("hidden");

  // プレビュー（file://）でも最低限一覧が見えるよう、埋め込み種データを先に描画。
  state.species = normalizeSpeciesArray(EMBEDDED_LOCAL_SPECIES);
  if (state.species.length > 0) {
    renderSpeciesList();
    setStatus(`埋め込みデータから ${state.species.length} 種を表示中...`);
  }

  let loadedFromDb = false;
  const dbSpecies = await loadSpeciesFromIndexedDB();
  if (dbSpecies.length > 0) {
    state.species = dbSpecies;
    loadedFromDb = true;
    renderSpeciesList();
    setStatus(`ローカルDBから ${dbSpecies.length} 種を表示中。最新データを確認します...`);
  }

  const localSpecies = await loadLocalSpecies();
  if (!loadedFromDb && localSpecies.length > 0) {
    state.species = localSpecies;
    renderSpeciesList();
    setStatus(`ローカルデータから ${localSpecies.length} 種を表示中。最新データを確認します...`);
  }

  if (localSpecies.length > 0) {
    await saveSpeciesToIndexedDB(localSpecies);
  }

  try {
    setStatus("iNaturalist プロジェクト情報を取得しています...");
    state.projectId = await fetchProjectIdBySlug(PROJECT_SLUG);

    await loadRecentObservationsSlideshow(state.projectId);

    setStatus("北海道の菌類種一覧を取得しています...");
    const remoteSpecies = await fetchAllSpecies(state.projectId);
    if (remoteSpecies.length > 0) {
      state.species = remoteSpecies;
      saveSpeciesCache(remoteSpecies);
      await saveSpeciesToIndexedDB(remoteSpecies);
    }
  } catch (error) {
    console.warn("オンライン取得に失敗したためローカル一覧を使用します", error);
    await loadRecentObservationsSlideshow(null);
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
    return normalizeSpeciesArray(EMBEDDED_LOCAL_SPECIES);
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


function openSpeciesDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SPECIES_DB_NAME, SPECIES_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SPECIES_STORE)) {
        const store = db.createObjectStore(SPECIES_STORE, { keyPath: "id" });
        store.createIndex("name", "name", { unique: false });
        store.createIndex("preferred_common_name", "preferred_common_name", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function loadSpeciesFromIndexedDB() {
  if (!window.indexedDB) return [];
  try {
    const db = await openSpeciesDb();
    const species = await new Promise((resolve, reject) => {
      const tx = db.transaction(SPECIES_STORE, "readonly");
      const store = tx.objectStore(SPECIES_STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return normalizeSpeciesArray(species);
  } catch (error) {
    console.warn("IndexedDB 読み込み失敗", error);
    return [];
  }
}

async function saveSpeciesToIndexedDB(species) {
  if (!window.indexedDB || species.length === 0) return;
  try {
    const db = await openSpeciesDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(SPECIES_STORE, "readwrite");
      const store = tx.objectStore(SPECIES_STORE);
      store.clear();
      for (const row of species) {
        store.put({
          id: row.id,
          name: row.name,
          preferred_common_name: row.preferred_common_name || row.japaneseName || "",
          count: row.count || 0,
          default_photo: row.default_photo || "",
          wikipedia_url: row.wikipedia_url || "",
        });
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    db.close();
  } catch (error) {
    console.warn("IndexedDB 保存失敗", error);
  }
}

function wireEvents() {
  if (dom.speciesList) {
    dom.speciesList.addEventListener("scroll", () => {
      state.listScrollByMode[state.currentMode] = dom.speciesList.scrollTop;
    });
  }

  if (dom.jpModeBtn && dom.speciesList) {
    dom.jpModeBtn.addEventListener("click", () => {
      state.listScrollByMode[state.currentMode] = dom.speciesList.scrollTop;
      state.currentMode = "jp";
      updateToggleState();
      renderSpeciesList();
    });
  }

  if (dom.scientificModeBtn && dom.speciesList) {
    dom.scientificModeBtn.addEventListener("click", () => {
      state.listScrollByMode[state.currentMode] = dom.speciesList.scrollTop;
      state.currentMode = "scientific";
      updateToggleState();
      renderSpeciesList();
    });
  }

  if (dom.homeBtn) {
    dom.homeBtn.addEventListener("click", () => {
      state.selectedTaxonId = null;
      dom.detailCard?.classList.add("hidden");
      dom.recentObsCard?.classList.remove("hidden");
      if (dom.distributionLayer) dom.distributionLayer.innerHTML = "";
      renderSpeciesList();
      setStatus(`${state.species.length}種を取得しました。左側の一覧から選択してください。`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }
}

function updateToggleState() {
  dom.jpModeBtn?.classList.toggle("active", state.currentMode === "jp");
  dom.scientificModeBtn?.classList.toggle("active", state.currentMode === "scientific");
}

function renderSpeciesList() {
  if (!dom.speciesList || !dom.listTitle) return;
  dom.speciesList.innerHTML = "";

  const inJpMode = state.currentMode === "jp";
  dom.listTitle.textContent = inJpMode ? "和名(五十音)" : "学名(A~Z)";
  updateSpeciesCount();

  const sorted = [...state.species].sort((a, b) => {
    if (inJpMode) {
      return a.japaneseName.localeCompare(b.japaneseName, "ja");
    }

    const aSci = (a.name || "").toLocaleLowerCase("en");
    const bSci = (b.name || "").toLocaleLowerCase("en");
    return aSci.localeCompare(bSci, "en");
  });

  let lastGroup = null;
  for (const taxon of sorted) {
    const groupLabel = inJpMode ? groupByGojuon(taxon.japaneseName) : extractGenus(taxon.name);
    const groupKey = inJpMode ? groupLabel : (groupLabel || "").charAt(0).toUpperCase();
    if (groupLabel !== lastGroup) {
      dom.speciesList.appendChild(createGroupHeading(groupLabel, groupKey));
      lastGroup = groupLabel;
    }
    dom.speciesList.appendChild(createListButton(taxon));
  }

  renderJumpNav(inJpMode);
  requestAnimationFrame(() => {
    dom.speciesList.scrollTop = state.listScrollByMode[state.currentMode] || 0;
  });
}

function createGroupHeading(label, groupKey) {
  const heading = document.createElement("div");
  heading.className = "genus-heading";
  heading.textContent = label;
  heading.dataset.groupKey = groupKey;
  return heading;
}

function renderJumpNav(inJpMode) {
  if (!dom.jumpNav) return;
  dom.jumpNav.innerHTML = "";
  dom.jumpNav.dataset.mode = inJpMode ? "jp" : "scientific";

  const grid = inJpMode ? GOJUON_JUMP_GRID : SCIENTIFIC_JUMP_GRID;
  for (const row of grid) {
    for (const key of row) {
      if (!key) {
        const spacer = document.createElement("span");
        spacer.className = "jump-spacer";
        spacer.setAttribute("aria-hidden", "true");
        dom.jumpNav.appendChild(spacer);
        continue;
      }

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "jump-btn";
      btn.textContent = key;
      btn.addEventListener("click", () => scrollToGroup(key));
      dom.jumpNav.appendChild(btn);
    }
  }
}

function scrollToGroup(key) {
  const target = dom.speciesList.querySelector(`.genus-heading[data-group-key="${key}"]`);
  if (target) {
    target.scrollIntoView({ block: "start", behavior: "smooth" });
  }
}

function groupByGojuon(name) {
  const first = toHiragana((name || "").trim().charAt(0));
  if (!first) return "その他";

  const normalized = normalizeToGojuonKana(first);
  return GOJUON_ORDER.includes(normalized) ? normalized : "その他";
}

function normalizeToGojuonKana(char) {
  return GOJUON_NORMALIZE_MAP[char] || char;
}

function toHiragana(text) {
  return text.replace(/[ァ-ヶ]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60));
}

function createListButton(taxon) {
  const button = document.createElement("button");
  button.className = "list-item";
  button.type = "button";

  const inJpMode = state.currentMode === "jp";
  const primary = inJpMode ? taxon.japaneseName : taxon.name;
  const secondary = inJpMode ? taxon.name : taxon.japaneseName;

  const primaryEl = document.createElement("span");
  primaryEl.className = `primary-name${inJpMode ? "" : " scientific-text"}`;
  primaryEl.textContent = primary;

  const sub = document.createElement("small");
  sub.className = inJpMode ? "scientific-text" : "";
  sub.textContent = secondary;

  button.appendChild(primaryEl);
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
  dom.recentObsCard?.classList.add("hidden");
  dom.detailSciName.textContent = taxon.name;
  dom.detailJaName.textContent = taxon.japaneseName === "和名なし" ? "" : taxon.japaneseName;
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (dom.content) dom.content.scrollTo({ top: 0, behavior: "smooth" });
  dom.metaGenus.textContent = extractGenus(taxon.name);
  dom.metaFamily.textContent = await familyNameFromTaxon(taxon.id);
  dom.metaObsCount.textContent = String(taxon.count || "-");
  dom.metaUpdated.textContent = new Date().toLocaleDateString("ja-JP");
  dom.photoGrid.innerHTML = "<p>観察記録を読み込み中...</p>";
  dom.distributionSummary.textContent = "分布ポイントを読み込み中...";
  dom.distributionLayer.innerHTML = "";
  renderSeasonality(Array(12).fill(0));

  const observations = state.projectId ? await fetchObservationsForTaxon(taxon.id) : [];
  renderPhotos(taxon, observations);
  renderDistribution(observations);
  const monthlyCounts = state.projectId ? await fetchMonthlySeasonality(taxon.id) : countsFromObservations(observations);
  renderSeasonality(monthlyCounts);

  if (!state.projectId) {
    dom.distributionSummary.textContent = "ローカル表示中のため分布ポイント取得はスキップしました。";
    return;
  }

}

function renderPhotos(taxon, observations) {
  dom.photoGrid.innerHTML = "";
  dom.obsLinkBtn.classList.add("hidden");
  dom.obsLinkBtn.removeAttribute("href");

  const photoItems = observations
    .flatMap((obs) => {
      const obsUrl = obs.uri || (obs.id ? `https://www.inaturalist.org/observations/${obs.id}` : null);
      const userName = obs.user?.login || "unknown";
      const faves = Number(obs.faves_count || 0);
      const isResearch = obs.quality_grade === "research";
      const score = (isResearch ? 1000 : 0) + faves * 10;
      return (obs.photos || []).map((photo) => ({
        imageUrl: photo.url?.replace("square", "large"),
        obsUrl,
        userName,
        score,
        licenseCode: String(photo.license_code || obs.license_code || "").toUpperCase(),
      }));
    })
    .filter((item) => item.imageUrl && item.obsUrl);

  if (photoItems.length === 0) {
    dom.photoGrid.innerHTML = "<p>写真付き観察が見つかりませんでした（ローカル表示モード）。</p>";
    return;
  }

  let selectedIndex = findBestFeaturedIndex(photoItems);

  const renderPhotoStack = () => {
    dom.photoGrid.innerHTML = "";

    const featuredItem = photoItems[selectedIndex];
    dom.photoGrid.appendChild(createPhotoCard(featuredItem, true, false, false));

    const thumbGrid = document.createElement("div");
    thumbGrid.className = "photo-thumbs";

    const displayIndices = computeDisplayIndices(photoItems.length, selectedIndex, THUMBNAIL_GRID_TOTAL);
    for (const idx of displayIndices) {
      const thumbCard = createPhotoCard(photoItems[idx], false, idx === selectedIndex, true, () => {
        selectedIndex = idx;
        renderPhotoStack();
      });
      thumbGrid.appendChild(thumbCard);
    }

    dom.photoGrid.appendChild(thumbGrid);
  };

  renderPhotoStack();

  if (state.projectId) {
    const observationsUrl = new URL("https://www.inaturalist.org/observations");
    observationsUrl.searchParams.set("project_id", PROJECT_SLUG);
    observationsUrl.searchParams.set("taxon_id", String(taxon.id));

    dom.obsLinkBtn.href = observationsUrl.toString();
    dom.obsLinkBtn.classList.remove("hidden");
  }
}

function computeDisplayIndices(total, selectedIndex, maxCount) {
  const count = Math.min(total, maxCount);
  const indices = [];
  for (let i = 0; i < count; i += 1) indices.push(i);

  if (selectedIndex >= count) {
    indices[count - 1] = selectedIndex;
    indices.sort((a, b) => a - b);
  }

  return indices;
}

function findBestFeaturedIndex(photoItems) {
  let bestIndex = 0;
  let bestScore = -Infinity;
  for (let i = 0; i < photoItems.length; i += 1) {
    const score = Number(photoItems[i].score || 0);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }
  return bestIndex;
}

function createPhotoCard(item, isFeatured, isActive = false, clickable = false, onThumbClick = null) {
  const card = document.createElement("div");
  card.className = isFeatured ? "photo-card featured-card" : "photo-card thumb-card";
  if (isActive) card.classList.add("is-active");

  const img = document.createElement("img");
  img.src = item.imageUrl;
  img.alt = "iNaturalist observation photo";
  img.loading = isFeatured ? "eager" : "lazy";
  img.className = isFeatured ? "featured-photo" : "thumb-photo";

  if (clickable && typeof onThumbClick === "function") {
    img.classList.add("thumb-clickable");
    img.addEventListener("click", onThumbClick);
  }

  const source = document.createElement("a");
  source.className = "photo-source";
  source.href = item.obsUrl;
  source.target = "_blank";
  source.rel = "noopener noreferrer";
  const licenseText = item.licenseCode ? ` (${item.licenseCode})` : "";
  source.textContent = `© ${item.userName}${licenseText}`;

  card.appendChild(img);

  if (isActive) {
    const badge = document.createElement("span");
    badge.className = "active-badge";
    badge.textContent = "表示中";
    card.appendChild(badge);
  }

  card.appendChild(source);
  return card;
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
    halo.setAttribute("fill", "#ff4d4d");
    halo.setAttribute("fill-opacity", String(0.1 + intensity * 0.22));
    dom.distributionLayer.appendChild(halo);

  }

  dom.distributionSummary.textContent = `座標付き観察 ${projectedPoints.length}件（表示点 ${cells.length}）`;
}

async function loadHokkaidoOutlineFromINat() {
  try {
    const [hokkaidoGeometry, kurilGeometry] = await Promise.all([
      fetchPlaceGeometryById(13078), // Hokkaido, JP
      fetchPlaceGeometryById(49474), // Kuril'skiy rayon, RU
    ]);

    const hokkaidoRings = extractOuterRings(hokkaidoGeometry).filter((ring) => ring.length >= 3);
    const northernRings = filterNorthernTerritoriesRings(extractOuterRings(kurilGeometry));

    const allRings = [...hokkaidoRings, ...northernRings];
    if (allRings.length === 0) return;

    const allCoordinates = allRings.flat();
    const bounds = boundsFromCoordinates(allCoordinates);
    state.mapBounds = expandBounds(bounds, 0.08);
    const referenceLat = (bounds.minLat + bounds.maxLat) / 2;
    state.mapProjection = computeMapProjection(state.mapBounds, referenceLat);

    const hokkaidoPaths = hokkaidoRings
      .map((ring) => buildSvgPathFromLonLat(ring, state.mapProjection))
      .filter(Boolean);
    if (hokkaidoPaths.length > 0 && dom.hokkaidoOutline) {
      dom.hokkaidoOutline.setAttribute("d", hokkaidoPaths.join(" "));
    }

    const northernPaths = northernRings
      .map((ring) => buildSvgPathFromLonLat(ring, state.mapProjection))
      .filter(Boolean);
    if (dom.northernTerritoriesOutline) {
      dom.northernTerritoriesOutline.setAttribute("d", northernPaths.join(" "));
    }
  } catch (error) {
    console.warn("北海道/北方領土境界の取得に失敗したため既定形状を使用します", error);
  }
}

async function fetchPlaceGeometryById(placeId) {
  const placeUrl = new URL(`${API_BASE}/places/${placeId}`);
  placeUrl.searchParams.set("locale", "ja");

  const placeRes = await fetchWithTimeout(placeUrl, {}, 8000);
  if (!placeRes.ok) return null;

  const placeData = await placeRes.json();
  return placeData?.results?.[0]?.geometry_geojson || null;
}

function extractOuterRings(geometry) {
  if (!geometry) return [];

  if (geometry.type === "Polygon") {
    return geometry.coordinates?.[0] ? [geometry.coordinates[0]] : [];
  }

  if (geometry.type === "MultiPolygon") {
    return (geometry.coordinates || [])
      .map((polygon) => polygon?.[0])
      .filter((ring) => Array.isArray(ring) && ring.length >= 3);
  }

  return [];
}

function filterNorthernTerritoriesRings(rings) {
  if (!Array.isArray(rings)) return [];

  // 南千島（国後・択捉・色丹・歯舞）付近に限定して北方領土として表示
  return rings.filter((ring) => {
    const center = ringCentroid(ring);
    if (!center) return false;
    const [lon, lat] = center;
    return lon >= 145 && lon <= 149.2 && lat >= 43 && lat <= 46;
  });
}

function ringCentroid(ring) {
  if (!Array.isArray(ring) || ring.length === 0) return null;
  let lon = 0;
  let lat = 0;
  for (const point of ring) {
    lon += Number(point?.[0] || 0);
    lat += Number(point?.[1] || 0);
  }
  return [lon / ring.length, lat / ring.length];
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


function updateSpeciesCount() {
  if (!dom.speciesCount) return;
  dom.speciesCount.textContent = `${state.species.length}種`;
}

function countsFromObservations(observations) {
  const counts = Array(12).fill(0);
  for (const obs of observations) {
    const month = obs?.observed_on_details?.month;
    if (Number.isInteger(month) && month >= 1 && month <= 12) counts[month - 1] += 1;
  }
  return counts;
}

function renderSeasonality(counts) {
  if (!dom.seasonalityChart) return;

  const data = Array.from({ length: 12 }, (_, i) => Number(counts?.[i] || 0));
  const maxValue = Math.max(0, ...data);
  const step = maxValue <= 10 ? 1 : maxValue >= 50 ? 10 : maxValue >= 20 ? 5 : 2;
  const maxRounded = Math.max(step, Math.ceil(maxValue / step) * step);

  const w = 640;
  const h = 220;
  const padL = 52;
  const padR = 52;
  const padT = 16;
  const padB = 30;
  const gw = w - padL - padR;
  const gh = h - padT - padB;

  const points = data.map((v, i) => {
    const x = padL + (gw * i) / 11;
    const y = padT + gh - (gh * v) / maxRounded;
    return { x, y, v };
  });

  const line = buildSmoothCurvePath(points, padT, padT + gh);
  const area = `${line} L ${(padL + gw).toFixed(2)} ${(padT + gh).toFixed(2)} L ${padL.toFixed(2)} ${(padT + gh).toFixed(2)} Z`;

  const gridLines = [];
  for (let v = 0; v <= maxRounded; v += step) {
    const y = padT + gh - (gh * v) / maxRounded;
    const major = v % (step * 2) === 0;
    gridLines.push(`<line x1="${padL}" y1="${y.toFixed(2)}" x2="${(padL + gw).toFixed(2)}" y2="${y.toFixed(2)}" stroke="#2f4f40" stroke-width="${major ? 1.5 : 1}" opacity="0.9"></line>`);
    gridLines.push(`<text x="${(padL - 8).toFixed(2)}" y="${(y + 4).toFixed(2)}" fill="#8eac98" font-size="10" text-anchor="end">${v}</text>`);
  }

  dom.seasonalityChart.innerHTML = `
    <rect x="0" y="0" width="${w}" height="${h}" fill="#08110c" stroke="#1f7a3f" />
    ${gridLines.join("")}
    <path d="${area}" fill="#173325" fill-opacity="0.45"></path>
    <path d="${line}" fill="none" stroke="#39b268" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"></path>
    ${points.map((p) => `<circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="2.6" fill="#39b268"></circle>`).join("")}
    ${Array.from({ length: 12 }, (_, i) => {
      const isPeak = maxValue > 0 && data[i] === maxValue;
      const hasObs = data[i] > 0;
      const color = isPeak ? "#ff6b6b" : hasObs ? "#f2d15b" : "#8eac98";
      return `<text x="${(padL + (gw * i) / 11).toFixed(2)}" y="${h - 8}" fill="${color}" font-size="11" text-anchor="middle">${i + 1}月</text>`;
    }).join("")}
  `;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function buildSmoothCurvePath(points, minY, maxY) {
  if (!points || points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;

  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = clamp(p1.y + (p2.y - p0.y) / 6, minY, maxY);
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = clamp(p2.y - (p3.y - p1.y) / 6, minY, maxY);

    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

async function fetchMonthlySeasonality(taxonId) {
  try {
    const url = new URL(`${API_BASE}/observations/histogram`);
    url.searchParams.set("project_id", String(state.projectId));
    url.searchParams.set("taxon_id", String(taxonId));
    url.searchParams.set("interval", "month_of_year");
    url.searchParams.set("locale", "ja");

    const response = await fetchWithTimeout(url, {}, 10000);
    if (!response.ok) return Array(12).fill(0);
    const data = await response.json();
    const counts = Array(12).fill(0);
    const byMonth = data?.results?.month_of_year || data?.results || {};
    for (let m = 1; m <= 12; m += 1) {
      counts[m - 1] = Number(byMonth?.[String(m)] || 0);
    }
    return counts;
  } catch (error) {
    console.warn("季節性データの取得に失敗", error);
    return Array(12).fill(0);
  }
}

async function loadRecentObservationsSlideshow(projectId) {
  if (!dom.recentObsSlideshow) return;

  dom.recentObsSlideshow.innerHTML = '<p class="recent-empty">最近の観察記録を読み込み中...</p>';

  try {
    const fetchRecent = async (queryKey, queryValue) => {
      const url = new URL(`${API_BASE}/observations`);
      url.searchParams.set(queryKey, String(queryValue));
      url.searchParams.set("order_by", "created_at");
      url.searchParams.set("order", "desc");
      url.searchParams.set("photos", "true");
      url.searchParams.set("per_page", String(RECENT_OBS_FETCH));
      url.searchParams.set("locale", "ja");

      const response = await fetchWithTimeout(url, {}, 10000);
      if (!response.ok) throw new Error(`recent observations fetch failed: ${response.status}`);
      return response.json();
    };

    let data = null;
    if (projectId) {
      data = await fetchRecent("project_id", projectId);
    }
    if (!data || !Array.isArray(data?.results) || data.results.length === 0) {
      data = await fetchRecent("project_slug", PROJECT_SLUG);
    }

    const slides = (data?.results || [])
      .filter((obs) => (obs.photos || []).length > 0)
      .slice(0, RECENT_OBS_SLIDES)
      .map((obs) => ({
        imageUrl: obs.photos?.[0]?.url?.replace("square", "large"),
        observationUrl: obs.uri || `https://www.inaturalist.org/observations/${obs.id}`,
        taxonName: obs.taxon?.name || "Unknown",
        taxonJaName: japaneseNameOrFallback(obs.taxon?.preferred_common_name),
        observedAt: obs.observed_on_string || obs.observed_on || "日付不明",
        observer: obs.user?.login || "unknown",
      }))
      .filter((item) => item.imageUrl);

    renderRecentObservationsSlides(slides);
  } catch (error) {
    console.warn("最近の観察記録の取得に失敗", error);
    dom.recentObsSlideshow.innerHTML = '<p class="recent-empty">最近の観察記録を取得できませんでした。</p>';
  }
}

function renderRecentObservationsSlides(slides) {
  if (!dom.recentObsSlideshow) return;

  dom.recentObsSlideshow.innerHTML = "";
  if (state.recentSlideshowTimer) {
    clearInterval(state.recentSlideshowTimer);
    state.recentSlideshowTimer = null;
  }

  if (slides.length === 0) {
    dom.recentObsSlideshow.innerHTML = '<p class="recent-empty">表示できる写真付き観察記録がありません。</p>';
    return;
  }

  const slideEls = slides.map((slide, index) => {
    const wrapper = document.createElement("article");
    wrapper.className = `recent-slide${index === 0 ? " active" : ""}`;

    const link = document.createElement("a");
    link.href = slide.observationUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";

    const image = document.createElement("img");
    image.src = slide.imageUrl;
    image.alt = `${slide.taxonJaName} (${slide.taxonName})`;

    const caption = document.createElement("p");
    caption.className = "recent-caption";
    caption.textContent = `${slide.taxonJaName} / ${slide.taxonName} ・ 観察者: ${slide.observer} ・ ${slide.observedAt}`;

    link.appendChild(image);
    link.appendChild(caption);
    wrapper.appendChild(link);
    dom.recentObsSlideshow.appendChild(wrapper);
    return wrapper;
  });

  if (slideEls.length === 1) return;

  let activeIndex = 0;
  state.recentSlideshowTimer = setInterval(() => {
    slideEls[activeIndex].classList.remove("active");
    activeIndex = (activeIndex + 1) % slideEls.length;
    slideEls[activeIndex].classList.add("active");
  }, RECENT_SLIDE_INTERVAL_MS);
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
  if (!name) return "和名なし";
  return isLikelyJapanese(name) ? name : "和名なし";
}

function isLikelyJapanese(text) {
  return /[\u3040-\u309F\u30A0-\u30FF\u3400-\u9FFF]/.test(text);
}

function extractGenus(scientificName) {
  return (scientificName || "").split(" ")[0] || "Unknown";
}

function setStatus(message) {
  if (!dom.statusBar) return;
  dom.statusBar.textContent = message;
}
