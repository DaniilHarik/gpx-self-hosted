const fs = require('fs');
const path = require('path');

const defaultGpxFiles = [
    { name: '2023-01-01_Run.gpx', path: '/data/Activities/runs/2023-01-01_Run.gpx', relativePath: 'Activities/runs/2023-01-01_Run.gpx' },
    { name: '2023-01-02_Walk.gpx', path: '/data/Activities/walks/2023-01-02_Walk.gpx', relativePath: 'Activities/walks/2023-01-02_Walk.gpx' },
    { name: '2023-03-01_Evil.gpx', path: '/data/Activities/<img src=x onerror=alert(1)>/2023-03-01_Evil.gpx', relativePath: 'Activities/<img src=x onerror=alert(1)>/2023-03-01_Evil.gpx' }
];

const defaultTileConfig = {
    initial: 'opentopomap',
    providers: {
        openstreetmap: { name: 'OpenStreetMap', url: 'http://osm.org', isTMS: false },
        opentopomap: { name: 'OpenTopoMap', url: 'http://oto.org', isTMS: false },
        maaamet: { name: 'Maa-Amet', url: 'http://maa.ee', isTMS: true }
    }
};

async function bootstrapApp(options = {}) {
    const {
        gpxFiles = defaultGpxFiles,
        tileConfig = defaultTileConfig,
        tileConfigError = null,
        includeDrawToolbar = false,
        tileLayerFactory,
        captureExportHandler = false,
        initialTheme = 'dark'
    } = options;

    jest.resetModules();
    window.__GPX_TEST__ = true;
    const realAddEventListener = HTMLElement.prototype.addEventListener;
    let exportClickHandler = null;
    let addEventSpy = null;

    if (captureExportHandler) {
        addEventSpy = jest.spyOn(HTMLElement.prototype, 'addEventListener').mockImplementation(function (type, listener, options) {
            if (this && this.id === 'export-drawn-track' && type === 'click') {
                exportClickHandler = listener;
            }
            return realAddEventListener.call(this, type, listener, options);
        });
    }

    localStorage.clear();
    document.documentElement.dataset.theme = initialTheme;

    document.body.innerHTML = `
        <div id="map">
            <div class="leaflet-top leaflet-right">
                <div id="download-control-placeholder" class="leaflet-control"></div>
            </div>
            <div class="leaflet-bottom leaflet-left">
                <div id="layer-control-placeholder" class="leaflet-control"></div>
            </div>
        </div>
        <div class="sidebar-header">
            <div class="header-row">
                <h2>GPX Archive <span id="file-count"></span></h2>
                <div class="header-actions">
                    <button id="theme-toggle" class="icon-btn" title="Toggle theme" aria-label="Toggle theme">
                        <i class="fas fa-moon"></i>
                    </button>
                    <button id="toggle-multi-track" class="icon-btn"></button>
                </div>
            </div>
        </div>
        <ul id="file-list" class="file-list"></ul>
        <input id="filesearch" />
        <div id="view-toggle" class="view-toggle">
            <button class="view-toggle-btn active" data-view="activities" aria-pressed="true">Activities</button>
            <button class="view-toggle-btn" data-view="plans" aria-pressed="false">Plans</button>
        </div>
        <div id="activity-filters"></div>
        <div id="info-panel" class="hidden">
             <h3 id="track-name"></h3>
             <span id="track-distance"></span>
             <span id="track-duration"></span>
             <span id="track-date"></span>
             <span id="track-speed"></span>
             <span id="track-elevation-gain"></span>
             <span id="track-elevation-loss"></span>
        </div>

        <button id="export-btn"></button>
        ${includeDrawToolbar ? '<div class="leaflet-draw leaflet-control"><div class="leaflet-draw-toolbar-top"></div></div>' : ''}
    `;

    const mapMock = {
        setView: jest.fn().mockReturnThis(),
        addLayer: jest.fn().mockReturnThis(),
        removeLayer: jest.fn().mockReturnThis(),
        removeControl: jest.fn().mockReturnThis(),
        fitBounds: jest.fn().mockReturnThis(),
        addControl: jest.fn().mockReturnThis(),
        on: jest.fn().mockReturnThis(),
        getContainer: jest.fn(() => document.getElementById('map')),
        getZoom: jest.fn(() => 7),
        getBounds: jest.fn(() => ({
            getNorthWest: () => ({ lat: 59, lng: 24 }),
            getSouthEast: () => ({ lat: 58, lng: 25 })
        })),
        project: jest.fn((latlng, zoom) => {
            const scale = 256 * (1 << zoom);
            const x = ((latlng.lng + 180) / 360) * scale;
            const y = ((90 - latlng.lat) / 180) * scale;
            return { x, y };
        })
    };

    const createdTileLayers = [];
    const tileLayerFactoryFn = tileLayerFactory || (() => ({
        addTo: jest.fn().mockReturnThis()
    }));

    global.Blob = class {
        constructor(parts, opts = {}) {
            this.parts = parts;
            this.type = opts.type;
        }
        text() {
            return Promise.resolve(this.parts.join(''));
        }
    };

    const featureGroupState = { layers: [] };
    const featureGroupMock = {
        addTo: jest.fn(),
        addLayer: jest.fn((layer) => featureGroupState.layers.push(layer)),
        getLayers: jest.fn(() => featureGroupState.layers),
        eachLayer: jest.fn((cb) => featureGroupState.layers.forEach(cb))
    };

    class Polyline {
        constructor(latlngs = [], opts = {}) {
            this._latlngs = latlngs;
            this.options = opts;
        }
        getLatLngs() {
            return this._latlngs;
        }
    }



    class Marker {
        constructor(latlng = { lat: 0, lng: 0 }) {
            this._latlng = latlng;
        }
        getLatLng() {
            return this._latlng;
        }
    }

    const controlExtend = jest.fn((def) => {
        function Control(opts) {
            this.options = opts;
        }
        Control.prototype.addTo = jest.fn(() => this);
        Control.prototype.onAdd = def.onAdd || jest.fn();
        Control.prototype.onRemove = def.onRemove || jest.fn();
        return Control;
    });

    const gpxMock = {
        on: jest.fn(function (event, cb) {
            if (event === 'loaded') {
                cb({ target: this });
            }
            return this;
        }),
        addTo: jest.fn().mockReturnThis(),
        getBounds: jest.fn(),
        get_distance: jest.fn(() => 10000), // 10km
        get_total_time: jest.fn(() => 3600000), // 1h
        get_moving_time: jest.fn(() => 3000000), // 50m
        get_start_time: jest.fn(() => new Date('2023-01-01T10:00:00Z')),
        get_moving_speed: jest.fn(() => 12.5),
        get_elevation_data: jest.fn(() => [
            [0, 100], [1, 110], [2, 120] // simple gain
        ])
    };

    const existingControlLayers = global.L && global.L.control && global.L.control.layers;
    const controlLayers = typeof existingControlLayers === 'function'
        ? existingControlLayers
        : jest.fn(() => ({
            addTo: jest.fn()
        }));

    global.L = {
        map: jest.fn(() => mapMock),
        tileLayer: jest.fn(() => {
            const layer = tileLayerFactoryFn();
            createdTileLayers.push(layer);
            return layer;
        }),
        control: {
            layers: controlLayers
        },
        GPX: jest.fn(() => gpxMock),
        FeatureGroup: jest.fn(() => featureGroupMock),
        Control: {
            Draw: jest.fn(() => ({
                addTo: jest.fn()
            })),
            extend: controlExtend
        },
        Draw: {
            Event: {
                CREATED: 'draw:created'
            }
        },

        Polyline,
        Marker,
        DomUtil: {
            create: jest.fn((tag, className, container) => {
                const el = document.createElement(tag);
                if (className) el.className = className;
                if (container) container.appendChild(el);
                return el;
            })
        },
        DomEvent: {
            disableClickPropagation: jest.fn(),
            disableScrollPropagation: jest.fn()
        }
    };



    global.fetch = jest.fn((url) => {
        if (url === '/api/tile-config') {
            if (tileConfigError) {
                return Promise.reject(tileConfigError);
            }
            return Promise.resolve({
                json: () => Promise.resolve(tileConfig)
            });
        }
        if (url === '/api/gpx') {
            return Promise.resolve({
                json: () => Promise.resolve(gpxFiles)
            });
        }
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
    });

    const app = await import('../app.js');
    if (app.resetState) app.resetState();
    if (app.init) await app.init();
    await new Promise(resolve => setTimeout(resolve, 0));

    if (addEventSpy) {
        addEventSpy.mockRestore();
    }
    return { app, featureGroupMock, featureGroupState, mapMock, tileLayers: createdTileLayers, exportClickHandler, gpxMock };
}

