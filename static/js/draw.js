/**
 * Draw Logic and GPX Export
 */
import { state } from './state.js';

export function setupDrawControl() {
    if (typeof L === 'undefined') return;

    state.drawnItems = new L.FeatureGroup();
    state.map.addLayer(state.drawnItems);

    const drawControl = new L.Control.Draw({
        draw: {
            polyline: {
                shapeOptions: {
                    color: '#ff0000',
                    weight: 4
                }
            },
            polygon: false,
            rectangle: false,
            circle: false,
            circlemarker: false,
            marker: true
        },
        edit: {
            featureGroup: state.drawnItems
        }
    });

    state.map.addControl(drawControl);
    addExportButtonToDrawToolbar();

    state.map.on(L.Draw.Event.CREATED, function (e) {
        state.drawnItems.addLayer(e.layer);
        updateExportButtonState();
    });

    state.map.on(L.Draw.Event.DELETED, function () {
        updateExportButtonState();
    });
}

function addExportButtonToDrawToolbar() {
    const toolbar = document.querySelector('.leaflet-draw.leaflet-control .leaflet-draw-toolbar-top');
    if (!toolbar || toolbar.querySelector('.leaflet-draw-export')) return;

    const exportButton = L.DomUtil.create('a', 'leaflet-draw-export leaflet-bar-part', toolbar);
    exportButton.href = '#';
    exportButton.title = 'Export Drawn Tracks';
    exportButton.id = 'export-drawn-track';
    exportButton.innerHTML = '<i class="fas fa-file-export"></i>';

    L.DomEvent.disableClickPropagation(exportButton);
    exportButton.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (exportButton.classList.contains('is-disabled')) return;
        exportGPX();
    });

    updateExportButtonState();
}

export function exportGPX() {
    if (!state.drawnItems || state.drawnItems.getLayers().length === 0) {
        alert('No tracks drawn to export!');
        return;
    }

    let gpx = '<?xml version="1.0" encoding="UTF-8"?>\n';
    gpx += '<gpx version="1.1" creator="GPX Offline Viewer">\n';

    state.drawnItems.eachLayer(function (layer) {
        if (layer instanceof L.Polyline) {
            gpx += '  <trk>\n    <name>Drawn Track</name>\n    <trkseg>\n';
            const latlngs = layer.getLatLngs();
            latlngs.forEach(latlng => {
                gpx += `      <trkpt lat="${latlng.lat}" lon="${latlng.lng}"></trkpt>\n`;
            });
            gpx += '    </trkseg>\n  </trk>\n';
        } else if (layer instanceof L.Marker) {
            const latlng = layer.getLatLng();
            gpx += `  <wpt lat="${latlng.lat}" lon="${latlng.lng}"><name>Waypoint</name></wpt>\n`;
        }
    });

    gpx += '</gpx>';

    const blob = new Blob([gpx], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `drawn-track-${new Date().toISOString().slice(0, 10)}.gpx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export function updateExportButtonState() {
    const exportButton = document.getElementById('export-drawn-track');
    if (!exportButton || !state.drawnItems) return;
    const hasLayers = state.drawnItems.getLayers().length > 0;
    exportButton.classList.toggle('is-disabled', !hasLayers);
    exportButton.setAttribute('aria-disabled', String(!hasLayers));
    exportButton.tabIndex = hasLayers ? 0 : -1;
}
