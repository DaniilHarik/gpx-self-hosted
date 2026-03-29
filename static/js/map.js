/**
 * Map Initialization and Theme Management
 */
import { state, ui, constants } from './state.js';
import * as utils from './utils.js';

const MAP_OPTIONS = {
    zoomControl: false,
    doubleClickZoom: false,
    zoomSnap: 0.25,
    zoomDelta: 0.25,
    wheelPxPerZoomLevel: 60
};
const DEFAULT_MIN_ZOOM = 0;
const DEFAULT_MAX_ZOOM = 20;
const BBOX_COPY_RESET_MS = 1600;
const COORD_COPY_RESET_MS = 1600;
const ZOOM_SPEED_PRESETS = [
    { key: 'fast', label: 'Fast', buttonStep: 1.0, wheelPxPerZoomLevel: 60 },
    { key: 'normal', label: 'Normal', buttonStep: 0.5, wheelPxPerZoomLevel: 90 },
    { key: 'precise', label: 'Precise', buttonStep: 0.25, wheelPxPerZoomLevel: 120 }
];
const DEFAULT_ZOOM_SPEED_INDEX = 0;

function clampZoom(value, min, max) {
    if (!Number.isFinite(value)) return min;
    return Math.min(Math.max(value, min), max);
}

function getZoomBounds() {
    const minZoom = typeof state.map?.getMinZoom === 'function' ? state.map.getMinZoom() : DEFAULT_MIN_ZOOM;
    const maxZoom = typeof state.map?.getMaxZoom === 'function' ? state.map.getMaxZoom() : DEFAULT_MAX_ZOOM;
    const safeMin = Number.isFinite(minZoom) ? minZoom : DEFAULT_MIN_ZOOM;
    const safeMax = Number.isFinite(maxZoom) ? maxZoom : DEFAULT_MAX_ZOOM;
    return {
        min: safeMin,
        max: Math.max(safeMax, safeMin)
    };
}

function getMapCenterCoordinate() {
    const center = typeof state.map?.getCenter === 'function' ? state.map.getCenter() : null;
    if (!center || !Number.isFinite(center.lat) || !Number.isFinite(center.lng)) {
        return null;
    }
    return { lat: center.lat, lng: center.lng };
}

function stopMapPropagation(element) {
    ['click', 'dblclick', 'mousedown', 'mouseup', 'wheel', 'touchstart', 'pointerdown'].forEach((eventName) => {
        element.addEventListener(eventName, (event) => event.stopPropagation());
    });
}

async function copyTextToClipboard(text) {
    if (!text) return false;
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(text);
        return true;
    }
    return false;
}

