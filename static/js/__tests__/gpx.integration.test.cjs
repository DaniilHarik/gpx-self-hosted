const fs = require('node:fs');
const path = require('node:path');

// Match the browser dependencies in index.html. The parser must be real:
// mocks previously hid failures on the application's own elevation-free exports.
global.L = require('leaflet');
require('leaflet-gpx');

let state, addTrack, renderFileList, exportGPX;
const file = { name: 'drawn.gpx', path: '/data/Plans/drawn.gpx', relativePath: 'Plans/drawn.gpx', activity: 'Plans' };

beforeEach(async () => {
    document.body.innerHTML = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8').match(/<body>([\s\S]*)<\/body>/)[1];
    const stateModule = await import('../state.js');
    stateModule.resetState();
    state = stateModule.state;
    ({ addTrack } = await import('../tracks.js'));
    ({ renderFileList } = await import('../files.js'));
    ({ exportGPX } = await import('../draw.js'));
    state.map = { addLayer: jest.fn(), removeLayer: jest.fn(), fitBounds: jest.fn() };
    state.drawnItems = new L.FeatureGroup();
    URL.createObjectURL = jest.fn(() => 'blob:test');
    URL.revokeObjectURL = jest.fn();
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    renderFileList([file]);
});

afterEach(() => jest.restoreAllMocks());

async function exportDrawnXML() {
    exportGPX();
    const blob = URL.createObjectURL.mock.calls[0][0];
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsText(blob);
    });
}

async function loadXML(xml) {
    global.fetch = jest.fn(async () => ({ ok: true, text: async () => xml }));
    await addTrack(file.path, file.name);
    const track = state.loadedTracks.get(file.path);
    expect(track.status).toBe('ready');
    expect(track.layer.getBounds().isValid()).toBe(true);
    expect(document.querySelector('#file-list li[data-path]').dataset.loadState).toBe('ready');
    expect(document.querySelector('.track-load-status').hidden).toBe(true);
    expect(document.querySelector('#info-panel').classList.contains('hidden')).toBe(false);
    return track.layer;
}

test('loads the application\'s own drawn export without elevation', async () => {
    state.drawnItems.addLayer(new L.Polyline([[58.6, 25], [58.7, 25.1]]));
    await loadXML(await exportDrawnXML());
    expect(document.querySelector('#track-distance').textContent).not.toBe('0.00 km');
    expect(document.querySelector('#track-elevation-gain').textContent).toBe('N/A');
    expect(document.querySelector('#track-elevation-loss').textContent).toBe('N/A');
    expect(document.querySelector('#track-date').textContent).toBe('N/A');
    expect(document.querySelector('#track-speed').textContent).toBe('N/A');
    expect(document.querySelector('#track-duration').textContent).toBe('-');
});

test.each(['', '<time>not-a-date</time>'])('does not invent timing statistics when a point time is missing or invalid: %s', async time => {
    await loadXML(`<gpx><trk><trkseg><trkpt lat="58" lon="25"><time>2026-10-17T08:00:00Z</time></trkpt><trkpt lat="58" lon="25.001">${time}</trkpt></trkseg></trk></gpx>`);
    expect(document.querySelector('#track-date').textContent).toBe('N/A');
    expect(document.querySelector('#track-speed').textContent).toBe('N/A');
    expect(document.querySelector('#track-duration').textContent).toBe('-');
});

test.each(['2026-10-17', '1970-01-01'])('preserves recorded timing, including legitimate epoch dates: %s', async date => {
    const start = `${date}T00:00:00Z`;
    const layer = await loadXML(`<gpx><trk><trkseg><trkpt lat="58" lon="25"><time>${start}</time></trkpt><trkpt lat="58" lon="25.001"><time>${date}T00:00:10Z</time></trkpt></trkseg></trk></gpx>`);
    expect(document.querySelector('#track-date').textContent).toBe(new Date(start).toLocaleDateString());
    expect(document.querySelector('#track-speed').textContent).toBe(`${layer.get_moving_speed().toFixed(1)} km/h`);
    expect(document.querySelector('#track-speed').textContent).not.toContain('Infinity');
    expect(document.querySelector('#track-duration').textContent).toBe('0m');
});

test('loads tracks whose initial elevation is missing', async () => {
    await loadXML('<gpx><trk><trkseg><trkpt lat="58" lon="25"/><trkpt lat="59" lon="26"><ele>20</ele></trkpt></trkseg></trk></gpx>');
    expect(document.querySelector('#track-elevation-gain').textContent).toBe('N/A');
});

test('still reports available elevation after real GPX parsing', async () => {
    const points = [0, 10, 20, 30, 40, 50].map((ele, i) => `<trkpt lat="58" lon="${25 + i / 100}"><ele>${ele}</ele></trkpt>`).join('');
    await loadXML(`<gpx><trk><trkseg>${points}</trkseg></trk></gpx>`);
    expect(document.querySelector('#track-elevation-gain').textContent).toMatch(/^\+\d+ m$/);
});

test('keeps separate track segments disconnected and excludes the gap from distance', async () => {
    const segment = lon => `<trkseg><trkpt lat="0" lon="${lon}"><ele>0</ele></trkpt><trkpt lat="0" lon="${lon + 0.01}"><ele>0</ele></trkpt></trkseg>`;
    const layer = await loadXML(`<gpx><trk>${segment(0)}${segment(10)}</trk></gpx>`);
    expect(layer.get_distance()).toBeCloseTo(2223.9, 0);
    expect(document.querySelector('#track-distance').textContent).toBe('2.22 km');
    const lines = [];
    function visit(item) {
        if (item instanceof L.Polyline) lines.push(item.getLatLngs());
        else if (item.eachLayer) item.eachLayer(visit);
    }
    visit(layer);
    expect(lines).toHaveLength(2);
    expect(lines.map(points => points.map(point => point.lng))).toEqual([[0, 0.01], [10, 10.01]]);
});

test.each([
    ['track', 'waypoint', 'track', 'waypoint'],
    ['waypoint', 'track', 'waypoint', 'track'],
])('exports GPX schema order regardless of creation order: %j', async (...order) => {
    order.forEach((kind, i) => state.drawnItems.addLayer(kind === 'waypoint'
        ? new L.Marker([58 + i / 100, 25])
        : new L.Polyline([[58 + i / 100, 25], [58 + i / 100, 25.01]])));
    const xml = await exportDrawnXML();
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    expect(doc.querySelector('parsererror')).toBeNull();
    expect(doc.documentElement.namespaceURI).toBe('http://www.topografix.com/GPX/1/1');
    expect(Array.from(doc.documentElement.children, el => el.localName)).toEqual(['metadata', 'wpt', 'wpt', 'trk', 'trk']);
    expect(doc.querySelectorAll('trkpt')).toHaveLength(4);
    expect(doc.querySelectorAll('wpt')).toHaveLength(2);
    await loadXML(xml);
});
