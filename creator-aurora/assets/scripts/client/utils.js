




window.currentUser         = window.currentUser         || null;
window.userRole            = window.userRole            || null;
window.userPlan            = window.userPlan            || null;
window._dashboardRendered  = window._dashboardRendered  || false;


// Administration is an Auth permission; profile roles are sharing groups only.
function isAdmin() { return window.currentUser?.app_metadata?.role === 'admin'; }

function canAccessTab(tab) {
    if (!window.currentUser) return false;
    if (tab === 'admin') return isAdmin();
    return Array.isArray(window.userPlan?.allowed_tabs) && window.userPlan.allowed_tabs.includes(tab);
}

async function sameRoleUserIds() {
    if (!window.userRole || !window.currentUser) return [];
    const { data, error } = await sb.from('user_profiles').select('id')
        .eq('role', window.userRole).neq('id', window.currentUser.id);
    if (error) throw error;
    return (data || []).map(profile => profile.id);
}


function showToast(msg, duration = 2200) {
    const toast = document.getElementById('toast');
    if (!toast) return;

    clearTimeout(window._auroraToastTimer);
    clearTimeout(window._auroraToastCleanupTimer);
    toast.textContent = msg;
    toast.classList.add('show');
    toast.setAttribute('aria-hidden', 'false');

    window._auroraToastTimer = setTimeout(() => {
        toast.classList.remove('show');
        toast.setAttribute('aria-hidden', 'true');
        window._auroraToastCleanupTimer = setTimeout(() => {
            if (!toast.classList.contains('show')) toast.textContent = '';
        }, 280);
    }, duration);
}


function showAuthError(msg) {
    const el = document.getElementById('auth-error');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
}

function hideAuthError() {
    document.getElementById('auth-error')?.classList.remove('show');
}


function getDisplayName(user) {
    return user?.user_metadata?.display_name
        || user?.email?.split('@')[0]
        || '';
}

function updateSidebarUser() {
    const user = window.currentUser;
    if (!user) return;
    const name = getDisplayName(user);
    const el = {
        name:  document.getElementById('sidebar-user-name'),
        email: document.getElementById('sidebar-user-email'),
        role:  document.getElementById('sidebar-user-role'),
    };
    if (el.name)  el.name.textContent  = name || user.email || '';
    if (el.email) el.email.textContent = user.email || '';
    if (el.role) {
        if (window.userRole) {
            el.role.textContent    = window.userRole;
            el.role.style.display  = 'inline-block';
        } else {
            el.role.style.display  = 'none';
        }
    }
}


function escapeHtml(text) {
    if (!text) return '';
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
}

function formatBytes(bytes) {
    if (!bytes) return '—';
    if (bytes < 1024)    return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
}

function getFileIcon(ext) {
    const icons = {
        mp4:uiIcon('video'), mov:uiIcon('video'), avi:uiIcon('video'), webm:uiIcon('video'),
        mp3:uiIcon('music'), wav:uiIcon('music'), ogg:uiIcon('music'),
        png:uiIcon('image'), jpg:uiIcon('image'), jpeg:uiIcon('image'), gif:uiIcon('image'), webp:uiIcon('image'), svg:uiIcon('image'),
        pdf:uiIcon('file'), doc:uiIcon('file'), docx:uiIcon('file'), txt:uiIcon('file'),
        zip:uiIcon('folder'), rar:uiIcon('folder'),
        psd:uiIcon('image'), ai:uiIcon('image'),
    };
    return icons[ext?.toLowerCase()] || uiIcon('file');
}

function getFileType(ext) {
    const e = ext?.toLowerCase();
    if (['mp4','mov','avi','webm'].includes(e))        return 'video';
    if (['mp3','wav','ogg','aac'].includes(e))         return 'audio';
    if (['png','jpg','jpeg','gif','webp','svg'].includes(e)) return 'image';
    if (['pdf','doc','docx','txt'].includes(e))        return 'doc';
    if (['zip','rar','7z'].includes(e))                return 'archive';
    if (['psd','ai','figma','xd'].includes(e))         return 'design';
    return 'other';
}

function dbToLocal(row) {
    return {
        id:        row.id,
        name:      row.name,
        script:    row.script    || '',
        notes:     row.notes     || {},
        done:      row.done      || {},
        visibility:row.visibility|| 'private',
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}


function closeSidebar() {
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('sidebar-overlay')?.classList.remove('show');
}
function withTimeout(promise, ms = 8000) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), ms))
    ]);
}