function setupZoomSlider() {
    if (!state.map) return;
    const mapContainer = state.map.getContainer();
    if (!mapContainer) return;

    const sliderStep = MAP_OPTIONS.zoomDelta;
    const control = document.createElement('div');
    control.className = 'zoom-slider-control';
    control.setAttribute('role', 'group');
    control.setAttribute('aria-label', 'Map zoom controls');

    const zoomOutButton = document.createElement('button');
    zoomOutButton.type = 'button';
    zoomOutButton.className = 'zoom-slider-btn';
    zoomOutButton.setAttribute('aria-label', 'Zoom out');
    zoomOutButton.textContent = '-';

    const slider = document.createElement('input');
    slider.id = 'map-zoom-slider';
    slider.className = 'zoom-slider-range';
    slider.type = 'range';
    slider.step = String(sliderStep);
    slider.setAttribute('aria-label', 'Map zoom slider');

    const zoomInButton = document.createElement('button');
    zoomInButton.type = 'button';
    zoomInButton.className = 'zoom-slider-btn';
    zoomInButton.setAttribute('aria-label', 'Zoom in');
    zoomInButton.textContent = '+';

    const zoomValue = document.createElement('span');
    zoomValue.className = 'zoom-slider-value';
    zoomValue.setAttribute('aria-hidden', 'true');

    const speedButton = document.createElement('button');
    speedButton.type = 'button';
    speedButton.className = 'zoom-speed-btn';
    speedButton.setAttribute('aria-label', 'Change zoom speed');

    const bboxButton = document.createElement('button');
    bboxButton.type = 'button';
    bboxButton.className = 'zoom-speed-btn zoom-bbox-btn';
    bboxButton.textContent = 'bbox';
    bboxButton.title = 'Copy current map bbox';
    bboxButton.setAttribute('aria-label', bboxButton.title);

    const coordsReadout = document.createElement('button');
    coordsReadout.type = 'button';
    coordsReadout.className = 'zoom-coords-readout';
    coordsReadout.textContent = 'Center unavailable';
    coordsReadout.title = 'Click to copy current map center coordinates';
    coordsReadout.setAttribute('aria-label', coordsReadout.title);
    coordsReadout.setAttribute('aria-live', 'polite');
    coordsReadout.disabled = true;

    let bboxResetTimer = null;
    let coordsResetTimer = null;
    let selectedCoordinate = null;
    let selectedCoordinateMode = 'center';
    let selectedCoordinateText = '';
    const getCoordinateReadoutTitle = () => selectedCoordinateMode === 'manual'
        ? 'Click to copy selected coordinates'
        : 'Click to copy current map center coordinates';
    const resetBboxButton = () => {
        bboxButton.textContent = 'bbox';
        bboxButton.title = 'Copy current map bbox';
        bboxButton.setAttribute('aria-label', bboxButton.title);
        bboxButton.dataset.state = 'idle';
    };
    const flashBboxButtonState = (label, title, stateName) => {
        if (bboxResetTimer) {
            window.clearTimeout(bboxResetTimer);
            bboxResetTimer = null;
        }
        bboxButton.textContent = label;
        bboxButton.title = title;
        bboxButton.setAttribute('aria-label', title);
        bboxButton.dataset.state = stateName;
        if (stateName !== 'idle') {
            bboxResetTimer = window.setTimeout(() => {
                resetBboxButton();
            }, BBOX_COPY_RESET_MS);
        }
    };

    const updateCoordinateDisplay = (latlng, mode = 'center') => {
        selectedCoordinate = latlng && Number.isFinite(latlng.lat) && Number.isFinite(latlng.lng)
            ? { lat: latlng.lat, lng: latlng.lng }
            : null;
        selectedCoordinateMode = mode === 'manual' ? 'manual' : 'center';

        const copyText = utils.buildCoordinateCopyText(selectedCoordinate);
        selectedCoordinateText = copyText;
        coordsReadout.textContent = copyText || 'Center unavailable';
        coordsReadout.title = getCoordinateReadoutTitle();
        coordsReadout.setAttribute('aria-label', coordsReadout.title);
        coordsReadout.dataset.state = selectedCoordinate ? selectedCoordinateMode : 'idle';
        coordsReadout.disabled = !copyText;
    };

    const resetCoordsReadout = () => {
        if (coordsResetTimer) {
            window.clearTimeout(coordsResetTimer);
            coordsResetTimer = null;
        }
        coordsReadout.textContent = selectedCoordinateText || 'Center unavailable';
        coordsReadout.title = getCoordinateReadoutTitle();
        coordsReadout.setAttribute('aria-label', coordsReadout.title);
        coordsReadout.dataset.state = selectedCoordinate ? selectedCoordinateMode : 'idle';
    };

    const flashCoordsReadoutState = (label, title, stateName) => {
        if (coordsResetTimer) {
            window.clearTimeout(coordsResetTimer);
            coordsResetTimer = null;
        }
        coordsReadout.textContent = label;
        coordsReadout.title = title;
        coordsReadout.setAttribute('aria-label', title);
        coordsReadout.dataset.state = stateName;
        if (stateName !== 'idle') {
            coordsResetTimer = window.setTimeout(() => {
                resetCoordsReadout();
            }, COORD_COPY_RESET_MS);
        }
    };

    let currentSpeedIndex = DEFAULT_ZOOM_SPEED_INDEX;
    const applyZoomSpeed = (nextIndex) => {
        currentSpeedIndex = ((nextIndex % ZOOM_SPEED_PRESETS.length) + ZOOM_SPEED_PRESETS.length) % ZOOM_SPEED_PRESETS.length;
        const preset = ZOOM_SPEED_PRESETS[currentSpeedIndex];
        speedButton.textContent = preset.label;
        speedButton.title = `Zoom speed: ${preset.label}. Click to change.`;
        speedButton.setAttribute('aria-label', speedButton.title);
        if (state.map?.options) {
            state.map.options.wheelPxPerZoomLevel = preset.wheelPxPerZoomLevel;
            state.map.options.zoomDelta = preset.buttonStep;
            // Keep gesture-driven zoom snapping aligned with the active click-speed preset.
            state.map.options.zoomSnap = preset.buttonStep;
        }
    };

    const syncSliderFromMap = () => {
        const { min, max } = getZoomBounds();
        const currentZoom = typeof state.map.getZoom === 'function' ? state.map.getZoom() : 0;
        const boundedZoom = clampZoom(currentZoom, min, max);
        slider.min = String(min);
        slider.max = String(max);
        slider.value = String(boundedZoom);
        zoomValue.textContent = boundedZoom.toFixed(2);
    };

    const setMapZoom = (nextZoom) => {
        const { min, max } = getZoomBounds();
        const boundedZoom = clampZoom(nextZoom, min, max);
        state.map.setZoom(boundedZoom);
    };
    const syncCoordinateDisplayFromMapCenter = () => {
        updateCoordinateDisplay(getMapCenterCoordinate(), 'center');
        resetCoordsReadout();
    };

    slider.addEventListener('input', () => {
        setMapZoom(Number(slider.value));
    });

    zoomOutButton.addEventListener('click', () => {
        const buttonStep = state.map?.options?.zoomDelta || MAP_OPTIONS.zoomDelta;
        setMapZoom(state.map.getZoom() - buttonStep);
    });

    zoomInButton.addEventListener('click', () => {
        const buttonStep = state.map?.options?.zoomDelta || MAP_OPTIONS.zoomDelta;
        setMapZoom(state.map.getZoom() + buttonStep);
    });

    speedButton.addEventListener('click', () => {
        applyZoomSpeed(currentSpeedIndex + 1);
    });

    bboxButton.addEventListener('click', async () => {
        const bounds = state.map?.getBounds?.();
        const copyText = utils.buildBboxCopyText(bounds);
        if (!copyText) {
            flashBboxButtonState('No bbox', 'Current map bbox is unavailable', 'error');
            return;
        }

        try {
            const copied = await copyTextToClipboard(copyText);
            if (!copied) {
                flashBboxButtonState('No Copy', 'Clipboard API unavailable', 'error');
                return;
            }
            flashBboxButtonState('Copied', 'Copied current map bbox', 'copied');
        } catch {
            flashBboxButtonState('Failed', 'Failed to copy current map bbox', 'error');
        }
    });

    coordsReadout.addEventListener('click', async () => {
        const copyText = utils.buildCoordinateCopyText(selectedCoordinate);
        if (!copyText) {
            return;
        }

        try {
            const copied = await copyTextToClipboard(copyText);
            if (!copied) {
                flashCoordsReadoutState('No Copy', 'Clipboard API unavailable', 'error');
                return;
            }
            flashCoordsReadoutState('Copied', 'Copied selected coordinates', 'copied');
        } catch {
            flashCoordsReadoutState('Failed', 'Failed to copy selected coordinates', 'error');
        }
    });

    control.appendChild(zoomOutButton);
    control.appendChild(slider);
    control.appendChild(zoomInButton);
    control.appendChild(zoomValue);
    control.appendChild(speedButton);
    control.appendChild(coordsReadout);
    control.appendChild(bboxButton);

    stopMapPropagation(control);
    mapContainer.appendChild(control);
    applyZoomSpeed(DEFAULT_ZOOM_SPEED_INDEX);
    resetBboxButton();
    syncCoordinateDisplayFromMapCenter();
    syncSliderFromMap();
    state.map.on('zoomend', syncSliderFromMap);
    state.map.on('zoomend', syncCoordinateDisplayFromMapCenter);
    state.map.on('zoomlevelschange', syncSliderFromMap);
    state.map.on('baselayerchange', syncSliderFromMap);
    state.map.on('moveend', syncCoordinateDisplayFromMapCenter);
    state.map.on('click', (event) => {
        const latlng = event?.latlng;
        if (!latlng || !Number.isFinite(latlng.lat) || !Number.isFinite(latlng.lng)) {
            return;
        }

        const currentZoom = typeof state.map?.getZoom === 'function' ? state.map.getZoom() : DEFAULT_MIN_ZOOM;
        const buttonStep = state.map?.options?.zoomDelta || MAP_OPTIONS.zoomDelta;
        const { min, max } = getZoomBounds();
        const nextZoom = clampZoom(currentZoom + buttonStep, min, max);
        state.map.setView([latlng.lat, latlng.lng], nextZoom);
        updateCoordinateDisplay(latlng, 'center');
        resetCoordsReadout();
    });
    state.map.on('contextmenu', (event) => {
        event?.originalEvent?.preventDefault?.();
        updateCoordinateDisplay(event?.latlng, 'manual');
        resetCoordsReadout();
    });
}

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
    state.map = L.map('map', MAP_OPTIONS).setView([58.60, 25.01], 8);
    setupZoomSlider();
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
