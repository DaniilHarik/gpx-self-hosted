/**
 * GPX Loading and Focus Logic
 */
import { state, ui, constants } from './state.js';
import * as utils from './utils.js';
import { applyFilters } from './files.js';

const START_MARKER_ICON_URL = utils.svgToDataUri(utils.buildPinSvg('#16a34a', '#166534', '#f8fafc'));
const END_MARKER_ICON_URL = utils.svgToDataUri(utils.buildPinSvg('#dc2626', '#991b1b', '#fef2f2'));
const DEFAULT_MARKER_ICON_URL = utils.svgToDataUri(utils.buildPinSvg('#2563eb', '#1e40af', '#f8fafc'));
const TRANSPARENT_SHADOW_URL = utils.svgToDataUri('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>');
const HIDDEN_MARKER_ICON_URL = TRANSPARENT_SHADOW_URL;

export function setupMultiTrackToggle() {
    const toggleMultiTrackBtn = ui.multiTrackToggle;
    if (!toggleMultiTrackBtn) return;

    updateMultiTrackToggleUi(toggleMultiTrackBtn);

    toggleMultiTrackBtn.addEventListener('click', () => {
        state.isMultiTrackMode = !state.isMultiTrackMode;
        updateMultiTrackToggleUi(toggleMultiTrackBtn);
        if (!state.isMultiTrackMode) enforceSingleTrack();
        applyFilters();
    });
}

export function setupStartEndMarkerToggle() {
    const toggleBtn = ui.startEndMarkersToggle;
    if (!toggleBtn) return;

    updateStartEndMarkerToggleUi(toggleBtn);

    toggleBtn.addEventListener('click', () => {
        state.showStartEndMarkers = !state.showStartEndMarkers;
        updateStartEndMarkerToggleUi(toggleBtn);
        refreshLoadedTrackLayers();
    });
}

export function enforceSingleTrack() {
    if (state.loadedTracks.size <= 1) return;
    const keepPath = state.focusedTrackPath || state.loadedTracks.keys().next().value;
    const pathsToRemove = [];
    state.loadedTracks.forEach((_, path) => { if (path !== keepPath) pathsToRemove.push(path); });
    pathsToRemove.forEach(path => removeTrack(path));
}

export function focusTrack(path, name) {
    const toRemove = [];
    state.loadedTracks.forEach((_, p) => { if (p !== path) toRemove.push(p); });
    toRemove.forEach(p => removeTrack(p));

    state.focusedTrackPath = path;
    let pending;
    const track = state.loadedTracks.get(path);
    if (!track) {
        pending = addTrack(path, name);
    } else if (track.status === 'error') {
        pending = retryTrack(path);
    } else if (track.status === 'ready') {
        state.pendingFitTrack = null;
        state.map.fitBounds(track.layer.getBounds());
    } else {
        state.pendingFitTrack = track;
        pending = track.pending;
    }

    updateInfoPanelWithTrack(path);
    updateListSelectionState();
    return pending;
}

export function toggleTrackVisibility(path, name, shouldShow) {
    if (shouldShow) {
        if (!state.loadedTracks.has(path)) addTrack(path, name);
    } else {
        removeTrack(path);
    }
    updateListSelectionState();
}

export function addTrack(path, name) {
    if (state.loadedTracks.has(path)) return state.loadedTracks.get(path).pending;

    const usedColors = new Set(Array.from(state.loadedTracks.values()).map(t => t.color));
    const color = constants.TRACK_COLORS.find(c => !usedColors.has(c)) || constants.TRACK_COLORS[state.loadedTracks.size % constants.TRACK_COLORS.length];

    return startTrackLoad(path, name, color);
}

export function retryTrack(path) {
    const track = state.loadedTracks.get(path);
    if (!track || track.status !== 'error') return;
    return startTrackLoad(path, track.name, track.color);
}

export function removeTrack(path) {
    if (state.loadedTracks.has(path)) {
        const track = state.loadedTracks.get(path);
        state.loadedTracks.delete(path);
        track.controller.abort();
        if (track.layer) state.map.removeLayer(track.layer);
        if (state.pendingFitTrack === track) state.pendingFitTrack = null;

        if (state.focusedTrackPath === path) {
            state.focusedTrackPath = null;
            ui.infoPanel.classList.add('hidden');
            if (state.loadedTracks.size > 0) {
                const nextPath = state.loadedTracks.keys().next().value;
                state.focusedTrackPath = nextPath;
                updateInfoPanelWithTrack(nextPath);
            }
        }
        updateListSelectionState();
    }
}

