





const MUSICAS_API_PATH = '/v1/music';

const MUSICAS_GENRES = [
    { id: 'epica', label: 'Épica', icon: uiIcon('sword'), color: '#ff9800' },
    { id: 'suspense', label: 'Suspense', icon: uiIcon('mask'), color: '#9c27b0' },
    { id: 'misterio', label: 'Mistério', icon: uiIcon('search'), color: '#2196f3' },
    { id: 'minecraft', label: 'Minecraft', icon: uiIcon('cube'), color: '#4caf50' },
    { id: 'sneak', label: 'Sneak', icon: uiIcon('eye'), color: '#f44336' },
    { id: 'terror', label: 'Terror', icon: uiIcon('ghost'), color: '#ffc107' },
    { id: 'drama', label: 'Drama', icon: uiIcon('mask'), color: '#e91e63' },
    { id: 'acao', label: 'Ação', icon: uiIcon('bolt'), color: '#f44336' },
    { id: 'aventura', label: 'Aventura', icon: uiIcon('compass'), color: '#2196f3' },
    { id: 'cinematica', label: 'Cinematográfica', icon: uiIcon('clapper'), color: '#607d8b' },
    { id: 'tristeza', label: 'Tristeza', icon: uiIcon('drop'), color: '#546e7a' },
    { id: 'vitoria', label: 'Vitória', icon: uiIcon('trophy'), color: '#ffc107' },
    { id: 'tensao', label: 'Tensão', icon: uiIcon('bolt'), color: '#ff5722' },
    { id: 'ambiente', label: 'Ambiente', icon: uiIcon('leaf'), color: '#4caf50' },
    { id: 'outros', label: 'Outros', icon: uiIcon('music'), color: '#888' },
];


let musicasAllData = [];
let musicasFilter = 'all';
let musicasSearch = '';
let musicasUploading = false;
let musicasUploadQueue = [];  
let musicasQueueIndex = 0;   


let playerAudio = null;  
let playerCurrentId = null;  
let playerPlaying = false;

const SOUND_COLLECTIONS = {
    musicas: { tab: 'musicas', bodyId: 'musicas-body', prefix: 'musicas' },
    efeitos: { tab: 'efeitos-sonoros', bodyId: 'efeitos-sonoros-body', prefix: 'efeitos-sonoros' },
};
let activeSoundCollection = SOUND_COLLECTIONS.musicas;
let supabaseMusicMigrationPromise = null;

function _soundLabel(plural = false) {
    const isEffects = activeSoundCollection === SOUND_COLLECTIONS.efeitos;
    return isEffects ? (plural ? 'efeitos sonoros' : 'efeito sonoro') : (plural ? 'músicas' : 'música');
}

function _musicWorkerBaseUrl() {
    const url = String(MUSIC_R2_WORKER_URL || '').trim().replace(/\/$/, '');
    if (!url) throw new Error('A integração de músicas com o R2 ainda não foi configurada.');
    return url;
}