describe('Offline cache pre-warming', () => {
    test('renders Download Current View as a map control in the top right corner', async () => {
        await bootstrapApp({ gpxFiles: [] });
        const corner = document.querySelector('#map .leaflet-top.leaflet-right');
        expect(corner).toBeTruthy();
        expect(corner.firstElementChild).toBeTruthy();
        expect(corner.firstElementChild.classList.contains('map-offline-tools')).toBe(true);
        expect(document.getElementById('download-current-view')).toBeTruthy();
        expect(document.getElementById('download-current-view-status').textContent).toContain('Ready');
    });

    test('shows confirm UI and toggles back when canceling', async () => {
        await bootstrapApp({ gpxFiles: [] });
        const button = document.getElementById('download-current-view');
        const confirmArea = document.getElementById('prewarm-confirm-area');

        expect(confirmArea.classList.contains('hidden')).toBe(true);
        button.click();
        expect(confirmArea.classList.contains('hidden')).toBe(false);
        expect(button.classList.contains('hidden')).toBe(true);

        document.getElementById('prewarm-confirm-no').click();
        expect(confirmArea.classList.contains('hidden')).toBe(true);
        expect(button.classList.contains('hidden')).toBe(false);
    });

    test('does not start downloading when confirm is declined', async () => {
        window.confirm = jest.fn(() => false);
        await bootstrapApp({
            gpxFiles: [],
            tileConfig: {
                initial: 'opentopomap',
                offline: false,
                providers: {
                    opentopomap: { name: 'OpenTopoMap', isTMS: false, minZoom: 0, maxZoom: 0 }
                }
            }
        });

        const button = document.getElementById('download-current-view');
        button.click();

        const prewarmCalls = global.fetch.mock.calls.filter(([url]) => url === '/api/prewarm-view');
        expect(prewarmCalls).toHaveLength(0);
    });

    test('downloads tiles for current view and updates status', async () => {
        window.confirm = jest.fn(() => true);
        const prewarmSpy = jest.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ providerKey: 'opentopomap', zoomMin: 0, zoomMax: 0, total: 1, ok: 1, failed: 0 }) }));

        await bootstrapApp({
            gpxFiles: [],
            tileConfig: {
                initial: 'opentopomap',
                offline: false,
                providers: {
                    opentopomap: { name: 'OpenTopoMap', isTMS: false, minZoom: 0, maxZoom: 0 }
                }
            }
        });

        global.fetch.mockImplementation((url, opts) => {
            if (url === '/api/tile-config') return Promise.resolve({ json: () => Promise.resolve({ initial: 'opentopomap', offline: false, providers: { opentopomap: { name: 'OpenTopoMap', isTMS: false, minZoom: 0, maxZoom: 0 } } }) });
            if (url === '/api/gpx') return Promise.resolve({ json: () => Promise.resolve([]) });
            if (url === '/api/prewarm-view') return prewarmSpy(url, opts);
            return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
        });

        const appTick = () => new Promise(resolve => setTimeout(resolve, 0));
        await appTick();

        const button = document.getElementById('download-current-view');
        button.click();
        await appTick();
        document.getElementById('prewarm-confirm-yes').click();
        await appTick();
        await appTick();

        expect(prewarmSpy).toHaveBeenCalledTimes(1);
        const status = document.getElementById('download-current-view-status').textContent;
        expect(status).toContain('Done');
        expect(status).toContain('1/1');
    });

    test('shows failure status when prewarm request fails', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
        await bootstrapApp({
            gpxFiles: [],
            tileConfig: {
                initial: 'opentopomap',
                offline: false,
                providers: {
                    opentopomap: { name: 'OpenTopoMap', isTMS: false, minZoom: 0, maxZoom: 0 }
                }
            }
        });

        global.fetch.mockImplementation((url) => {
            if (url === '/api/prewarm-view') {
                return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) });
            }
            return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
        });

        const appTick = () => new Promise(resolve => setTimeout(resolve, 0));
        await appTick();

        document.getElementById('download-current-view').click();
        await appTick();
        document.getElementById('prewarm-confirm-yes').click();
        await appTick();
        await appTick();

        expect(document.getElementById('download-current-view-status').textContent).toContain('Failed');
        expect(consoleErrorSpy).toHaveBeenCalled();
        consoleErrorSpy.mockRestore();
    });

    test('cancel aborts in-flight downloads and shows Canceled', async () => {
        window.confirm = jest.fn(() => true);

        await bootstrapApp({
            gpxFiles: [],
            tileConfig: {
                initial: 'opentopomap',
                offline: false,
                providers: {
                    opentopomap: { name: 'OpenTopoMap', isTMS: false, minZoom: 0, maxZoom: 2 }
                }
            }
        });

        const neverResolvingFetch = jest.fn((url, opts = {}) => {
            if (url !== '/api/prewarm-view') return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
            return new Promise((resolve, reject) => {
                if (opts.signal) {
                    opts.signal.addEventListener('abort', () => {
                        const err = new Error('aborted');
                        err.name = 'AbortError';
                        reject(err);
                    });
                }
            });
        });

        global.fetch.mockImplementation((url, opts) => {
            if (url === '/api/tile-config') {
                return Promise.resolve({
                    json: () => Promise.resolve({
                        initial: 'opentopomap',
                        offline: false,
                        providers: { opentopomap: { name: 'OpenTopoMap', isTMS: false, minZoom: 0, maxZoom: 2 } }
                    })
                });
            }
            if (url === '/api/gpx') return Promise.resolve({ json: () => Promise.resolve([]) });
            return neverResolvingFetch(url, opts);
        });

        const appTick = () => new Promise(resolve => setTimeout(resolve, 0));
        await appTick();

        const button = document.getElementById('download-current-view');
        const cancel = document.getElementById('download-current-view-cancel');
        button.click();
        await appTick();
        document.getElementById('prewarm-confirm-yes').click();
        await appTick();
        cancel.click();
        await appTick();
        await appTick();
        await appTick();

        expect(document.getElementById('download-current-view-status').textContent).toContain('Canceled');
    });

    test('disables download when no active tile provider exists', async () => {
        await bootstrapApp({
            gpxFiles: [],
            tileConfig: {
                providers: {}
            }
        });

        const button = document.getElementById('download-current-view');
        const status = document.getElementById('download-current-view-status').textContent;
        expect(button.disabled).toBe(true);
        expect(status).toContain('No active base layer');
    });

    test('persists selected layer to localStorage on baselayerchange', async () => {
        let captureBaseLayers = null;
        global.L.control.layers.mockImplementationOnce((baseLayers) => {
            captureBaseLayers = baseLayers;
            return { addTo: jest.fn() };
        });

        const { mapMock } = await bootstrapApp({
            tileConfig: {
                initial: 'osm',
                providers: {
                    osm: { name: 'OSM' },
                    topo: { name: 'Topo' }
                }
            }
        });

        const baselayerchangeHandler = mapMock.on.mock.calls.find(([event]) => event === 'baselayerchange')[1];
        const topoLayer = captureBaseLayers['Topo'];

        const setItemSpy = jest.spyOn(Storage.prototype, 'setItem');
        baselayerchangeHandler({ layer: topoLayer });

        expect(setItemSpy).toHaveBeenCalledWith('gpx-self-host-layer', 'topo');
        setItemSpy.mockRestore();
    });

    test('uses saved layer from localStorage on initialization', async () => {
        const originalGetItem = Storage.prototype.getItem;
        const getItemSpy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) {
            if (key === 'gpx-self-host-layer') return 'topo';
            return originalGetItem.call(this, key);
        });

        let captureBaseLayers = null;
        global.L.control.layers.mockImplementationOnce((baseLayers) => {
            captureBaseLayers = baseLayers;
            return { addTo: jest.fn() };
        });

        const { mapMock } = await bootstrapApp({
            tileConfig: {
                initial: 'osm',
                providers: {
                    osm: { name: 'OSM' },
                    topo: { name: 'Topo' }
                }
            }
        });

        const topoLayer = captureBaseLayers['Topo'];
        expect(topoLayer.addTo).toHaveBeenCalledWith(mapMock);

        getItemSpy.mockRestore();
    });
});