export function updateInfoPanelWithTrack(path) {
    const track = state.loadedTracks.get(path);
    if (track?.status === 'ready') {
        updateInfoPanel(track.layer, track.name, track.hasTimestamps);
    } else {
        ui.infoPanel.classList.add('hidden');
    }
}

export function updateListSelectionState() {
    document.querySelectorAll('#file-list li[data-path]').forEach(updateTrackListItem);
}

export function updateTrackListItem(li) {
    const path = li.dataset.path;
    const track = state.loadedTracks.get(path);
    const checkbox = li.querySelector('.track-select-cb');

    if (track) {
        if (checkbox) {
            checkbox.checked = true;
            checkbox.style.accentColor = track.color;
        }
        li.style.borderLeft = `4px solid ${track.color}`;
        li.classList.toggle('active', path === state.focusedTrackPath);
    } else {
        if (checkbox) {
            checkbox.checked = false;
            checkbox.style.accentColor = '';
        }
        li.style.borderLeft = '';
        li.classList.remove('active');
    }
    const status = li.querySelector('.track-load-status');
    if (status) {
        const isLoading = track?.status === 'loading';
        const isError = track?.status === 'error';
        li.dataset.loadState = track?.status || 'idle';
        status.hidden = !isLoading && !isError;
        status.querySelector('.track-load-message').textContent = isLoading ? 'Loading track...' : (track?.error || '');
        status.querySelector('.track-retry').hidden = !isError;
    }
}

export function updateInfoPanel(gpx, name, hasTimestamps = true) {
    ui.trackName.textContent = name;
    ui.trackDistance.textContent = `${(gpx.get_distance() / 1000).toFixed(2)} km`;

    const totalTimeMs = gpx.get_total_time();
    const movingTimeMs = gpx.get_moving_time();
    const duration = movingTimeMs > 0 ? movingTimeMs : totalTimeMs;
    ui.trackDuration.textContent = hasTimestamps && Number.isFinite(duration) ? utils.formatDuration(duration) : '-';

    const start = gpx.get_start_time();
    ui.trackDate.textContent = hasTimestamps && Number.isFinite(start?.getTime()) ? start.toLocaleDateString() : 'N/A';
    const speed = gpx.get_moving_speed();
    ui.trackSpeed.textContent = hasTimestamps && movingTimeMs > 0 && Number.isFinite(speed) ? `${speed.toFixed(1)} km/h` : 'N/A';

    // leaflet-gpx 1.7 formats elevation labels with null.toFixed when a
    // track starts without optional <ele> values. Keep other statistics and
    // loading-state updates available even when elevation cannot be read.
    let elevationData;
    try {
        elevationData = gpx.get_elevation_data();
    } catch {
        elevationData = null;
    }
    const hasElevation = elevationData?.length > 0 && elevationData.every(point => Number.isFinite(point[1]));
    if (hasElevation) {
        const { gain, loss } = utils.calculateSmoothedElevation(elevationData);
        ui.trackElevationGain.textContent = `+${Math.round(gain)} m`;
        ui.trackElevationLoss.textContent = `-${Math.round(loss)} m`;
    } else {
        ui.trackElevationGain.textContent = 'N/A';
        ui.trackElevationLoss.textContent = 'N/A';
    }

    ui.infoPanel.classList.remove('hidden');
}

function updateStartEndMarkerToggleUi(toggleBtn) {
    toggleBtn.classList.toggle('active', state.showStartEndMarkers);
    toggleBtn.setAttribute('aria-pressed', state.showStartEndMarkers ? 'true' : 'false');
    const title = state.showStartEndMarkers ? 'Hide start/end markers' : 'Show start/end markers';
    toggleBtn.title = title;
    toggleBtn.setAttribute('aria-label', title);
}

function updateMultiTrackToggleUi(toggleBtn) {
    const isActive = state.isMultiTrackMode;
    toggleBtn.classList.toggle('active', isActive);
    toggleBtn.setAttribute('aria-pressed', isActive ? 'true' : 'false');

    const title = isActive ? 'Disable multi-select' : 'Enable multi-select';
    toggleBtn.title = title;
    toggleBtn.setAttribute('aria-label', title);

    if (ui.multiTrackToggleLabel) {
        ui.multiTrackToggleLabel.textContent = 'Multi-select';
    }
}

