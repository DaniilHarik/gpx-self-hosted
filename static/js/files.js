/**
 * File Listing and Activity Filtering
 */
import { state, ui, constants } from './state.js';
import * as utils from './utils.js';
import { focusTrack, toggleTrackVisibility } from './tracks.js';

export function setView(nextView) {
    const normalized = nextView === 'plans' ? 'plans' : 'activities';
    if (normalized === 'plans' && !state.hasPlanFiles) return;
    if (normalized === state.currentView) return;
    state.currentView = normalized;
    state.selectedActivities.clear();
    updateViewToggleUiState();
    updateActivityFilterVisibility();
    applyFilters();
}

export function updateViewToggleUiState({ hasPlans = state.hasPlanFiles } = {}) {
    if (!ui.viewToggle) return;
    const buttons = Array.from(ui.viewToggle.querySelectorAll('.view-toggle-btn'));
    buttons.forEach(btn => {
        const view = btn.dataset.view;
        const isActive = view === state.currentView;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });

    const plansBtn = ui.viewToggle.querySelector('.view-toggle-btn[data-view="plans"]');
    if (plansBtn) plansBtn.disabled = !hasPlans;
}

export function updateActivityFilterVisibility() {
    if (!ui.activityFilters) return;
    ui.activityFilters.classList.toggle('hidden', state.currentView === 'plans');
}

export function setupActivityFilters(activities) {
    if (!ui.activityFilters) return;

    state.activityKeyMap = new Map();
    ui.activityFilters.replaceChildren();
    state.selectedActivities.clear();

    const counts = {};
    state.allFiles.forEach(f => {
        if ((f.activity || '').toLowerCase() !== 'plans') {
            counts[f.activity] = (counts[f.activity] || 0) + 1;
        }
    });

    const fragment = document.createDocumentFragment();
    const totalActivities = Object.values(counts).reduce((a, b) => a + b, 0);
    fragment.appendChild(createActivityButton('All', 'all', 'fa-layer-group', totalActivities));

    Array.from(activities).sort((a, b) => a.localeCompare(b)).forEach((activity, index) => {
        const activityKey = `activity-${index}`;
        state.activityKeyMap.set(activityKey, activity);
        fragment.appendChild(createActivityButton(activity, activityKey, utils.getActivityIcon(activity, constants.ACTIVITY_ICON_MAP), counts[activity]));
    });

    ui.activityFilters.appendChild(fragment);
    updateActivityFilterStyles();
}

function createActivityButton(label, value, iconClass, count) {
    const button = document.createElement('button');
    button.className = 'filter-chip' + (value === 'all' ? ' active' : '');
    button.dataset.activity = value;
    const icon = document.createElement('i');
    icon.classList.add('fas', iconClass);
    const text = document.createElement('span');
    text.textContent = label;
    button.appendChild(icon);
    button.appendChild(text);

    if (typeof count === 'number') {
        const countSpan = document.createElement('span');
        countSpan.className = 'activity-count';
        countSpan.textContent = count;
        button.appendChild(countSpan);
    }

    button.addEventListener('click', () => handleActivityClick(value));
    return button;
}

function handleActivityClick(value) {
    if (value === 'all') {
        state.selectedActivities.clear();
    } else {
        const activity = state.activityKeyMap.get(value);
        if (!activity) return;

        if (state.selectedActivities.has(activity)) {
            state.selectedActivities.delete(activity);
        } else {
            state.selectedActivities.add(activity);
        }
    }

    updateActivityFilterStyles();
    applyFilters();
}

export function updateActivityFilterStyles() {
    if (!ui.activityFilters) return;
    const buttons = ui.activityFilters.querySelectorAll('.filter-chip');
    buttons.forEach(button => {
        const value = button.dataset.activity;
        if (value === 'all') {
            button.classList.toggle('active', state.selectedActivities.size === 0);
        } else {
            const activity = state.activityKeyMap.get(value);
            button.classList.toggle('active', activity ? state.selectedActivities.has(activity) : false);
        }
    });
}

export function applyFilters() {
    let filtered = state.allFiles.filter(f => {
        const name = (f.name || '').toLowerCase();
        const rel = (f.relativePath || '').toLowerCase();
        const matchesSearch = name.includes(state.searchTerm) || rel.includes(state.searchTerm);
        const isPlan = (f.activity || '').toLowerCase() === 'plans';
        if (state.currentView === 'plans' && !isPlan) return false;
        if (state.currentView === 'activities' && isPlan) return false;

        const matchesActivity = state.selectedActivities.size === 0 || state.selectedActivities.has(f.activity);
        return matchesSearch && matchesActivity;
    });

    if (state.currentView === 'plans') {
        filtered = filtered.slice().sort((a, b) => {
            const aKey = (a.relativePath || a.name || '').toLowerCase();
            const bKey = (b.relativePath || b.name || '').toLowerCase();
            return aKey.localeCompare(bKey);
        });
    }

    renderFileList(filtered, { groupByYear: state.currentView !== 'plans' });
}

