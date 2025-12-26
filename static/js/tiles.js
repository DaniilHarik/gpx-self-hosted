/**
 * Tile Config and Prewarm Management
 */
import { state, ui, constants } from './state.js';
import * as utils from './utils.js';
import { persistLayer, getSavedLayer } from './map.js';

export async function initMapLayer() {
    try {
        const response = await fetch('/api/tile-config');
        const config = await response.json();

        state.tileConfigState = config;
        state.providerKeyByLayer = new WeakMap();

        const baseLayers = {};
        let initialLayer = null;
        let initialProviderKey = null;

        Object.keys(config.providers).forEach(key => {
            const provider = config.providers[key];
            const layer = L.tileLayer(`/tiles/${key}/{z}/{x}/{y}.png`, {
                maxZoom: provider.maxZoom || 18,
                minZoom: provider.minZoom || 0,
                attribution: provider.attribution,
                tms: provider.isTMS
            });
            state.providerKeyByLayer.set(layer, key);
            baseLayers[provider.name] = layer;

            const savedLayerKey = getSavedLayer();
            if (savedLayerKey && config.providers[savedLayerKey]) {
                initialProviderKey = savedLayerKey;
                initialLayer = baseLayers[config.providers[savedLayerKey].name];
            } else if (config.initial && config.providers[config.initial]) {
                initialProviderKey = config.initial;
                initialLayer = baseLayers[config.providers[config.initial].name];
            }
        });

        if (initialLayer) {
            initialLayer.addTo(state.map);
            state.activeTileProviderKey = initialProviderKey;
        } else {
            const firstKey = Object.keys(baseLayers)[0];
            if (firstKey) {
                baseLayers[firstKey].addTo(state.map);
                const providerKey = Object.keys(config.providers).find(k => config.providers[k].name === firstKey);
                state.activeTileProviderKey = providerKey || Object.keys(config.providers)[0] || null;
            }
        }

        if (state.layerControl) {
            state.map.removeControl(state.layerControl);
        }
        state.layerControl = L.control.layers(baseLayers, null, { position: constants.LAYER_CONTROL_POSITION }).addTo(state.map);
        ensureDownloadCurrentViewOverlay();

        state.map.on('baselayerchange', (e) => {
            const providerKey = state.providerKeyByLayer.get(e.layer);
            if (providerKey) {
                state.activeTileProviderKey = providerKey;
                persistLayer(providerKey);
                state.prewarmStatusText = null;
                updateDownloadCurrentViewUiState();
            }
        });

        updateDownloadCurrentViewUiState();
    } catch (error) {
        console.error('Error loading tile config:', error);
        L.tileLayer('/tiles/opentopomap/{z}/{x}/{y}.png', {
            maxZoom: 15,
            attribution: 'Map data: © OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap (CC-BY-SA)'
        }).addTo(state.map);

        state.tileConfigState = {
            initial: 'opentopomap',
            offline: false,
            providers: {
                opentopomap: { name: 'OpenTopoMap', isTMS: false, minZoom: 0, maxZoom: 15 }
            }
        };
        state.activeTileProviderKey = 'opentopomap';
        updateDownloadCurrentViewUiState();
        ensureDownloadCurrentViewOverlay();
    }
}

export function updateDownloadCurrentViewUiState() {
    if (!ui.downloadBtn || !ui.downloadStatus || !ui.downloadCancel) return;

    if (state.prewarmInProgress) {
        ui.downloadBtn.disabled = true;
        ui.downloadCancel.classList.remove('hidden');
        return;
    }

    ui.downloadCancel.classList.add('hidden');

    if (!state.tileConfigState) {
        ui.downloadBtn.disabled = true;
        state.prewarmStatusText = 'Loading map config…';
        ui.downloadStatus.textContent = state.prewarmStatusText;
        return;
    }

    if (state.tileConfigState.offline) {
        ui.downloadBtn.disabled = true;
        state.prewarmStatusText = 'Server is in offline mode.';
        ui.downloadStatus.textContent = state.prewarmStatusText;
        return;
    }

    if (!state.activeTileProviderKey) {
        ui.downloadBtn.disabled = true;
        state.prewarmStatusText = 'No active base layer.';
        ui.downloadStatus.textContent = state.prewarmStatusText;
        return;
    }

    const provider = state.tileConfigState.providers && state.tileConfigState.providers[state.activeTileProviderKey];
    const providerName = provider && provider.name ? provider.name : state.activeTileProviderKey;
    ui.downloadBtn.disabled = false;
    if (!state.prewarmStatusText) {
        ui.downloadStatus.textContent = `Ready (${providerName})`;
    } else {
        ui.downloadStatus.textContent = state.prewarmStatusText;
    }
}