function startTrackLoad(path, name, color, { fitOnLoad = true } = {}) {
    const track = { layer: null, name, color, status: 'loading', controller: new AbortController() };
    state.loadedTracks.set(path, track);
    if (!state.focusedTrackPath) state.focusedTrackPath = path;
    if (fitOnLoad) state.pendingFitTrack = track;
    updateInfoPanelWithTrack(state.focusedTrackPath);
    updateListSelectionState();
    track.pending = loadTrack(path, track);
    return track.pending;
}

async function loadTrack(path, track) {
    const isCurrent = () => state.loadedTracks.get(path) === track;
    const timeout = setTimeout(() => track.controller.abort(), 30000);
    let failureMessage = 'Could not download this track.';
    try {
        const response = await fetch(path, { signal: track.controller.signal });
        if (!response.ok) {
            if (response.status === 404) failureMessage = 'Track file not found.';
            throw new Error('Track request failed');
        }
        const text = (await response.text()).trim();
        if (!isCurrent()) return;
        if (track.controller.signal.aborted) throw new Error('Track request timed out');

        failureMessage = 'Could not read this GPX file.';
        const xml = new DOMParser().parseFromString(text, 'application/xml');
        if (xml.querySelector('parsererror') || xml.documentElement.localName !== 'gpx') {
            throw new Error('Invalid GPX document');
        }

        // leaflet-gpx substitutes 1970 for missing point times. Check the
        // source so invented dates and speeds never become user statistics.
        const points = Array.from(xml.querySelectorAll('trkpt, rtept'));
        track.hasTimestamps = points.length > 0 && points.every(point => {
            const time = point.querySelector('time')?.textContent;
            return time && Number.isFinite(Date.parse(time));
        });

        // Parse downloaded XML synchronously so parser failures stay in this
        // try/catch. Leaflet GPX's URL loader does not report HTTP failures.
        const layer = createTrackLayer(text, track.color);
        const bounds = layer.getBounds();
        if (!bounds.isValid()) {
            failureMessage = 'This GPX file has no map points.';
            throw new Error('Empty GPX layer');
        }
        track.layer = layer;
        layer.addTo(state.map);
        track.status = 'ready';
        if (state.pendingFitTrack === track) {
            state.pendingFitTrack = null;
            state.map.fitBounds(bounds);
        }
    } catch {
        if (!isCurrent()) return;
        if (track.layer) state.map.removeLayer(track.layer);
        track.layer = null;
        track.status = 'error';
        track.error = track.controller.signal.aborted ? 'Track load timed out.' : failureMessage;
        if (state.pendingFitTrack === track) state.pendingFitTrack = null;
    } finally {
        clearTimeout(timeout);
        if (isCurrent()) {
            updateInfoPanelWithTrack(state.focusedTrackPath);
            updateListSelectionState();
        }
    }
}

function createTrackLayer(xml, color) {
    return new L.GPX(xml, {
        async: false,
        gpx_options: { joinTrackSegments: false },
        marker_options: getMarkerOptions(),
        polyline_options: {
            color: color,
            opacity: 0.8,
            weight: 3,
            lineCap: 'round'
        }
    });
}

function getMarkerOptions() {
    return {
        startIconUrl: state.showStartEndMarkers ? START_MARKER_ICON_URL : HIDDEN_MARKER_ICON_URL,
        endIconUrl: state.showStartEndMarkers ? END_MARKER_ICON_URL : HIDDEN_MARKER_ICON_URL,
        shadowUrl: TRANSPARENT_SHADOW_URL,
        wptIconUrls: { '': DEFAULT_MARKER_ICON_URL },
        wptIconTypeUrls: { '': DEFAULT_MARKER_ICON_URL },
        iconSize: constants.MARKER_ICON_SIZE,
        iconAnchor: constants.MARKER_ICON_ANCHOR,
        shadowSize: [1, 1],
        shadowAnchor: [0, 0]
    };
}

function refreshLoadedTrackLayers() {
    Array.from(state.loadedTracks.entries()).forEach(([path, track]) => {
        if (track.status === 'error') return;
        track.controller.abort();
        if (track.layer) state.map.removeLayer(track.layer);
        const fitOnLoad = state.pendingFitTrack === track;
        startTrackLoad(path, track.name, track.color, { fitOnLoad });
    });
}
