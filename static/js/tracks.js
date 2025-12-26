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

export function setupMultiTrackToggle() {
    const toggleMultiTrackBtn = document.getElementById('toggle-multi-track');
    if (toggleMultiTrackBtn) {
        toggleMultiTrackBtn.addEventListener('click', () => {
            state.isMultiTrackMode = !state.isMultiTrackMode;
            toggleMultiTrackBtn.classList.toggle('active', state.isMultiTrackMode);
            if (!state.isMultiTrackMode) enforceSingleTrack();
            applyFilters();
        });
    }
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

    if (!state.loadedTracks.has(path)) {
        addTrack(path, name);
    } else {
        const track = state.loadedTracks.get(path);
        state.map.fitBounds(track.layer.getBounds());
    }

    state.focusedTrackPath = path;
    updateInfoPanelWithTrack(path);
    updateListSelectionState();
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
    if (state.loadedTracks.has(path)) return;

    const usedColors = new Set(Array.from(state.loadedTracks.values()).map(t => t.color));
    const color = constants.TRACK_COLORS.find(c => !usedColors.has(c)) || constants.TRACK_COLORS[state.loadedTracks.size % constants.TRACK_COLORS.length];

    ui.infoPanel.classList.add('hidden');
    state.loadedTracks.set(path, { layer: null, name, color });

    const layer = new L.GPX(path, {
        async: true,
        marker_options: {
            startIconUrl: START_MARKER_ICON_URL,
            endIconUrl: END_MARKER_ICON_URL,
            shadowUrl: TRANSPARENT_SHADOW_URL,
            wptIconUrls: { '': DEFAULT_MARKER_ICON_URL },
            wptIconTypeUrls: { '': DEFAULT_MARKER_ICON_URL },
            iconSize: constants.MARKER_ICON_SIZE,
            iconAnchor: constants.MARKER_ICON_ANCHOR,
            shadowSize: [1, 1],
            shadowAnchor: [0, 0]
        },
        polyline_options: {
            color: color,
            opacity: 0.8,
            weight: 3,
            lineCap: 'round'
        }
    }).on('loaded', function (e) {
        state.map.fitBounds(e.target.getBounds());
        if (state.focusedTrackPath === path || !state.focusedTrackPath) {
            state.focusedTrackPath = path;
            updateInfoPanel(e.target, name);
            updateListSelectionState();
        }
    }).addTo(state.map);

    state.loadedTracks.get(path).layer = layer;
}

export function removeTrack(path) {
    if (state.loadedTracks.has(path)) {
        const track = state.loadedTracks.get(path);
        state.map.removeLayer(track.layer);
        state.loadedTracks.delete(path);

        if (state.focusedTrackPath === path) {
            state.focusedTrackPath = null;
            ui.infoPanel.classList.add('hidden');
            if (state.loadedTracks.size > 0) {
                const nextPath = state.loadedTracks.keys().next().value;
                const nextTrack = state.loadedTracks.get(nextPath);
                state.focusedTrackPath = nextPath;
                updateInfoPanel(nextTrack.layer, nextTrack.name);
            }
        }
        updateListSelectionState();
    }
}

export function updateInfoPanelWithTrack(path) {
    const track = state.loadedTracks.get(path);
    if (track && track.layer.get_distance) {
        updateInfoPanel(track.layer, track.name);
    }
}

export function updateListSelectionState() {
    const lis = document.querySelectorAll('#file-list li');
    lis.forEach(li => {
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
    });
}

export function updateInfoPanel(gpx, name) {
    ui.trackName.textContent = name;
    ui.trackDistance.textContent = `${(gpx.get_distance() / 1000).toFixed(2)} km`;

    const totalTimeMs = gpx.get_total_time();
    const movingTimeMs = gpx.get_moving_time();
    ui.trackDuration.textContent = utils.formatDuration(movingTimeMs > 0 ? movingTimeMs : totalTimeMs);

    const start = gpx.get_start_time();
    ui.trackDate.textContent = start ? start.toLocaleDateString() : 'N/A';
    ui.trackSpeed.textContent = `${gpx.get_moving_speed().toFixed(1)} km/h`;

    const elevationData = gpx.get_elevation_data();
    const { gain, loss } = utils.calculateSmoothedElevation(elevationData);
    ui.trackElevationGain.textContent = `+${Math.round(gain)} m`;
    ui.trackElevationLoss.textContent = `-${Math.round(loss)} m`;

    ui.infoPanel.classList.remove('hidden');
}
