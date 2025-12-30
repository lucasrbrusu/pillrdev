import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';

// RevenueCat's browser fallback (used in Expo Go without a dev client) expects
// a browser-like `location` object. React Native doesn't provide one, so we
// stub the minimal shape to avoid `location.search` errors during init.
if (typeof globalThis.location === 'undefined') {
  globalThis.location = { search: '' };
} else if (typeof globalThis.location.search === 'undefined') {
  globalThis.location.search = '';
}

// Production RevenueCat API keys (iOS and Android)
const iosApiKey = 'appl_VnKzbJTYiUgHyeQtpuoHZgyrAjj';
const androidApiKey = 'goog_pwyWISJSXbUBoSRppNHtySWkYwU';

const ENTITLEMENT_ID = 'premium';
const DEFAULT_OFFERING_ID = 'default';

const globalKey = '__PILLARUP_REVENUECAT__';
const globalState = (() => {
  if (!globalThis[globalKey]) {
    globalThis[globalKey] = { configured: false, configurePromise: null };
  }
  return globalThis[globalKey];
})();

let configured = globalState.configured || false;
let configurePromise = globalState.configurePromise || null;

export const configureRevenueCat = async () => {
  if (configured) return true;
  if (configurePromise) return configurePromise;

  const apiKey = Platform.OS === 'ios' ? iosApiKey : androidApiKey;
  if (!apiKey) return false;

  configurePromise = globalState.configurePromise = (async () => {
    try {
      Purchases.setLogLevel(LOG_LEVEL.WARN);
      await Purchases.configure({ apiKey });
      configured = true;
      globalState.configured = true;
      return true;
    } catch (error) {
      console.warn('RevenueCat configure failed', error);
      return false;
    } finally {
      configurePromise = null;
      globalState.configurePromise = null;
    }
  })();

  return configurePromise;
};

const matchPackage = (currentOffering, type) => {
  if (!currentOffering) return null;

  if (type === 'monthly') {
    return (
      currentOffering.monthly ||
      (currentOffering.availablePackages || []).find(
        (p) =>
          (p?.packageType || '').toString().toLowerCase() === 'monthly' ||
          (p?.identifier || '').toLowerCase().includes('month')
      ) ||
      null
    );
  }

  if (type === 'annual') {
    return (
      currentOffering.annual ||
      (currentOffering.availablePackages || []).find(
        (p) =>
          (p?.packageType || '').toString().toLowerCase() === 'annual' ||
          (p?.identifier || '').toLowerCase().includes('year')
      ) ||
      null
    );
  }

  return null;
};

const pickDefaultOffering = (offerings) => {
  if (!offerings) return null;
  if (offerings.all && offerings.all[DEFAULT_OFFERING_ID]) {
    return offerings.all[DEFAULT_OFFERING_ID];
  }
  if (offerings.current) return offerings.current;
  const allList = offerings.all ? Object.values(offerings.all) : [];
  return allList.find(Boolean) || null;
};

export const loadOfferingPackages = async () => {
  const ok = await configureRevenueCat();
  if (!ok) {
    return { offering: null, monthly: null, annual: null };
  }
  const offerings = await Purchases.getOfferings();
  const selected = pickDefaultOffering(offerings);
  return {
    offering: selected,
    monthly: matchPackage(selected, 'monthly'),
    annual: matchPackage(selected, 'annual'),
  };
};

export const purchaseRevenueCatPackage = async (pkg) => {
  const ok = await configureRevenueCat();
  if (!ok) throw new Error('RevenueCat not configured');
  return Purchases.purchasePackage(pkg);
};

export const restoreRevenueCatPurchases = async () => {
  const ok = await configureRevenueCat();
  if (!ok) throw new Error('RevenueCat not configured');
  return Purchases.restorePurchases();
};

export const getPremiumEntitlementStatus = async () => {
  const ok = await configureRevenueCat();
  if (!ok) return { entitlement: null, isActive: false, info: null, expiration: null };
  const info = await Purchases.getCustomerInfo();
  const activeEntitlements = info?.entitlements?.active || {};

  const direct = activeEntitlements[ENTITLEMENT_ID];
  const fallback = Object.values(activeEntitlements || {}).find((ent) => {
    const id = (ent?.identifier || '').toLowerCase();
    return id === ENTITLEMENT_ID.toLowerCase();
  });

  const entitlement = direct || fallback || null;
  const expiration =
    entitlement?.expirationDate ||
    entitlement?.expiresDate ||
    entitlement?.expirationDateMillis ||
    entitlement?.expirationDateMs ||
    entitlement?.expiresDateMillis ||
    entitlement?.expiresDateMs ||
    entitlement?.expiration_date ||
    entitlement?.expires_date ||
    null;
  return {
    entitlement,
    isActive: !!entitlement,
    info,
    expiration,
  };
};

export default {
  configureRevenueCat,
  loadOfferingPackages,
  purchaseRevenueCatPackage,
  restoreRevenueCatPurchases,
  getPremiumEntitlementStatus,
};
