/**
 * Tile Config and Layer Management
 */
import { state, constants } from './state.js';
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

        state.map.on('baselayerchange', (e) => {
            const providerKey = state.providerKeyByLayer.get(e.layer);
            if (providerKey) {
                state.activeTileProviderKey = providerKey;
                persistLayer(providerKey);
            }
        });
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
    }
}
