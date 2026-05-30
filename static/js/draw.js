/**
 * Draw Logic and GPX Export
 */
import { state } from './state.js';

const DEFAULT_IMAGE_EXPORT_SCALE = 2;

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
    addExportButtonsToDrawToolbar();

    state.map.on(L.Draw.Event.CREATED, function (e) {
        state.drawnItems.addLayer(e.layer);
        updateExportButtonState();
    });

    state.map.on(L.Draw.Event.DELETED, function () {
        updateExportButtonState();
    });
}

function addExportButtonsToDrawToolbar() {
    const toolbar = document.querySelector('.leaflet-draw.leaflet-control .leaflet-draw-toolbar-top');
    if (!toolbar) return;

    if (!toolbar.querySelector('#export-drawn-track')) {
        const exportButton = createToolbarButton({
            toolbar,
            id: 'export-drawn-track',
            title: 'Export Drawn Tracks',
            iconClass: 'fas fa-file-export'
        });

        exportButton.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            if (exportButton.classList.contains('is-disabled')) return;
            exportGPX();
        });
    }

    if (!toolbar.querySelector('#export-map-image-hires')) {
        const exportImageButton = createToolbarButton({
            toolbar,
            id: 'export-map-image-hires',
            title: 'Export High-Resolution Map Image',
            iconClass: 'fas fa-image'
        });

        exportImageButton.addEventListener('click', async function (e) {
            e.preventDefault();
            e.stopPropagation();
            await exportMapImageHighRes();
        });
    }

    updateExportButtonState();
}

function createToolbarButton({ toolbar, id, title, iconClass }) {
    const button = L.DomUtil.create('a', 'leaflet-draw-export leaflet-bar-part', toolbar);
    button.href = '#';
    button.title = title;
    button.id = id;
    button.innerHTML = `<i class="${iconClass}"></i>`;
    button.setAttribute('aria-label', title);
    L.DomEvent.disableClickPropagation(button);
    return button;
}