describe('CSS regressions', () => {
    test('Leaflet control hover does not reset sprite backgrounds', () => {
        const cssPath = path.join(__dirname, '../../css/style.css');
        const css = fs.readFileSync(cssPath, 'utf8');

        const leafletBarRule = css.match(/\.leaflet-bar a\s*\{[^}]*\}/s);
        expect(leafletBarRule).toBeTruthy();
        expect(leafletBarRule[0]).toMatch(/background-color\s*:\s*var\(--leaflet-control-bg\)\s*;/);
        expect(leafletBarRule[0]).not.toMatch(/(^|[;\s])background\s*:/);

        const leafletBarHoverRule = css.match(/\.leaflet-bar a:hover\s*\{[^}]*\}/s);
        expect(leafletBarHoverRule).toBeTruthy();
        expect(leafletBarHoverRule[0]).toMatch(/background-color\s*:\s*var\(--leaflet-control-bg-hover\)\s*;/);
        expect(leafletBarHoverRule[0]).not.toMatch(/(^|[;\s])background\s*:/);

        const primaryHoverRule = css.match(/\.primary-btn:hover\s*\{[^}]*\}/s);
        expect(primaryHoverRule).toBeTruthy();
        expect(primaryHoverRule[0]).not.toMatch(/filter\s*:/);
    });
});

describe('Sorting', () => {
    test('sorts files by date descending across activities', () => {
        // A: newer date, alphabetically "Z" activity
        // B: older date, alphabetically "A" activity
        const files = [
            { name: '2022-01-01_Old.gpx', path: '/data/Activities/A_Activity/2022-01-01_Old.gpx', relativePath: 'Activities/A_Activity/2022-01-01_Old.gpx', activity: 'A_Activity' },
            { name: '2023-01-01_New.gpx', path: '/data/Activities/Z_Activity/2023-01-01_New.gpx', relativePath: 'Activities/Z_Activity/2023-01-01_New.gpx', activity: 'Z_Activity' },
            { name: 'NoDate.gpx', path: '/data/Activities/B_Activity/NoDate.gpx', relativePath: 'Activities/B_Activity/NoDate.gpx', activity: 'B_Activity' }
        ];

        // Use the app's internal sorting logic or mock fetch response
        // We'll mock fetch response to test the full flow including fetchFiles
        // Re-bootstrap to trigger fetch
        return bootstrapApp({ gpxFiles: files }).then(() => {
            const list = document.getElementById('file-list');
            const items = list.querySelectorAll('li:not(.year-separator)');

            // Expectations for Date Descending Sort:
            // 1. 2023-01-01_New.gpx (Newest)
            // 2. 2022-01-01_Old.gpx (Older)
            // 3. NoDate.gpx (No Date - usually last or first depending on impl, assuming last for now or strictly after dated ones)

            expect(items[0].textContent).toContain('New');
            expect(items[1].textContent).toContain('Old');
            expect(items[2].textContent).toContain('NoDate');
        });
    });

    test('renders year separators when years change', async () => {
        const files = [
            { name: '2023-01-01_A.gpx', path: '/data/Activities/Other/a.gpx', relativePath: 'Activities/Other/a.gpx' },
            { name: '2023-02-01_B.gpx', path: '/data/Activities/Other/b.gpx', relativePath: 'Activities/Other/b.gpx' },
            { name: '2022-12-31_C.gpx', path: '/data/Activities/Other/c.gpx', relativePath: 'Activities/Other/c.gpx' },
            { name: '2021-01-01_D.gpx', path: '/data/Activities/Other/d.gpx', relativePath: 'Activities/Other/d.gpx' }
        ];

        await bootstrapApp({ gpxFiles: files });
        const list = document.getElementById('file-list');
        const children = Array.from(list.children);

        // Expected structure:
        // 1. Separator 2023
        // 2. File A
        // 3. File B
        // 4. Separator 2022
        // 5. File C
        // 6. Separator 2021
        // 7. File D

        // Filter for separators
        const separators = children.filter(el => el.classList.contains('year-separator'));
        expect(separators.length).toBe(3);
        expect(separators[0].textContent).toBe('2023');
        expect(separators[1].textContent).toBe('2022');
        expect(separators[2].textContent).toBe('2021');

        // Verify order
        expect(children[0].textContent).toBe('2023');
        expect(children[1].textContent).toContain('B');
        expect(children[2].textContent).toContain('A');
        expect(children[3].textContent).toBe('2022');
        expect(children[4].textContent).toContain('C');
        expect(children[5].textContent).toBe('2021');
        expect(children[6].textContent).toContain('D');
    });

    test('year separator row is sticky', () => {
        const cssPath = path.resolve(__dirname, '../../css/style.css');
        const css = fs.readFileSync(cssPath, 'utf8');
        const match = css.match(/\.year-separator\s*\{[\s\S]*?\}/m);
        expect(match).not.toBeNull();
        expect(match[0]).toMatch(/position:\s*sticky/i);
    });

    test('year separators are robust to date-only timezone shifts', async () => {
        const RealDate = global.Date;
        class MockDate extends RealDate {
            constructor(...args) {
                if (args.length === 1 && typeof args[0] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(args[0])) {
                    const [year, month, day] = args[0].split('-').map(Number);
                    // Simulate the classic bug: date-only strings shifting into the previous day/year.
                    super(year, month - 1, day - 1);
                    return;
                }
                super(...args);
            }
            static now() { return RealDate.now(); }
            static parse(s) { return RealDate.parse(s); }
            static UTC(...args) { return RealDate.UTC(...args); }
        }

        global.Date = MockDate;
        try {
            const files = [
                { name: '2021-01-01_D.gpx', path: '/data/Activities/Other/d.gpx', relativePath: 'Activities/Other/d.gpx' },
                { name: '2020-12-31_C.gpx', path: '/data/Activities/Other/c.gpx', relativePath: 'Activities/Other/c.gpx' }
            ];

            await bootstrapApp({ gpxFiles: files });
            const separators = Array.from(document.querySelectorAll('#file-list .year-separator'));
            expect(separators.map(s => s.textContent)).toEqual(['2021', '2020']);
        } finally {
            global.Date = RealDate;
        }
    });
});

