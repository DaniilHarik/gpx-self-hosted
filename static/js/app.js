/**
 * GPX Viewer - Main Entrypoint
 */
import { state, ui, resetState, constants } from './state.js';
import { initMap, setupThemeToggle, normalizeTheme, getCurrentTheme, setTheme } from './map.js';
import { initMapLayer } from './tiles.js';
import { fetchFiles, setView, applyFilters, renderFileList } from './files.js';
import { setupMultiTrackToggle, focusTrack, toggleTrackVisibility, addTrack, removeTrack, updateInfoPanel } from './tracks.js';
import { setupDrawControl, updateExportButtonState, exportGPX } from './draw.js';
import * as utils from './utils.js';

// --- Wrapped Helper for Tests ---
function getActivityIcon(activity) {
    return utils.getActivityIcon(activity, constants.ACTIVITY_ICON_MAP);
}
const {
    calculateSmoothedElevation,
    formatDuration,
    deriveActivity,
    addActivityToFiles,
    getDisplayFolder,
    parseDateFromFilename
} = utils;

// --- Initialization ---

async function init() {
    initMap();
    setupThemeToggle();
    setupMultiTrackToggle();
    setupDrawControl();

    // Map layer initialization (includes prewarm UI setup)
    await initMapLayer();

    // Event Listeners
    if (ui.searchInput) {
        ui.searchInput.addEventListener('input', (e) => {
            state.searchTerm = e.target.value.toLowerCase();
            applyFilters();
        });
    }

    if (ui.viewToggle) {
        ui.viewToggle.addEventListener('click', (e) => {
            const button = e.target.closest('.view-toggle-btn');
            if (!button || button.disabled) return;
            setView(button.dataset.view);
        });
    }

    // Initial data fetch
    await fetchFiles();
}

// Start the app
if (!state.isTestEnv) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}

// --- Exports for Testing ---
// Note: In ESM, we can just export them. 
// Existing tests using require() might need adjustments or we might need a bridge.

export {
    calculateSmoothedElevation,
    formatDuration,
    updateInfoPanel,
    updateExportButtonState,
    deriveActivity,
    addActivityToFiles,
    getDisplayFolder,
    getActivityIcon,
    parseDateFromFilename,
    normalizeTheme,
    getCurrentTheme,
    fetchFiles,
    renderFileList,
    addTrack,
    removeTrack,
    focusTrack,
    resetState,
    init,
    exportGPX
};
