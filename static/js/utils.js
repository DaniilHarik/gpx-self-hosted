/**
 * GPX Viewer Utilities
 */

export function svgToDataUri(svg) {
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function buildPinSvg(fillColor, strokeColor, dotColor) {
    return `
        <svg xmlns="http://www.w3.org/2000/svg" width="30" height="37" viewBox="0 0 25 41" fill="none">
            <path d="M12.5 1C6.7 1 2 5.7 2 11.5c0 7.1 10.5 27.9 10.5 27.9S23 18.6 23 11.5C23 5.7 18.3 1 12.5 1z" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1.2"/>
            <circle cx="12.5" cy="11.5" r="4.2" fill="${dotColor}"/>
        </svg>
    `;
}

export function clampInt(value, min, max) {
    const num = Number(value);
    if (!Number.isFinite(num)) return min;
    return Math.max(min, Math.min(max, Math.trunc(num)));
}

export function boundsToDto(bounds) {
    if (!bounds) return null;
    if (typeof bounds.getNorth === 'function') {
        return {
            north: bounds.getNorth(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            west: bounds.getWest()
        };
    }
    if (typeof bounds.getNorthWest === 'function' && typeof bounds.getSouthEast === 'function') {
        const nw = bounds.getNorthWest();
        const se = bounds.getSouthEast();
        return {
            north: nw.lat,
            west: nw.lng,
            south: se.lat,
            east: se.lng
        };
    }
    return null;
}

export function deriveActivity(relativePath) {
    if (!relativePath) return 'Other';
    const segments = relativePath.split('/');
    const root = (segments[0] || '').toLowerCase();
    if (root === 'plans') return 'Plans';
    if (root === 'activities') {
        return segments[1] || 'Other';
    }
    return segments[0] || 'Other';
}

export function getActivityIcon(activity, activityIconMap) {
    const key = (activity || '').toLowerCase();
    if (key === 'plans') return 'fa-calendar';
    return activityIconMap[key] || 'fa-route';
}

export function addActivityToFiles(files) {
    return files.map(file => {
        const activity = deriveActivity(file.relativePath);
        return { ...file, activity };
    });
}

export function getDisplayFolder(relativePath, activity) {
    const folderParts = (relativePath || '').split('/').slice(0, -1);
    const activityLower = (activity || '').toLowerCase();
    if (folderParts.length > 0 && folderParts[0].toLowerCase() === 'activities') {
        folderParts.shift();
    }
    if (folderParts.length > 0 && folderParts[0].toLowerCase() === 'plans') {
        folderParts.shift();
    }
    if (folderParts.length > 0 && folderParts[0].toLowerCase() === activityLower) {
        folderParts.shift();
    }
    return folderParts.join('/');
}

const dateRegex = /^(\d{4})[-]?(\d{2})[-]?(\d{2})/;

export function parseDateFromFilename(filename) {
    if (!filename) return null;
    const match = filename.match(dateRegex);
    if (match) {
        const year = Number(match[1]);
        const month = Number(match[2]);
        const day = Number(match[3]);
        const date = new Date(year, month - 1, day);
        if (Number.isNaN(date.getTime())) return null;
        // Validate that components haven't wrapped around (JS Date is very lenient)
        if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
            return null;
        }
        return date;
    }
    return null;
}

export function calculateSmoothedElevation(data) {
    if (!data || data.length === 0) return { gain: 0, loss: 0 };

    const elevations = data.map(d => d[1]);
    const windowSize = 5;
    const smoothed = [];

    for (let i = 0; i < elevations.length; i++) {
        let sum = 0;
        let count = 0;
        for (let j = Math.max(0, i - Math.floor(windowSize / 2));
            j <= Math.min(elevations.length - 1, i + Math.floor(windowSize / 2));
            j++) {
            sum += elevations[j];
            count++;
        }
        smoothed.push(sum / count);
    }

    let gain = 0;
    let loss = 0;
    const threshold = 0.5;

    for (let i = 1; i < smoothed.length; i++) {
        const diff = smoothed[i] - smoothed[i - 1];
        if (Math.abs(diff) > threshold) {
            if (diff > 0) gain += diff;
            else loss += Math.abs(diff);
        }
    }

    return { gain, loss };
}

export function formatDuration(ms) {
    if (!ms) return '-';
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)));

    const h = hours > 0 ? `${hours}h ` : '';
    const m = `${minutes}m`;
    return h + m;
}