describe('App Logic', () => {
    let app;
    let featureGroupMock;
    let featureGroupState;
    let mapMock;

    beforeEach(async () => {
        ({ app, featureGroupMock, featureGroupState, mapMock } = await bootstrapApp());
    });

    const findChipByLabel = (label) => {
        const chips = Array.from(document.querySelectorAll('#activity-filters .filter-chip'));
        return chips.find(btn => btn.textContent.includes(label));
    };

    const findViewButton = (view) => {
        return document.querySelector(`#view-toggle .view-toggle-btn[data-view="${view}"]`);
    };

    describe('Initialization', () => {
        test('initializes map with config', () => {
            expect(global.fetch).toHaveBeenCalledWith('/api/tile-config');
            expect(global.L.tileLayer).toHaveBeenCalled();
            // Check if layer control was added
            expect(global.L.control.layers).toHaveBeenCalled();
            // Check if draw control was added
            expect(global.L.Control.Draw).toHaveBeenCalled();
        });

        test('fetches and lists files', () => {
            expect(global.fetch).toHaveBeenCalledWith('/api/gpx');
            const list = document.getElementById('file-list');
            // Check if 3 items are rendered (excluding separators)
            expect(list.querySelectorAll('li:not(.year-separator)').length).toBe(3);
            expect(list.innerHTML).toContain('Run');
            expect(list.innerHTML).toContain('Walk');
            expect(document.getElementById('file-count').textContent).toBe('(3)');
            expect(list.querySelector('img')).toBeNull();
        });
    });

    describe('Interactions', () => {
        test('search filters the file list', () => {
            const input = document.getElementById('filesearch');
            input.value = 'Run';
            input.dispatchEvent(new Event('input'));

            const list = document.getElementById('file-list');
            expect(list.querySelectorAll('li:not(.year-separator)').length).toBe(1);
            expect(list.innerHTML).toContain('Run');
            expect(list.innerHTML).not.toContain('Walk');
            expect(document.getElementById('file-count').textContent).toBe('(1)');
        });

        test('empty search results show message', () => {
            const input = document.getElementById('filesearch');
            input.value = 'NonExistent';
            input.dispatchEvent(new Event('input'));

            const list = document.getElementById('file-list');
            expect(list.innerHTML).toContain('No GPX files found');
        });

        test('clicking a file loads it on the map', () => {
            const list = document.getElementById('file-list');
            const item = Array.from(list.children).find(li => li.title === 'Activities/walks/2023-01-02_Walk.gpx');
            item.click();

            // Should call L.GPX with path
            expect(global.L.GPX).toHaveBeenCalledWith('/data/Activities/walks/2023-01-02_Walk.gpx', expect.any(Object));

            // Check active class
            expect(item.classList.contains('active')).toBe(true);

            // The mock manually fires 'loaded', which calls updateInfoPanel
            // Check if info panel was populated
            expect(document.getElementById('track-name').textContent).toBe('2023-01-02_Walk.gpx');
            expect(document.getElementById('track-distance').textContent).toBe('10.00 km');
        });

        test('omits redundant folder labels and filters by relative path', () => {
            const list = document.getElementById('file-list');
            const firstItem = Array.from(list.children).find(li => li.title === 'Activities/walks/2023-01-02_Walk.gpx');
            const folderLabel = firstItem.querySelector('.track-folder');
            expect(folderLabel).toBeNull();
            expect(firstItem.title).toBe('Activities/walks/2023-01-02_Walk.gpx');

            const input = document.getElementById('filesearch');
            input.value = 'runs';
            input.dispatchEvent(new Event('input'));

            expect(list.querySelectorAll('li:not(.year-separator)').length).toBe(1);
            expect(list.innerHTML).toContain('Run');
        });

        test('activity filter chips toggle active state and filter results', () => {
            const chips = Array.from(document.querySelectorAll('#activity-filters .filter-chip'));
            const allChip = chips.find(btn => btn.dataset.activity === 'all');
            const runChip = findChipByLabel('runs');
            const walkChip = findChipByLabel('walks');
            const evilChip = findChipByLabel('onerror=alert');

            expect(allChip.classList.contains('active')).toBe(true);
            expect(runChip.classList.contains('active')).toBe(false);
            expect(evilChip.classList.contains('active')).toBe(false);

            runChip.click();
            const list = document.getElementById('file-list');
            expect(list.querySelectorAll('li:not(.year-separator)').length).toBe(1);
            expect(list.innerHTML).toContain('Run');
            expect(allChip.classList.contains('active')).toBe(false);
            expect(runChip.classList.contains('active')).toBe(true);

            runChip.click(); // toggles off and resets to all
            expect(list.querySelectorAll('li:not(.year-separator)').length).toBe(3);
            expect(allChip.classList.contains('active')).toBe(true);

            walkChip.click();
            expect(list.querySelectorAll('li:not(.year-separator)').length).toBe(1);
            expect(list.innerHTML).toContain('Walk');
            expect(walkChip.classList.contains('active')).toBe(true);
            expect(evilChip.classList.contains('active')).toBe(false);
        });

        test('treats Plans folder as a separate view excluded from Activities', async () => {
            const planFiles = [
                ...defaultGpxFiles,
                { name: '2025-01-03_Beta.gpx', path: '/data/Plans/2025-01-03_Beta.gpx', relativePath: 'Plans/2025-01-03_Beta.gpx' },
                { name: '2024-12-31_Alpha.gpx', path: '/data/Plans/2024-12-31_Alpha.gpx', relativePath: 'Plans/2024-12-31_Alpha.gpx' }
            ];
            await bootstrapApp({ gpxFiles: planFiles });

            const list = document.getElementById('file-list');
            expect(list.querySelectorAll('li:not(.year-separator)').length).toBe(3);
            expect(list.innerHTML).not.toContain('2025-01-03_Beta');
            expect(list.innerHTML).not.toContain('2024-12-31_Alpha');
            expect(document.getElementById('file-count').textContent).toBe('(3)');

            const plansBtn = findViewButton('plans');
            expect(plansBtn).toBeTruthy();
            plansBtn.click();
            expect(plansBtn.getAttribute('aria-pressed')).toBe('true');
            expect(findViewButton('activities').getAttribute('aria-pressed')).toBe('false');
            expect(document.getElementById('activity-filters').classList.contains('hidden')).toBe(true);
            expect(list.querySelectorAll('li.year-separator').length).toBe(0);
            expect(list.querySelectorAll('li:not(.year-separator)').length).toBe(2);
            expect(list.innerHTML).toContain('2025-01-03_Beta');
            expect(list.innerHTML).toContain('2024-12-31_Alpha');
            expect(document.getElementById('file-count').textContent).toBe('(2)');

            const planItems = Array.from(list.querySelectorAll('li:not(.year-separator)'));
            expect(planItems.map(li => li.title)).toEqual([
                'Plans/2024-12-31_Alpha.gpx',
                'Plans/2025-01-03_Beta.gpx'
            ]);

            const activitiesBtn = findViewButton('activities');
            activitiesBtn.click();
            expect(activitiesBtn.getAttribute('aria-pressed')).toBe('true');
            expect(document.getElementById('activity-filters').classList.contains('hidden')).toBe(false);

            const runChip = findChipByLabel('runs');
            runChip.click();
            expect(list.querySelectorAll('li:not(.year-separator)').length).toBe(1);
            expect(list.innerHTML).toContain('Run');
        });

        test('renders formatted titles, dates, icons and toggles active state', () => {
            const customFiles = app.addActivityToFiles([
                { name: '2013-06-07-09_Morning-ride.gpx', path: '/data/Activities/backpacking/2013-06-07-09_Morning-ride.gpx', relativePath: 'Activities/backpacking/2013-06-07-09_Morning-ride.gpx' },
                { name: 'Track_without_date.gpx', path: '/data/Activities/other/Track_without_date.gpx', relativePath: 'Activities/other/Track_without_date.gpx' }
            ]);

            app.renderFileList(customFiles);
            const list = document.getElementById('file-list');
            const items = list.querySelectorAll('li:not(.year-separator)');
            const first = items[0];
            const second = items[1];

            expect(first.querySelector('.track-date').textContent).toBe('2013-06-07-09');
            expect(first.querySelector('.track-title').textContent).toBe('Morning-ride');
            expect(first.querySelector('.activity-chip i').className).toContain('fa-mountain');
            expect(second.querySelector('.track-title').textContent).toBe('Track without date');

            first.click();
            expect(first.classList.contains('active')).toBe(true);
            second.click();
            expect(second.classList.contains('active')).toBe(true);
            expect(first.classList.contains('active')).toBe(false);
        });

        test('supports multi-activity filtering and reset via All chip', () => {
            const list = document.getElementById('file-list');
            const chips = Array.from(document.querySelectorAll('#activity-filters .filter-chip'));
            const allChip = chips.find(btn => btn.dataset.activity === 'all');
            const runChip = findChipByLabel('runs');
            const walkChip = findChipByLabel('walks');
            const evilChip = findChipByLabel('onerror=alert');

            runChip.click();
            walkChip.click();
            expect(list.querySelectorAll('li:not(.year-separator)').length).toBe(2);
            expect(evilChip.classList.contains('active')).toBe(false);

            const input = document.getElementById('filesearch');
            input.value = 'walk';
            input.dispatchEvent(new Event('input'));
            expect(list.querySelectorAll('li:not(.year-separator)').length).toBe(1);
            expect(list.innerHTML).toContain('Walk');

            allChip.click();
            input.value = '';
            input.dispatchEvent(new Event('input'));
            expect(list.querySelectorAll('li:not(.year-separator)').length).toBe(3);
            expect(allChip.classList.contains('active')).toBe(true);
            expect(runChip.classList.contains('active')).toBe(false);
            expect(walkChip.classList.contains('active')).toBe(false);
            expect(evilChip.classList.contains('active')).toBe(false);
        });

        test('renders activity counts on filter chips', () => {
            const chips = Array.from(document.querySelectorAll('#activity-filters .filter-chip'));
            const allChip = chips.find(btn => btn.dataset.activity === 'all');
            const runsChip = findChipByLabel('runs');
            const walksChip = findChipByLabel('walks');

            expect(allChip.querySelector('.activity-count').textContent).toBe('3');
            expect(runsChip.querySelector('.activity-count').textContent).toBe('1');
            expect(walksChip.querySelector('.activity-count').textContent).toBe('1');
        });
    });

    describe('Multi-Track Mode', () => {
        test('toggles mode and checkboxes', () => {
            const toggleBtn = document.getElementById('toggle-multi-track');
            const list = document.getElementById('file-list');

            // Initially single mode, no checkboxes
            expect(list.querySelector('.track-select-cb')).toBeNull();

            // Toggle On
            toggleBtn.click();
            expect(toggleBtn.classList.contains('active')).toBe(true);
            expect(list.querySelector('.track-select-cb')).toBeTruthy();

            // Toggle Off
            toggleBtn.click();
            expect(toggleBtn.classList.contains('active')).toBe(false);
            expect(list.querySelector('.track-select-cb')).toBeNull();
        });

        test('multi-select adds tracks without removing others', () => {
            const toggleBtn = document.getElementById('toggle-multi-track');
            toggleBtn.click();

            const list = document.getElementById('file-list');
            const items = list.querySelectorAll('li:not(.year-separator)');

            const findCb = (partialPath) => {
                const li = Array.from(items).find(i => i.dataset.path && i.dataset.path.includes(partialPath));
                return li ? li.querySelector('.track-select-cb') : null;
            };
            const cb1 = findCb('Activities/walks/2023-01-02_Walk.gpx');
            const cb2 = findCb('Activities/runs/2023-01-01_Run.gpx');

            // Click Walk first
            if (cb1) cb1.click();
            expect(global.L.GPX).toHaveBeenCalledTimes(1);
            expect(global.L.GPX).toHaveBeenLastCalledWith(expect.stringContaining('Walk'), expect.any(Object));

            // Click second checkbox (Run)
            if (cb2) cb2.click();
            expect(global.L.GPX).toHaveBeenCalledTimes(2);
            expect(global.L.GPX).toHaveBeenLastCalledWith(expect.stringContaining('Run'), expect.any(Object));

            // Map should have both layers
            expect(mapMock.removeLayer).not.toHaveBeenCalled();
        });

        test('uses inline SVG marker icons for waypoints and start/end', () => {
            const toggleBtn = document.getElementById('toggle-multi-track');
            toggleBtn.click();

            const list = document.getElementById('file-list');
            const item = list.querySelector('li:not(.year-separator)');
            const cb = item.querySelector('.track-select-cb');
            cb.click();

            const firstCallOpts = global.L.GPX.mock.calls[0][1];
            const markerOpts = firstCallOpts.marker_options;

            expect(markerOpts.startIconUrl.startsWith('data:image/svg+xml')).toBe(true);
            expect(markerOpts.endIconUrl.startsWith('data:image/svg+xml')).toBe(true);
            expect(markerOpts.wptIconUrls[''].startsWith('data:image/svg+xml')).toBe(true);
            expect(markerOpts.wptIconTypeUrls[''].startsWith('data:image/svg+xml')).toBe(true);
            expect(markerOpts.shadowUrl.startsWith('data:image/svg+xml')).toBe(true);
        });

        test('exclusive click in multi-mode removes others', () => {
            const toggleBtn = document.getElementById('toggle-multi-track');
            toggleBtn.click();
            const list = document.getElementById('file-list');
            const items = list.querySelectorAll('li:not(.year-separator)');

            // Load two tracks
            const cb1 = items[0].querySelector('.track-select-cb');
            const cb2 = items[1].querySelector('.track-select-cb');
            if (cb1) cb1.click();
            if (cb2) cb2.click();

            // Now click the text of the first one
            items[0].click();

            // Should have removed the second track
            expect(mapMock.removeLayer).toHaveBeenCalled();
            // And kept/re-focused the first
        });

        test('disabling multi-mode enforces single track', () => {
            const toggleBtn = document.getElementById('toggle-multi-track');
            toggleBtn.click();
            const list = document.getElementById('file-list');
            const items = list.querySelectorAll('li:not(.year-separator)');

            // Load two tracks
            items[0].querySelector('.track-select-cb').click();
            items[1].querySelector('.track-select-cb').click();

            // Toggle Off
            toggleBtn.click();

            // Should remove all except one (usually the last focused, or first)
            expect(mapMock.removeLayer).toHaveBeenCalled();
        });

        test('uses blue as primary color and rotates colors', () => {
            const toggleBtn = document.getElementById('toggle-multi-track');
            toggleBtn.click();
            const list = document.getElementById('file-list');
            const items = list.querySelectorAll('li:not(.year-separator)');

            // Global L.GPX mock needs to inspect options passed
            items[0].querySelector('.track-select-cb').click();

            // First track should be Blue #0000FF
            const firstCallOpts = global.L.GPX.mock.calls[0][1];
            expect(firstCallOpts.polyline_options.color).toBe('#0000FF');
            expect(firstCallOpts.polyline_options.weight).toBe(3);

            items[1].querySelector('.track-select-cb').click();
            const secondCallOpts = global.L.GPX.mock.calls[1][1];
            expect(secondCallOpts.polyline_options.color).toBe('#FF0000'); // Red is second in TRACK_COLORS
        });
    });

    describe('Security', () => {
        test('renders dangerous names as text, not HTML', () => {
            const dangerousName = '<img src=x onerror=alert(1)>';
            app.renderFileList([{
                name: `${dangerousName}.gpx`,
                path: '/data/Activities/evil/evil.gpx',
                relativePath: 'Activities/evil/track.gpx',
                activity: 'Evil',
            }]);

            const list = document.getElementById('file-list');
            const titleEl = list.querySelector('.track-title');

            expect(titleEl).toBeTruthy();
            expect(titleEl.textContent).toContain(dangerousName);
            expect(list.querySelector('img')).toBeNull();
            expect(list.innerHTML).not.toContain('<img src=');
        });

        test('renders activity filter chips using textContent', () => {
            const chips = Array.from(document.querySelectorAll('#activity-filters .filter-chip'));
            const evilChip = chips.find(btn => btn.textContent.includes('<img src=x onerror=alert(1)>'));
            expect(evilChip).toBeTruthy();
            expect(evilChip.querySelector('img')).toBeNull();
            expect(evilChip.innerHTML).not.toContain('<img src=');
            expect(evilChip.dataset.activity).not.toContain('<img');
        });

        test('renders nested folder labels safely', () => {
            const maliciousPath = 'Activities/runs/<img src=x onerror=alert(1)>/2023-04-01_Scouting.gpx';
            const files = app.addActivityToFiles([{
                name: '2023-04-01_Scouting.gpx',
                path: '/data/Activities/runs/2023-04-01_Scouting.gpx',
                relativePath: maliciousPath
            }]);

            app.renderFileList(files);
            const folderEl = document.querySelector('.track-folder');
            expect(folderEl).toBeTruthy();
            expect(folderEl.textContent).toContain('<img src=x onerror=alert(1)>');
            expect(folderEl.innerHTML).not.toContain('<img src=');
        });
    });

    describe('Utils (Exported)', () => {
        test('formatDuration formats milliseconds to HHh MMm', () => {
            expect(app.formatDuration(3660000)).toBe('1h 1m');
            expect(app.formatDuration(60000)).toBe('1m');
            expect(app.formatDuration(3600000)).toBe('1h 0m');
            expect(app.formatDuration(59999)).toBe('0m');
            expect(app.formatDuration(120000)).toBe('2m');
        });

        test('formatDuration returns - for 0 or null', () => {
            expect(app.formatDuration(0)).toBe('-');
            expect(app.formatDuration(null)).toBe('-');
        });

        test('calculateSmoothedElevation calculates gain and loss correctly', () => {
            const data = [
                [0, 100], [1, 100], [2, 100],
                [3, 110],
                [4, 110], [5, 110]
            ];

            const result = app.calculateSmoothedElevation(data);
            expect(result.gain).toBeGreaterThan(0);
            expect(result.loss).toBe(0);
        });

        test('updateInfoPanel populates DOM elements', () => {
            // We can manually invoke this if we want to test specific rendering logic 
            // without the full L.GPX flow
            const mockGpx = {
                get_distance: () => 5000,
                get_total_time: () => 1800000,
                get_moving_time: () => 1800000,
                get_start_time: () => new Date('2023-01-01'),
                get_moving_speed: () => 10,
                get_elevation_data: () => []
            };

            app.updateInfoPanel(mockGpx, 'Test Track');
            expect(document.getElementById('track-name').textContent).toBe('Test Track');
            expect(document.getElementById('info-panel').classList.contains('hidden')).toBe(false);
        });

        test('exportGPX alerts if no tracks drawn', () => {
            global.alert = jest.fn();
            app.exportGPX();
            expect(global.alert).toHaveBeenCalledWith('No tracks drawn to export!');
        });

        test('calculateSmoothedElevation ignores tiny fluctuations and captures losses', () => {
            const noisyFlat = [
                [0, 100], [1, 100.2], [2, 99.9], [3, 100.1], [4, 100]
            ];
            const flatResult = app.calculateSmoothedElevation(noisyFlat);
            expect(flatResult.gain).toBeCloseTo(0);
            expect(flatResult.loss).toBeCloseTo(0);

            const descending = [
                [0, 200], [1, 180], [2, 160], [3, 140], [4, 120]
            ];
            const lossResult = app.calculateSmoothedElevation(descending);
            expect(lossResult.gain).toBeCloseTo(0);
            expect(lossResult.loss).toBeGreaterThan(0);
        });

        test('updateExportButtonState toggles accessibility based on drawn layers', () => {
            const exportBtn = document.createElement('a');
            exportBtn.id = 'export-drawn-track';
            exportBtn.className = 'leaflet-draw-export';
            document.body.appendChild(exportBtn);

            app.updateExportButtonState();
            expect(exportBtn.classList.contains('is-disabled')).toBe(true);
            expect(exportBtn.getAttribute('aria-disabled')).toBe('true');
            expect(exportBtn.tabIndex).toBe(-1);

            featureGroupMock.addLayer(new global.L.Marker({ lat: 1, lng: 2 }));
            app.updateExportButtonState();
            expect(exportBtn.classList.contains('is-disabled')).toBe(false);
            expect(exportBtn.getAttribute('aria-disabled')).toBe('false');
            expect(exportBtn.tabIndex).toBe(0);
        });

        test('exportGPX builds GPX data for polylines and markers', async () => {
            global.URL.createObjectURL = jest.fn(() => 'blob:url');
            global.URL.revokeObjectURL = jest.fn();
            const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => { });

            featureGroupMock.addLayer(new global.L.Polyline([
                { lat: 1, lng: 2 },
                { lat: 3, lng: 4 }
            ]));
            featureGroupMock.addLayer(new global.L.Marker({ lat: 5, lng: 6 }));

            await app.exportGPX();

            expect(global.URL.createObjectURL).toHaveBeenCalledTimes(1);
            const blobArg = global.URL.createObjectURL.mock.calls[0][0];
            const xml = await blobArg.text();
            expect(xml).toContain('<trkpt lat="1" lon="2"></trkpt>');
            expect(xml).toContain('<trkpt lat="3" lon="4"></trkpt>');
            expect(xml).toContain('<wpt lat="5" lon="6"><name>Waypoint</name></wpt>');
            clickSpy.mockRestore();
        });

        test('deriveActivity and addActivityToFiles handle missing and nested paths', () => {
            expect(app.deriveActivity(undefined)).toBe('Other');
            expect(app.deriveActivity('Activities/Bikepacking/2023/file.gpx')).toBe('Bikepacking');

            const annotated = app.addActivityToFiles([{ relativePath: 'Activities/Runs/Folder/file.gpx', name: 'file.gpx' }]);
            expect(annotated[0].activity).toBe('Runs');
        });

        test('getDisplayFolder strips activity prefix and keeps nested folders', () => {
            expect(app.getDisplayFolder('Activities/runs/sub/further/file.gpx', 'runs')).toBe('sub/further');
            expect(app.getDisplayFolder('Activities/other/path/file.gpx', 'runs')).toBe('other/path');
            expect(app.getDisplayFolder('', 'runs')).toBe('');
        });

        test('getActivityIcon maps known activities and defaults gracefully', () => {
            expect(app.getActivityIcon('backpacking')).toBe('fa-mountain');
            expect(app.getActivityIcon('Speed Hiking')).toBe('fa-person-hiking');
            expect(app.getActivityIcon('Gravel')).toBe('fa-bicycle');
            expect(app.getActivityIcon('MTB')).toBe('fa-bicycle');
            expect(app.getActivityIcon('IceSkating')).toBe('fa-skating');
            expect(app.getActivityIcon('Sailing')).toBe('fa-sailboat');
            expect(app.getActivityIcon('Flights')).toBe('fa-plane');
            expect(app.getActivityIcon('unknown')).toBe('fa-route');
        });

        test('renders MTB activity chip with bicycle icon', async () => {
            await bootstrapApp({
                gpxFiles: [
                    { name: '2023-01-03_MTB.gpx', path: '/data/Activities/MTB/2023-01-03_MTB.gpx', relativePath: 'Activities/MTB/2023-01-03_MTB.gpx' }
                ]
            });

            const chips = Array.from(document.querySelectorAll('#activity-filters .filter-chip'));
            const mtbChip = chips.find(btn => btn.textContent.includes('MTB'));
            expect(mtbChip).toBeTruthy();
            expect(mtbChip.querySelector('i').className).toContain('fa-bicycle');
        });

        test('renders Gravel activity chip with bicycle icon', async () => {
            await bootstrapApp({
                gpxFiles: [
                    { name: '2023-01-03_Gravel.gpx', path: '/data/Activities/Gravel/2023-01-03_Gravel.gpx', relativePath: 'Activities/Gravel/2023-01-03_Gravel.gpx' }
                ]
            });

            const chips = Array.from(document.querySelectorAll('#activity-filters .filter-chip'));
            const gravelChip = chips.find(btn => btn.textContent.includes('Gravel'));
            expect(gravelChip).toBeTruthy();
            expect(gravelChip.querySelector('i').className).toContain('fa-bicycle');
        });

        test('renders IceSkating activity chip with skating icon', async () => {
            await bootstrapApp({
                gpxFiles: [
                    { name: '2023-01-03_IceSkating.gpx', path: '/data/Activities/IceSkating/2023-01-03_IceSkating.gpx', relativePath: 'Activities/IceSkating/2023-01-03_IceSkating.gpx' }
                ]
            });

            const chips = Array.from(document.querySelectorAll('#activity-filters .filter-chip'));
            const skatingChip = chips.find(btn => btn.textContent.includes('IceSkating'));
            expect(skatingChip).toBeTruthy();
            expect(skatingChip.querySelector('i').className).toContain('fa-skating');
        });

        test('updateInfoPanel prefers moving time and handles missing values', () => {
            const movingPreferred = {
                get_distance: () => 3000,
                get_total_time: () => 1200000,
                get_moving_time: () => 600000,
                get_start_time: () => null,
                get_moving_speed: () => 7.5,
                get_elevation_data: () => []
            };

            app.updateInfoPanel(movingPreferred, 'Moving First');
            expect(document.getElementById('track-duration').textContent).toBe('10m');
            expect(document.getElementById('track-date').textContent).toBe('N/A');
            expect(document.getElementById('track-distance').textContent).toBe('3.00 km');

            const zeroValues = {
                get_distance: () => 0,
                get_total_time: () => 0,
                get_moving_time: () => 0,
                get_start_time: () => undefined,
                get_moving_speed: () => 0,
                get_elevation_data: () => []
            };

            app.updateInfoPanel(zeroValues, 'Zero Track');
            expect(document.getElementById('track-duration').textContent).toBe('-');
            expect(document.getElementById('track-date').textContent).toBe('N/A');
            expect(document.getElementById('track-speed').textContent).toBe('0.0 km/h');
        });
    });

    describe('Theme Toggle', () => {
        test('initializes toggle UI for dark theme', async () => {
            await bootstrapApp({ initialTheme: 'dark' });
            const button = document.getElementById('theme-toggle');
            expect(button).toBeTruthy();
            expect(button.getAttribute('aria-pressed')).toBe('true');
            expect(button.title).toBe('Switch to light mode');
            expect(button.querySelector('i').className).toBe('fas fa-sun');
        });

        test('initializes toggle UI for light theme', async () => {
            await bootstrapApp({ initialTheme: 'light' });
            const button = document.getElementById('theme-toggle');
            expect(button).toBeTruthy();
            expect(button.getAttribute('aria-pressed')).toBe('false');
            expect(button.title).toBe('Switch to dark mode');
            expect(button.querySelector('i').className).toBe('fas fa-moon');
        });

        test('toggles theme and persists to localStorage', async () => {
            await bootstrapApp({ initialTheme: 'dark' });
            const button = document.getElementById('theme-toggle');

            button.click();
            expect(document.documentElement.dataset.theme).toBe('light');
            expect(localStorage.getItem('gpx-self-hosted-theme')).toBe('light');
            expect(button.getAttribute('aria-pressed')).toBe('false');
            expect(button.title).toBe('Switch to dark mode');
            expect(button.querySelector('i').className).toBe('fas fa-moon');

            button.click();
            expect(document.documentElement.dataset.theme).toBe('dark');
            expect(localStorage.getItem('gpx-self-hosted-theme')).toBe('dark');
            expect(button.getAttribute('aria-pressed')).toBe('true');
            expect(button.title).toBe('Switch to light mode');
            expect(button.querySelector('i').className).toBe('fas fa-sun');
        });

        test('normalizeTheme handles invalid values', async () => {
            const { app } = await bootstrapApp();
            expect(app.normalizeTheme('invalid')).toBeNull();
            expect(app.normalizeTheme(null)).toBeNull();
            expect(app.normalizeTheme(undefined)).toBeNull();
        });

        test('initializes from document dataset theme', async () => {
            document.documentElement.dataset.theme = 'light';
            const { app } = await bootstrapApp({ initialTheme: 'light' });
            expect(app.getCurrentTheme()).toBe('light');
        });
    });
});