export function exportGPX() {
    if (!state.drawnItems || state.drawnItems.getLayers().length === 0) {
        alert('No tracks drawn to export!');
        return;
    }

    let gpx = '<?xml version="1.0" encoding="UTF-8"?>\n';
    gpx += '<gpx version="1.1" creator="GPX Offline Viewer" xmlns="http://www.topografix.com/GPX/1/1">\n';

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

export async function exportMapImageHighRes(scale = DEFAULT_IMAGE_EXPORT_SCALE) {
    if (!state.map || typeof document === 'undefined') {
        alert('Map is not ready for export yet.');
        return;
    }

    const container = state.map.getContainer?.();
    if (!container) {
        alert('Map is not ready for export yet.');
        return;
    }

    const rect = container.getBoundingClientRect();
    const width = Math.round(container.clientWidth || rect.width || 0);
    const height = Math.round(container.clientHeight || rect.height || 0);
    if (width <= 0 || height <= 0) {
        alert('Map size is unavailable for export.');
        return;
    }

    const safeScale = Number.isFinite(scale) && scale > 0 ? scale : DEFAULT_IMAGE_EXPORT_SCALE;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * safeScale);
    canvas.height = Math.round(height * safeScale);

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        alert('Browser does not support canvas export.');
        return;
    }

    ctx.save();
    ctx.scale(safeScale, safeScale);
    ctx.fillStyle = getMapBackgroundColor(container);
    ctx.fillRect(0, 0, width, height);

    const containerRect = container.getBoundingClientRect();
    await drawImageElementsOnCanvas(container, containerRect, '.leaflet-tile-pane img.leaflet-tile', ctx);
    await drawSvgOverlaysOnCanvas(container, containerRect, ctx);
    await drawImageElementsOnCanvas(container, containerRect, '.leaflet-marker-pane img.leaflet-marker-icon, .leaflet-marker-pane img.leaflet-marker-shadow', ctx);
    ctx.restore();

    try {
        const blob = await canvasToBlob(canvas);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `map-export-hires-${new Date().toISOString().slice(0, 10)}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (err) {
        console.error('Failed to export map image:', err);
        alert('Failed to export map image.');
    }
}

function getMapBackgroundColor(container) {
    try {
        const color = window.getComputedStyle(container).backgroundColor;
        if (color && color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') return color;
    } catch {
        // Fallback to white below.
    }
    return '#ffffff';
}

async function drawImageElementsOnCanvas(container, containerRect, selector, ctx) {
    const images = Array.from(container.querySelectorAll(selector));
    for (const img of images) {
        if (!isElementVisible(img)) continue;
        const loaded = await waitForImage(img);
        if (!loaded) continue;
        const rect = img.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) continue;
        const opacity = getElementOpacity(img);
        if (opacity <= 0) continue;
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.drawImage(img, rect.left - containerRect.left, rect.top - containerRect.top, rect.width, rect.height);
        ctx.restore();
    }
}

async function drawSvgOverlaysOnCanvas(container, containerRect, ctx) {
    const overlays = Array.from(container.querySelectorAll('.leaflet-overlay-pane svg'));
    for (const svg of overlays) {
        if (!isElementVisible(svg)) continue;
        const rect = svg.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) continue;

        const svgMarkup = buildStandaloneSvgMarkup(svg, rect);
        const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;
        const image = await loadImage(dataUrl);
        if (!image) continue;

        const opacity = getElementOpacity(svg);
        if (opacity <= 0) continue;
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.drawImage(image, rect.left - containerRect.left, rect.top - containerRect.top, rect.width, rect.height);
        ctx.restore();
    }
}

function buildStandaloneSvgMarkup(svg, rect) {
    const clone = svg.cloneNode(true);

    if (clone.style) {
        // Leaflet positions renderer SVGs with CSS transforms; keep placement in canvas coordinates
        // and strip runtime transforms to avoid double-shifting during export.
        clone.style.transform = 'none';
        clone.style.transformOrigin = '0 0';
        clone.style.left = '0px';
        clone.style.top = '0px';
    }

    clone.removeAttribute('x');
    clone.removeAttribute('y');
    clone.setAttribute('width', String(rect.width));
    clone.setAttribute('height', String(rect.height));
    if (!clone.getAttribute('viewBox')) {
        clone.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
    }
    if (!clone.getAttribute('xmlns')) {
        clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    }

    return new XMLSerializer().serializeToString(clone);
}

function getElementOpacity(element) {
    try {
        const opacity = Number.parseFloat(window.getComputedStyle(element).opacity);
        return Number.isFinite(opacity) ? Math.max(0, Math.min(1, opacity)) : 1;
    } catch {
        return 1;
    }
}

function isElementVisible(element) {
    try {
        const style = window.getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden';
    } catch {
        return true;
    }
}

function waitForImage(imageEl) {
    if (!imageEl) return Promise.resolve(false);
    if (imageEl.complete) return Promise.resolve(imageEl.naturalWidth > 0);

    return new Promise((resolve) => {
        const onLoad = () => cleanup(true);
        const onError = () => cleanup(false);
        const cleanup = (result) => {
            imageEl.removeEventListener('load', onLoad);
            imageEl.removeEventListener('error', onError);
            resolve(result);
        };
        imageEl.addEventListener('load', onLoad, { once: true });
        imageEl.addEventListener('error', onError, { once: true });
    });
}

function loadImage(src) {
    return new Promise((resolve) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => resolve(null);
        image.src = src;
    });
}

function canvasToBlob(canvas) {
    if (typeof canvas.toBlob === 'function') {
        return new Promise((resolve, reject) => {
            canvas.toBlob((blob) => {
                if (blob) {
                    resolve(blob);
                    return;
                }
                reject(new Error('Canvas blob was empty.'));
            }, 'image/png');
        });
    }

    const dataUrl = canvas.toDataURL('image/png');
    const base64 = dataUrl.split(',')[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }
    return Promise.resolve(new Blob([bytes], { type: 'image/png' }));
}

export function updateExportButtonState() {
    const exportButton = document.getElementById('export-drawn-track');
    if (!exportButton || !state.drawnItems) return;
    const hasLayers = state.drawnItems.getLayers().length > 0;
    exportButton.classList.toggle('is-disabled', !hasLayers);
    exportButton.setAttribute('aria-disabled', String(!hasLayers));
    exportButton.tabIndex = hasLayers ? 0 : -1;
}
