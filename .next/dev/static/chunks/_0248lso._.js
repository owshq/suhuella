(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/brands/.build/entry.ts [app-client] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$brands$2f$suhuella$2f$entry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/brands/suhuella/entry.ts [app-client] (ecmascript) <locals>");
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/brands/api.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createBrandApi",
    ()=>createBrandApi
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$brands$2f$presentation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/brands/presentation.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$brands$2f$helpers$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/brands/helpers.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$brands$2f$theme$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/brands/theme.ts [app-client] (ecmascript)");
;
;
;
function createBrandApi(brand) {
    return {
        brand,
        brandCssVars: (config = brand)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$brands$2f$theme$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["brandPresentationCssVars"])(config),
        siteOrigin: (config = brand)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$brands$2f$helpers$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["siteOriginOf"])(config),
        siteUrl: (pathname, config = brand)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$brands$2f$helpers$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["siteUrlOf"])(pathname, config),
        supportMailto: (config = brand)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$brands$2f$helpers$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["supportMailtoOf"])(config),
        salesMailto: (subject, config = brand)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$brands$2f$helpers$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["salesMailtoOf"])(subject, config),
        desktopProtocolUrl: (path, config = brand)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$brands$2f$helpers$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["desktopProtocolUrlOf"])(path, config),
        applyBrandPresentation: (text, config = brand)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$brands$2f$presentation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["applyBrandPresentation"])(text, config),
        applyBrandPresentationDeep: (value, config = brand)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$brands$2f$presentation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["applyBrandPresentationDeep"])(value, config),
        licenseOtpReplyTo: (config = brand)=>config.emails?.support ?? config.supportEmail,
        licenseOtpFromDisplay: (config = brand)=>{
            const address = config.emails?.licenses ?? (config.supportEmail ? `licenses@${config.primaryDomain}` : "");
            return address ? `${config.displayName} <${address}>` : config.displayName;
        }
    };
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/brands/helpers.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "desktopProtocolUrlOf",
    ()=>desktopProtocolUrlOf,
    "hasForbiddenSecretFields",
    ()=>hasForbiddenSecretFields,
    "salesMailtoOf",
    ()=>salesMailtoOf,
    "siteOriginOf",
    ()=>siteOriginOf,
    "siteUrlOf",
    ()=>siteUrlOf,
    "supportMailtoOf",
    ()=>supportMailtoOf
]);
function siteOriginOf(config) {
    return `https://${config.primaryDomain}`;
}
function siteUrlOf(pathname, config) {
    const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
    return `${siteOriginOf(config)}${path}`;
}
function supportMailtoOf(config) {
    if (!config.supportEmail) return "";
    return `mailto:${config.supportEmail}`;
}
function salesMailtoOf(subject, config) {
    if (!config.salesEmail) return "";
    return `mailto:${config.salesEmail}?subject=${encodeURIComponent(subject)}`;
}
function desktopProtocolUrlOf(path, config) {
    const suffix = path.replace(/^\/+/, "");
    return `${config.desktopProtocol}://${suffix}`;
}
function hasForbiddenSecretFields(config) {
    const record = config;
    const hits = [];
    for (const key of Object.keys(record)){
        if (/secret|apiKey|webhook|credential|d1Binding|privateKey/i.test(key)) {
            hits.push(key);
        }
    }
    return hits;
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/brands/presentation.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "applyBrandPresentation",
    ()=>applyBrandPresentation,
    "applyBrandPresentationDeep",
    ()=>applyBrandPresentationDeep
]);
/** Template tokens in current SuHuella copy. Projection is identity for brand suhuella. */ const TEMPLATE = {
    displayName: "SuHuella",
    primaryDomain: "suhuella.com",
    supportEmail: "support@suhuella.com",
    salesEmail: "sales@suhuella.com"
};
function applyBrandPresentation(text, config) {
    let next = text;
    if (config.supportEmail) next = next.replaceAll(TEMPLATE.supportEmail, config.supportEmail);
    if (config.salesEmail) next = next.replaceAll(TEMPLATE.salesEmail, config.salesEmail);
    return next.replaceAll(TEMPLATE.primaryDomain, config.primaryDomain).replaceAll(TEMPLATE.displayName, config.displayName);
}
function applyBrandPresentationDeep(value, config) {
    if (typeof value === "string") {
        return applyBrandPresentation(value, config);
    }
    if (Array.isArray(value)) {
        return value.map((item)=>applyBrandPresentationDeep(item, config));
    }
    if (value && typeof value === "object") {
        const next = {};
        for (const [key, item] of Object.entries(value)){
            next[key] = applyBrandPresentationDeep(item, config);
        }
        return next;
    }
    return value;
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/brands/release-manifest.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "brandReleaseFromManifest",
    ()=>brandReleaseFromManifest
]);
function installerUrl(entry, legacy) {
    const fromDownloads = typeof entry?.url === "string" ? entry.url.trim() : entry?.url === null ? "" : "";
    if (fromDownloads) return fromDownloads;
    return typeof legacy === "string" ? legacy.trim() : "";
}
function brandReleaseFromManifest(manifest) {
    const channel = manifest.channel === "beta" ? "beta" : "stable";
    return {
        version: manifest.version.trim(),
        channel,
        minimumVersion: manifest.minimumVersion.trim(),
        mandatory: Boolean(manifest.mandatory),
        windows: installerUrl(manifest.downloads?.windows, manifest.windows),
        mac: installerUrl(manifest.downloads?.mac, manifest.mac)
    };
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/brands/suhuella/brand.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "suhuellaBrand",
    ()=>suhuellaBrand
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$brands$2f$release$2d$manifest$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/brands/release-manifest.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$brands$2f$suhuella$2f$release$2e$json$2e5b$json$5d2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/brands/suhuella/release.json.[json].mjs [app-client] (ecmascript)");
;
;
const suhuellaBrand = {
    id: "suhuella",
    operatorId: "self",
    displayName: "SuHuella",
    primaryDomain: "suhuella.com",
    supportEmail: "support@suhuella.com",
    salesEmail: "sales@suhuella.com",
    emails: {
        licenses: "licenses@suhuella.com",
        support: "support@suhuella.com",
        sales: "sales@suhuella.com",
        partners: "partners@suhuella.com",
        billing: "billing@suhuella.com",
        privacy: "privacy@suhuella.com",
        security: "security@suhuella.com",
        operations: "operations@suhuella.com"
    },
    theme: {
        accent: "#0084FF",
        onAccent: "#FFFFFF"
    },
    paidCheckoutEnabled: true,
    releaseRemoteEnabled: true,
    logo: {
        publicSvg: "/suhuella-logo.svg",
        publicPng: "/suhuella-logo.png"
    },
    icon: {
        public192: "/suhuella-icon-192.png",
        public256: "/suhuella-icon-256.png",
        public512: "/suhuella-icon-512.png"
    },
    desktopProductName: "SuHuella",
    desktopAppId: "com.suhuella.desktop",
    desktopProtocol: "suhuella",
    pwa: {
        name: "SuHuella",
        shortName: "SuHuella",
        description: "Your knowledge, on this computer. Documents never leave this computer.",
        startUrl: "/home",
        backgroundColor: "#A7D8F9",
        themeColor: "#A7D8F9",
        icons: [
            {
                src: "/suhuella-icon-512.png",
                sizes: "512x512",
                type: "image/png",
                purpose: "any"
            },
            {
                src: "/suhuella-icon-256.png",
                sizes: "256x256",
                type: "image/png",
                purpose: "any"
            },
            {
                src: "/suhuella-icon-192.png",
                sizes: "192x192",
                type: "image/png",
                purpose: "any"
            }
        ]
    },
    download: {
        macArtifactName: "${productName}-${version}.${ext}",
        windowsArtifactName: "${productName}-Setup-${version}.${ext}"
    },
    release: (0, __TURBOPACK__imported__module__$5b$project$5d2f$brands$2f$release$2d$manifest$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["brandReleaseFromManifest"])(__TURBOPACK__imported__module__$5b$project$5d2f$brands$2f$suhuella$2f$release$2e$json$2e5b$json$5d2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/brands/suhuella/entry.ts [app-client] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "applyBrandPresentation",
    ()=>applyBrandPresentation,
    "applyBrandPresentationDeep",
    ()=>applyBrandPresentationDeep,
    "brand",
    ()=>brand,
    "brandCssVars",
    ()=>brandCssVars,
    "desktopProtocolUrl",
    ()=>desktopProtocolUrl,
    "licenseOtpFromDisplay",
    ()=>licenseOtpFromDisplay,
    "licenseOtpReplyTo",
    ()=>licenseOtpReplyTo,
    "salesMailto",
    ()=>salesMailto,
    "siteOrigin",
    ()=>siteOrigin,
    "siteUrl",
    ()=>siteUrl,
    "supportMailto",
    ()=>supportMailto
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$brands$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/brands/api.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$brands$2f$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/brands/types.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$brands$2f$helpers$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/brands/helpers.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$brands$2f$theme$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/brands/theme.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$brands$2f$suhuella$2f$brand$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/brands/suhuella/brand.ts [app-client] (ecmascript)");
;
;
;
;
;
const { brand, siteOrigin, siteUrl, supportMailto, salesMailto, desktopProtocolUrl, applyBrandPresentation, applyBrandPresentationDeep, licenseOtpReplyTo, licenseOtpFromDisplay, brandCssVars } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$brands$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createBrandApi"])(__TURBOPACK__imported__module__$5b$project$5d2f$brands$2f$suhuella$2f$brand$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["suhuellaBrand"]);
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/brands/suhuella/release.json.[json].mjs [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
"use turbopack no side effects";
const __TURBOPACK__default__export__ = {
    "version": "0.1.0-pre-rc",
    "channel": "stable",
    "mandatory": false,
    "downloads": {
        "web": {
            "available": true
        },
        "mac": {
            "available": true,
            "url": "https://download.suhuella.com/latest/mac"
        },
        "windows": {
            "available": true,
            "url": "https://download.suhuella.com/latest/win"
        }
    },
    "minimumVersion": "0.1.0-pre-rc",
    "releaseDate": "2026-09-19",
    "notes": ""
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/brands/theme.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "HEX_COLOR",
    ()=>HEX_COLOR,
    "accentReadableOnNeutral",
    ()=>accentReadableOnNeutral,
    "assertBrandTheme",
    ()=>assertBrandTheme,
    "brandPresentationCssVars",
    ()=>brandPresentationCssVars,
    "brandThemeCssVars",
    ()=>brandThemeCssVars,
    "contrastRatio",
    ()=>contrastRatio,
    "darkenHex",
    ()=>darkenHex,
    "isHexColor",
    ()=>isHexColor,
    "parseHex",
    ()=>parseHex,
    "relativeLuminance",
    ()=>relativeLuminance,
    "resolveBrandTheme",
    ()=>resolveBrandTheme,
    "withAlpha",
    ()=>withAlpha
]);
const HEX_COLOR = /^#([0-9a-fA-F]{6})$/;
const WHITE = "#FFFFFF";
const BLACK = "#000000";
function isHexColor(value) {
    return HEX_COLOR.test(value.trim());
}
function parseHex(hex) {
    const match = HEX_COLOR.exec(hex.trim());
    if (!match) return null;
    const value = match[1];
    return {
        r: Number.parseInt(value.slice(0, 2), 16),
        g: Number.parseInt(value.slice(2, 4), 16),
        b: Number.parseInt(value.slice(4, 6), 16)
    };
}
function channelLuminance(channel) {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}
function relativeLuminance(hex) {
    const rgb = parseHex(hex);
    if (!rgb) return null;
    return 0.2126 * channelLuminance(rgb.r) + 0.7152 * channelLuminance(rgb.g) + 0.0722 * channelLuminance(rgb.b);
}
function contrastRatio(a, b) {
    const left = relativeLuminance(a);
    const right = relativeLuminance(b);
    if (left === null || right === null) return null;
    const lighter = Math.max(left, right);
    const darker = Math.min(left, right);
    return (lighter + 0.05) / (darker + 0.05);
}
function accentReadableOnNeutral(accent) {
    const onWhite = contrastRatio(accent, WHITE);
    const onBlack = contrastRatio(accent, BLACK);
    return onWhite !== null && onWhite >= 4.5 || onBlack !== null && onBlack >= 4.5;
}
function darkenHex(hex, amount = 0.08) {
    const rgb = parseHex(hex);
    if (!rgb) return hex;
    const scale = Math.max(0, 1 - amount);
    const toHex = (channel)=>Math.round(channel * scale).toString(16).padStart(2, "0");
    return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`.toUpperCase();
}
function withAlpha(hex, alpha = 0.1) {
    const rgb = parseHex(hex);
    if (!rgb) return hex;
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}
function resolveBrandTheme(theme) {
    const accent = theme.accent.trim().toUpperCase();
    const onAccent = theme.onAccent.trim().toUpperCase();
    return {
        accent,
        onAccent,
        accentHover: (theme.accentHover ?? darkenHex(accent, 0.08)).toUpperCase(),
        accentMuted: theme.accentMuted ?? withAlpha(accent, 0.1)
    };
}
function brandThemeCssVars(theme) {
    const resolved = resolveBrandTheme(theme);
    return {
        "--brand-accent": resolved.accent,
        "--brand-accent-hover": resolved.accentHover,
        "--brand-accent-muted": resolved.accentMuted,
        "--brand-on-accent": resolved.onAccent,
        "--nav-active-bg": resolved.accent,
        "--nav-active-fg": resolved.onAccent,
        "--overlay-strong": resolved.accent
    };
}
function brandPresentationCssVars(config) {
    return {
        ...brandThemeCssVars(config.theme),
        "--brand-surface": config.pwa.backgroundColor,
        "--landing-bg": config.pwa.backgroundColor
    };
}
function assertBrandTheme(theme, brandId) {
    if (!isHexColor(theme.accent)) {
        throw new Error(`${brandId} theme.accent must be #RRGGBB`);
    }
    if (!isHexColor(theme.onAccent)) {
        throw new Error(`${brandId} theme.onAccent must be #RRGGBB`);
    }
    if (theme.accentHover && !isHexColor(theme.accentHover)) {
        throw new Error(`${brandId} theme.accentHover must be #RRGGBB`);
    }
    if (!accentReadableOnNeutral(theme.accent)) {
        throw new Error(`${brandId} theme.accent must contrast 4.5:1 against white or black`);
    }
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/brands/types.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "BRAND_IDS",
    ()=>BRAND_IDS,
    "FORBIDDEN_BRAND_CONFIG_KEYS",
    ()=>FORBIDDEN_BRAND_CONFIG_KEYS,
    "OPERATOR_IDS",
    ()=>OPERATOR_IDS
]);
const BRAND_IDS = [
    "suhuella",
    "dbasenet"
];
const OPERATOR_IDS = [
    "self"
];
const FORBIDDEN_BRAND_CONFIG_KEYS = [
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "RESEND_API_KEY",
    "LICENSE_SIGNING_SECRET",
    "stripeSecretKey",
    "resendApiKey",
    "licenseSigningSecret",
    "d1Binding",
    "r2Credentials"
];
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/product/src/lib/app-locale.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "APP_LOCALE_EVENT",
    ()=>APP_LOCALE_EVENT,
    "APP_LOCALE_KEY",
    ()=>APP_LOCALE_KEY,
    "APP_LOCALE_USER_KEY",
    ()=>APP_LOCALE_USER_KEY,
    "appChromeCopy",
    ()=>appChromeCopy,
    "readAppLocale",
    ()=>readAppLocale,
    "subscribeAppLocale",
    ()=>subscribeAppLocale,
    "useAppLocale",
    ()=>useAppLocale,
    "writeAppLocale",
    ()=>writeAppLocale
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$brands$2f2e$build$2f$entry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/brands/.build/entry.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$brands$2f$suhuella$2f$entry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/brands/suhuella/entry.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/site/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
;
;
const APP_LOCALE_KEY = "suhuella-locale";
const APP_LOCALE_USER_KEY = "suhuella-locale-user";
const APP_LOCALE_EVENT = "suhuella-locale-change";
function isAppLocale(value) {
    return value === "es" || value === "en";
}
function detectDeviceLocale() {
    if (typeof navigator === "undefined") return "es";
    const languages = navigator.languages?.length ? navigator.languages : [
        navigator.language
    ];
    for (const language of languages){
        const lower = language.toLowerCase();
        if (lower.startsWith("es")) return "es";
        if (lower.startsWith("en")) return "en";
    }
    return "es";
}
function readAppLocale() {
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    const userSet = localStorage.getItem(APP_LOCALE_USER_KEY) === "true";
    if (userSet) {
        const stored = localStorage.getItem(APP_LOCALE_KEY);
        if (isAppLocale(stored)) return stored;
    }
    return detectDeviceLocale();
}
function writeAppLocale(locale) {
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    localStorage.setItem(APP_LOCALE_KEY, locale);
    localStorage.setItem(APP_LOCALE_USER_KEY, "true");
    document.documentElement.lang = locale;
    document.cookie = `${APP_LOCALE_KEY}=${locale};path=/;max-age=31536000;samesite=lax`;
    window.dispatchEvent(new Event(APP_LOCALE_EVENT));
}
function subscribeAppLocale(onStoreChange) {
    const handler = ()=>onStoreChange();
    window.addEventListener(APP_LOCALE_EVENT, handler);
    window.addEventListener("storage", handler);
    return ()=>{
        window.removeEventListener(APP_LOCALE_EVENT, handler);
        window.removeEventListener("storage", handler);
    };
}
const chrome = {
    es: {
        search: "Buscar",
        home: "Inicio",
        organise: "Organizar",
        sources: "Fuentes",
        activity: "Actividad",
        settings: "Ajustes",
        settingsIntro: "Cómo está configurada SuHuella.",
        general: "General",
        ai: "IA",
        license: "Licencia",
        privacy: "Privacidad",
        notifications: "Notificaciones",
        diagnostics: "Diagnóstico",
        about: "Acerca de",
        computer: "Ordenador",
        name: "Nombre",
        operatingSystem: "Sistema operativo",
        language: "Idioma",
        languageHint: "Aplica a SuHuella en este navegador y en el escritorio de este dispositivo.",
        openSettings: "Abrir Ajustes",
        freeActivate: "Gratis · Activar licencia",
        licenseNeedsAttention: "La licencia necesita atención",
        revokeTitle: "Revocar en este dispositivo",
        revokeBody: "Este dispositivo vuelve a Gratis. Tu compra no se cancela: puedes activar otro dispositivo más adelante.",
        revokeAction: "Revocar en este dispositivo",
        revokeDone: "Este dispositivo usa ahora la edición Gratis"
    },
    en: {
        search: "Search",
        home: "Home",
        organise: "Organise",
        sources: "Sources",
        activity: "Activity",
        settings: "Settings",
        settingsIntro: "How SuHuella is configured.",
        general: "General",
        ai: "AI",
        license: "License",
        privacy: "Privacy",
        notifications: "Notifications",
        diagnostics: "Diagnostics",
        about: "About",
        computer: "Computer",
        name: "Name",
        operatingSystem: "Operating system",
        language: "Language",
        languageHint: "Applies to SuHuella in this browser and on the desktop app on this device.",
        openSettings: "Open Settings",
        freeActivate: "Free · Activate license",
        licenseNeedsAttention: "License needs attention",
        revokeTitle: "Revoke on this computer",
        revokeBody: "This computer goes back to Free. Your purchase stays yours — you can activate another device later.",
        revokeAction: "Revoke on this computer",
        revokeDone: "This computer is now using Free edition"
    }
};
function appChromeCopy(locale) {
    const raw = chrome[locale];
    return {
        ...raw,
        settingsIntro: (0, __TURBOPACK__imported__module__$5b$project$5d2f$brands$2f$suhuella$2f$entry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["applyBrandPresentation"])(raw.settingsIntro),
        languageHint: (0, __TURBOPACK__imported__module__$5b$project$5d2f$brands$2f$suhuella$2f$entry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["applyBrandPresentation"])(raw.languageHint)
    };
}
function useAppLocale() {
    _s();
    const locale = (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useSyncExternalStore"])(subscribeAppLocale, readAppLocale, {
        "useAppLocale.useSyncExternalStore[locale]": ()=>"es"
    }["useAppLocale.useSyncExternalStore[locale]"]);
    const setLocale = (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useAppLocale.useCallback[setLocale]": (next)=>{
            writeAppLocale(next);
        }
    }["useAppLocale.useCallback[setLocale]"], []);
    return {
        locale,
        setLocale,
        t: appChromeCopy(locale)
    };
}
_s(useAppLocale, "4R01Fr55DAES5Kbo0mTcgtd7ET0=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useSyncExternalStore"]
    ];
});
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/site/components/AnimatedMeshBackground.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AnimatedMeshBackground",
    ()=>AnimatedMeshBackground
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/site/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/site/node_modules/framer-motion/dist/es/render/components/motion/proxy.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$folder$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Folder$3e$__ = __turbopack_context__.i("[project]/site/node_modules/lucide-react/dist/esm/icons/folder.mjs [app-client] (ecmascript) <export default as Folder>");
"use client";
;
;
;
const floatingFolders = [
    {
        className: "bottom-[8%] left-[4%] h-14 w-14 -rotate-6",
        iconClass: "h-7 w-7 text-violet-500",
        fill: "#8B5CF6",
        animate: {
            y: [
                0,
                -22,
                0
            ],
            rotate: [
                -6,
                8,
                -6
            ]
        },
        duration: 7
    },
    {
        className: "top-[12%] left-[22%] h-10 w-10 rotate-12",
        iconClass: "h-5 w-5 text-rose-500",
        fill: "#F43F5E",
        hideOnLanding: true,
        animate: {
            y: [
                0,
                18,
                0
            ],
            rotate: [
                12,
                -4,
                12
            ]
        },
        duration: 5.5
    },
    {
        className: "right-[4%] bottom-[28%] h-16 w-16 -rotate-12",
        iconClass: "h-8 w-8 text-emerald-500",
        fill: "#10B981",
        animate: {
            y: [
                0,
                -28,
                0
            ],
            rotate: [
                -12,
                6,
                -12
            ]
        },
        duration: 8
    },
    {
        className: "right-[20%] top-[18%] h-11 w-11 rotate-6",
        iconClass: "h-5 w-5 text-amber-500",
        fill: "#F59E0B",
        animate: {
            y: [
                0,
                20,
                0
            ],
            rotate: [
                6,
                -10,
                6
            ]
        },
        duration: 6
    },
    {
        className: "bottom-[38%] left-[14%] h-9 w-9 -rotate-3",
        iconClass: "h-4 w-4 text-sky-500",
        fill: "#0EA5E9",
        opacity: "opacity-90",
        hideOnLanding: true,
        animate: {
            y: [
                0,
                -14,
                0
            ],
            rotate: [
                -3,
                6,
                -3
            ]
        },
        duration: 5
    },
    {
        className: "top-[8%] right-[8%] h-12 w-12 rotate-[-8deg]",
        iconClass: "h-6 w-6 text-indigo-500",
        fill: "#6366F1",
        animate: {
            y: [
                0,
                16,
                0
            ],
            x: [
                0,
                -6,
                0
            ],
            rotate: [
                -8,
                4,
                -8
            ]
        },
        duration: 6.5
    },
    {
        className: "bottom-[18%] right-[32%] h-8 w-8 rotate-10",
        iconClass: "h-4 w-4 text-fuchsia-500",
        fill: "#D946EF",
        opacity: "opacity-85",
        animate: {
            y: [
                0,
                12,
                0
            ],
            rotate: [
                10,
                -6,
                10
            ]
        },
        duration: 4.8
    },
    {
        className: "top-[42%] left-[6%] h-11 w-11 -rotate-12",
        iconClass: "h-5 w-5 text-teal-500",
        fill: "#14B8A6",
        hideOnLanding: true,
        animate: {
            y: [
                0,
                -16,
                0
            ],
            rotate: [
                -12,
                5,
                -12
            ]
        },
        duration: 7.2
    },
    {
        className: "top-[28%] right-[38%] h-9 w-9 rotate-3",
        iconClass: "h-4 w-4 text-orange-500",
        fill: "#F97316",
        opacity: "opacity-80",
        animate: {
            y: [
                0,
                14,
                0
            ],
            rotate: [
                3,
                -5,
                3
            ]
        },
        duration: 5.2
    },
    {
        className: "bottom-[6%] right-[12%] h-10 w-10 -rotate-6",
        iconClass: "h-5 w-5 text-blue-500",
        fill: "#3B82F6",
        animate: {
            y: [
                0,
                -18,
                0
            ],
            rotate: [
                -6,
                8,
                -6
            ]
        },
        duration: 6.8
    },
    {
        className: "top-[55%] left-[28%] h-8 w-8 rotate-[-14deg]",
        iconClass: "h-4 w-4 text-violet-400",
        fill: "#A78BFA",
        opacity: "opacity-75",
        hideOnLanding: true,
        animate: {
            y: [
                0,
                10,
                0
            ],
            rotate: [
                -14,
                4,
                -14
            ]
        },
        duration: 4.5
    },
    {
        className: "bottom-[48%] right-[6%] h-[52px] w-[52px] rotate-8",
        iconClass: "h-6 w-6 text-rose-400",
        fill: "#FB7185",
        animate: {
            y: [
                0,
                -20,
                0
            ],
            rotate: [
                8,
                -6,
                8
            ]
        },
        duration: 7.5
    }
];
function AnimatedMeshBackground({ landing = false, contained = false }) {
    const visibleFolders = landing ? floatingFolders.filter((folder)=>!folder.hideOnLanding) : floatingFolders;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        "aria-hidden": true,
        className: contained ? "pointer-events-none absolute inset-0 overflow-hidden bg-[var(--brand-surface,#A7D8F9)]" : "pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[var(--brand-surface,#A7D8F9)]",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["motion"].div, {
                className: "absolute left-[10%] top-[20%] h-4 w-4 rounded-full bg-[#3B82F6]/80",
                animate: {
                    y: [
                        0,
                        -20,
                        0
                    ]
                },
                transition: {
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut"
                }
            }, void 0, false, {
                fileName: "[project]/site/components/AnimatedMeshBackground.tsx",
                lineNumber: 133,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["motion"].div, {
                className: "absolute right-[15%] top-[40%] h-3 w-3 rounded-full bg-[#3B82F6]/60",
                animate: {
                    y: [
                        0,
                        20,
                        0
                    ]
                },
                transition: {
                    duration: 5,
                    repeat: Infinity,
                    ease: "easeInOut"
                }
            }, void 0, false, {
                fileName: "[project]/site/components/AnimatedMeshBackground.tsx",
                lineNumber: 138,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["motion"].div, {
                className: "absolute bottom-[20%] left-[25%] h-6 w-6 rounded-full bg-white/60",
                animate: {
                    y: [
                        0,
                        -15,
                        0
                    ]
                },
                transition: {
                    duration: 6,
                    repeat: Infinity,
                    ease: "easeInOut"
                }
            }, void 0, false, {
                fileName: "[project]/site/components/AnimatedMeshBackground.tsx",
                lineNumber: 143,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["motion"].div, {
                className: "absolute right-[25%] top-[15%] h-8 w-8 rounded-full bg-white/40",
                animate: {
                    y: [
                        0,
                        25,
                        0
                    ]
                },
                transition: {
                    duration: 7,
                    repeat: Infinity,
                    ease: "easeInOut"
                }
            }, void 0, false, {
                fileName: "[project]/site/components/AnimatedMeshBackground.tsx",
                lineNumber: 148,
                columnNumber: 7
            }, this),
            visibleFolders.map((item, index)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["motion"].div, {
                    className: `absolute flex items-center justify-center rounded-2xl border border-white/50 bg-white/45 shadow-lg backdrop-blur-md ${item.opacity ?? "opacity-95"} ${item.className}`,
                    animate: item.animate,
                    transition: {
                        duration: item.duration,
                        repeat: Infinity,
                        ease: "easeInOut"
                    },
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$folder$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Folder$3e$__["Folder"], {
                        className: item.iconClass,
                        fill: item.fill,
                        strokeWidth: 1.5
                    }, void 0, false, {
                        fileName: "[project]/site/components/AnimatedMeshBackground.tsx",
                        lineNumber: 165,
                        columnNumber: 15
                    }, this)
                }, index, false, {
                    fileName: "[project]/site/components/AnimatedMeshBackground.tsx",
                    lineNumber: 155,
                    columnNumber: 13
                }, this))
        ]
    }, void 0, true, {
        fileName: "[project]/site/components/AnimatedMeshBackground.tsx",
        lineNumber: 125,
        columnNumber: 5
    }, this);
}
_c = AnimatedMeshBackground;
var _c;
__turbopack_context__.k.register(_c, "AnimatedMeshBackground");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/site/components/LanguageSwitcher.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "LanguageSwitcher",
    ()=>LanguageSwitcher
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/site/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$components$2f$providers$2f$LocaleProvider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/site/components/providers/LocaleProvider.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
const options = [
    "es",
    "en"
];
function LanguageSwitcher({ inline = false }) {
    _s();
    const { locale, setLocale } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$components$2f$providers$2f$LocaleProvider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useLocale"])();
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: inline ? "flex items-center gap-0.5 rounded-full border border-white/70 bg-white/80 p-1 shadow-sm backdrop-blur-sm" : "fixed top-5 right-5 z-50 flex items-center gap-0.5 rounded-full border border-white/70 bg-white/80 p-1 shadow-sm backdrop-blur-sm",
        children: options.map((option)=>{
            const active = locale === option;
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                type: "button",
                onClick: ()=>setLocale(option),
                className: `rounded-full px-3 py-1.5 text-xs font-semibold tracking-wide uppercase transition-all duration-200 ${active ? "bg-[var(--nav-active-bg)] text-[var(--nav-active-fg)] shadow-sm" : "text-slate-500 hover:text-slate-800"}`,
                "aria-pressed": active,
                "aria-label": option === "es" ? "Español" : "English",
                children: option
            }, option, false, {
                fileName: "[project]/site/components/LanguageSwitcher.tsx",
                lineNumber: 26,
                columnNumber: 11
            }, this);
        })
    }, void 0, false, {
        fileName: "[project]/site/components/LanguageSwitcher.tsx",
        lineNumber: 16,
        columnNumber: 5
    }, this);
}
_s(LanguageSwitcher, "Fo5P0XCsX2RYC5mXl+ijSeGkVFY=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$components$2f$providers$2f$LocaleProvider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useLocale"]
    ];
});
_c = LanguageSwitcher;
var _c;
__turbopack_context__.k.register(_c, "LanguageSwitcher");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/site/components/icons/BrandMark.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "BrandMark",
    ()=>BrandMark
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/site/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$brands$2f2e$build$2f$entry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/brands/.build/entry.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$brands$2f$suhuella$2f$entry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/brands/suhuella/entry.ts [app-client] (ecmascript) <locals>");
;
;
function BrandMark({ className = "", size = 20, "aria-label": ariaLabel }) {
    if (__TURBOPACK__imported__module__$5b$project$5d2f$brands$2f$suhuella$2f$entry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["brand"].id === "suhuella") {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
            src: __TURBOPACK__imported__module__$5b$project$5d2f$brands$2f$suhuella$2f$entry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["brand"].icon.public256,
            alt: "",
            width: size,
            height: size,
            "aria-hidden": ariaLabel ? undefined : true,
            "aria-label": ariaLabel,
            className: `block shrink-0 rounded-[22%] object-contain ${className}`.trim()
        }, void 0, false, {
            fileName: "[project]/site/components/icons/BrandMark.tsx",
            lineNumber: 13,
            columnNumber: 7
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
        src: __TURBOPACK__imported__module__$5b$project$5d2f$brands$2f$suhuella$2f$entry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["brand"].logo.publicSvg,
        alt: "",
        width: size,
        height: size,
        "aria-hidden": ariaLabel ? undefined : true,
        "aria-label": ariaLabel,
        className: `block shrink-0 object-contain ${className}`.trim()
    }, void 0, false, {
        fileName: "[project]/site/components/icons/BrandMark.tsx",
        lineNumber: 26,
        columnNumber: 5
    }, this);
}
_c = BrandMark;
var _c;
__turbopack_context__.k.register(_c, "BrandMark");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/site/components/icons/SuhuellaWordmark.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "SuhuellaWordmark",
    ()=>SuhuellaWordmark
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/site/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$brands$2f2e$build$2f$entry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/brands/.build/entry.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$brands$2f$suhuella$2f$entry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/brands/suhuella/entry.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$components$2f$icons$2f$BrandMark$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/site/components/icons/BrandMark.tsx [app-client] (ecmascript)");
;
;
;
function SuhuellaWordmark({ className = "", glyphClassName = "h-5 w-5 shrink-0", textClassName = "text-sm font-semibold tracking-[-0.02em] text-slate-900", variant = "horizontal", tagline, taglineClassName = "text-xs text-slate-500" }) {
    if (variant === "compact") {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$site$2f$components$2f$icons$2f$BrandMark$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BrandMark"], {
            className: glyphClassName,
            "aria-label": __TURBOPACK__imported__module__$5b$project$5d2f$brands$2f$suhuella$2f$entry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["brand"].displayName
        }, void 0, false, {
            fileName: "[project]/site/components/icons/SuhuellaWordmark.tsx",
            lineNumber: 22,
            columnNumber: 12
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        className: `inline-flex min-w-0 items-center gap-2 ${className}`.trim(),
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$site$2f$components$2f$icons$2f$BrandMark$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BrandMark"], {
                className: glyphClassName
            }, void 0, false, {
                fileName: "[project]/site/components/icons/SuhuellaWordmark.tsx",
                lineNumber: 27,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "min-w-0",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: `block ${textClassName}`.trim(),
                        children: __TURBOPACK__imported__module__$5b$project$5d2f$brands$2f$suhuella$2f$entry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["brand"].displayName
                    }, void 0, false, {
                        fileName: "[project]/site/components/icons/SuhuellaWordmark.tsx",
                        lineNumber: 29,
                        columnNumber: 9
                    }, this),
                    tagline ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: `mt-0.5 block ${taglineClassName}`.trim(),
                        children: tagline
                    }, void 0, false, {
                        fileName: "[project]/site/components/icons/SuhuellaWordmark.tsx",
                        lineNumber: 31,
                        columnNumber: 11
                    }, this) : null
                ]
            }, void 0, true, {
                fileName: "[project]/site/components/icons/SuhuellaWordmark.tsx",
                lineNumber: 28,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/site/components/icons/SuhuellaWordmark.tsx",
        lineNumber: 26,
        columnNumber: 5
    }, this);
}
_c = SuhuellaWordmark;
var _c;
__turbopack_context__.k.register(_c, "SuhuellaWordmark");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/site/components/providers/LocaleProvider.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "LocaleProvider",
    ()=>LocaleProvider,
    "useLocale",
    ()=>useLocale
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/site/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/site/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$app$2d$locale$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/product/src/lib/app-locale.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$lib$2f$i18n$2f$dictionary$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/site/lib/i18n/dictionary.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature();
"use client";
;
;
;
const LocaleContext = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createContext"])(null);
function readLocale() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$app$2d$locale$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["readAppLocale"])();
}
function getServerSnapshot() {
    return "es";
}
function LocaleProvider({ children }) {
    _s();
    const locale = (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useSyncExternalStore"])(__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$app$2d$locale$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["subscribeAppLocale"], readLocale, getServerSnapshot);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "LocaleProvider.useEffect": ()=>{
            document.documentElement.lang = locale;
        }
    }["LocaleProvider.useEffect"], [
        locale
    ]);
    const setLocale = (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "LocaleProvider.useCallback[setLocale]": (next)=>{
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$product$2f$src$2f$lib$2f$app$2d$locale$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["writeAppLocale"])(next);
        }
    }["LocaleProvider.useCallback[setLocale]"], []);
    const value = (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "LocaleProvider.useMemo[value]": ()=>({
                locale,
                setLocale,
                t: (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$lib$2f$i18n$2f$dictionary$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getDictionary"])(locale)
            })
    }["LocaleProvider.useMemo[value]"], [
        locale,
        setLocale
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(LocaleContext.Provider, {
        value: value,
        children: children
    }, void 0, false, {
        fileName: "[project]/site/components/providers/LocaleProvider.tsx",
        lineNumber: 61,
        columnNumber: 5
    }, this);
}
_s(LocaleProvider, "ker7prhgz4Nk1aBU9dqksurTM8Y=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useSyncExternalStore"]
    ];
});
_c = LocaleProvider;
function useLocale() {
    _s1();
    const context = (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useContext"])(LocaleContext);
    if (!context) {
        throw new Error("useLocale must be used within LocaleProvider");
    }
    return context;
}
_s1(useLocale, "b9L3QQ+jgeyIrH0NfHrJ8nn7VMU=");
var _c;
__turbopack_context__.k.register(_c, "LocaleProvider");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/site/components/web/RouteOverlayFrame.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "RouteOverlayFrame",
    ()=>RouteOverlayFrame
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/site/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__ = __turbopack_context__.i("[project]/site/node_modules/lucide-react/dist/esm/icons/x.mjs [app-client] (ecmascript) <export default as X>");
var __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/site/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2d$dom$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/site/node_modules/next/dist/compiled/react-dom/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$components$2f$AnimatedMeshBackground$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/site/components/AnimatedMeshBackground.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$components$2f$LanguageSwitcher$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/site/components/LanguageSwitcher.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$components$2f$icons$2f$SuhuellaWordmark$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/site/components/icons/SuhuellaWordmark.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
;
function RouteOverlayFrame({ ariaLabel, onClose, children }) {
    _s();
    const dialogRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const [mounted, setMounted] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "RouteOverlayFrame.useEffect": ()=>{
            setMounted(true);
        }
    }["RouteOverlayFrame.useEffect"], []);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "RouteOverlayFrame.useEffect": ()=>{
            if (!mounted) return;
            const dialog = dialogRef.current;
            if (!dialog) return;
            const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            dialog.focus();
            const onKeyDown = {
                "RouteOverlayFrame.useEffect.onKeyDown": (event)=>{
                    if (event.key !== "Tab") return;
                    const focusable = dialog.querySelectorAll('a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])');
                    if (focusable.length === 0) return;
                    const first = focusable[0];
                    const last = focusable[focusable.length - 1];
                    if (event.shiftKey && document.activeElement === first) {
                        event.preventDefault();
                        last.focus();
                    } else if (!event.shiftKey && document.activeElement === last) {
                        event.preventDefault();
                        first.focus();
                    }
                }
            }["RouteOverlayFrame.useEffect.onKeyDown"];
            dialog.addEventListener("keydown", onKeyDown);
            return ({
                "RouteOverlayFrame.useEffect": ()=>{
                    dialog.removeEventListener("keydown", onKeyDown);
                    previousFocus?.focus();
                }
            })["RouteOverlayFrame.useEffect"];
        }
    }["RouteOverlayFrame.useEffect"], [
        mounted
    ]);
    if (!mounted) return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2d$dom$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createPortal"])(/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        ref: dialogRef,
        "data-route-overlay": true,
        role: "dialog",
        "aria-modal": "true",
        "aria-label": ariaLabel,
        tabIndex: -1,
        className: "fixed inset-0 z-[100] flex items-center justify-center p-3 outline-none sm:p-4",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                type: "button",
                "aria-label": "Close overlay",
                className: "absolute inset-0 bg-slate-950/40",
                onClick: onClose
            }, void 0, false, {
                fileName: "[project]/site/components/web/RouteOverlayFrame.tsx",
                lineNumber: 72,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "route-overlay-island landing-surface relative z-10 flex h-[min(50dvh,28rem)] w-[min(36rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-white/50 text-slate-900 shadow-2xl [color-scheme:light]",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$site$2f$components$2f$AnimatedMeshBackground$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AnimatedMeshBackground"], {
                        landing: true,
                        contained: true
                    }, void 0, false, {
                        fileName: "[project]/site/components/web/RouteOverlayFrame.tsx",
                        lineNumber: 80,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "relative z-10 min-h-0 flex-1 overflow-y-auto px-4 py-5 text-slate-900 sm:px-5",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "mb-3 flex items-center justify-between gap-2",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$site$2f$components$2f$icons$2f$SuhuellaWordmark$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SuhuellaWordmark"], {
                                        glyphClassName: "h-6 w-6",
                                        textClassName: "text-sm font-semibold tracking-[-0.02em]"
                                    }, void 0, false, {
                                        fileName: "[project]/site/components/web/RouteOverlayFrame.tsx",
                                        lineNumber: 83,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex items-center gap-2",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$site$2f$components$2f$LanguageSwitcher$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["LanguageSwitcher"], {
                                                inline: true
                                            }, void 0, false, {
                                                fileName: "[project]/site/components/web/RouteOverlayFrame.tsx",
                                                lineNumber: 88,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                type: "button",
                                                onClick: onClose,
                                                "aria-label": "Close",
                                                className: "flex h-9 w-9 items-center justify-center rounded-full border border-white/70 bg-white/80 text-slate-800 shadow-sm backdrop-blur-sm transition hover:bg-white hover:text-slate-950",
                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__["X"], {
                                                    className: "h-4 w-4",
                                                    strokeWidth: 2
                                                }, void 0, false, {
                                                    fileName: "[project]/site/components/web/RouteOverlayFrame.tsx",
                                                    lineNumber: 95,
                                                    columnNumber: 17
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/site/components/web/RouteOverlayFrame.tsx",
                                                lineNumber: 89,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/site/components/web/RouteOverlayFrame.tsx",
                                        lineNumber: 87,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/site/components/web/RouteOverlayFrame.tsx",
                                lineNumber: 82,
                                columnNumber: 11
                            }, this),
                            children
                        ]
                    }, void 0, true, {
                        fileName: "[project]/site/components/web/RouteOverlayFrame.tsx",
                        lineNumber: 81,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/site/components/web/RouteOverlayFrame.tsx",
                lineNumber: 79,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/site/components/web/RouteOverlayFrame.tsx",
        lineNumber: 63,
        columnNumber: 5
    }, this), document.body);
}
_s(RouteOverlayFrame, "g99YuGOk4sM/QvIiEke8HlugDLs=");
_c = RouteOverlayFrame;
var _c;
__turbopack_context__.k.register(_c, "RouteOverlayFrame");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/site/components/web/RouteOverlayShell.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "RouteOverlayShell",
    ()=>RouteOverlayShell
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/site/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$shared$2f$lib$2f$app$2d$dynamic$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/site/node_modules/next/dist/shared/lib/app-dynamic.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/site/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/site/node_modules/next/navigation.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$brands$2f2e$build$2f$entry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/brands/.build/entry.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$brands$2f$suhuella$2f$entry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/brands/suhuella/entry.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$components$2f$web$2f$RouteOverlayFrame$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/site/components/web/RouteOverlayFrame.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$components$2f$providers$2f$LocaleProvider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/site/components/providers/LocaleProvider.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$lib$2f$route$2d$overlay$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/site/lib/route-overlay.ts [app-client] (ecmascript)");
;
;
;
;
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
;
;
const LandingContent = (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$shared$2f$lib$2f$app$2d$dynamic$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])(()=>__turbopack_context__.A("[project]/site/components/LandingContent.tsx [app-client] (ecmascript, next/dynamic entry, async loader)").then((mod)=>({
            default: mod.LandingContent
        })), {
    loadableGenerated: {
        modules: [
            "[project]/site/components/LandingContent.tsx [app-client] (ecmascript, next/dynamic entry)"
        ]
    },
    ssr: false
});
_c = LandingContent;
const LicensePlansPage = (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$shared$2f$lib$2f$app$2d$dynamic$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])(()=>__turbopack_context__.A("[project]/site/components/LicensePlansPage.tsx [app-client] (ecmascript, next/dynamic entry, async loader)").then((mod)=>({
            default: mod.LicensePlansPage
        })), {
    loadableGenerated: {
        modules: [
            "[project]/site/components/LicensePlansPage.tsx [app-client] (ecmascript, next/dynamic entry)"
        ]
    },
    ssr: false
});
_c1 = LicensePlansPage;
const DownloadCatalogContent = (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$shared$2f$lib$2f$app$2d$dynamic$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])(()=>__turbopack_context__.A("[project]/site/components/DownloadCatalogContent.tsx [app-client] (ecmascript, next/dynamic entry, async loader)").then((mod)=>({
            default: mod.DownloadCatalogContent
        })), {
    loadableGenerated: {
        modules: [
            "[project]/site/components/DownloadCatalogContent.tsx [app-client] (ecmascript, next/dynamic entry)"
        ]
    },
    ssr: false
});
_c2 = DownloadCatalogContent;
const SuccessContent = (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$shared$2f$lib$2f$app$2d$dynamic$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])(()=>__turbopack_context__.A("[project]/site/components/SuccessContent.tsx [app-client] (ecmascript, next/dynamic entry, async loader)").then((mod)=>({
            default: mod.SuccessContent
        })), {
    loadableGenerated: {
        modules: [
            "[project]/site/components/SuccessContent.tsx [app-client] (ecmascript, next/dynamic entry)"
        ]
    },
    ssr: false
});
_c3 = SuccessContent;
function overlayLabel(overlay, locale) {
    if (overlay === "landing") return __TURBOPACK__imported__module__$5b$project$5d2f$brands$2f$suhuella$2f$entry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["brand"].displayName;
    if (overlay === "license") return locale === "es" ? "Planes y licencias" : "Plans and licenses";
    if (overlay === "download") {
        return locale === "es" ? `Descargas de ${__TURBOPACK__imported__module__$5b$project$5d2f$brands$2f$suhuella$2f$entry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["brand"].displayName}` : `${__TURBOPACK__imported__module__$5b$project$5d2f$brands$2f$suhuella$2f$entry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["brand"].displayName} downloads`;
    }
    return locale === "es" ? "Estado de la compra" : "Purchase status";
}
function RouteOverlayShell({ children, overlay: initialOverlay, release, installerUrls, paidCheckoutEnabled, desktopDownloadAvailable }) {
    _s();
    const pathname = (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["usePathname"])();
    const { locale } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$components$2f$providers$2f$LocaleProvider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useLocale"])();
    const overlay = (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$lib$2f$route$2d$overlay$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["overlayFromPathname"])(pathname) ?? initialOverlay;
    const closeOverlay = (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "RouteOverlayShell.useCallback[closeOverlay]": ()=>{
            window.location.assign((0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$lib$2f$route$2d$overlay$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["overlayHomePath"])());
        }
    }["RouteOverlayShell.useCallback[closeOverlay]"], []);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "RouteOverlayShell.useEffect": ()=>{
            if (!overlay) return;
            const onKeyDown = {
                "RouteOverlayShell.useEffect.onKeyDown": (event)=>{
                    if (event.key === "Escape") {
                        event.preventDefault();
                        closeOverlay();
                    }
                }
            }["RouteOverlayShell.useEffect.onKeyDown"];
            window.addEventListener("keydown", onKeyDown);
            return ({
                "RouteOverlayShell.useEffect": ()=>window.removeEventListener("keydown", onKeyDown)
            })["RouteOverlayShell.useEffect"];
        }
    }["RouteOverlayShell.useEffect"], [
        overlay,
        closeOverlay
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            children,
            overlay ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$site$2f$components$2f$web$2f$RouteOverlayFrame$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["RouteOverlayFrame"], {
                ariaLabel: overlayLabel(overlay, locale),
                onClose: closeOverlay,
                children: [
                    overlay === "landing" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(LandingContent, {
                        embedded: true,
                        installerUrls: installerUrls,
                        onClose: closeOverlay
                    }, void 0, false, {
                        fileName: "[project]/site/components/web/RouteOverlayShell.tsx",
                        lineNumber: 88,
                        columnNumber: 13
                    }, this) : null,
                    overlay === "license" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Suspense"], {
                        fallback: null,
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(LicensePlansPage, {
                            embedded: true,
                            desktopDownloadAvailable: desktopDownloadAvailable,
                            paidCheckoutEnabled: paidCheckoutEnabled,
                            onClose: closeOverlay
                        }, void 0, false, {
                            fileName: "[project]/site/components/web/RouteOverlayShell.tsx",
                            lineNumber: 92,
                            columnNumber: 15
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/site/components/web/RouteOverlayShell.tsx",
                        lineNumber: 91,
                        columnNumber: 13
                    }, this) : null,
                    overlay === "download" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(DownloadCatalogContent, {
                        embedded: true,
                        release: release,
                        onClose: closeOverlay
                    }, void 0, false, {
                        fileName: "[project]/site/components/web/RouteOverlayShell.tsx",
                        lineNumber: 101,
                        columnNumber: 13
                    }, this) : null,
                    overlay === "success" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Suspense"], {
                        fallback: null,
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SuccessContent, {
                            embedded: true,
                            plansHref: "/license",
                            onClose: closeOverlay
                        }, void 0, false, {
                            fileName: "[project]/site/components/web/RouteOverlayShell.tsx",
                            lineNumber: 105,
                            columnNumber: 15
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/site/components/web/RouteOverlayShell.tsx",
                        lineNumber: 104,
                        columnNumber: 13
                    }, this) : null
                ]
            }, void 0, true, {
                fileName: "[project]/site/components/web/RouteOverlayShell.tsx",
                lineNumber: 86,
                columnNumber: 9
            }, this) : null
        ]
    }, void 0, true, {
        fileName: "[project]/site/components/web/RouteOverlayShell.tsx",
        lineNumber: 83,
        columnNumber: 5
    }, this);
}
_s(RouteOverlayShell, "617Bzof9Y1DqeUvvZdC7w8eBAak=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["usePathname"],
        __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$components$2f$providers$2f$LocaleProvider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useLocale"]
    ];
});
_c4 = RouteOverlayShell;
var _c, _c1, _c2, _c3, _c4;
__turbopack_context__.k.register(_c, "LandingContent");
__turbopack_context__.k.register(_c1, "LicensePlansPage");
__turbopack_context__.k.register(_c2, "DownloadCatalogContent");
__turbopack_context__.k.register(_c3, "SuccessContent");
__turbopack_context__.k.register(_c4, "RouteOverlayShell");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/site/components/web/SuhuellaApp.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "SuhuellaApp",
    ()=>SuhuellaApp
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/site/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$shared$2f$lib$2f$app$2d$dynamic$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/site/node_modules/next/dist/shared/lib/app-dynamic.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/site/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$components$2f$providers$2f$LocaleProvider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/site/components/providers/LocaleProvider.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$components$2f$web$2f$RouteOverlayShell$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/site/components/web/RouteOverlayShell.tsx [app-client] (ecmascript)");
;
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
const SettingsWindow = (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$shared$2f$lib$2f$app$2d$dynamic$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"])(()=>__turbopack_context__.A("[project]/packages/product/src/windows/SettingsWindow.tsx [app-client] (ecmascript, next/dynamic entry, async loader)").then((mod)=>({
            default: mod.SettingsWindow
        })), {
    loadableGenerated: {
        modules: [
            "[project]/packages/product/src/windows/SettingsWindow.tsx [app-client] (ecmascript, next/dynamic entry)"
        ]
    },
    ssr: false,
    loading: ()=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            "data-suhuella-app": true,
            className: "h-dvh w-full bg-[var(--app-bg)]"
        }, void 0, false, {
            fileName: "[project]/site/components/web/SuhuellaApp.tsx",
            lineNumber: 16,
            columnNumber: 32
        }, ("TURBOPACK compile-time value", void 0))
});
_c = SettingsWindow;
function scheduleIdle(callback) {
    const idle = globalThis.requestIdleCallback;
    if (typeof idle === "function") {
        const id = idle(callback);
        return ()=>{
            const cancel = globalThis.cancelIdleCallback;
            cancel?.(id);
        };
    }
    const id = window.setTimeout(callback, 0);
    return ()=>window.clearTimeout(id);
}
function SuhuellaApp({ overlay, release, installerUrls, paidCheckoutEnabled, desktopDownloadAvailable }) {
    _s();
    const [hostReady, setHostReady] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "SuhuellaApp.useEffect": ()=>{
            let cancelled = false;
            const boot = {
                "SuhuellaApp.useEffect.boot": ()=>{
                    void __turbopack_context__.A("[project]/packages/product/src/host/install-browser-host.ts [app-client] (ecmascript, async loader)").then({
                        "SuhuellaApp.useEffect.boot": ({ installBrowserHost })=>{
                            if (cancelled) return;
                            installBrowserHost();
                            setHostReady(true);
                        }
                    }["SuhuellaApp.useEffect.boot"]);
                }
            }["SuhuellaApp.useEffect.boot"];
            if (overlay) {
                return scheduleIdle(boot);
            }
            boot();
            return ({
                "SuhuellaApp.useEffect": ()=>{
                    cancelled = true;
                }
            })["SuhuellaApp.useEffect"];
        }
    }["SuhuellaApp.useEffect"], [
        overlay
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$site$2f$components$2f$providers$2f$LocaleProvider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["LocaleProvider"], {
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$site$2f$components$2f$web$2f$RouteOverlayShell$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["RouteOverlayShell"], {
            overlay: overlay,
            release: release,
            installerUrls: installerUrls,
            paidCheckoutEnabled: paidCheckoutEnabled,
            desktopDownloadAvailable: desktopDownloadAvailable,
            children: hostReady ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                "data-suhuella-app": true,
                className: "h-dvh min-h-0 w-full overflow-hidden bg-[var(--app-bg)] text-[var(--app-fg)]",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SettingsWindow, {}, void 0, false, {
                    fileName: "[project]/site/components/web/SuhuellaApp.tsx",
                    lineNumber: 84,
                    columnNumber: 13
                }, this)
            }, void 0, false, {
                fileName: "[project]/site/components/web/SuhuellaApp.tsx",
                lineNumber: 80,
                columnNumber: 11
            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$site$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                "data-suhuella-app": true,
                className: "h-dvh w-full bg-[var(--app-bg)]"
            }, void 0, false, {
                fileName: "[project]/site/components/web/SuhuellaApp.tsx",
                lineNumber: 87,
                columnNumber: 11
            }, this)
        }, void 0, false, {
            fileName: "[project]/site/components/web/SuhuellaApp.tsx",
            lineNumber: 72,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/site/components/web/SuhuellaApp.tsx",
        lineNumber: 71,
        columnNumber: 5
    }, this);
}
_s(SuhuellaApp, "nEo22RU1FpSokKc5233p2D7fN+4=");
_c1 = SuhuellaApp;
var _c, _c1;
__turbopack_context__.k.register(_c, "SettingsWindow");
__turbopack_context__.k.register(_c1, "SuhuellaApp");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/site/lib/i18n/dictionary.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "dictionaries",
    ()=>dictionaries,
    "getDictionary",
    ()=>getDictionary
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$brands$2f2e$build$2f$entry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/brands/.build/entry.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$brands$2f$suhuella$2f$entry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/brands/suhuella/entry.ts [app-client] (ecmascript) <locals>");
;
const es = {
    meta: {
        title: "SuHuella — La carpeta correcta al guardar",
        description: "SuHuella Web te deja probar SuHuella en este dispositivo. Todo permanece en local. La app de escritorio estará disponible más adelante."
    },
    pageTitles: {
        download: "Descarga",
        license: "Licencia"
    },
    success: {
        title: "Tu pago se ha completado",
        verifiedTitle: "Pago confirmado",
        description: "Gracias por tu compra. Elige tu plataforma e instala SuHuella en un minuto.",
        downloadWindows: "Descargar SuHuella para Windows",
        downloadMac: "Descargar SuHuella para macOS",
        downloadCta: "Descargar SuHuella",
        backHome: "Volver al inicio",
        verifying: "Confirmando tu pago",
        verifyingHint: "Solo un momento.",
        missingSessionTitle: "Esta página es solo después de pagar",
        missingSessionDescription: "Completa la compra para descargar SuHuella. Si ya pagaste, abre el enlace de tu recibo o escríbenos a support@suhuella.com.",
        invalidSessionTitle: "No hemos podido confirmar este pago",
        invalidSessionDescription: "Puedes seguir: vuelve a intentarlo o escríbenos a support@suhuella.com. Si ya pagaste, te ayudamos con la descarga.",
        unauthorizedTitle: "No hemos podido confirmar tu compra",
        unauthorizedDescription: "Completa la compra para descargar SuHuella. Si ya pagaste, escríbenos a support@suhuella.com.",
        retryPurchase: "Ver planes",
        viewPlans: "Ver planes",
        lifetimeUnavailable: "Lifetime aún no está disponible.",
        monthlyUnavailable: "Monthly aún no está disponible.",
        planUnavailable: "Este plan aún no está disponible.",
        installersPending: "Tu pago está confirmado. El instalador aún no está listo. Puedes seguir: escríbenos a support@suhuella.com y te lo enviamos.",
        mvpWarning: "Versión inicial: algunas aplicaciones pueden no mostrar sugerencias todavía. Puedes seguir guardando como siempre.",
        support: "¿Necesitas ayuda? support@suhuella.com",
        trayNote: "SuHuella espera en la bandeja del sistema y solo aparece cuando lo necesitas.",
        installTitle: "Qué hacer ahora",
        installSteps: [
            "Descarga el instalador de tu sistema.",
            "Si Windows o macOS avisan que no está firmado, continúa: Más información → Ejecutar de todos modos, o clic derecho → Abrir.",
            "Abre SuHuella. No aparece una ventana: busca el icono en la bandeja (Windows) o en la barra de menús (macOS).",
            "Pulsa la notificación o el icono, añade las carpetas que ya usas y sigue guardando."
        ],
        unsignedNote: "El instalador aún no está firmado. La advertencia del sistema es esperada. Luego SuHuella espera en la bandeja.",
        downloadUnavailableTitle: "La descarga aún no está lista",
        downloadUnavailableDescription: "Tu pago está confirmado. El instalador no está listo todavía. Puedes seguir: escríbenos a support@suhuella.com y te lo enviamos.",
        licenseActivated: "Licencia activada",
        openApp: "Abrir SuHuella",
        downloadIfMissing: "Si SuHuella no se abre, descárgala e instálala.",
        paymentIncomplete: "El pago no se ha completado.",
        purchaseConfirmed: "Compra confirmada",
        alreadyInstalled: "¿Ya está instalada? Abre SuHuella para activar este dispositivo.",
        continueInBrowser: "Usar SuHuella en este navegador",
        checkoutCanceled: "Checkout cancelado. Tu plan no ha cambiado.",
        modalNoPurchaseTitle: "No hay ninguna compra que confirmar",
        modalNoPurchaseDescription: "No hemos podido verificar una sesión de checkout. Puedes seguir usando SuHuella Web o ver los planes."
    },
    welcomeModal: {
        title: "Organiza documentos sin perder el control",
        body: "SuHuella aprende de las carpetas que tú eliges y sugiere dónde guardar u organizar documentos. Tus archivos permanecen en este dispositivo. Nada se mueve sin tu confirmación.",
        start: "Empezar",
        viewPlans: "Ver planes",
        howItWorks: "¿Cómo funciona?"
    },
    hero: {
        badge: {
            name: "SuHuella"
        },
        title: "Guarda tus archivos en la carpeta correcta. Al instante.",
        subtitle: "SuHuella Web te deja probarla en este dispositivo. Todo permanece en local. La app de escritorio dará la experiencia nativa más adelante."
    },
    features: {
        eyebrow: "Por qué SuHuella",
        title: "Privada, silenciosa y tuya",
        items: [
            {
                title: "Todo permanece en tu ordenador",
                description: "El contenido de tus archivos no se envía a ningún sitio. SuHuella funciona sin conexión."
            },
            {
                title: "En este navegador ahora",
                description: "Ábrela aquí, sin instalar nada. La app de escritorio dará la experiencia nativa más adelante."
            },
            {
                title: "Planes de pago más adelante",
                description: "Los planes de pago aún no están disponibles. Mientras tanto, ábrela en este navegador."
            }
        ]
    },
    download: {
        title: "Descarga SuHuella",
        subtitle: "Instálalo en un minuto. Luego sigue guardando como siempre.",
        windows: "Windows",
        mac: "macOS",
        orBuy: "¿Aún no has comprado?",
        trayNote: "Espera en la bandeja del sistema y solo aparece cuando lo necesitas.",
        unavailable: "Aún no disponible",
        comingSoon: "La app de escritorio estará disponible pronto. Mientras tanto, ábrela en este navegador.",
        catalogTitle: "Descargas de SuHuella",
        catalogSubtitle: "Aquí aparecerán las versiones públicas de SuHuella Desktop cuando estén disponibles. Mientras tanto, puedes usar SuHuella Web en este navegador.",
        catalogSubtitleWithMac: "La descarga es pública. SuHuella Desktop Mac es pre-RC. Al abrir la app, la licencia comprueba edición y capacidades. El checkout de pago sigue desactivado.",
        stateWebTitle: "SuHuella Web",
        stateWebAvailable: "Disponible ahora",
        stateWebAction: "Abrir SuHuella",
        stateDesktopTitle: "SuHuella Desktop",
        stateDesktopUnavailable: "Todavía no disponible en esta pre-RC.",
        stateDesktopNoInstallers: "No hay instaladores públicos para Mac o Windows en este momento.",
        stateMacTitle: "SuHuella Desktop Mac",
        stateMacAvailable: "Disponible",
        stateMacAction: "Descargar para Mac",
        stateWindowsTitle: "SuHuella Desktop Windows",
        stateWindowsUnavailable: "Aún no disponible",
        catalogUnsignedNote: "macOS puede mostrar un aviso de seguridad porque esta build pre-RC no está notarizada.",
        activationNote: "Puedes descargar una versión pública cuando esté disponible. Al abrir SuHuella, la licencia comprueba edición, dispositivos y capacidades. El checkout de pago sigue desactivado.",
        viewPlans: "Ver planes",
        tableVersion: "Versión",
        tableChannel: "Canal",
        tablePlatform: "Plataforma",
        tableStatus: "Estado",
        tableDate: "Fecha",
        tableAction: "Acción",
        platformWeb: "Web",
        platformMac: "Mac",
        platformWindows: "Windows",
        statusAvailable: "Disponible",
        statusUnavailable: "No disponible",
        channelPreRc: "pre-RC",
        channelStable: "stable",
        channelBeta: "beta",
        actionOpen: "Abrir",
        actionDownload: "Descargar",
        actionNone: "—"
    },
    howItWorks: {
        title: "Configúralo una vez. Ahorra tiempo cada día.",
        steps: [
            {
                number: "01",
                title: "Añade las carpetas que ya usas",
                description: "Elige las carpetas de las que SuHuella aprende. Todo permanece en tu ordenador."
            },
            {
                number: "02",
                title: "Revisa lo que propone",
                description: "En Organizar ves el plan. SuHuella sugiere la carpeta; tú decides qué ocurre."
            },
            {
                number: "03",
                title: "Tú confirmas",
                description: "Nada se mueve hasta que lo apruebas. La app de escritorio añadirá más adelante la experiencia nativa al guardar."
            }
        ]
    },
    embeddings: {
        title: "La carpeta correcta, cada vez",
        subtitle: "SuHuella te sugiere una carpeta. Tú confirmas. Todo permanece en este dispositivo.",
        models: "En este dispositivo · Todo permanece en local",
        stats: [
            {
                value: "Local",
                label: "En este dispositivo"
            },
            {
                value: "Tuya",
                label: "Tú tienes el control"
            },
            {
                value: "Después",
                label: "Escritorio más adelante"
            }
        ],
        statsNote: {
            title: "Ahora en el navegador",
            description: "SuHuella Web trabaja en este dispositivo. La app de escritorio dará la experiencia nativa más adelante."
        }
    },
    privacy: {
        eyebrow: "Privacidad",
        title: "Todo permanece en tu ordenador",
        description: "SuHuella Web funciona en este dispositivo. El contenido de tus archivos no se envía. La app de escritorio dará la experiencia nativa más adelante."
    },
    faq: {
        title: "Preguntas frecuentes",
        items: [
            {
                question: "¿SuHuella guarda el archivo por mí?",
                answer: "No. SuHuella sugiere la carpeta y tú confirmas. En el navegador lo haces desde Organizar."
            },
            {
                question: "¿Mis archivos salen de este ordenador?",
                answer: "No. El contenido permanece en este dispositivo."
            },
            {
                question: "¿Dónde está SuHuella?",
                answer: "Ábrela en este navegador. La app de escritorio estará disponible más adelante."
            },
            {
                question: "¿Puedo usar SuHuella ahora?",
                answer: "Sí. Ábrela en este navegador. La app de escritorio para macOS y Windows estará disponible pronto."
            }
        ]
    },
    footer: {
        privacy: "Privacidad",
        terms: "Términos",
        support: "support@suhuella.com",
        copyright: "© 2026 SuHuella"
    },
    legal: {
        updated: "Última actualización: septiembre 2026",
        privacyTitle: "Privacidad",
        termsTitle: "Términos",
        privacyParagraphs: [
            "SuHuella se puede usar ahora en el navegador. Los nombres de archivo, las rutas de carpeta y tus ajustes se quedan en este dispositivo.",
            "La app no sube documentos, nombres de archivo ni rutas de carpeta a ningún servidor, salvo que en el futuro actives de forma explícita una función en la nube.",
            "Los ajustes se guardan en este dispositivo.",
            "Este sitio no ofrece instaladores de escritorio ahora. Cuando el pago esté disponible, se procesa a través de Stripe. No creamos cuentas de usuario ni guardamos tu correo en una base de datos propia.",
            "Para cualquier duda: support@suhuella.com"
        ],
        termsParagraphs: [
            "SuHuella es una compra digital de pago único, sin suscripción. El importe final se muestra en el checkout de Stripe antes de pagar.",
            "Esta es una versión inicial. El producto puede cambiar y algunas aplicaciones pueden no ser compatibles todavía.",
            "No garantizamos que la app de escritorio, cuando exista, detecte la ventana Guardar / Guardar como en todos los programas.",
            "SuHuella sugiere una carpeta de destino y tú confirmas. En el navegador lo haces desde Organizar. SuHuella no mueve archivos por ti.",
            "Si necesitas un reembolso o tienes un problema, escribe a support@suhuella.com."
        ]
    },
    mockup: {
        fileName: "factura_servicios_marzo.pdf",
        badge: "Todo permanece en tu ordenador",
        enterHint: "Enter",
        saveAsHint: "Guardar como…",
        matchLabel: "",
        allOrganized: "Todo organizado",
        suggestions: [
            {
                path: "Finance / 2026",
                match: 97
            },
            {
                path: "Projects / Design",
                match: 79
            },
            {
                path: "Clients / TechCorp / Invoices",
                match: 72
            },
            {
                path: "Admin / Contabilidad",
                match: 65
            },
            {
                path: "Archive",
                match: 63
            },
            {
                path: "Legal / Contracts",
                match: 51
            },
            {
                path: "Personal / Receipts",
                match: 49
            }
        ]
    }
};
const en = {
    meta: {
        title: "SuHuella — The right folder when you save",
        description: "SuHuella Web lets you try SuHuella on this device. Everything stays local. The desktop app is coming later."
    },
    pageTitles: {
        download: "Download",
        license: "License"
    },
    success: {
        title: "Your payment was successful",
        verifiedTitle: "Payment confirmed",
        description: "Thank you for your purchase. Choose your platform and install SuHuella in a minute.",
        downloadWindows: "Download SuHuella for Windows",
        downloadMac: "Download SuHuella for macOS",
        downloadCta: "Download SuHuella",
        backHome: "Back to home",
        verifying: "Confirming your payment",
        verifyingHint: "This only takes a moment.",
        missingSessionTitle: "This page is only after you pay",
        missingSessionDescription: "Complete your purchase to download SuHuella. If you already paid, open the link from your receipt or email support@suhuella.com.",
        invalidSessionTitle: "We could not confirm this payment",
        invalidSessionDescription: "You can continue: try again or email support@suhuella.com. If you already paid, we will help you get the download.",
        unauthorizedTitle: "We could not confirm your purchase",
        unauthorizedDescription: "Complete your purchase to download SuHuella. If you already paid, email support@suhuella.com.",
        retryPurchase: "View plans",
        viewPlans: "View plans",
        lifetimeUnavailable: "Lifetime is not available yet.",
        monthlyUnavailable: "Monthly is not available yet.",
        planUnavailable: "This plan is not available yet.",
        installersPending: "Your payment is confirmed. The installer is not ready yet. You can continue: email support@suhuella.com and we will send it to you.",
        mvpWarning: "Early version: some apps may not show suggestions yet. You can keep saving as usual.",
        support: "Need help? support@suhuella.com",
        trayNote: "SuHuella waits in the tray and only appears when you need it.",
        installTitle: "What to do next",
        installSteps: [
            "Download the installer for your system.",
            "If Windows or macOS warns that it is unsigned, continue: More info → Run anyway, or right-click → Open.",
            "Open SuHuella. No window appears — look for the icon in the tray (Windows) or the menu bar (macOS).",
            "Click the notification or the icon, add the folders you already use, then keep saving."
        ],
        unsignedNote: "The installer is not signed yet. The system warning is expected. After that, SuHuella waits in the tray.",
        downloadUnavailableTitle: "The download is not ready yet",
        downloadUnavailableDescription: "Your payment is confirmed. The installer is not ready yet. You can continue: email support@suhuella.com and we will send it to you.",
        licenseActivated: "License activated",
        openApp: "Open SuHuella",
        downloadIfMissing: "If SuHuella does not open, download and install it.",
        paymentIncomplete: "Payment was not completed.",
        purchaseConfirmed: "Purchase confirmed",
        alreadyInstalled: "Already installed? Open SuHuella to activate this device.",
        continueInBrowser: "Use SuHuella in this browser",
        checkoutCanceled: "Checkout canceled. Your plan is unchanged.",
        modalNoPurchaseTitle: "No purchase to confirm",
        modalNoPurchaseDescription: "We could not verify a checkout session. You can continue using SuHuella Web or view plans."
    },
    welcomeModal: {
        title: "Organise documents without losing control",
        body: "SuHuella learns from the folders you choose and suggests where to save or organise documents. Your files stay on this device. Nothing moves without your confirmation.",
        start: "Get started",
        viewPlans: "View plans",
        howItWorks: "How it works"
    },
    hero: {
        badge: {
            name: "SuHuella"
        },
        title: "Save files to the right folder. Instantly.",
        subtitle: "SuHuella Web lets you try it on this device. Everything stays local. The desktop app will provide the full native experience later."
    },
    features: {
        eyebrow: "Why SuHuella",
        title: "Private, quiet, and yours",
        items: [
            {
                title: "Everything stays on your computer",
                description: "No file contents leave your computer. SuHuella works offline."
            },
            {
                title: "In this browser now",
                description: "Open it here, with nothing to install. The desktop app will provide the full native experience later."
            },
            {
                title: "Paid plans later",
                description: "Paid plans are not available yet. Until then, open SuHuella in this browser."
            }
        ]
    },
    download: {
        title: "Download SuHuella",
        subtitle: "Install in a minute. Then keep saving as usual.",
        windows: "Windows",
        mac: "macOS",
        orBuy: "Haven't purchased yet?",
        trayNote: "It waits in the tray and only appears when you need it.",
        unavailable: "Not ready yet",
        comingSoon: "The desktop app is coming soon. Until then, open SuHuella in this browser.",
        catalogTitle: "SuHuella downloads",
        catalogSubtitle: "Public SuHuella Desktop versions will appear here when they are available. For now, you can use SuHuella Web in this browser.",
        catalogSubtitleWithMac: "The download is public. SuHuella Desktop Mac is pre-RC. When you open the app, the license checks edition and capabilities. Paid checkout stays off.",
        stateWebTitle: "SuHuella Web",
        stateWebAvailable: "Available now",
        stateWebAction: "Open SuHuella",
        stateDesktopTitle: "SuHuella Desktop",
        stateDesktopUnavailable: "Not available in this pre-RC.",
        stateDesktopNoInstallers: "There are no public Mac or Windows installers yet.",
        stateMacTitle: "SuHuella Desktop Mac",
        stateMacAvailable: "Available",
        stateMacAction: "Download for Mac",
        stateWindowsTitle: "SuHuella Desktop Windows",
        stateWindowsUnavailable: "Not available yet",
        catalogUnsignedNote: "macOS may show a security warning because this pre-RC build is not notarized.",
        activationNote: "You can download a public version when it is available. When you open SuHuella, the license checks edition, devices, and capabilities. Paid checkout stays off.",
        viewPlans: "View plans",
        tableVersion: "Version",
        tableChannel: "Channel",
        tablePlatform: "Platform",
        tableStatus: "Status",
        tableDate: "Date",
        tableAction: "Action",
        platformWeb: "Web",
        platformMac: "Mac",
        platformWindows: "Windows",
        statusAvailable: "Available",
        statusUnavailable: "Not available yet",
        channelPreRc: "pre-RC",
        channelStable: "stable",
        channelBeta: "beta",
        actionOpen: "Open",
        actionDownload: "Download",
        actionNone: "—"
    },
    howItWorks: {
        title: "Set it up once. Save time every day.",
        steps: [
            {
                number: "01",
                title: "Add the folders you already use",
                description: "Pick the folders SuHuella learns from. Everything stays on your computer."
            },
            {
                number: "02",
                title: "Review the plan",
                description: "On Organise you see the plan. SuHuella suggests the folder; you decide what happens."
            },
            {
                number: "03",
                title: "You confirm",
                description: "Nothing moves until you approve it. The desktop app will later add the native experience when you save."
            }
        ]
    },
    embeddings: {
        title: "The right folder, every time",
        subtitle: "SuHuella suggests a folder. You confirm. Everything stays on this device.",
        models: "On this device · Everything stays local",
        stats: [
            {
                value: "Local",
                label: "On this device"
            },
            {
                value: "Yours",
                label: "You stay in control"
            },
            {
                value: "Later",
                label: "Desktop coming later"
            }
        ],
        statsNote: {
            title: "In the browser now",
            description: "SuHuella Web works on this device. The desktop app will provide the full native experience later."
        }
    },
    privacy: {
        eyebrow: "Privacy",
        title: "Everything stays on your computer",
        description: "SuHuella Web runs on this device. File contents are not sent away. The desktop app will provide the full native experience later."
    },
    faq: {
        title: "Questions",
        items: [
            {
                question: "Does SuHuella save the file for me?",
                answer: "No. SuHuella suggests the folder and you confirm. In the browser you do that from Organise."
            },
            {
                question: "Do my files leave this computer?",
                answer: "No. The contents stay on this device."
            },
            {
                question: "Where does SuHuella live?",
                answer: "Open it in this browser. The desktop app is coming later."
            },
            {
                question: "Can I use SuHuella now?",
                answer: "Yes. Open it in this browser. The desktop app for macOS and Windows is coming soon."
            }
        ]
    },
    footer: {
        privacy: "Privacy",
        terms: "Terms",
        support: "support@suhuella.com",
        copyright: "© 2026 SuHuella"
    },
    legal: {
        updated: "Last updated: September 2026",
        privacyTitle: "Privacy",
        termsTitle: "Terms",
        privacyParagraphs: [
            "SuHuella can be used in the browser now. File names, folder paths, and settings stay on this device.",
            "The app does not upload documents, file names, or folder paths to any server unless you later enable a cloud feature explicitly.",
            "Settings stay on this device.",
            "This website does not offer desktop installers now. When payment is available, it is processed through Stripe. We do not create user accounts or store your email in our own database.",
            "Questions: support@suhuella.com"
        ],
        termsParagraphs: [
            "SuHuella is a one-time digital purchase with no subscription. The final amount is shown in Stripe checkout before you pay.",
            "This is an early version. The product may change, and some apps may not work yet.",
            "We do not guarantee that the desktop app, when it exists, will detect the Save / Save As window in every application.",
            "SuHuella suggests a destination folder and you confirm. In the browser you do that from Organise. SuHuella does not move files for you.",
            "If you need a refund or have a problem, contact support@suhuella.com."
        ]
    },
    mockup: {
        fileName: "factura_servicios_marzo.pdf",
        badge: "Everything stays on your computer",
        enterHint: "Enter",
        saveAsHint: "Save As…",
        matchLabel: "",
        allOrganized: "All organized",
        suggestions: [
            {
                path: "Finance / 2026",
                match: 97
            },
            {
                path: "Projects / Design",
                match: 79
            },
            {
                path: "Clients / TechCorp / Invoices",
                match: 72
            },
            {
                path: "Admin / Accounting",
                match: 65
            },
            {
                path: "Archive",
                match: 63
            },
            {
                path: "Legal / Contracts",
                match: 51
            },
            {
                path: "Personal / Receipts",
                match: 49
            }
        ]
    }
};
const dictionaries = {
    es,
    en
};
function getDictionary(locale) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$brands$2f$suhuella$2f$entry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["applyBrandPresentationDeep"])(dictionaries[locale]);
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/site/lib/route-overlay.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ROUTE_OVERLAY_PATHS",
    ()=>ROUTE_OVERLAY_PATHS,
    "overlayFromPathname",
    ()=>overlayFromPathname,
    "overlayHomePath",
    ()=>overlayHomePath
]);
const ROUTE_OVERLAY_PATHS = {
    landing: "/",
    license: "/license",
    download: "/download",
    success: "/license/success"
};
function overlayFromPathname(pathname) {
    const path = pathname.replace(/\/+$/, "") || "/";
    if (path === "/") return "landing";
    if (path === "/license") return "license";
    if (path === "/download") return "download";
    if (path === "/license/success" || path === "/success" || path === "/descarga-exitosa") {
        return "success";
    }
    return null;
}
function overlayHomePath() {
    return "/home";
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=_0248lso._.js.map