describe('App edge cases', () => {
    test('renders empty state when no GPX files are returned', async () => {
        await bootstrapApp({ gpxFiles: [] });
        const list = document.getElementById('file-list');
        expect(list.textContent).toContain('No GPX files found.');
        expect(document.getElementById('file-count').textContent).toBe('');
        const allChip = document.querySelector('#activity-filters .filter-chip');
        expect(allChip.classList.contains('active')).toBe(true);
    });

    test('renders error message when GPX fetch fails', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
        const { app } = await bootstrapApp();

        global.fetch.mockImplementation((url) => {
            if (url === '/api/gpx') return Promise.reject(new Error('Internal Server Error'));
            return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
        });

        await app.fetchFiles();

        const list = document.getElementById('file-list');
        expect(list.textContent).toContain('Error loading files.');
        expect(consoleErrorSpy).toHaveBeenCalled();
        consoleErrorSpy.mockRestore();
    });

    test('sorts mixed dated and undated files correctly', async () => {
        const files = [
            { name: 'ZZZ_Undated.gpx', path: '/data/Activities/Other/zzz.gpx', relativePath: 'Activities/Other/ZZZ_Undated.gpx' },
            { name: '2023-01-01_New.gpx', path: '/data/Activities/Other/2023.gpx', relativePath: 'Activities/Other/2023-01-01_New.gpx' },
            { name: 'AAA_Undated.gpx', path: '/data/Activities/Other/aaa.gpx', relativePath: 'Activities/Other/AAA_Undated.gpx' },
            { name: '2022-01-01_Old.gpx', path: '/data/Activities/Other/2022.gpx', relativePath: 'Activities/Other/2022-01-01_Old.gpx' }
        ];

        await bootstrapApp({ gpxFiles: files });
        const list = document.getElementById('file-list');
        const items = Array.from(list.querySelectorAll('li:not(.year-separator)')).map(li => li.querySelector('.track-title').textContent);

        // Expected sort: 2023 New, 2022 Old, ZZZ Undated, AAA Undated
        // Because dated comes first, then undated alphabetically (descending in fallback)
        // Wait, app logic says: return bKey.localeCompare(aKey); which is descending alphabetical.
        expect(items).toEqual(['New', 'Old', 'ZZZ Undated', 'AAA Undated']);
    });
    test('does not switch to Plans view if no plan files exist', async () => {
        await bootstrapApp({ gpxFiles: defaultGpxFiles }); // no plans
        const plansBtn = document.querySelector('.view-toggle-btn[data-view="plans"]');
        expect(plansBtn.disabled).toBe(true);

        const list = document.getElementById('file-list');
        const initialContent = list.innerHTML;

        plansBtn.click();
        expect(list.innerHTML).toBe(initialContent); // Should not change
    });

    test('multi-track mode: automatically focuses another track when removing focused track', async () => {
        const { app, mapMock, gpxMock } = await bootstrapApp({
            gpxFiles: [
                { name: 'Track1.gpx', path: '/track1.gpx', relativePath: 'Activities/runs/Track1.gpx' },
                { name: 'Track2.gpx', path: '/track2.gpx', relativePath: 'Activities/runs/Track2.gpx' }
            ]
        });

        // Toggle multi-track mode
        document.getElementById('toggle-multi-track').click();

        // Load both
        await app.addTrack('/track1.gpx', 'Track1.gpx');
        await app.addTrack('/track2.gpx', 'Track2.gpx');

        // Verify Track 1 is active (it becomes focused by default on first load)
        let items = document.querySelectorAll('#file-list li:not(.year-separator)');
        const item1 = Array.from(items).find(li => li.dataset.path === '/track1.gpx');
        const item2 = Array.from(items).find(li => li.dataset.path === '/track2.gpx');
        expect(item1.classList.contains('active')).toBe(true);

        // Remove the first one (which is focused)
        app.removeTrack('/track1.gpx');
        await new Promise(resolve => setTimeout(resolve, 0)); // wait for focus update
        expect(mapMock.removeLayer).toHaveBeenCalled();

        // The second one should now be focused
        expect(item2.classList.contains('active')).toBe(true);
        expect(document.getElementById('track-name').textContent).toBe('Track2.gpx');
    });

    test('multi-track mode: preserves existing track and shows checkboxes when toggled', async () => {
        await bootstrapApp({
            gpxFiles: [
                { name: 'Track1.gpx', path: '/track1.gpx', relativePath: 'Activities/runs/Track1.gpx' }
            ]
        });

        const list = document.getElementById('file-list');
        const item = list.querySelector('li:not(.year-separator)');

        // Load track in single mode
        item.click();
        expect(item.classList.contains('active')).toBe(true);
        expect(list.querySelector('.track-select-cb')).toBeNull();

        // Toggle multi-mode
        document.getElementById('toggle-multi-track').click();

        // Checkbox should appear and be checked
        const cb = list.querySelector('.track-select-cb');
        expect(cb).toBeTruthy();
        expect(cb.checked).toBe(true);
        expect(item.classList.contains('active')).toBe(true);
    });
    test('offline pre-warm: disabled button when server is in offline mode', async () => {
        await bootstrapApp({
            gpxFiles: [],
            tileConfig: {
                initial: 'opentopomap',
                offline: true,
                providers: {
                    opentopomap: { name: 'OpenTopoMap', isTMS: false, minZoom: 0, maxZoom: 18 }
                }
            }
        });

        const button = document.getElementById('download-current-view');
        expect(button.disabled).toBe(true);
        expect(document.getElementById('download-current-view-status').textContent).toContain('offline mode');
    });

    test('offline pre-warm: handles partial failures and updates status', async () => {
        window.confirm = jest.fn(() => true);
        const prewarmSpy = jest.fn(() => Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
                providerKey: 'opentopomap',
                zoomMin: 0,
                zoomMax: 0,
                total: 10,
                ok: 8,
                failed: 2
            })
        }));

        await bootstrapApp({
            gpxFiles: [],
            tileConfig: {
                initial: 'opentopomap',
                offline: false,
                providers: {
                    opentopomap: { name: 'OpenTopoMap', isTMS: false, minZoom: 0, maxZoom: 0 }
                }
            }
        });

        global.fetch.mockImplementation((url, opts) => {
            if (url === '/api/prewarm-view') return prewarmSpy(url, opts);
            return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
        });

        const appTick = () => new Promise(resolve => setTimeout(resolve, 0));
        await appTick();

        document.getElementById('download-current-view').click();
        await appTick();
        document.getElementById('prewarm-confirm-yes').click();
        await appTick();
        await appTick();

        const status = document.getElementById('download-current-view-status').textContent;
        expect(status).toContain('Done');
        expect(status).toContain('8/10');
    });

    test('falls back to the first provider when initial key is missing', async () => {
        const { mapMock, tileLayers } = await bootstrapApp({
            gpxFiles: [],
            tileConfig: {
                initial: 'missing',
                providers: {
                    maaamet: { name: 'Maa-Amet', url: 'http://maa.ee', isTMS: true },
                    opentopomap: { name: 'OpenTopoMap', url: 'http://oto.org', isTMS: false }
                }
            },
            tileLayerFactory: () => ({
                addTo: jest.fn().mockReturnThis()
            })
        });

        expect(tileLayers).toHaveLength(2);
        expect(tileLayers[0].addTo).toHaveBeenCalledWith(mapMock);
        expect(tileLayers[1].addTo).not.toHaveBeenCalled();
    });

    test('uses OpenTopo fallback when tile config fetch fails', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
        const { mapMock, tileLayers } = await bootstrapApp({
            gpxFiles: [],
            tileConfigError: new Error('fetch failed'),
            tileLayerFactory: () => ({
                addTo: jest.fn().mockReturnThis()
            })
        });

        expect(tileLayers).toHaveLength(1);
        expect(tileLayers[0].addTo).toHaveBeenCalledWith(mapMock);
        expect(global.L.tileLayer).toHaveBeenCalledWith('/tiles/opentopomap/{z}/{x}/{y}.png', expect.objectContaining({ maxZoom: 15 }));
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error loading tile config:', expect.any(Error));
        consoleErrorSpy.mockRestore();
    });

    test('creates OpenStreetMap layer when configured', async () => {
        const { mapMock, tileLayers } = await bootstrapApp({
            gpxFiles: [],
            tileConfig: {
                initial: 'openstreetmap',
                providers: {
                    opentopomap: { name: 'OpenTopoMap', isTMS: false },
                    openstreetmap: { name: 'OpenStreetMap', isTMS: false, minZoom: 0, maxZoom: 19, attribution: '© OpenStreetMap contributors' }
                }
            },
            tileLayerFactory: () => ({
                addTo: jest.fn().mockReturnThis()
            })
        });

        const calls = global.L.tileLayer.mock.calls;
        const osmIndex = calls.findIndex(([url]) => url === '/tiles/openstreetmap/{z}/{x}/{y}.png');
        expect(osmIndex).toBeGreaterThanOrEqual(0);
        expect(calls[osmIndex][1]).toEqual(expect.objectContaining({
            maxZoom: 19,
            minZoom: 0,
            attribution: '© OpenStreetMap contributors',
            tms: false
        }));
        expect(tileLayers[osmIndex].addTo).toHaveBeenCalledWith(mapMock);
    });

    test('adds export button to draw toolbar and wires enabled state', async () => {
        const { app, featureGroupMock, exportClickHandler } = await bootstrapApp({ includeDrawToolbar: true, captureExportHandler: true });
        const originalCreate = global.URL.createObjectURL;
        const originalRevoke = global.URL.revokeObjectURL;

        expect(exportClickHandler).toBeTruthy();
        const exportButton = document.getElementById('export-drawn-track');
        expect(exportButton).toBeTruthy();
        expect(exportButton.classList.contains('is-disabled')).toBe(true);

        global.URL.createObjectURL = jest.fn(() => 'blob:url');
        global.URL.revokeObjectURL = jest.fn();
        const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => { });

        const appendSpy = jest.spyOn(document.body, 'appendChild');
        const disabledEvent = new Event('click', { bubbles: true, cancelable: true });
        exportClickHandler(disabledEvent);
        expect(disabledEvent.defaultPrevented).toBe(true);
        expect(global.URL.createObjectURL).not.toHaveBeenCalled();

        featureGroupMock.addLayer(new global.L.Marker({ lat: 10, lng: 20 }));
        expect(featureGroupMock.getLayers()).toHaveLength(1);
        app.updateExportButtonState();
        expect(exportButton.classList.contains('is-disabled')).toBe(false);
        const enabledEvent = new Event('click', { bubbles: true, cancelable: true });
        exportClickHandler(enabledEvent);
        expect(enabledEvent.defaultPrevented).toBe(true);

        expect(appendSpy).toHaveBeenCalled();
        expect(global.URL.createObjectURL).toHaveBeenCalledTimes(1);

        clickSpy.mockRestore();
        appendSpy.mockRestore();
        global.URL.createObjectURL = originalCreate;
        global.URL.revokeObjectURL = originalRevoke;
    });

    describe('Edge cases and Robustness', () => {
        test('formatDuration handles edge cases', async () => {
            const { app } = await bootstrapApp();
            expect(app.formatDuration(0)).toBe('-');
            expect(app.formatDuration(null)).toBe('-');
            expect(app.formatDuration(undefined)).toBe('-');
            expect(app.formatDuration(500)).toBe('0m');
            expect(app.formatDuration(60000)).toBe('1m');
            expect(app.formatDuration(3600000)).toBe('1h 0m');
        });

        test('deriveActivity handles unexpected paths', async () => {
            const { app } = await bootstrapApp();
            expect(app.deriveActivity(null)).toBe('Other');
            expect(app.deriveActivity('')).toBe('Other');
            expect(app.deriveActivity('Activities/')).toBe('Other');
            expect(app.deriveActivity('Plans/path/to/file.gpx')).toBe('Plans');
            expect(app.deriveActivity('some/random/path.gpx')).toBe('some');
        });

        test('getDisplayFolder handles various paths', async () => {
            const { app } = await bootstrapApp();
            expect(app.getDisplayFolder('Activities/runs/2023/run.gpx', 'runs')).toBe('2023');
            expect(app.getDisplayFolder('Activities/runs/run.gpx', 'runs')).toBe('');
            expect(app.getDisplayFolder('Plans/2023/plan.gpx', 'Plans')).toBe('2023');
            expect(app.getDisplayFolder('root.gpx', 'Other')).toBe('');
        });

        test('parseDateFromFilename handles various invalid formats', async () => {
            const { app } = await bootstrapApp();
            expect(app.parseDateFromFilename(null)).toBeNull();
            expect(app.parseDateFromFilename('')).toBeNull();
            expect(app.parseDateFromFilename('no-date.gpx')).toBeNull();
            expect(app.parseDateFromFilename('2023-13-01_InvalidMonth.gpx')).toBeNull();
            expect(app.parseDateFromFilename('2023-01-32_InvalidDay.gpx')).toBeNull();
            expect(app.parseDateFromFilename('abcd-ef-gh_NotANumber.gpx')).toBeNull();
        });

        test('getActivityIcon fallback', async () => {
            const { app } = await bootstrapApp();
            expect(app.getActivityIcon('UnknownActivity')).toBe('fa-route');
            expect(app.getActivityIcon(null)).toBe('fa-route');
            expect(app.getActivityIcon('Plans')).toBe('fa-calendar');
        });
    });
});