async function _musicR2Request(path = '', options = {}) {
    const { data: { session } } = await sb.auth.getSession();
    if (!session?.access_token) throw new Error('Sua sessão expirou. Entre novamente para acessar as músicas.');

    const response = await fetch(_musicWorkerBaseUrl() + MUSICAS_API_PATH + path, {
        ...options,
        headers: {
            Authorization: `Bearer ${session.access_token}`,
            ...(options.headers || {}),
        },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Não foi possível concluir a operação com o R2.');
    return payload;
}

async function _migrateSupabaseMusicLibrary() {
    if (activeSoundCollection !== SOUND_COLLECTIONS.musicas || sessionStorage.getItem('aurora-r2-music-migration-complete')) return;
    if (supabaseMusicMigrationPromise) return supabaseMusicMigrationPromise;

    supabaseMusicMigrationPromise = (async () => {
        let cursor = sessionStorage.getItem('aurora-r2-music-migration-cursor') || '';
        let transferred = 0;
        while (true) {
            const path = `/migrate-supabase?collection=musicas${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
            const result = await _musicR2Request(path, { method: 'POST' });
            transferred += result.copied || 0;
            if (!result.nextCursor) {
                sessionStorage.setItem('aurora-r2-music-migration-complete', '1');
                sessionStorage.removeItem('aurora-r2-music-migration-cursor');
                if (transferred) showToast(`${transferred} músicas migradas para o R2.`);
                return;
            }
            cursor = result.nextCursor;
            sessionStorage.setItem('aurora-r2-music-migration-cursor', cursor);
        }
    })();

    try {
        await supabaseMusicMigrationPromise;
    } finally {
        supabaseMusicMigrationPromise = null;
    }
}

function setGenreContent(element, genre, includeLabel = true) {
    if (!element) return;
    element.innerHTML = genre?.icon || uiIcon('music');
    if (includeLabel && genre?.label) {
        element.append(document.createTextNode(` ${genre.label}`));
    }
}





function renderMusicasPage() {
    renderSoundLibrary(SOUND_COLLECTIONS.musicas);
}

function renderEfeitosSonorosPage() {
    renderSoundLibrary(SOUND_COLLECTIONS.efeitos);
}

function renderSoundLibrary(collection) {
    if (!canAccessTab(collection.tab)) return;
    if (activeSoundCollection !== collection) {
        playerAudio?.pause();
        playerAudio = null;
        playerCurrentId = null;
        playerPlaying = false;
        document.getElementById(activeSoundCollection.bodyId)?.replaceChildren();
        document.getElementById(activeSoundCollection.bodyId)?.removeAttribute('data-initialized');
    }
    activeSoundCollection = collection;
    const body = document.getElementById(collection.bodyId);
    if (!body) return;
    if (body.dataset.initialized) { loadMusicas(); return; }
    body.dataset.initialized = '1';

    
    const canUpload = canAccessTab(collection.tab);
    const soundLabel = _soundLabel();
    const soundLabelPlural = _soundLabel(true);

    body.innerHTML = `
    
    <div class="mu-player-bar" id="mu-player-bar" style="display:none;">
        <div class="mu-player-left">
            <button class="mu-player-btn" id="mu-player-play">
                <svg id="mu-play-icon" viewBox="0 0 24 24" fill="currentColor" style="width:18px;height:18px;">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
            </button>
            <div class="mu-player-info">
                <div class="mu-player-title" id="mu-player-title">—</div>
                <div class="mu-player-genre" id="mu-player-genre"></div>
            </div>
        </div>
        <div class="mu-player-center">
            <span class="mu-player-time" id="mu-player-current">0:00</span>
            <div class="mu-player-track" id="mu-player-track">
                <div class="mu-player-progress" id="mu-player-progress"></div>
            </div>
            <span class="mu-player-time" id="mu-player-duration">0:00</span>
        </div>
        <div class="mu-player-right">
            <button class="mu-player-btn" id="mu-player-stop" title="Parar">
                <svg viewBox="0 0 24 24" fill="currentColor" style="width:14px;height:14px;"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
            </button>
            <input type="range" class="mu-volume-slider" id="mu-volume" min="0" max="1" step="0.05" value="0.8">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;color:var(--muted);flex-shrink:0;">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
            </svg>
        </div>
    </div>

    
    <div class="mu-toolbar">
        <div class="sk-search-wrap" style="flex:1;min-width:180px;">
            <span class="sk-search-icon-box" aria-hidden="true">
                <svg class="sk-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
            </span>
            <input class="sk-search-input" id="mu-search" placeholder="Buscar ${soundLabel}…">
        </div>
        ${canUpload ? `
        <button class="btn-new" id="mu-upload-btn">
            <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" fill="none" style="width:13px;height:13px;">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Upload
        </button>` : ''}
        <button class="action-btn" id="mu-refresh-btn" style="background:transparent;border:1px solid var(--border);color:var(--muted);" title="Atualizar">
            <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" fill="none" style="width:13px;height:13px;">
                <polyline points="23 4 23 10 17 10"/>
                <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
            </svg>
        </button>
    </div>

    
    <div class="mu-genre-filters" id="mu-genre-filters">
        <button class="mu-genre-chip active" data-genre="all">
            ${uiIcon('music')} Todas
        </button>
        ${MUSICAS_GENRES.map(g => `
        <button class="mu-genre-chip" data-genre="${g.id}" style="--chip-color:${g.color};">
            ${g.icon} ${g.label}
        </button>`).join('')}
    </div>

    
    <div class="sk-stats" id="mu-stats"></div>

    
    <div class="mu-grid-wrap">
        <div id="mu-grid">
            <div class="loading-state"><span class="spinner"></span> Carregando músicas…</div>
        </div>
    </div>

    
    <div class="modal-overlay" id="mu-upload-modal">
        <div class="modal" style="max-width:500px;">
            <div class="modal-header">
                <div>
                    <div class="modal-step-num" id="mu-modal-step">Upload</div>
                    <div class="modal-step-name">ADICIONAR ${soundLabel.toUpperCase()}</div>
                </div>
                <button class="modal-close" id="mu-modal-close">
                    <svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>

            <div style="padding:20px 24px;display:flex;flex-direction:column;gap:16px;">

                
                <div class="mu-modal-player" id="mu-modal-player" style="display:none;">
                    <div class="mu-modal-wave">
                        <svg viewBox="0 0 200 40" style="width:100%;height:40px;opacity:.4;">
                            ${Array.from({ length: 40 }, (_, i) => `<rect x="${i * 5 + 1}" y="${20 - Math.random() * 18}" width="3" height="${Math.random() * 36 + 4}" fill="var(--gold)" rx="1"/>`).join('')}
                        </svg>
                    </div>
                    <audio id="mu-modal-audio" style="width:100%;margin-top:8px;" controls></audio>
                </div>

                
                <div class="mu-modal-file-info" id="mu-modal-file-info"></div>

                
                <div class="auth-field">
                    <label>Nome da música</label>
                    <input type="text" id="mu-modal-name" placeholder="Ex: Tema Épico de Batalha" maxlength="80">
                </div>

                
                <div class="auth-field">
                    <label>Categoria / Gênero</label>
                    <div class="mu-genre-select" id="mu-genre-select">
                        ${MUSICAS_GENRES.map(g => `
                        <button class="mu-genre-opt" data-genre="${g.id}" style="--chip-color:${g.color};">
                            <span>${g.icon}</span> ${g.label}
                        </button>`).join('')}
                    </div>
                    <input type="hidden" id="mu-modal-genre" value="">
                    <div style="font-family:var(--font-mono);font-size:.5rem;color:var(--muted);margin-top:6px;" id="mu-genre-selected-label">Nenhuma selecionada</div>
                </div>

                
                <div id="mu-upload-progress" style="display:none;">
                    <div style="font-family:var(--font-mono);font-size:.6rem;color:var(--muted);margin-bottom:6px;" id="mu-upload-label">Enviando…</div>
                    <div style="height:4px;background:var(--border);border-radius:2px;overflow:hidden;">
                        <div id="mu-upload-bar" style="height:100%;background:var(--red);width:0%;transition:width .3s;"></div>
                    </div>
                </div>

            </div>

            <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 24px;border-top:1px solid var(--border);">
                <div style="font-family:var(--font-mono);font-size:.55rem;color:var(--muted);" id="mu-modal-queue-info"></div>
                <div style="display:flex;gap:8px;">
                    <button class="action-btn" id="mu-modal-skip">Pular</button>
                    <button class="action-btn primary" id="mu-modal-save">
                        <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" style="width:12px;height:12px;">
                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                            <polyline points="17 8 12 3 7 8"/>
                            <line x1="12" y1="3" x2="12" y2="15"/>
                        </svg>
                        Enviar
                    </button>
                </div>
            </div>
        </div>
    </div>

    
    <div class="modal-overlay" id="mu-drop-modal">
        <div class="modal" style="max-width:480px;">
            <div class="modal-header">
                <div>
                    <div class="modal-step-num">Biblioteca</div>
                    <div class="modal-step-name">UPLOAD DE ${soundLabelPlural.toUpperCase()}</div>
                </div>
                <button class="modal-close" id="mu-drop-modal-close">
                    <svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
            <div style="padding:20px 24px;display:flex;flex-direction:column;gap:16px;">
                <div class="sk-drop-zone" id="mu-drop-zone" style="min-height:120px;">
                    <div class="sk-drop-preview">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:40px;height:40px;color:var(--muted);">
                            <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
                        </svg>
                        <div class="sk-drop-label">Clique ou arraste arquivos de áudio</div>
                        <div class="sk-drop-hint">MP3, WAV, OGG, FLAC aceitos · múltiplos arquivos</div>
                    </div>
                </div>
                <input type="file" id="mu-file-input" accept="audio/*" multiple style="display:none;">
                <div id="mu-drop-file-list" style="display:none;">
                    <div style="font-family:var(--font-mono);font-size:.55rem;text-transform:uppercase;letter-spacing:2px;color:var(--muted);margin-bottom:8px;">Arquivos selecionados</div>
                    <div id="mu-drop-files"></div>
                </div>
            </div>
            <div style="display:flex;justify-content:flex-end;gap:8px;padding:14px 24px;border-top:1px solid var(--border);">
                <button class="action-btn" id="mu-drop-cancel">Cancelar</button>
                <button class="action-btn primary" id="mu-drop-start">Continuar</button>
            </div>
        </div>
    </div>

    
    <div class="modal-overlay" id="mu-view-modal">
        <div class="modal" style="max-width:480px;">
            <div class="modal-header">
                <div>
                    <div class="modal-step-num" id="mu-view-genre-label"></div>
                    <div class="modal-step-name" id="mu-view-title"></div>
                </div>
                <button class="modal-close" id="mu-view-close">
                    <svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
            <div style="padding:24px;display:flex;flex-direction:column;gap:20px;align-items:center;">
                
                <div class="mu-vinyl" id="mu-vinyl">
                    <div class="mu-vinyl-label" id="mu-vinyl-genre-icon"></div>
                </div>
                
                <div style="width:100%;">
                    <div class="mu-full-player">
                        <div class="mu-full-time" id="mu-view-current">0:00</div>
                        <div class="mu-full-track" id="mu-view-track">
                            <div class="mu-full-progress" id="mu-view-progress"></div>
                        </div>
                        <div class="mu-full-time" id="mu-view-duration">0:00</div>
                    </div>
                    <div class="mu-full-controls">
                        <button class="mu-ctrl-btn" id="mu-view-rewind" title="-10s">
                            <svg viewBox="0 0 24 24" fill="currentColor" style="width:16px;height:16px;"><path d="M11.99 5V1l-5 5 5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6h-2c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/><text x="8" y="15" font-size="5" fill="currentColor">10</text></svg>
                        </button>
                        <button class="mu-ctrl-btn large" id="mu-view-play">
                            <svg id="mu-view-play-icon" viewBox="0 0 24 24" fill="currentColor" style="width:22px;height:22px;"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                        </button>
                        <button class="mu-ctrl-btn" id="mu-view-forward" title="+10s">
                            <svg viewBox="0 0 24 24" fill="currentColor" style="width:16px;height:16px;"><path d="M18 13c0 3.31-2.69 6-6 6s-6-2.69-6-6 2.69-6 6-6v4l5-5-5-5v4c-4.42 0-8 3.58-8 8s3.58 8 8 8 8-3.58 8-8h-2z"/></svg>
                        </button>
                    </div>
                    <div style="display:flex;align-items:center;gap:10px;margin-top:12px;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;color:var(--muted);flex-shrink:0;">
                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                        </svg>
                        <input type="range" class="mu-volume-slider" id="mu-view-volume" min="0" max="1" step="0.05" value="0.8" style="flex:1;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;color:var(--muted);flex-shrink:0;">
                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
                        </svg>
                    </div>
                </div>
                
                <div class="sk-view-meta" id="mu-view-meta" style="width:100%;"></div>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 24px;border-top:1px solid var(--border);">
                <button class="action-btn danger" id="mu-view-delete" style="display:none;border-color:rgba(232,17,26,.4);color:#ff8080;">${uiIcon('trash')} Excluir</button>
                <div style="display:flex;gap:8px;margin-left:auto;">
                    <button class="action-btn"
        id="mu-view-download"
        type="button">
    ${uiIcon('download')} Download
</button>
                    <button class="action-btn" id="mu-view-copy">${uiIcon('copy')} URL</button>
                </div>
            </div>
        </div>
    </div>
    `;

    _bindMusicasEvents(canUpload);
    _initGlobalPlayer();
    loadMusicas();
}





function _initGlobalPlayer() {
    if (playerAudio) return;
    playerAudio = new Audio();
    playerAudio.volume = 0.8;

    playerAudio.addEventListener('timeupdate', () => {
        const dur = playerAudio.duration || 0;
        const cur = playerAudio.currentTime || 0;
        const pct = dur > 0 ? (cur / dur) * 100 : 0;
        document.getElementById('mu-player-progress').style.width = pct + '%';
        document.getElementById('mu-player-current').textContent = _fmtTime(cur);

        
        const vp = document.getElementById('mu-view-progress');
        const vc = document.getElementById('mu-view-current');
        if (vp) vp.style.width = pct + '%';
        if (vc) vc.textContent = _fmtTime(cur);

        
        const vinyl = document.getElementById('mu-vinyl');
        if (vinyl) vinyl.classList.toggle('spinning', playerPlaying);
    });

    playerAudio.addEventListener('loadedmetadata', () => {
        const dur = playerAudio.duration || 0;
        const dEl = document.getElementById('mu-player-duration');
        const vd = document.getElementById('mu-view-duration');
        if (dEl) dEl.textContent = _fmtTime(dur);
        if (vd) vd.textContent = _fmtTime(dur);
    });

    playerAudio.addEventListener('ended', () => {
        playerPlaying = false;
        _updatePlayIcons();
        _updateCardPlayIcons();
        document.getElementById('mu-vinyl')?.classList.remove('spinning');
    });

    
    document.getElementById('mu-player-track')?.addEventListener('click', e => {
        if (!playerAudio.duration) return;
        const rect = e.currentTarget.getBoundingClientRect();
        playerAudio.currentTime = ((e.clientX - rect.left) / rect.width) * playerAudio.duration;
    });

    document.getElementById('mu-view-track')?.addEventListener('click', e => {
        if (!playerAudio.duration) return;
        const rect = e.currentTarget.getBoundingClientRect();
        playerAudio.currentTime = ((e.clientX - rect.left) / rect.width) * playerAudio.duration;
    });

    
    document.getElementById('mu-volume')?.addEventListener('input', e => {
        playerAudio.volume = e.target.value;
        const vv = document.getElementById('mu-view-volume');
        if (vv) vv.value = e.target.value;
    });
    document.getElementById('mu-view-volume')?.addEventListener('input', e => {
        playerAudio.volume = e.target.value;
        const bv = document.getElementById('mu-volume');
        if (bv) bv.value = e.target.value;
    });
}

function _fmtTime(s) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
}

function _playMusic(music) {
    const bar = document.getElementById('mu-player-bar');
    if (playerCurrentId === music.id && playerPlaying) {
        playerAudio.pause();
        playerPlaying = false;
        _updatePlayIcons();
        _updateCardPlayIcons(); 
        document.getElementById('mu-vinyl')?.classList.remove('spinning');
        return;
    }
    if (playerCurrentId !== music.id) {
        playerAudio.src = music.url;
        playerCurrentId = music.id;
    }
    playerAudio.play().then(() => {
        playerPlaying = true;
        bar.style.display = 'flex';
        document.getElementById('mu-player-title').textContent = music.name;
        const g = MUSICAS_GENRES.find(x => x.id === music.genre.split(',')[0]);
        setGenreContent(document.getElementById('mu-player-genre'), g);
        _updatePlayIcons();
        _updateCardPlayIcons(); 
        document.getElementById('mu-vinyl')?.classList.add('spinning');
        document.querySelectorAll('.mu-card').forEach(c => c.classList.remove('mu-card-playing'));
        document.querySelector(`.mu-card[data-id="${music.id}"]`)?.classList.add('mu-card-playing');
    }).catch(console.error);
}

function _updatePlayIcons() {
    const isPlay = playerPlaying;
    const playIcon = document.getElementById('mu-play-icon');
    if (playIcon) playIcon.innerHTML = isPlay
        ? '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>'
        : '<polygon points="5 3 19 12 5 21 5 3"/>';

    const viewIcon = document.getElementById('mu-view-play-icon');
    if (viewIcon) viewIcon.innerHTML = isPlay
        ? '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>'
        : '<polygon points="5 3 19 12 5 21 5 3"/>';
}

function _updateCardPlayIcons() {
    document.querySelectorAll('.mu-card').forEach(card => {
        const id = card.dataset.id;
        const playBtn = card.querySelector('.mu-card-play');
        if (!playBtn) return;

        const isThisPlaying = (id === playerCurrentId && playerPlaying);
        playBtn.innerHTML = isThisPlaying
            ? `<svg viewBox="0 0 24 24" fill="currentColor" style="width:14px;height:14px;">
                   <rect x="6" y="4" width="4" height="16"/>
                   <rect x="14" y="4" width="4" height="16"/>
               </svg>`
            : `<svg viewBox="0 0 24 24" fill="currentColor" style="width:14px;height:14px;">
                   <polygon points="5 3 19 12 5 21 5 3"/>
               </svg>`;
    });
}





async function loadMusicas() {
    const grid = document.getElementById('mu-grid');
    if (grid) grid.innerHTML = '<div class="loading-state"><span class="spinner"></span> Carregando músicas…</div>';

    try {
        if (activeSoundCollection === SOUND_COLLECTIONS.musicas) {
            if (grid) grid.innerHTML = '<div class="loading-state"><span class="spinner"></span> Migrando músicas antigas para o R2…</div>';
            await _migrateSupabaseMusicLibrary();
        }
        
        const params = `?collection=${encodeURIComponent(activeSoundCollection.prefix)}`;
        const { items: allFiles = [], legacyCount = 0 } = await _musicR2Request(params);
        if (activeSoundCollection === SOUND_COLLECTIONS.musicas && legacyCount > 0) {
            await _musicR2Request('/migrate-root', { method: 'POST' });
            return loadMusicas();
        }
        musicasAllData = allFiles.map(file => {
            const parts = file.key.split('/');
            const primaryGenre = parts.length >= 2 ? parts[0] : 'outros';
            const fileName = parts.slice(1).join('/') || parts[0];          
            const fileBase = fileName.replace(/\.(mp3|wav|ogg|flac|m4a)$/i, '');
            const suffixMatch = fileBase.match(/__(.+)$/);
            const extraGenres = suffixMatch ? suffixMatch[1].split('_') : [];
            const genre = [primaryGenre, ...extraGenres].join(',');
            const name = fileName
                .replace(/\.(mp3|wav|ogg|flac|m4a)$/i, '')
                .replace(/__[^.]+$/, '')
                .replace(/_/g, ' ');
            const ext = fileName.split('.').pop()?.toLowerCase() || 'mp3';
            return {
                id: file.key,
                path: file.key,
                name,
                fileName,
                genre,
                url: file.url,
                ext,
                size: file.size || 0,
                createdAt: file.uploadedAt,
            };
        });

        _renderMusicasGrid();
    } catch (err) {
        console.error('Erro ao carregar músicas:', err);
        if (grid) grid.innerHTML = `
            <div class="projects-empty">
                <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
                <h3>Erro ao carregar músicas</h3>
                <p>${escapeHtml(err.message)}</p>
                <p style="font-size:.7rem;color:var(--muted);margin-top:6px;">Verifique a configuração do Worker e do bucket R2.</p>
            </div>`;
    }
}







function _getFilteredMusicas() {
    return musicasAllData.filter(m => {
        if (musicasFilter !== 'all') {
            const genres = m.genre.split(',');
            if (!genres.includes(musicasFilter)) return false;
        }
        if (musicasSearch) {
            const q = musicasSearch.toLowerCase();
            if (!m.name.toLowerCase().includes(q) && !m.genre.toLowerCase().includes(q)) return false;
        }
        return true;
    });
}

function _renderMusicasGrid() {
    const grid = document.getElementById('mu-grid');
    const filtered = _getFilteredMusicas();
    if (!grid) return;

    if (!filtered.length) {
        grid.innerHTML = `
            <div class="projects-empty">
                <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                <h3>${musicasAllData.length === 0 ? `Nenhum ${_soundLabel()} ainda` : `Nenhum ${_soundLabel()} encontrado`}</h3>
                <p>${musicasAllData.length === 0 ? `Faça o upload dos primeiros ${_soundLabel(true)}!` : 'Tente outro filtro ou termo de busca.'}</p>
            </div>`;
        return;
    }

    
    if (musicasFilter !== 'all') {
        const g = MUSICAS_GENRES.find(x => x.id === musicasFilter) || { label: musicasFilter, icon: uiIcon('music'), color: '#888' };
        grid.innerHTML = `
        <div class="mu-genre-section">
            <div class="mu-genre-header">
                <div class="mu-genre-dot" style="background:${g.color};"></div>
                <span class="mu-genre-title">${g.icon} ${g.label}</span>
                <span class="sk-player-count">${filtered.length} ${_soundLabel(filtered.length !== 1)}</span>
            </div>
            <div class="mu-tracks-list">
                ${filtered.map((m, i) => _trackCardHtml(m, i)).join('')}
            </div>
        </div>`;
    } else {
        
        const byGenre = {};
        filtered.forEach(m => {
            const genres = m.genre.split(',');
            genres.forEach(g => {
                if (!byGenre[g]) byGenre[g] = [];
                byGenre[g].push(m);
            });
        });

        const genreOrder = MUSICAS_GENRES.map(g => g.id);
        const sorted = Object.entries(byGenre).sort((a, b) => genreOrder.indexOf(a[0]) - genreOrder.indexOf(b[0]));

        grid.innerHTML = sorted.map(([genreId, tracks]) => {
            const g = MUSICAS_GENRES.find(x => x.id === genreId) || { label: genreId, icon: uiIcon('music'), color: '#888' };
            return `
            <div class="mu-genre-section">
                <div class="mu-genre-header">
                    <div class="mu-genre-dot" style="background:${g.color};"></div>
                    <span class="mu-genre-title">${g.icon} ${g.label}</span>
                    <span class="sk-player-count">${tracks.length} ${_soundLabel(tracks.length !== 1)}</span>
                </div>
                <div class="mu-tracks-list">
                    ${tracks.map((m, i) => _trackCardHtml(m, i)).join('')}
                </div>
            </div>`;
        }).join('');
    }

    
    grid.querySelectorAll('.mu-card').forEach(card => {
        const id = card.dataset.id;
        const music = musicasAllData.find(m => m.id === id);
        if (!music) return;

        card.querySelector('.mu-card-play')?.addEventListener('click', e => {
            e.stopPropagation();
            _playMusic(music);
        });
        card.addEventListener('click', () => _openViewModal(music));
    });
}

function _trackCardHtml(m, i) {
    const g = MUSICAS_GENRES.find(x => x.id === m.genre) || { color: '#888', icon: uiIcon('music') };
    const ext = m.ext?.toUpperCase() || 'MP3';
    const isPlaying = playerCurrentId === m.id;
    return `
    <div class="mu-card ${isPlaying ? 'mu-card-playing' : ''}" data-id="${escapeHtml(m.id)}">
        <div class="mu-card-num" style="color:${g.color};">${String(i + 1).padStart(2, '0')}</div>
        <button class="mu-card-play" title="${isPlaying && playerPlaying ? 'Pausar' : 'Reproduzir'}">
            ${isPlaying && playerPlaying
            ? `<svg viewBox="0 0 24 24" fill="currentColor" style="width:14px;height:14px;"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`
            : `<svg viewBox="0 0 24 24" fill="currentColor" style="width:14px;height:14px;"><polygon points="5 3 19 12 5 21 5 3"/></svg>`
        }
        </button>
        <div class="mu-card-info">
            <div class="mu-card-name">${escapeHtml(m.name)}</div>
            <div class="mu-card-meta">${ext} · ${_fmtSize(m.size)}</div>
        </div>
        <div class="mu-card-wave">
            <div class="mu-card-bars">
                ${Array.from({ length: 12 }, () => `<div class="mu-bar" style="height:${Math.random() * 80 + 20}%;"></div>`).join('')}
            </div>
        </div>
    </div>`;
}

function _fmtSize(bytes) {
    if (!bytes) return '—';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
}





function _openViewModal(music) {
    const g = MUSICAS_GENRES.find(x => x.id === music.genre) || { label: 'Outros', icon: uiIcon('music'), color: '#888' };

    setGenreContent(document.getElementById('mu-view-genre-label'), g);
    document.getElementById('mu-view-title').textContent = music.name.toUpperCase();

    
    setGenreContent(document.getElementById('mu-vinyl-genre-icon'), g, false);
    document.getElementById('mu-vinyl').style.setProperty('--vinyl-color', g.color);

    
    const date = music.createdAt ? new Date(music.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';
    document.getElementById('mu-view-meta').innerHTML = `
        <div class="sk-view-meta-row"><span>Categoria</span><b>${g.label}</b></div>
        <div class="sk-view-meta-row"><span>Arquivo</span><b>${escapeHtml(music.fileName)}</b></div>
        <div class="sk-view-meta-row"><span>Tamanho</span><b>${_fmtSize(music.size)}</b></div>
        <div class="sk-view-meta-row"><span>Adicionado</span><b>${date}</b></div>`;

    
const dl = document.getElementById('mu-view-download');

dl.removeAttribute("target");

dl.onclick = async (e) => {
    e.preventDefault();

    try {
        const response = await fetch(music.url);
        if (!response.ok) throw new Error('Arquivo não encontrado no R2.');
        const url = URL.createObjectURL(await response.blob());

        const a = document.createElement("a");
        a.href = url;
        a.download = music.fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();

        URL.revokeObjectURL(url);
    } catch (err) {
        showToast("Erro ao baixar: " + err.message);
    }
};

document.getElementById('mu-view-copy').onclick = () => {
    navigator.clipboard.writeText(music.url)
        .then(() => showToast('URL copiada!'))
        .catch(() => showToast('Erro'));
};

    
    const canDelete = canAccessTab('musicas');
    const delBtn = document.getElementById('mu-view-delete');
    delBtn.style.display = canDelete ? 'flex' : 'none';
    delBtn.onclick = async () => {
        if (!canAccessTab('musicas')) return;
        if (!confirm(`Excluir "${music.name}"?`)) return;
        try {
            await _musicR2Request(`?collection=${encodeURIComponent(activeSoundCollection.prefix)}&key=${encodeURIComponent(music.path)}`, { method: 'DELETE' });
        } catch (err) {
            showToast('Erro: ' + err.message);
            return;
        }
        if (playerCurrentId === music.id) { playerAudio.pause(); playerPlaying = false; document.getElementById('mu-player-bar').style.display = 'none'; }
        musicasAllData = musicasAllData.filter(m => m.id !== music.id);
        _renderMusicasGrid();
        _closeMusicasModal('mu-view-modal');
        showToast('Música excluída!');
    };

    
    document.getElementById('mu-view-play').onclick = () => _playMusic(music);
    document.getElementById('mu-view-rewind').onclick = () => { if (playerAudio) playerAudio.currentTime = Math.max(0, playerAudio.currentTime - 10); };
    document.getElementById('mu-view-forward').onclick = () => { if (playerAudio) playerAudio.currentTime = Math.min(playerAudio.duration || 0, playerAudio.currentTime + 10); };

    
    if (playerCurrentId !== music.id) {
        _playMusic(music);
    }

    document.getElementById('mu-view-modal').classList.add('open');
}

function _closeMusicasModal(id) {
    document.getElementById(id)?.classList.remove('open');
}





function _openDropModal() {
    musicasUploadQueue = [];
    document.getElementById('mu-file-input').value = '';
    document.getElementById('mu-drop-file-list').style.display = 'none';
    document.getElementById('mu-drop-files').innerHTML = '';
    document.getElementById('mu-drop-modal').classList.add('open');
}

function _handleDropFiles(files) {
    const audioFiles = [...files].filter(f => /\.(mp3|wav|ogg|flac|m4a|aac)$/i.test(f.name));
    if (!audioFiles.length) { showToast('Selecione arquivos de áudio!'); return; }
    musicasUploadQueue = audioFiles.map(f => ({ file: f, name: f.name.replace(/\.(mp3|wav|ogg|flac|m4a|aac)$/i, '').replace(/_/g, ' '), genre: '', skip: false }));

    const listEl = document.getElementById('mu-drop-files');
    const listWrap = document.getElementById('mu-drop-file-list');
    listEl.innerHTML = musicasUploadQueue.map((q, i) => `
        <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);">
            <span style="font-size:1rem;">${uiIcon('music')}</span>
            <div>
                <div style="font-family:var(--font-body);font-size:.82rem;color:var(--text);">${escapeHtml(q.file.name)}</div>
                <div style="font-family:var(--font-mono);font-size:.52rem;color:var(--muted);">${_fmtSize(q.file.size)}</div>
            </div>
        </div>`).join('');
    listWrap.style.display = 'block';
}

function _startUploadQueue() {
    if (!musicasUploadQueue.length) return;
    _closeMusicasModal('mu-drop-modal');
    musicasQueueIndex = 0;
    _showUploadModalForIndex(0);
}

function _showUploadModalForIndex(idx) {
    if (idx >= musicasUploadQueue.length) {
        
        showToast('Upload concluído!');
        loadMusicas();
        return;
    }

    const item = musicasUploadQueue[idx];
    const total = musicasUploadQueue.length;

    document.getElementById('mu-modal-step').textContent = `Música ${idx + 1} de ${total}`;
    document.getElementById('mu-modal-queue-info').textContent = `${total - idx - 1} arquivo${total - idx - 1 !== 1 ? 's' : ''} restante${total - idx - 1 !== 1 ? 's' : ''}`;
    document.getElementById('mu-modal-name').value = item.name;
    document.getElementById('mu-upload-progress').style.display = 'none';
    document.getElementById('mu-upload-bar').style.width = '0%';

    
    document.querySelectorAll('.mu-genre-opt').forEach(b => b.classList.remove('active'));
    document.getElementById('mu-modal-genre').value = '';

    
    const previewWrap = document.getElementById('mu-modal-player');
    const previewAudio = document.getElementById('mu-modal-audio');
    const objUrl = URL.createObjectURL(item.file);
    previewAudio.src = objUrl;
    previewWrap.style.display = 'block';

    
    document.getElementById('mu-modal-file-info').innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;background:var(--panel2);border:1px solid var(--border);border-radius:7px;padding:10px 14px;">
            <span class="mu-modal-file-icon">${uiIcon('music')}</span>
            <div>
                <div style="font-family:var(--font-body);font-size:.82rem;color:var(--text);">${escapeHtml(item.file.name)}</div>
                <div style="font-family:var(--font-mono);font-size:.52rem;color:var(--muted);">${_fmtSize(item.file.size)}</div>
            </div>
        </div>`;

    document.getElementById('mu-upload-modal').classList.add('open');
}

async function _doUploadCurrent() {
    if (!canAccessTab('musicas')) { openUpgradeModal('musicas'); return; }
    const idx = musicasQueueIndex;
    const item = musicasUploadQueue[idx];
    const name = document.getElementById('mu-modal-name').value.trim();
    const genre = document.getElementById('mu-modal-genre').value;

    if (!name) { showToast('Digite o nome!'); return; }
    if (!genre) { showToast('Selecione uma categoria!'); return; }

    const sanitize = str => str.replace(/[^a-zA-Z0-9\-_çãõáàâéêíóôú ]/g, '').trim().replace(/\s+/g, '_');
    const ext = item.file.name.split('.').pop().toLowerCase();
    const safeName = sanitize(name) || `musica_${idx + 1}`;
    const genres = genre.split(',');
    const primaryGenre = genres[0]; 
    const genreSuffix = genres.length > 1 ? `__${genres.slice(1).join('_')}` : '';
    const path = `${primaryGenre}/${safeName}${genreSuffix}.${ext}`;

    
    const previewAudio = document.getElementById('mu-modal-audio');
    previewAudio.pause();

    const saveBtn = document.getElementById('mu-modal-save');
    saveBtn.disabled = true; saveBtn.innerHTML = '<span class="spinner"></span>';
    document.getElementById('mu-upload-progress').style.display = 'block';
    document.getElementById('mu-upload-label').textContent = 'Enviando…';
    document.getElementById('mu-upload-bar').style.width = '40%';

    try {
        const { uploadUrl, contentType } = await _musicR2Request(`/upload-url?collection=${encodeURIComponent(activeSoundCollection.prefix)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ collection: activeSoundCollection.prefix, key: path }),
        });
        const upload = await fetch(uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': contentType },
            body: item.file,
        });
        if (!upload.ok) throw new Error('O R2 recusou o upload. Tente enviar novamente.');
        document.getElementById('mu-upload-bar').style.width = '100%';
        document.getElementById('mu-upload-label').textContent = 'Enviado!';
        showToast(`"${name}" enviada!`);
        setTimeout(() => _nextInQueue(), 600);
    } catch (err) {
        showToast('Erro: ' + err.message);
    } finally {
        saveBtn.disabled = false; saveBtn.innerHTML = '⬆ Enviar';
    }
}

function _nextInQueue() {
    _closeMusicasModal('mu-upload-modal');
    musicasQueueIndex++;
    setTimeout(() => _showUploadModalForIndex(musicasQueueIndex), 200);
}

function _skipCurrent() {
    const previewAudio = document.getElementById('mu-modal-audio');
    previewAudio?.pause();
    _closeMusicasModal('mu-upload-modal');
    musicasQueueIndex++;
    setTimeout(() => _showUploadModalForIndex(musicasQueueIndex), 200);
}





function _bindMusicasEvents(canUpload) {
    
    document.getElementById('mu-player-play')?.addEventListener('click', () => {
        if (!playerAudio || !playerCurrentId) return;
        if (playerPlaying) { playerAudio.pause(); playerPlaying = false; }
        else { playerAudio.play(); playerPlaying = true; }
        _updatePlayIcons();
        document.getElementById('mu-vinyl')?.classList.toggle('spinning', playerPlaying);
    });

    document.getElementById('mu-player-stop')?.addEventListener('click', () => {
        playerAudio?.pause();
        if (playerAudio) playerAudio.currentTime = 0;
        playerPlaying = false;
        playerCurrentId = null;
        _updatePlayIcons();
        document.getElementById('mu-player-bar').style.display = 'none';
        document.querySelectorAll('.mu-card').forEach(c => c.classList.remove('mu-card-playing'));
        document.getElementById('mu-vinyl')?.classList.remove('spinning');
    });

    
    document.getElementById('mu-view-close')?.addEventListener('click', () => _closeMusicasModal('mu-view-modal'));
    document.getElementById('mu-view-modal')?.addEventListener('click', e => { if (e.target.id === 'mu-view-modal') _closeMusicasModal('mu-view-modal'); });

    
    document.getElementById('mu-search')?.addEventListener('input', e => {
        musicasSearch = e.target.value;
        _renderMusicasGrid();
    });

    
    document.getElementById('mu-refresh-btn')?.addEventListener('click', loadMusicas);

    
    document.getElementById('mu-genre-filters')?.addEventListener('click', e => {
        const btn = e.target.closest('.mu-genre-chip');
        if (!btn) return;
        musicasFilter = btn.dataset.genre;
        document.querySelectorAll('.mu-genre-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _renderMusicasGrid();
    });

    if (canUpload) {
        
        document.getElementById('mu-upload-btn')?.addEventListener('click', _openDropModal);

        
        document.getElementById('mu-drop-modal-close')?.addEventListener('click', () => _closeMusicasModal('mu-drop-modal'));
        document.getElementById('mu-drop-cancel')?.addEventListener('click', () => _closeMusicasModal('mu-drop-modal'));
        document.getElementById('mu-drop-modal')?.addEventListener('click', e => { if (e.target.id === 'mu-drop-modal') _closeMusicasModal('mu-drop-modal'); });
        document.getElementById('mu-drop-start')?.addEventListener('click', _startUploadQueue);

        
        const fileInput = document.getElementById('mu-file-input');
        const dropZone = document.getElementById('mu-drop-zone');
        dropZone?.addEventListener('click', () => fileInput.click());
        fileInput?.addEventListener('change', () => { if (fileInput.files?.length) _handleDropFiles(fileInput.files); });
        dropZone?.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
        dropZone?.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
        dropZone?.addEventListener('drop', e => { e.preventDefault(); dropZone.classList.remove('drag-over'); if (e.dataTransfer.files?.length) _handleDropFiles(e.dataTransfer.files); });

        
        document.getElementById('mu-modal-close')?.addEventListener('click', () => { document.getElementById('mu-modal-audio')?.pause(); _closeMusicasModal('mu-upload-modal'); });
        document.getElementById('mu-modal-save')?.addEventListener('click', _doUploadCurrent);
        document.getElementById('mu-modal-skip')?.addEventListener('click', _skipCurrent);
        document.getElementById('mu-upload-modal')?.addEventListener('click', e => { if (e.target.id === 'mu-upload-modal') { document.getElementById('mu-modal-audio')?.pause(); _closeMusicasModal('mu-upload-modal'); } });

        
        document.getElementById('mu-genre-select')?.addEventListener('click', e => {
            const btn = e.target.closest('.mu-genre-opt');
            if (!btn) return;
            btn.classList.toggle('active');

            
            const ativos = [...document.querySelectorAll('.mu-genre-opt.active')]
                .map(b => b.dataset.genre);
            document.getElementById('mu-modal-genre').value = ativos.join(',');

            
            const label = document.getElementById('mu-genre-selected-label');
            if (label) {
                label.textContent = ativos.length
                    ? ativos.map(id => MUSICAS_GENRES.find(g => g.id === id)?.label || id).join(', ')
                    : 'Nenhuma selecionada';
            }
        });
    }

    
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            _closeMusicasModal('mu-view-modal');
            _closeMusicasModal('mu-drop-modal');
            if (document.getElementById('mu-upload-modal')?.classList.contains('open')) {
                document.getElementById('mu-modal-audio')?.pause();
                _closeMusicasModal('mu-upload-modal');
            }
        }
    });
}
