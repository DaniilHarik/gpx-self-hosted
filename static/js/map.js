/**
 * Map Initialization and Theme Management
 */
import { state, ui, constants } from './state.js';
import * as utils from './utils.js';

export function setupLeafletIcons() {
    if (typeof L === 'undefined' || !L.Icon || !L.Icon.Default) return;

    const TRANSPARENT_SHADOW_URL = utils.svgToDataUri('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>');
    const DEFAULT_MARKER_ICON_URL = utils.svgToDataUri(utils.buildPinSvg('#2563eb', '#1e40af', '#f8fafc'));

    L.Icon.Default.mergeOptions({
        iconUrl: DEFAULT_MARKER_ICON_URL,
        iconRetinaUrl: DEFAULT_MARKER_ICON_URL,
        shadowUrl: TRANSPARENT_SHADOW_URL,
        iconSize: constants.MARKER_ICON_SIZE,
        iconAnchor: constants.MARKER_ICON_ANCHOR,
        popupAnchor: constants.MARKER_POPUP_ANCHOR,
        shadowSize: [1, 1],
        shadowAnchor: [0, 0]
    });
}

export function initMap() {
    if (typeof L === 'undefined') return;
    state.map = L.map('map').setView([58.60, 25.01], 7);
    setupLeafletIcons();
}

// --- Theme ---
export function persistLayer(key) {
    try {
        localStorage.setItem(constants.LAYER_STORAGE_KEY, key);
    } catch {
        // Ignore storage failures
    }
}

export function getSavedLayer() {
    try {
        return localStorage.getItem(constants.LAYER_STORAGE_KEY);
    } catch {
        return null;
    }
}

export function normalizeTheme(value) {
    return value === 'light' || value === 'dark' ? value : null;
}

export function getCurrentTheme() {
    return normalizeTheme(document.documentElement.dataset.theme) || 'dark';
}

function persistTheme(theme) {
    try {
        localStorage.setItem(constants.THEME_STORAGE_KEY, theme);
    } catch {
        // Ignore storage failures (private mode, etc.)
    }
}

export function updateThemeToggleUi(theme) {
    const button = ui.themeToggle;
    if (!button) return;

    const isDark = theme === 'dark';
    const icon = button.querySelector('i');
    if (icon) {
        icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
    }

    button.setAttribute('aria-pressed', isDark ? 'true' : 'false');
    button.title = isDark ? 'Switch to light mode' : 'Switch to dark mode';
    button.setAttribute('aria-label', button.title);
}

export function setTheme(theme, { shouldPersist = true } = {}) {
    const normalized = normalizeTheme(theme);
    if (!normalized) return;
    document.documentElement.dataset.theme = normalized;
    if (shouldPersist) persistTheme(normalized);
    updateThemeToggleUi(normalized);
}

export function setupThemeToggle() {
    if (!ui.themeToggle) return;

    updateThemeToggleUi(getCurrentTheme());

    ui.themeToggle.addEventListener('click', () => {
        const nextTheme = getCurrentTheme() === 'dark' ? 'light' : 'dark';
        setTheme(nextTheme);
    });
}