export async function fetchFiles() {
    try {
        const response = await fetch('/api/gpx');
        const files = await response.json();
        const filesWithActivity = utils.addActivityToFiles(files || []);
        state.hasPlanFiles = filesWithActivity.some(f => (f.activity || '').toLowerCase() === 'plans');
        const activities = new Set(filesWithActivity.filter(f => (f.activity || '').toLowerCase() !== 'plans').map(f => f.activity));

        state.allFiles = filesWithActivity.sort((a, b) => {
            const dateA = utils.parseDateFromFilename(a.name);
            const dateB = utils.parseDateFromFilename(b.name);
            if (dateA && dateB) {
                const timeDiff = dateB - dateA;
                if (timeDiff !== 0) return timeDiff;
            } else if (dateA) return -1;
            else if (dateB) return 1;

            const aKey = (a.relativePath || a.name || '').toLowerCase();
            const bKey = (b.relativePath || b.name || '').toLowerCase();
            return bKey.localeCompare(aKey);
        });

        setupActivityFilters(activities);
        updateViewToggleUiState();
        updateActivityFilterVisibility();
        applyFilters();
    } catch (error) {
        console.error('Error fetching files:', error);
        ui.fileList.replaceChildren();
        renderListMessage('Error loading files. Check console.', 'error');
    }
}

function renderListMessage(text, className = '') {
    const li = document.createElement('li');
    if (className) li.className = className;
    li.textContent = text;
    ui.fileList.appendChild(li);
}

export function renderFileList(files, { groupByYear = true } = {}) {
    if (ui.fileCount) {
        ui.fileCount.textContent = files.length > 0 ? `(${files.length})` : '';
    }

    ui.fileList.replaceChildren();
    if (files.length === 0) {
        renderListMessage('No GPX files found.');
        return;
    }

    let lastYear = null;

    files.forEach(file => {
        if (groupByYear) {
            const fileDate = utils.parseDateFromFilename(file.name);
            if (fileDate) {
                const year = fileDate.getFullYear();
                if (year !== lastYear) {
                    ui.fileList.appendChild(createYearSeparator(year));
                    lastYear = year;
                }
            }
        }

        const li = createFileListItem(file);
        ui.fileList.appendChild(li);
    });
}

function createYearSeparator(year) {
    const sepLi = document.createElement('li');
    sepLi.className = 'year-separator';
    sepLi.textContent = year;
    sepLi.style.cursor = 'default';
    return sepLi;
}

function createFileListItem(file) {
    const li = document.createElement('li');
    li.dataset.path = file.path;

    if (state.isMultiTrackMode) {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'track-select-cb';
        checkbox.checked = state.loadedTracks.has(file.path);
        if (state.loadedTracks.has(file.path)) {
            checkbox.style.accentColor = state.loadedTracks.get(file.path).color;
        }
        checkbox.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleTrackVisibility(file.path, file.name, e.target.checked);
        });
        li.appendChild(checkbox);
    }

    if (state.loadedTracks.has(file.path)) {
        const track = state.loadedTracks.get(file.path);
        li.style.borderLeft = `4px solid ${track.color}`;
        if (state.focusedTrackPath === file.path) li.classList.add('active');
    }

    const infoDiv = createTrackInfo(file);
    li.appendChild(infoDiv);
    li.title = file.relativePath || file.name;
    li.addEventListener('click', () => { focusTrack(file.path, file.name); });
    return li;
}

function createTrackInfo(file) {
    const infoDiv = document.createElement('div');
    infoDiv.className = 'track-info';

    const rawName = (file.name || '').replace(/\.gpx$/i, '');
    const dateMatch = rawName.match(/^(\d{4}[-\d]*)(?:[\s_]+)(.*)/);
    const activity = file.activity || 'Other';
    const folder = utils.getDisplayFolder(file.relativePath, activity);

    if (folder) {
        const folderEl = document.createElement('div');
        folderEl.className = 'track-folder';
        folderEl.textContent = folder;
        infoDiv.appendChild(folderEl);
    }

    const metaEl = document.createElement('div');
    metaEl.className = 'track-meta';
    metaEl.appendChild(createActivityChip(activity));

    if (dateMatch) {
        const dateEl = document.createElement('div');
        dateEl.className = 'track-date';
        dateEl.textContent = dateMatch[1];
        metaEl.appendChild(dateEl);
    }

    infoDiv.appendChild(metaEl);

    const titleEl = document.createElement('div');
    titleEl.className = 'track-title';
    updateTitleEl(titleEl, rawName, dateMatch);
    infoDiv.appendChild(titleEl);

    return infoDiv;
}

function createActivityChip(activity) {
    const activityChip = document.createElement('div');
    activityChip.className = 'activity-chip';
    const icon = document.createElement('i');
    icon.classList.add('fas', utils.getActivityIcon(activity, constants.ACTIVITY_ICON_MAP));
    const activityLabel = document.createElement('span');
    activityLabel.textContent = activity;
    activityChip.appendChild(icon);
    activityChip.appendChild(activityLabel);
    return activityChip;
}

function updateTitleEl(titleEl, rawName, dateMatch) {
    if (dateMatch) {
        let titleText = dateMatch[2].replace(/_/g, ' ').trim();
        if (!titleText) titleText = "Untitled Track";
        titleEl.textContent = titleText;
    } else {
        titleEl.textContent = rawName.replace(/_/g, ' ');
    }
}
