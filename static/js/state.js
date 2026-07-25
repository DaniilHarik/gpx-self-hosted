/**
 * GPX Viewer State and UI Cache
 */

export const state = {
    get isTestEnv() {
        return typeof window !== 'undefined' && window.__GPX_TEST__ === true;
    },
    map: null, // Initialized in map.js
    loadedTracks: new Map(),
    focusedTrackPath: null,
    isMultiTrackMode: false,
    showStartEndMarkers: true,
    allFiles: [],
    selectedActivities: new Set(),
    activityKeyMap: new Map(),
    areActivityFiltersExpanded: false,
    searchTerm: '',
    currentView: 'activities', // 'activities' | 'plans'
    hasPlanFiles: false,
    layerControl: null,
    tileConfigState: null,
    activeTileProviderKey: null,
    providerKeyByLayer: new WeakMap(),

    // Leaflet Draw bits
    drawnItems: null,
};

// Use getters for UI elements to avoid stale references in tests and ensure they are found when needed
export const ui = {
    get fileList() { return document.getElementById('file-list'); },
    get searchInput() { return document.getElementById('filesearch'); },
    get activityFilterSection() { return document.getElementById('activity-filter-section'); },
    get activityFilterToggle() { return document.getElementById('toggle-activity-filters'); },
    get activityFilterSummary() { return document.getElementById('activity-filter-summary'); },
    get activityFilters() { return document.getElementById('activity-filters'); },
    get viewToggle() { return document.getElementById('view-toggle'); },
    get infoPanel() { return document.getElementById('info-panel'); },
    get fileCount() { return document.getElementById('file-count'); },
    get themeToggle() { return document.getElementById('theme-toggle'); },
    get multiTrackToggle() { return document.getElementById('toggle-multi-track'); },
    get multiTrackToggleLabel() { return document.getElementById('toggle-multi-track-label'); },
    get startEndMarkersToggle() { return document.getElementById('toggle-start-end-markers'); },

    // Stats panel
    get trackName() { return document.getElementById('track-name'); },
    get trackDistance() { return document.getElementById('track-distance'); },
    get trackDuration() { return document.getElementById('track-duration'); },
    get trackDate() { return document.getElementById('track-date'); },
    get trackSpeed() { return document.getElementById('track-speed'); },
    get trackElevationGain() { return document.getElementById('track-elevation-gain'); },
    get trackElevationLoss() { return document.getElementById('track-elevation-loss'); },

};

export function resetState() {
    state.map = null;
    state.loadedTracks.clear();
    state.focusedTrackPath = null;
    state.isMultiTrackMode = false;
    state.showStartEndMarkers = true;
    state.allFiles = [];
    state.selectedActivities.clear();
    state.activityKeyMap.clear();
    state.areActivityFiltersExpanded = false;
    state.searchTerm = '';
    state.currentView = 'activities';
    state.hasPlanFiles = false;
    state.layerControl = null;
    state.tileConfigState = null;
    state.activeTileProviderKey = null;
    state.providerKeyByLayer = new WeakMap();
    state.drawnItems = null;
}

export const constants = {
    MARKER_ICON_SIZE: [25, 29],
    MARKER_ICON_ANCHOR: [12, 29],
    MARKER_POPUP_ANCHOR: [1, -24],
    TRACK_COLORS: [
        '#0000FF', // Blue (Primary)
        '#FF0000', // Red
        '#00AA00', // Green
        '#9b59b6', // Purple
        '#f1c40f', // Yellow
        '#00FFFF', // Cyan
        '#FF8000'  // Orange
    ],
    LAYER_CONTROL_POSITION: 'bottomleft',
    ACTIVITY_ICON_MAP: {
        backpacking: 'fa-mountain',
        'speed hiking': 'fa-person-hiking',
        bikepacking: 'fa-person-biking',
        gravel: 'fa-bicycle',
        mtb: 'fa-bicycle',
        'mountain biking': 'fa-bicycle',
        mountain_biking: 'fa-bicycle',
        iceskating: 'fa-skating',
        'ice skating': 'fa-skating',
        'ice-skating': 'fa-skating',
        ice_skating: 'fa-skating',
        sailing: 'fa-sailboat',
        overlanding: 'fa-car',
        flight: 'fa-plane',
        flights: 'fa-plane'
    },
    THEME_STORAGE_KEY: 'gpx-self-hosted-theme',
    LAYER_STORAGE_KEY: 'gpx-self-host-layer'
};
