import AsyncStorage from '@react-native-async-storage/async-storage';

const BARCODE_CACHE_PREFIX = '@pillaflow:barcode_food:';
const SEARCH_CACHE_PREFIX = '@pillaflow:food_search:';
const BARCODE_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const SEARCH_CACHE_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours
const DEFAULT_SEARCH_LIMIT = 20;

const OPEN_FOOD_FACTS_BASE_URL = 'https://world.openfoodfacts.org';
const OPEN_FOOD_FACTS_USER_AGENT = 'Pillaflow/1.0 (https://pillr.xyz)';
const USDA_BASE_URL = 'https://api.nal.usda.gov/fdc/v1';
// Use EXPO_PUBLIC_USDA_API_KEY in production to avoid DEMO_KEY limits.
const USDA_API_KEY = process.env.EXPO_PUBLIC_USDA_API_KEY || 'DEMO_KEY';

const USDA_NUTRIENT_IDS = {
  calories: new Set(['1008', '208']),
  protein: new Set(['1003', '203']),
  carbs: new Set(['1005', '205']),
  fat: new Set(['1004', '204']),
};

const toNumber = (v) => {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : Number(v);
  return Number.isFinite(n) ? n : null;
};

const toRoundedMacro = (value) => {
  if (value === null || value === undefined) return null;
  const parsed = toNumber(value);
  if (parsed === null) return null;
  return Math.round(parsed * 10) / 10;
};

const normalizeText = (value) => String(value || '').trim().toLowerCase();

const normalizeBarcode = (raw) => {
  if (!raw) return null;
  const s = String(raw).trim();

  // If it's already basically digits, keep it.
  const digitsOnly = s.replace(/\D/g, '');
  if (digitsOnly.length >= 8 && digitsOnly.length <= 14) return digitsOnly;

  // If QR contains digits in a URL/string, extract the longest run.
  const matches = s.match(/\d{8,14}/g);
  if (matches && matches.length) {
    return matches.sort((a, b) => b.length - a.length)[0];
  }
  return null;
};

const normalizeBarcodeForCompare = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return null;
  const withoutLeadingZeroes = digits.replace(/^0+/, '');
  return withoutLeadingZeroes || '0';
};

const normalizeQueryKey = (value) => normalizeText(value).replace(/\s+/g, ' ');