function interfaceIcon(type) {
    const paths = {
        eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
        like: '<path d="M7 10v10"/><path d="M3 10h4V4h9.5a3.5 3.5 0 0 1 0 7H14l-2.5 4H7"/>',
        message: '<path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
        video: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3z"/>',
        music: '<path d="M9 18V5l10-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/>',
        image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m21 15-5-5L5 20"/>',
        file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h6"/>',
        folder: '<path d="M3 6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
        lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
        board: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3.5h6v3H9zM9 11h6M9 15h4"/>',
        calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
        trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15M10 10v7M14 10v7"/>',
        edit: '<path d="m4 20 4.2-1 10.4-10.4a2.2 2.2 0 0 0-3.1-3.1L5.1 15.9z"/><path d="m13.8 7.2 3.1 3.1"/>',
        link: '<path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1"/>',
        save: '<path d="M5 3h11l3 3v15H5z"/><path d="M8 3v6h8V3M8 21v-7h8v7"/>',
        close: '<path d="m6 6 12 12M18 6 6 18"/>',
        search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
        user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
        trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4M12 13v4M8 21h8M9 17h6"/>',
        sword: '<path d="m14.5 5.5 4-4M13 7l4 4M5 19l7-7M3 21l3-3M8 4l12 12"/>',
        mask: '<path d="M4 5c4-2 12-2 16 0v7c0 5-3.5 8-8 9-4.5-1-8-4-8-9z"/><path d="M8 10h.01M16 10h.01M8 15c2 1 6 1 8 0"/>',
        cube: '<path d="m12 2 8 4.5v9L12 20l-8-4.5v-9zM12 20v-9.5M4 6.5l8 4 8-4"/>',
        ghost: '<path d="M5 20V9a7 7 0 0 1 14 0v11l-3-2-4 2-4-2z"/><circle cx="9" cy="11" r="1"/><circle cx="15" cy="11" r="1"/>',
        compass: '<circle cx="12" cy="12" r="9"/><path d="m15 9-2 4-4 2 2-4z"/>',
        clapper: '<path d="M4 8h16v12H4zM4 8l2-4h14l-2 4M4 13h16M9 4l2 4M15 4l2 4"/>',
        drop: '<path d="M12 2s7 7.2 7 12a7 7 0 0 1-14 0c0-4.8 7-12 7-12z"/>',
        leaf: '<path d="M20 4C11 4 4 8 4 16c0 2.5 1.5 4 4 4 8 0 12-7 12-16z"/><path d="M4 20c3-5 7-8 12-11"/>',
        bolt: '<path d="m13 2-9 12h7l-1 8 10-13h-7z"/>',
        spark: '<path d="m12 2 1.7 6.3L20 10l-6.3 1.7L12 18l-1.7-6.3L4 10l6.3-1.7z"/>',
        check: '<path d="m5 12 4 4L19 6"/>',
        checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8 12 2.7 2.7L16.5 9"/>',
        x: '<path d="m6 6 12 12M18 6 6 18"/>',
        upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v4h16v-4"/>',
        download: '<path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 20h16"/>',
        copy: '<rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
        alignRight: '<path d="M8 6h12M4 10h16M9 14h11M5 18h15"/>',
        eraser: '<path d="m7 19-4-4L14 4l6 6-9 9z"/><path d="m11 19 5-5M7 19h14"/>',
        code: '<path d="m8 9-4 3 4 3M16 9l4 3-4 3M14 5l-4 14"/>',
        text: '<path d="M4 6V4h16v2M9 20h6M12 4v16"/>',
        clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
        note: '<path d="M5 3h14v18H5zM8 8h8M8 12h8M8 16h5"/>',
        tag: '<path d="M20 13 13 20l-9-9V4h7z"/><circle cx="8.5" cy="8.5" r="1.5"/>',
        flag: '<path d="M5 21V4M5 5h11l-2 4 2 4H5"/>',
        youtube: '<rect x="3" y="6" width="18" height="12" rx="3"/><path d="m10 9 5 3-5 3z"/>',
        checklist: '<path d="m4 7 2 2 3-4M11 7h9M4 14l2 2 3-4M11 14h9M11 20h9"/>',
        info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
        warning: '<path d="M12 3 2 21h20z"/><path d="M12 9v5M12 18h.01"/>',
        arrowRight: '<path d="M5 12h14M14 7l5 5-5 5"/>',
        share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4"/>',
        users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
        star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z"/>',
        chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
        refresh: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 8a7 7 0 0 1 11.5-2L20 8M4 16l2.4 2a7 7 0 0 0 11.5-2"/>',
        play: '<circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4z"/>',
    };
    return paths[type] || paths.spark;
}

function uiIcon(type, className = '') {
    return `<svg class="ui-icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">${interfaceIcon(type)}</svg>`;
}

function cleanLegacyIconText(value) {
    return String(value ?? '').replace(/^[◆◇◈♦❖]\s*/, '');
}

function hydrateInterfaceIcons(root = document) {
    root.querySelectorAll('[data-ui-icon]').forEach(element => {
        if (element.dataset.uiIconHydrated === 'true') return;
        element.innerHTML = uiIcon(element.dataset.uiIcon);
        element.dataset.uiIconHydrated = 'true';
    });
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => hydrateInterfaceIcons());
    } else {
        hydrateInterfaceIcons();
    }
}
