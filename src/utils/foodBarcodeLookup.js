import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = '@pillarup:barcode_food:';
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

const toNumber = (v) => {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : Number(v);
  return Number.isFinite(n) ? n : null;
};

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

const readCache = async (barcode) => {
  try {
    const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}${barcode}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.ts || !parsed?.payload) return null;
    if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
    return parsed.payload;
  } catch {
    return null;
  }
};

const writeCache = async (barcode, payload) => {
  try {
    await AsyncStorage.setItem(
      `${CACHE_PREFIX}${barcode}`,
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

const fetchOpenFoodFacts = async (barcode) => {
  // OFF prefers a descriptive User-Agent
  const headers = {
    'User-Agent': 'PillarUp/1.0 (https://pillr.xyz)',
    'Accept': 'application/json',
  };

  // v2 endpoint (global database)
  const url =
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}` +
    `?fields=product_name,product_name_en,brands,nutriments,serving_size,quantity`;

  const res = await fetch(url, { headers });
  if (!res.ok) return null;

  const json = await res.json();
  if (!json || json.status !== 1 || !json.product) return null;

  const product = json.product;
  const nutr = product.nutriments || {};

  // Prefer "per serving" if available, else "per 100g"
  const hasServing =
    nutr['energy-kcal_serving'] != null ||
    nutr['energy_serving'] != null ||
    nutr['proteins_serving'] != null ||
    nutr['fat_serving'] != null ||
    nutr['carbohydrates_serving'] != null;

  const basis = hasServing ? 'serving' : '100g';

  const kcal =
    toNumber(nutr[`energy-kcal_${basis}`]) ??
    // Sometimes only kJ is present:
    (toNumber(nutr[`energy_${basis}`]) != null
      ? Math.round(toNumber(nutr[`energy_${basis}`]) / 4.184)
      : null);

  const protein = toNumber(nutr[`proteins_${basis}`]);
  const fat = toNumber(nutr[`fat_${basis}`]);
  const carbs = toNumber(nutr[`carbohydrates_${basis}`]);

  const name =
    product.product_name ||
    product.product_name_en ||
    (product.brands ? `${product.brands}` : null) ||
    'Unknown product';

  return {
    name,
    calories: kcal,
    proteinGrams: protein,
    carbsGrams: carbs,
    fatGrams: fat,
    servingSize: product.serving_size || product.quantity || null,
    source: 'openfoodfacts',
    basis, // 'serving' or '100g'
  };
};

/**
 * Main lookup:
 * - local map override
 * - inline QR formats (JSON / pipe-delimited)
 * - Open Food Facts (cached)
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

  const cached = await readCache(barcode);
  if (cached) return cached;

  const off = await fetchOpenFoodFacts(barcode);
  if (!off) return null;

  await writeCache(barcode, off);
  return off;
};