const readCache = async (prefix, key, ttlMs) => {
  try {
    const raw = await AsyncStorage.getItem(`${prefix}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.ts || !parsed?.payload) return null;
    if (Date.now() - parsed.ts > ttlMs) return null;
    return parsed.payload;
  } catch {
    return null;
  }
};

const writeCache = async (prefix, key, payload) => {
  try {
    await AsyncStorage.setItem(
      `${prefix}${key}`,
      JSON.stringify({ ts: Date.now(), payload })
    );
  } catch {
    // ignore cache failures
  }
};

const parseInlineFormats = (rawData) => {
  const code = (rawData || '').trim();
  if (!code) return null;

  // JSON payload inside a QR code
  try {
    const parsed = JSON.parse(code);
    if (parsed && parsed.name) {
      return {
        name: parsed.name,
        calories: parsed.calories ?? null,
        proteinGrams: parsed.protein ?? parsed.proteinGrams ?? null,
        carbsGrams: parsed.carbs ?? parsed.carbsGrams ?? null,
        fatGrams: parsed.fat ?? parsed.fatGrams ?? null,
        source: 'inline',
      };
    }
  } catch {
    // not JSON
  }

  // Pipe format: name|cal|protein|carbs|fat
  const parts = code.split('|').map((p) => p.trim());
  if (parts.length >= 5) {
    const [namePart, calPart, proteinPart, carbPart, fatPart] = parts;
    return {
      name: namePart || undefined,
      calories: toNumber(calPart),
      proteinGrams: toNumber(proteinPart),
      carbsGrams: toNumber(carbPart),
      fatGrams: toNumber(fatPart),
      source: 'inline',
    };
  }

  return null;
};

const hasServingNutrients = (nutr = {}) =>
  nutr['energy-kcal_serving'] != null ||
  nutr.energy_serving != null ||
  nutr.proteins_serving != null ||
  nutr.fat_serving != null ||
  nutr.carbohydrates_serving != null;

const pickOpenFoodFactsCalories = (nutr, basis) =>
  toNumber(nutr[`energy-kcal_${basis}`]) ??
  (toNumber(nutr[`energy_${basis}`]) != null
    ? Math.round(toNumber(nutr[`energy_${basis}`]) / 4.184)
    : null);

const mapOpenFoodFactsProduct = (product = {}) => {
  const nutr = product.nutriments || {};
  const basis = hasServingNutrients(nutr) ? 'serving' : '100g';

  const name =
    product.product_name ||
    product.product_name_en ||
    (product.brands ? `${product.brands}` : null) ||
    'Unknown product';

  return {
    name,
    calories: pickOpenFoodFactsCalories(nutr, basis),
    proteinGrams: toRoundedMacro(toNumber(nutr[`proteins_${basis}`])),
    carbsGrams: toRoundedMacro(toNumber(nutr[`carbohydrates_${basis}`])),
    fatGrams: toRoundedMacro(toNumber(nutr[`fat_${basis}`])),
    servingSize: product.serving_size || product.quantity || null,
    source: 'openfoodfacts',
    sourceLabel: 'Open Food Facts',
    basis,
    brand: product.brands || null,
  };
};

const fetchOpenFoodFacts = async (barcode) => {
  // OFF prefers a descriptive User-Agent
  const headers = {
    'User-Agent': OPEN_FOOD_FACTS_USER_AGENT,
    'Accept': 'application/json',
  };

  // v2 endpoint (global database)
  const url =
    `${OPEN_FOOD_FACTS_BASE_URL}/api/v2/product/${encodeURIComponent(barcode)}` +
    `?fields=product_name,product_name_en,brands,nutriments,serving_size,quantity`;

  const res = await fetch(url, { headers });
  if (!res.ok) return null;

  const json = await res.json();
  if (!json || json.status !== 1 || !json.product) return null;

  return mapOpenFoodFactsProduct(json.product);
};

const fetchOpenFoodFactsSearch = async (query, limit = 10) => {
  const headers = {
    'User-Agent': OPEN_FOOD_FACTS_USER_AGENT,
    'Accept': 'application/json',
  };
  const pageSize = Math.max(1, Math.min(limit, 50));
  const url =
    `${OPEN_FOOD_FACTS_BASE_URL}/cgi/search.pl` +
    `?search_terms=${encodeURIComponent(query)}` +
    '&search_simple=1&action=process&json=1' +
    `&page_size=${pageSize}` +
    '&fields=code,product_name,product_name_en,brands,nutriments,serving_size,quantity';

  const res = await fetch(url, { headers });
  if (!res.ok) return [];

  const json = await res.json();
  const products = Array.isArray(json?.products) ? json.products : [];

  return products
    .map((item) => {
      if (!item) return null;
      const mapped = mapOpenFoodFactsProduct(item);
      return {
        ...mapped,
        externalId: item.code || null,
      };
    })
    .filter((item) => item?.name);
};

const normalizeNutrientId = (value) => {
  if (value === null || value === undefined) return null;
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return null;
  const withoutLeadingZeroes = digits.replace(/^0+/, '');
  return withoutLeadingZeroes || '0';
};

const toKcalIfNeeded = (value, unitName) => {
  const parsed = toNumber(value);
  if (parsed === null) return null;
  const unit = normalizeText(unitName);
  if (unit.includes('kj')) return Math.round(parsed / 4.184);
  return parsed;
};

const getUsdaNutrientValue = (food = {}, key) => {
  const nutrients = Array.isArray(food.foodNutrients) ? food.foodNutrients : [];
  const idSet = USDA_NUTRIENT_IDS[key];

  for (const nutrient of nutrients) {
    const ids = [
      normalizeNutrientId(nutrient?.nutrientId),
      normalizeNutrientId(nutrient?.nutrient?.id),
      normalizeNutrientId(nutrient?.nutrient?.nutrientId),
      normalizeNutrientId(nutrient?.nutrientNumber),
      normalizeNutrientId(nutrient?.nutrient?.number),
    ].filter(Boolean);

    if (idSet && ids.some((id) => idSet.has(id))) {
      return toKcalIfNeeded(
        nutrient?.value ?? nutrient?.amount,
        nutrient?.unitName ?? nutrient?.nutrient?.unitName
      );
    }
  }

  const namesByKey = {
    calories: ['energy'],
    protein: ['protein'],
    carbs: ['carbohydrate'],
    fat: ['fat', 'lipid'],
  };

  const fallbackNames = namesByKey[key] || [];
  for (const nutrient of nutrients) {
    const nutrientName = normalizeText(
      nutrient?.nutrientName ?? nutrient?.nutrient?.name
    );
    if (!nutrientName) continue;
    if (!fallbackNames.some((name) => nutrientName.includes(name))) continue;
    const value = nutrient?.value ?? nutrient?.amount;
    if (key === 'calories') {
      return toKcalIfNeeded(
        value,
        nutrient?.unitName ?? nutrient?.nutrient?.unitName
      );
    }
    return toRoundedMacro(value);
  }

  return null;
};

const formatUsdaServingSize = (food = {}) => {
  const size = toNumber(food?.servingSize);
  const unit = String(food?.servingSizeUnit || '').trim();
  if (size !== null && unit) return `${size} ${unit}`;
  if (size !== null) return `${size} g`;
  if (food?.householdServingFullText) return String(food.householdServingFullText);
  return null;
};

const mapUsdaFood = (food = {}) => {
  if (!food?.description) return null;

  const labelNutrients = food?.labelNutrients || {};
  const calories =
    toNumber(labelNutrients?.calories?.value ?? labelNutrients?.calories) ??
    getUsdaNutrientValue(food, 'calories');
  const protein =
    toRoundedMacro(labelNutrients?.protein?.value ?? labelNutrients?.protein) ??
    getUsdaNutrientValue(food, 'protein');
  const carbs =
    toRoundedMacro(
      labelNutrients?.carbohydrates?.value ?? labelNutrients?.carbohydrates
    ) ?? getUsdaNutrientValue(food, 'carbs');
  const fat =
    toRoundedMacro(labelNutrients?.fat?.value ?? labelNutrients?.fat) ??
    getUsdaNutrientValue(food, 'fat');

  const brand = food.brandOwner || food.brandName || null;
  const description = String(food.description || '').trim();
  const name =
    brand && !normalizeText(description).includes(normalizeText(brand))
      ? `${brand} ${description}`
      : description;

  const servingSize = formatUsdaServingSize(food);
  const hasServingSize = toNumber(food?.servingSize) !== null || !!food?.householdServingFullText;

  return {
    name: name || description || 'Unknown product',
    calories,
    proteinGrams: protein,
    carbsGrams: carbs,
    fatGrams: fat,
    servingSize,
    source: 'usda',
    sourceLabel: 'USDA FoodData Central',
    basis: hasServingSize ? 'serving' : '100g',
    brand,
    dataType: food.dataType || null,
    externalId: food.fdcId || null,
  };
};

const fetchUsdaFoodsSearchRaw = async (query, limit = 10) => {
  const trimmedQuery = String(query || '').trim();
  if (!trimmedQuery || !USDA_API_KEY) return [];

  const pageSize = Math.max(1, Math.min(limit, 50));
  const url =
    `${USDA_BASE_URL}/foods/search` +
    `?api_key=${encodeURIComponent(USDA_API_KEY)}` +
    `&query=${encodeURIComponent(trimmedQuery)}` +
    `&pageSize=${pageSize}&pageNumber=1`;

  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return [];

  const json = await res.json();
  return Array.isArray(json?.foods) ? json.foods : [];
};

const fetchUsdaByBarcode = async (barcode) => {
  const foods = await fetchUsdaFoodsSearchRaw(barcode, 15);
  if (!foods.length) return null;

  const targetBarcode = normalizeBarcodeForCompare(barcode);
  const exactMatches = foods.filter((food) => {
    const gtin = normalizeBarcodeForCompare(food?.gtinUpc);
    return !!gtin && !!targetBarcode && gtin === targetBarcode;
  });

  const candidatePool = exactMatches.length ? exactMatches : foods;
  const preferred =
    candidatePool.find((food) =>
      normalizeText(food?.dataType).includes('branded')
    ) || candidatePool[0];

  return mapUsdaFood(preferred);
};

const fetchUsdaSearch = async (query, limit = 10) => {
  const foods = await fetchUsdaFoodsSearchRaw(query, limit);
  return foods.map(mapUsdaFood).filter((item) => item?.name);
};

const mergeFoodMatches = (openFoodFactsMatch, usdaMatch) => {
  if (!openFoodFactsMatch && !usdaMatch) return null;
  if (!openFoodFactsMatch) return usdaMatch;
  if (!usdaMatch) return openFoodFactsMatch;

  return {
    ...openFoodFactsMatch,
    name: openFoodFactsMatch.name || usdaMatch.name,
    calories: openFoodFactsMatch.calories ?? usdaMatch.calories ?? null,
    proteinGrams:
      openFoodFactsMatch.proteinGrams ?? usdaMatch.proteinGrams ?? null,
    carbsGrams: openFoodFactsMatch.carbsGrams ?? usdaMatch.carbsGrams ?? null,
    fatGrams: openFoodFactsMatch.fatGrams ?? usdaMatch.fatGrams ?? null,
    servingSize: openFoodFactsMatch.servingSize || usdaMatch.servingSize || null,
    basis: openFoodFactsMatch.basis || usdaMatch.basis || null,
    sourceLabel:
      openFoodFactsMatch.sourceLabel && usdaMatch.sourceLabel
        ? `${openFoodFactsMatch.sourceLabel} + ${usdaMatch.sourceLabel}`
        : openFoodFactsMatch.sourceLabel || usdaMatch.sourceLabel || null,
    matchedSources: Array.from(
      new Set([openFoodFactsMatch.source, usdaMatch.source].filter(Boolean))
    ),
    fallbackSource: usdaMatch.source || null,
  };
};

const interleaveLists = (lists, limit) => {
  const output = [];
  let index = 0;

  while (output.length < limit) {
    let pushedAny = false;
    for (const list of lists) {
      if (list[index]) {
        output.push(list[index]);
        pushedAny = true;
        if (output.length >= limit) break;
      }
    }
    if (!pushedAny) break;
    index += 1;
  }

  return output;
};

const dedupeFoods = (foods = []) => {
  const seen = new Set();
  const result = [];

  foods.forEach((item) => {
    if (!item?.name) return;
    const key = [
      normalizeText(item.name),
      normalizeText(item.brand),
      item.calories ?? '',
      item.proteinGrams ?? '',
      item.carbsGrams ?? '',
      item.fatGrams ?? '',
    ].join('|');

    if (seen.has(key)) return;
    seen.add(key);
    result.push(item);
  });

  return result;
};

const buildLocalSearchResults = (query, localMap = {}) => {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return [];

  return Object.entries(localMap)
    .map(([barcode, payload]) => {
      if (!payload?.name) return null;
      const nameMatches = normalizeText(payload.name).includes(normalizedQuery);
      const barcodeMatches = String(barcode || '').includes(normalizedQuery);
      if (!nameMatches && !barcodeMatches) return null;
      return {
        ...payload,
        source: 'local',
        sourceLabel: 'Local database',
        externalId: barcode,
      };
    })
    .filter(Boolean);
};

export const searchFoodsByQuery = async (rawQuery, options = {}) => {
  const query = String(rawQuery || '').trim();
  if (query.length < 2) return [];

  const localMap = options.localMap || {};
  const limit = Math.max(
    1,
    Math.min(Number(options.limit) || DEFAULT_SEARCH_LIMIT, 50)
  );
  const cacheKey = normalizeQueryKey(query);

  const cached = await readCache(
    SEARCH_CACHE_PREFIX,
    cacheKey,
    SEARCH_CACHE_TTL_MS
  );
  if (Array.isArray(cached) && cached.length) return cached.slice(0, limit);

  const perSourceLimit = Math.max(5, Math.ceil(limit * 0.75));

  const [openFoodFactsResults, usdaResults] = await Promise.all([
    fetchOpenFoodFactsSearch(query, perSourceLimit).catch(() => []),
    fetchUsdaSearch(query, perSourceLimit).catch(() => []),
  ]);

  const localResults = buildLocalSearchResults(query, localMap);
  const remoteResults = interleaveLists(
    [openFoodFactsResults, usdaResults],
    limit * 2
  );
  const mergedResults = dedupeFoods([...localResults, ...remoteResults]).slice(
    0,
    limit
  );

  await writeCache(SEARCH_CACHE_PREFIX, cacheKey, mergedResults);
  return mergedResults;
};

/**
 * Main lookup:
 * - local map override
 * - inline QR formats (JSON / pipe-delimited)
 * - Open Food Facts + USDA lookup (cached)
 */
export const lookupFoodByBarcode = async (rawData, options = {}) => {
  const localMap = options.localMap || {};

  const trimmed = (rawData || '').trim();
  if (!trimmed) return null;

  // 1) Local override
  if (localMap[trimmed]) return { ...localMap[trimmed], source: 'local' };

  // 2) Inline QR formats
  const inline = parseInlineFormats(trimmed);
  if (inline) return inline;

  // 3) Real barcode lookup (digits)
  const barcode = normalizeBarcode(trimmed);
  if (!barcode) return null;

  const cached = await readCache(
    BARCODE_CACHE_PREFIX,
    barcode,
    BARCODE_CACHE_TTL_MS
  );
  if (cached) return cached;

  const [openFoodFactsMatch, usdaMatch] = await Promise.all([
    fetchOpenFoodFacts(barcode).catch(() => null),
    fetchUsdaByBarcode(barcode).catch(() => null),
  ]);

  const merged = mergeFoodMatches(openFoodFactsMatch, usdaMatch);
  if (!merged) return null;

  await writeCache(BARCODE_CACHE_PREFIX, barcode, merged);
  return merged;
};