export function ensureDownloadCurrentViewOverlay() {
    if (!state.map) return;

    const mapContainer = state.map.getContainer();
    if (!mapContainer) return;

    let container = document.getElementById('download-current-view-control');
    if (!container) {
        container = document.createElement('div');
        container.id = 'download-current-view-control';
        const topRightCorner = mapContainer.querySelector('.leaflet-top.leaflet-right');
        const target = topRightCorner || mapContainer;
        container.className = `map-offline-tools${target === mapContainer ? ' absolute' : ''}`;
        container.classList.add('leaflet-control');

        container.innerHTML = `
            <button id="download-current-view" class="primary-btn" type="button" disabled>
                <i class="fas fa-download" aria-hidden="true"></i>
                <span>Download Current View</span>
            </button>
            <div class="offline-tools-status">
                <span id="download-current-view-status" class="status-text">Loading map config…</span>
                <button id="download-current-view-cancel" class="link-btn hidden" type="button">Cancel</button>
            </div>
            <div id="prewarm-progress-container" class="progress-container hidden">
                <div id="prewarm-progress-bar" class="progress-bar"></div>
            </div>
            <div id="prewarm-confirm-area" class="offline-tools-confirm hidden">
                <p id="prewarm-confirm-text">Download tiles for the current view?</p>
                <div class="confirm-actions">
                    <button id="prewarm-confirm-yes" class="primary-btn">Download</button>
                    <button id="prewarm-confirm-no" class="link-btn" style="text-decoration: none;">Not now</button>
                </div>
            </div>
        `;

        if (typeof L !== 'undefined' && L.DomEvent) {
            L.DomEvent.disableClickPropagation(container);
            L.DomEvent.disableScrollPropagation(container);
        }

        if (target.firstChild) target.insertBefore(container, target.firstChild);
        else target.appendChild(container);

        setupPrewarmListeners();
    }
}

function setupPrewarmListeners() {
    ui.downloadBtn.addEventListener('click', () => {
        if (state.prewarmInProgress) return;

        const provider = state.tileConfigState.providers && state.tileConfigState.providers[state.activeTileProviderKey];
        const minZoom = provider && typeof provider.minZoom === 'number' ? provider.minZoom : 0;
        const maxZoom = provider && typeof provider.maxZoom === 'number' ? provider.maxZoom : 18;

        const centerZoom = state.map.getZoom();
        const zoomMin = utils.clampInt(centerZoom - 2, minZoom, maxZoom);
        const zoomMax = utils.clampInt(centerZoom + 2, minZoom, maxZoom);
        const providerName = provider && provider.name ? provider.name : state.activeTileProviderKey;

        ui.confirmText.textContent = `Download tiles for ${providerName} (zoom ${zoomMin}–${zoomMax})?`;
        ui.confirmArea.classList.remove('hidden');
        ui.downloadBtn.classList.add('hidden');
    });

    ui.confirmNo.addEventListener('click', () => {
        ui.confirmArea.classList.add('hidden');
        ui.downloadBtn.classList.remove('hidden');
    });

    ui.confirmYes.addEventListener('click', async () => {
        if (state.prewarmInProgress) return;

        ui.confirmArea.classList.add('hidden');
        ui.downloadBtn.classList.remove('hidden');

        state.prewarmInProgress = true;
        state.prewarmAbortController = new AbortController();
        updateDownloadCurrentViewUiState();

        state.prewarmStatusText = 'Starting...';
        ui.downloadStatus.textContent = state.prewarmStatusText;
        ui.progressContainer.classList.remove('hidden');
        ui.progressBar.style.width = '0%';

        try {
            const bounds = state.map.getBounds();
            const boundsDto = utils.boundsToDto(bounds);
            if (!boundsDto) throw new Error('Unsupported map bounds object');
            const payload = {
                providerKey: state.activeTileProviderKey,
                bounds: boundsDto,
                centerZoom: state.map.getZoom(),
                zoomRadius: 2
            };

            const resp = await fetch('/api/prewarm-view', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: state.prewarmAbortController.signal
            });

            if (!resp.ok) throw new Error(`Prewarm failed with status ${resp.status}`);

            const updateProgress = (val) => { ui.progressBar.style.width = `${val}%`; };
            updateProgress(10);
            const result = await resp.json();
            updateProgress(100);

            state.prewarmStatusText = `Done: ${result.ok}/${result.total} tiles saved.`;
            ui.downloadStatus.textContent = state.prewarmStatusText;
        } catch (e) {
            if (state.prewarmAbortController && state.prewarmAbortController.signal.aborted) {
                state.prewarmStatusText = 'Canceled.';
                ui.downloadStatus.textContent = state.prewarmStatusText;
            } else {
                state.prewarmStatusText = 'Failed. Check console.';
                ui.downloadStatus.textContent = state.prewarmStatusText;
                console.error('Tile prewarm failed:', e);
            }
        } finally {
            state.prewarmAbortController = null;
            state.prewarmInProgress = false;
            updateDownloadCurrentViewUiState();
            setTimeout(() => {
                if (!state.prewarmInProgress) ui.progressContainer.classList.add('hidden');
            }, 3000);
        }
    });

    ui.downloadCancel.addEventListener('click', () => {
        if (state.prewarmAbortController) state.prewarmAbortController.abort();
    });
}
