




const SKINS_BUCKET = 'skins';

let skinsAllData = [];
let skinsFilter = { player: 'all', category: 'all', search: '' };
let skinsUploading = false;
let skinEditTarget = null; 

let pendingSkinConfirmResolve = null;





let _skinView3dLoaded = false;
let _skinView3dPromise = null;

function loadSkinView3d() {
  if (_skinView3dLoaded) return Promise.resolve();
  if (_skinView3dPromise) return _skinView3dPromise;
  _skinView3dPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/skinview3d@2.2.1/bundles/skinview3d.bundle.js';
    s.onload = () => { _skinView3dLoaded = true; resolve(); };
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return _skinView3dPromise;
}

let _sv3dInstance = null;

function disposeSkin3D() {
  if (_sv3dInstance) {
    _sv3dInstance.dispose();
    _sv3dInstance = null;
  }
}

async function renderSkin3DFull(canvas, url) {
  disposeSkin3D();

  try {
    await loadSkinView3d();
  } catch (e) {
    console.error('skinview3d não carregou:', e);
    renderSkinFace(canvas, url);
    return;
  }

  try {
    _sv3dInstance = new skinview3d.SkinViewer({
      canvas:  canvas,
      width:   canvas.width,
      height:  canvas.height,
      skin:    url,
    });

    _sv3dInstance.background        = null;
    _sv3dInstance.controls.enableRotate = true;
    _sv3dInstance.controls.enableZoom   = false;
    _sv3dInstance.controls.enablePan    = false;

    
    _sv3dInstance.animation = new skinview3d.IdleAnimation();
    _sv3dInstance.animation.speed = 0.5;

    
    _sv3dInstance.camera.position.set(0, 14, 40);
_sv3dInstance.controls.target.set(0, 14, 0);
_sv3dInstance.controls.update();

  } catch (e) {
    console.error('Erro ao inicializar skinview3d:', e);
    renderSkinFace(canvas, url);
  }
}

function ensureSkinConfirmModal() {
    let modal = document.getElementById('skin-confirm-modal');

    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'skin-confirm-modal';
        modal.className = 'modal-overlay';

        modal.innerHTML = `
        <div class="modal" style="max-width:420px;text-align:center;">
            <div class="modal-header" style="justify-content:flex-end;padding-bottom:8px;">
                <button class="modal-close" id="scm-close-btn">
                    <svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>

            <div style="padding:0 32px 32px;display:flex;flex-direction:column;align-items:center;gap:16px;">
                <div id="scm-icon" style="font-size:2.5rem;">${uiIcon('warning')}</div>

                <div id="scm-title"
                    style="font-family:var(--font-display);font-size:1.3rem;letter-spacing:2px;color:var(--text);">
                </div>

                <div id="scm-desc"
                    style="font-family:var(--font-body);font-size:.85rem;color:var(--muted);line-height:1.6;white-space:pre-line;">
                </div>

                <div style="display:flex;gap:12px;margin-top:8px;">
                    <button class="action-btn" id="scm-cancel-btn" style="min-width:100px;">
                        Cancelar
                    </button>

                    <button class="action-btn primary"
                        id="scm-confirm-btn"
                        style="background:var(--red);border-color:var(--red);min-width:100px;">
                        Excluir
                    </button>
                </div>
            </div>
        </div>
        `;

        document.body.appendChild(modal);

        const closeModal = () => {
            modal.classList.remove('open');

            if (pendingSkinConfirmResolve) {
                pendingSkinConfirmResolve(false);
                pendingSkinConfirmResolve = null;
            }
        };

        document.getElementById('scm-close-btn').addEventListener('click', closeModal);
        document.getElementById('scm-cancel-btn').addEventListener('click', closeModal);

        document.getElementById('scm-confirm-btn').addEventListener('click', () => {
            modal.classList.remove('open');

            if (pendingSkinConfirmResolve) {
                pendingSkinConfirmResolve(true);
                pendingSkinConfirmResolve = null;
            }
        });

        modal.addEventListener('click', e => {
            if (e.target === modal) closeModal();
        });
    }

    return modal;
}

function skinConfirm(title, message, icon = 'warning') {
    return new Promise(resolve => {
        const modal = ensureSkinConfirmModal();

        document.getElementById('scm-icon').innerHTML = uiIcon(icon);
        document.getElementById('scm-title').textContent = title;
        document.getElementById('scm-desc').textContent = message;

        pendingSkinConfirmResolve = resolve;

        modal.classList.add('open');
    });
}





function renderSkinsPage() {
    const body = document.getElementById('skins-body');
    if (!body) return;
    if (body.dataset.initialized) { loadSkins(); return; }
    body.dataset.initialized = '1';

    body.innerHTML = `
    
    <div class="sk-toolbar">
        <div class="sk-search-wrap">
            <span class="sk-search-icon-box" aria-hidden="true">
                <svg class="sk-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
            </span>
            <input class="sk-search-input" id="sk-search" placeholder="Buscar skin, player ou categoria…">
        </div>
        <div class="sk-filters">
            <div class="sk-filter-group">
                <label class="sk-filter-label">Player</label>
                <select class="sk-filter-sel" id="sk-filter-player"><option value="all">Todos</option></select>
            </div>
            <div class="sk-filter-group">
                <label class="sk-filter-label">Categoria</label>
                <select class="sk-filter-sel" id="sk-filter-cat"><option value="all">Todas</option></select>
            </div>
        </div>
        <button class="btn-new" id="sk-upload-btn">
            <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" fill="none" style="width:13px;height:13px;">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Upload
        </button>
        <button class="action-btn" id="sk-refresh-btn" style="background:transparent;border:1px solid var(--border);color:var(--muted);" title="Atualizar">
            <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" fill="none" style="width:13px;height:13px;">
                <polyline points="23 4 23 10 17 10"/>
                <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
            </svg>
        </button>
    </div>

    <div class="sk-stats" id="sk-stats"></div>

    <div class="sk-grid-wrap">
        <div class="sk-grid" id="sk-grid">
            <div class="loading-state"><span class="spinner"></span> Carregando skins…</div>
        </div>
    </div>

    
    <div class="modal-overlay" id="sk-upload-modal">
        <div class="modal" style="max-width:540px;">
            <div class="modal-header">
                <div>
                    <div class="modal-step-num">Biblioteca</div>
                    <div class="modal-step-name">UPLOAD DE SKINS</div>
                </div>
                <button class="modal-close" id="sk-modal-close">
                    <svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>

            <div style="padding:20px 24px;display:flex;flex-direction:column;gap:16px;">

                
                <div class="sk-drop-zone" id="sk-drop-zone">
                    <div class="sk-drop-preview" id="sk-drop-preview">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:36px;height:36px;color:var(--muted);">
                            <rect x="3" y="3" width="18" height="18" rx="2"/>
                            <circle cx="8.5" cy="8.5" r="1.5"/>
                            <polyline points="21 15 16 10 5 21"/>
                        </svg>
                        <div class="sk-drop-label">Clique ou arraste skins (.png)</div>
                        <div class="sk-drop-hint">Múltiplos arquivos aceitos · 64×64px recomendado</div>
                    </div>
                </div>
                <input type="file" id="sk-file-input" accept="image/png" multiple style="display:none;">

                
                <div id="sk-queue-wrap" style="display:none;">
                    <div style="font-family:var(--font-mono);font-size:.55rem;text-transform:uppercase;letter-spacing:2px;color:var(--muted);margin-bottom:8px;">
                        Arquivos selecionados
                    </div>
                    <div id="sk-queue-list" class="sk-queue-list"></div>
                </div>

                
                <div class="auth-field">
                    <label>Categoria <span style="color:var(--muted);font-size:.48rem;">(aplicada a todos os arquivos)</span></label>
                    <input type="text" id="sk-category" placeholder="Ex: Player, NPC, personagem e etc.."
                        maxlength="40" list="sk-cats-datalist">
                    <datalist id="sk-cats-datalist"></datalist>
                </div>

                
                <div class="sk-player-info" id="sk-player-info">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0;">
                        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                    </svg>
                    <span>Player: <b id="sk-player-display">—</b></span>
                </div>

                
                <div id="sk-progress-wrap" style="display:none;">
                    <div style="font-family:var(--font-mono);font-size:.6rem;color:var(--muted);margin-bottom:6px;" id="sk-progress-label">Enviando…</div>
                    <div style="height:4px;background:var(--border);border-radius:2px;overflow:hidden;">
                        <div id="sk-progress-bar" style="height:100%;background:var(--red);width:0%;transition:width .3s;"></div>
                    </div>
                </div>

            </div>

            <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 24px;border-top:1px solid var(--border);">
                <div style="font-family:var(--font-mono);font-size:.55rem;color:var(--muted);" id="sk-queue-count"></div>
                <div style="display:flex;gap:8px;">
                    <button class="action-btn" id="sk-modal-cancel">Cancelar</button>
                    <button class="action-btn primary" id="sk-modal-save">
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

    
    <div class="modal-overlay" id="sk-view-modal">
        <div class="modal" style="max-width:460px;">
            <div class="modal-header">
                <div>
                    <div class="modal-step-num" id="sk-view-category"></div>
                    <div class="modal-step-name" id="sk-view-name"></div>
                </div>
                <button class="modal-close" id="sk-view-close">
                    <svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
            <div class="sk-view-content">
                
                <canvas id="sk-view-canvas" style="border-radius:8px;border:1px solid var(--border);flex-shrink:0;background:transparent;min-width:300px;min-height:300px;"></canvas>
                
                <div style="flex:1;min-width:0;">
                    <div class="sk-view-meta" id="sk-view-meta"></div>
                </div>
            </div>

            
            <div id="sk-edit-section" style="display:none;padding:0 24px 16px;border-top:1px solid var(--border);margin-top:4px;">
                <div style="font-family:var(--font-mono);font-size:.55rem;text-transform:uppercase;letter-spacing:2px;color:var(--gold);margin:14px 0 12px;">Editar skin</div>
                <div class="auth-field" style="margin-bottom:10px;">
                    <label>Nome</label>
                    <input type="text" id="sk-edit-name" maxlength="60" placeholder="Nome da skin">
                </div>
                <div class="auth-field">
                    <label>Categoria</label>
                    <input type="text" id="sk-edit-category" maxlength="40" placeholder="Categoria" list="sk-edit-cats-datalist">
                    <datalist id="sk-edit-cats-datalist"></datalist>
                </div>
            </div>

            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:14px 24px;border-top:1px solid var(--border);">
                <div style="display:flex;gap:8px;">
                    <button class="action-btn danger" id="sk-view-delete" style="display:none;border-color:rgba(232,17,26,.4);color:#ff8080;">
                        ${uiIcon('trash')} Excluir
                    </button>
                    <button class="action-btn" id="sk-view-edit" style="display:none;">
                        ${uiIcon('edit')} Editar
                    </button>
                    <button class="action-btn primary" id="sk-view-save-edit" style="display:none;">
                        ${uiIcon('save')} Salvar
                    </button>
                </div>
                <div style="display:flex;gap:8px;">
                    <button class="action-btn" id="sk-view-copy-url">${uiIcon('copy')} URL</button>
                    <a class="action-btn primary" id="sk-view-download" download style="text-decoration:none;">${uiIcon('download')} Download</a>
                </div>
            </div>
        </div>
    </div>
    `;

    bindSkinsEvents();
    loadSkins();
}





async function loadSkins() {
    const grid = document.getElementById('sk-grid');
    if (grid) grid.innerHTML = '<div class="loading-state"><span class="spinner"></span> Carregando skins…</div>';

    try {
        const allFiles = await listAllFiles('');
        skinsAllData = allFiles.map(file => {
            const parts = file.path.split('/');
            let player, category, fileName;
            if (parts.length >= 3) {
                [player, category, ...rest] = parts;
                fileName = rest.join('/');
            } else if (parts.length === 2) {
                [player, fileName] = parts;
                category = 'Geral';
            } else {
                player = 'Desconhecido'; category = 'Geral'; fileName = parts[0];
            }
            const name = fileName.replace(/\.png$/i, '').replace(/_/g, ' ');
            const { data: { publicUrl } } = sb.storage.from(SKINS_BUCKET).getPublicUrl(file.path);
            return { path: file.path, player, category, name, fileName, url: publicUrl, createdAt: file.created_at, size: file.metadata?.size || 0 };
        });
        updateSkinsFilters();
        renderSkinsGrid();
    } catch (err) {
        console.error('Erro ao carregar skins:', err);
        if (grid) grid.innerHTML = `
            <div class="projects-empty">
                <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                <h3>Erro ao carregar skins</h3>
                <p>${escapeHtml(err.message)}</p>
                <p style="margin-top:6px;font-size:.7rem;color:var(--muted);">Verifique se o bucket "${SKINS_BUCKET}" existe e tem política pública.</p>
            </div>`;
    }
}

async function listAllFiles(prefix) {
    const { data: items, error } = await sb.storage.from(SKINS_BUCKET).list(prefix, { limit: 500 });
    if (error || !items) return [];
    const files = [];
    for (const item of items) {
        const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
        if (item.id === null) {
            files.push(...await listAllFiles(fullPath));
        } else if (item.name.toLowerCase().endsWith('.png')) {
            files.push({ path: fullPath, ...item });
        }
    }
    return files;
}





function updateSkinsFilters() {
    const players = ['all', ...new Set(skinsAllData.map(s => s.player))].sort();
    const cats = ['all', ...new Set(skinsAllData.map(s => s.category))].sort();

    const playerSel = document.getElementById('sk-filter-player');
    const catSel = document.getElementById('sk-filter-cat');
    if (playerSel) {
        const cur = playerSel.value;
        playerSel.innerHTML = players.map(p => `<option value="${escapeHtml(p)}">${p === 'all' ? 'Todos os players' : escapeHtml(p)}</option>`).join('');
        if (players.includes(cur)) playerSel.value = cur;
    }
    if (catSel) {
        const cur = catSel.value;
        catSel.innerHTML = cats.map(c => `<option value="${escapeHtml(c)}">${c === 'all' ? 'Todas as categorias' : escapeHtml(c)}</option>`).join('');
        if (cats.includes(cur)) catSel.value = cur;
    }
    
    const uploadCatsDl = document.getElementById('sk-cats-datalist');
    const editCatsDl = document.getElementById('sk-edit-cats-datalist');
    const catsHtml = cats.filter(c => c !== 'all').map(c => `<option value="${escapeHtml(c)}">`).join('');
    if (uploadCatsDl) uploadCatsDl.innerHTML = catsHtml;
    if (editCatsDl) editCatsDl.innerHTML = catsHtml;
}

function getFilteredSkins() {
    const { player, category, search } = skinsFilter;
    return skinsAllData.filter(s => {
        if (player !== 'all' && s.player !== player) return false;
        if (category !== 'all' && s.category !== category) return false;
        if (search) {
            const q = search.toLowerCase();
            if (!s.name.toLowerCase().includes(q) && !s.player.toLowerCase().includes(q) && !s.category.toLowerCase().includes(q)) return false;
        }
        return true;
    });
}

function renderSkinsGrid() {
    const filtered = getFilteredSkins();
    const grid = document.getElementById('sk-grid');
    const stats = document.getElementById('sk-stats');

    if (stats) {
        const players = new Set(skinsAllData.map(s => s.player)).size;
        const cats = new Set(skinsAllData.map(s => s.category)).size;
        stats.innerHTML = `
            <div class="sk-stat"><div class="sk-stat-val">${skinsAllData.length}</div><div class="sk-stat-label">Skins</div></div>
            <div class="sk-stat"><div class="sk-stat-val">${players}</div><div class="sk-stat-label">Players</div></div>
            <div class="sk-stat"><div class="sk-stat-val">${cats}</div><div class="sk-stat-label">Categorias</div></div>
            <div class="sk-stat"><div class="sk-stat-val">${filtered.length}</div><div class="sk-stat-label">Exibindo</div></div>`;
    }

    if (!grid) return;

    if (!filtered.length) {
        grid.innerHTML = `
            <div class="projects-empty">
                <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                <h3>${skinsAllData.length === 0 ? 'Nenhuma skin ainda' : 'Nenhuma skin encontrada'}</h3>
                <p>${skinsAllData.length === 0 ? 'Faça o upload da primeira skin!' : 'Tente ajustar os filtros.'}</p>
            </div>`;
        return;
    }

    
    const byPlayer = {};
    filtered.forEach(s => { if (!byPlayer[s.player]) byPlayer[s.player] = []; byPlayer[s.player].push(s); });

    grid.innerHTML = Object.entries(byPlayer).map(([player, skins]) => `
        <div class="sk-player-group">
            <div class="sk-player-label">
                <div class="sk-player-avatar">${player.charAt(0).toUpperCase()}</div>
                <span>${escapeHtml(player)}</span>
                <span class="sk-player-count">${skins.length} skin${skins.length !== 1 ? 's' : ''}</span>
            </div>
            <div class="sk-skins-row">
                ${skins.map(s => skinCardHtml(s)).join('')}
            </div>
        </div>`).join('');

    grid.querySelectorAll('.sk-card').forEach(card => {
        const skin = skinsAllData.find(s => s.path === card.dataset.path);
        if (!skin) return;
        const canvas = card.querySelector('canvas');
        if (canvas) renderSkinFace(canvas, skin.url);
        card.addEventListener('click', () => openSkinViewModal(skin));
    });
}

function skinCardHtml(s) {
    return `
    <div class="sk-card" data-path="${escapeHtml(s.path)}" title="${escapeHtml(s.name)}">
        <div class="sk-card-preview">
            <canvas class="sk-card-canvas" width="64" height="64"></canvas>
        </div>
        <div class="sk-card-info">
            <div class="sk-card-name">${escapeHtml(s.name)}</div>
            <div class="sk-card-cat">${escapeHtml(s.category)}</div>
        </div>
    </div>`;
}


function renderSkinFace(canvas, url, scale) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
        const s = scale || Math.floor(canvas.width / 8);
        canvas.width = 8 * s; canvas.height = 8 * s;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 8, 8, 8, 8, 0, 0, 8 * s, 8 * s);
        ctx.drawImage(img, 40, 8, 8, 8, 0, 0, 8 * s, 8 * s);
    };
    img.onerror = () => {
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#333';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    };
    img.src = url;
}





function openSkinViewModal(skin) {
    skinEditTarget = skin;

    document.getElementById('sk-view-category').textContent = `${skin.player} · ${skin.category}`;
    document.getElementById('sk-view-name').textContent = skin.name.toUpperCase();

    const canvas = document.getElementById('sk-view-canvas');
canvas.width  = 300;
canvas.height = 300;
renderSkin3DFull(canvas, skin.url);

    const date = skin.createdAt ? new Date(skin.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';
    document.getElementById('sk-view-meta').innerHTML = `
        <div class="sk-view-meta-row"><span>Player</span><b>${escapeHtml(skin.player)}</b></div>
        <div class="sk-view-meta-row"><span>Categoria</span><b>${escapeHtml(skin.category)}</b></div>
        <div class="sk-view-meta-row"><span>Arquivo</span><b>${escapeHtml(skin.fileName)}</b></div>
        <div class="sk-view-meta-row"><span>Adicionado</span><b>${date}</b></div>`;

    
    const dlBtn = document.getElementById('sk-view-download');
    dlBtn.href = skin.url; dlBtn.download = skin.fileName;
    document.getElementById('sk-view-copy-url').onclick = () => {
        navigator.clipboard.writeText(skin.url).then(() => showToast('URL copiada!')).catch(() => showToast('Erro ao copiar.'));
    };

    
    const isOwner = skin.player === getDisplayName(window.currentUser) || isAdmin();
    const editBtn = document.getElementById('sk-view-edit');
    const deleteBtn = document.getElementById('sk-view-delete');
    editBtn.style.display = isOwner ? 'flex' : 'none';
    deleteBtn.style.display = isOwner ? 'flex' : 'none';

    
    _closeEditSection();

    
    deleteBtn.onclick = async () => {

        const confirmed = await skinConfirm(
            'Excluir skin',
            `Tem certeza que deseja excluir "${skin.name}"?\n\nEsta ação não pode ser desfeita.`,
            'trash'
        );

        if (!confirmed) return;

        const { error } = await sb.storage
            .from(SKINS_BUCKET)
            .remove([skin.path]);

        if (error) {
            showToast('Erro: ' + error.message);
            return;
        }

        skinsAllData = skinsAllData.filter(s => s.path !== skin.path);

        updateSkinsFilters();
        renderSkinsGrid();
        closeSkinViewModal();

        showToast('Skin excluída!');
    };

    
    editBtn.onclick = () => {
        const editSection = document.getElementById('sk-edit-section');
        const saveBtn = document.getElementById('sk-view-save-edit');
        const isOpen = editSection.style.display !== 'none';
        if (isOpen) {
            _closeEditSection();
        } else {
            document.getElementById('sk-edit-name').value = skin.name;
            document.getElementById('sk-edit-category').value = skin.category;
            editSection.style.display = 'block';
            saveBtn.style.display = 'flex';
            editBtn.innerHTML = `${uiIcon('close')} Cancelar`;
        }
    };

    
    document.getElementById('sk-view-save-edit').onclick = async () => {
        await _doEditSkin(skin);
    };

    document.getElementById('sk-view-modal').classList.add('open');
}

function _closeEditSection() {
    document.getElementById('sk-edit-section').style.display = 'none';
    document.getElementById('sk-view-save-edit').style.display = 'none';
    document.getElementById('sk-view-edit').innerHTML = `${uiIcon('edit')} Editar`;
}

async function _doEditSkin(skin) {
    const newName = document.getElementById('sk-edit-name').value.trim();
    const newCategory = document.getElementById('sk-edit-category').value.trim();

    if (!newName) { showToast('Nome não pode ser vazio!'); return; }
    if (!newCategory) { showToast('Categoria não pode ser vazia!'); return; }

    const sanitize = str => str.replace(/[^a-zA-Z0-9\-_çãõáàâéêíóôú ]/g, '').trim().replace(/\s+/g, '_');

    
    const safeName = sanitize(newName) || 'skin';
    const safeCategory = sanitize(newCategory) || 'geral';
    const newPath = `${skin.player}/${safeCategory}/${safeName}.png`;

    const saveBtn = document.getElementById('sk-view-save-edit');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner"></span>';

    try {
        if (newPath !== skin.path) {
            
            const { error: copyErr } = await sb.storage.from(SKINS_BUCKET).copy(skin.path, newPath);
            if (copyErr) throw copyErr;
            
            await sb.storage.from(SKINS_BUCKET).remove([skin.path]);
        }

        showToast('Skin atualizada!');
        closeSkinViewModal();
        await loadSkins();
    } catch (err) {
        showToast('Erro ao editar: ' + err.message);
        console.error(err);
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = `${uiIcon('save')} Salvar`;
    }
}

function closeSkinViewModal() {
  document.getElementById('sk-view-modal')?.classList.remove('open');
  skinEditTarget = null;
  _closeEditSection();
  disposeSkin3D(); 
}





let skinsQueue = []; 

function openSkinsUploadModal() {
    skinsQueue = [];
    document.getElementById('sk-file-input').value = '';
    document.getElementById('sk-category').value = '';
    document.getElementById('sk-queue-wrap').style.display = 'none';
    document.getElementById('sk-queue-list').innerHTML = '';
    document.getElementById('sk-queue-count').textContent = '';
    document.getElementById('sk-progress-wrap').style.display = 'none';
    document.getElementById('sk-progress-bar').style.width = '0%';

    
    const displayName = getDisplayName(window.currentUser);
    const sanitize = str => str.replace(/[^a-zA-Z0-9\-_çãõáàâéêíóôú ]/g, '').trim().replace(/\s+/g, '_');
    document.getElementById('sk-player-display').textContent = sanitize(displayName) || window.currentUser?.email?.split('@')[0] || 'player';

    document.getElementById('sk-upload-modal').classList.add('open');
}

function closeSkinsUploadModal() {
    document.getElementById('sk-upload-modal')?.classList.remove('open');
    skinsQueue = [];
}

function handleMultipleFiles(files) {
    const pngs = [...files].filter(f => f.name.toLowerCase().endsWith('.png'));
    if (!pngs.length) { showToast('Selecione arquivos PNG!'); return; }

    skinsQueue = pngs.map(f => ({
        file: f,
        name: f.name.replace(/\.png$/i, '').replace(/_/g, ' '),
        status: 'pending',
    }));

    renderQueue();
}

function renderQueue() {
    const wrap = document.getElementById('sk-queue-wrap');
    const list = document.getElementById('sk-queue-list');
    const counter = document.getElementById('sk-queue-count');

    if (!skinsQueue.length) { wrap.style.display = 'none'; return; }
    wrap.style.display = 'block';
    counter.textContent = `${skinsQueue.length} arquivo${skinsQueue.length !== 1 ? 's' : ''} selecionado${skinsQueue.length !== 1 ? 's' : ''}`;

    list.innerHTML = skinsQueue.map((item, i) => `
        <div class="sk-queue-item" id="sk-qi-${i}">
            <div class="sk-queue-thumb" id="sk-qt-${i}"></div>
            <div class="sk-queue-fields">
                <input class="sk-queue-name" data-index="${i}" value="${escapeHtml(item.name)}"
                    placeholder="Nome da skin" maxlength="60"
                    title="Nome desta skin — pode editar antes de enviar">
                <div class="sk-queue-filename">${escapeHtml(item.file.name)}</div>
            </div>
            <div class="sk-queue-status" id="sk-qs-${i}">⏳</div>
            <button class="sk-queue-remove" data-index="${i}" title="Remover">×</button>
        </div>`).join('');

    
    skinsQueue.forEach((item, i) => {
        const url = URL.createObjectURL(item.file);
        const wrap = document.getElementById(`sk-qt-${i}`);
        const canvas = document.createElement('canvas');
        canvas.width = 32; canvas.height = 32;
        canvas.style.cssText = 'image-rendering:pixelated;border-radius:4px;';
        wrap.appendChild(canvas);
        renderSkinFace(canvas, url, 4);
    });

    
    list.querySelectorAll('.sk-queue-name').forEach(inp => {
        inp.addEventListener('input', e => {
            skinsQueue[parseInt(e.target.dataset.index)].name = e.target.value;
        });
    });

    
    list.querySelectorAll('.sk-queue-remove').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.index);
            skinsQueue.splice(idx, 1);
            renderQueue();
        });
    });
}

async function doSkinsUpload() {
    if (skinsUploading) return;
    if (!skinsQueue.length) { showToast('Selecione pelo menos um arquivo PNG!'); return; }

    const category = document.getElementById('sk-category').value.trim();
    if (!category) { showToast('Digite uma categoria!'); return; }

    const displayName = getDisplayName(window.currentUser);
    const sanitize = str => str.replace(/[^a-zA-Z0-9\-_çãõáàâéêíóôú ]/g, '').trim().replace(/\s+/g, '_');
    const safePlayer = sanitize(displayName) || window.currentUser?.email?.split('@')[0] || 'player';
    const safeCat = sanitize(category) || 'geral';

    skinsUploading = true;
    const saveBtn = document.getElementById('sk-modal-save');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner"></span> Enviando…';

    const progressWrap = document.getElementById('sk-progress-wrap');
    const progressBar = document.getElementById('sk-progress-bar');
    const progressLabel = document.getElementById('sk-progress-label');
    progressWrap.style.display = 'block';

    let done = 0;
    let errors = 0;

    for (let i = 0; i < skinsQueue.length; i++) {
        const item = skinsQueue[i];
        const safeName = sanitize(item.name) || `skin_${i + 1}`;
        const path = `${safePlayer}/${safeCat}/${safeName}.png`;
        const statusEl = document.getElementById(`sk-qs-${i}`);

        
        if (statusEl) statusEl.textContent = '⏳';
        progressLabel.textContent = `Enviando ${i + 1}/${skinsQueue.length}: ${item.file.name}`;
        progressBar.style.width = `${Math.round((i / skinsQueue.length) * 100)}%`;

        try {
            const { error } = await sb.storage.from(SKINS_BUCKET).upload(path, item.file, { contentType: 'image/png', upsert: true });
            if (error) throw error;
            if (statusEl) statusEl.innerHTML = uiIcon('checkCircle');
            done++;
        } catch (err) {
            console.error(`Erro em ${item.file.name}:`, err);
            if (statusEl) statusEl.innerHTML = uiIcon('x');
            errors++;
        }
    }

    progressBar.style.width = '100%';
    progressLabel.textContent = errors > 0 ? `Concluído com ${errors} erro(s).` : 'Tudo enviado!';

    const msg = errors > 0
        ? `${done} enviada${done !== 1 ? 's' : ''}, ${errors} com erro`
        : `${done} skin${done !== 1 ? 's' : ''} enviada${done !== 1 ? 's' : ''}!`;
    showToast(msg);

    skinsUploading = false;
    saveBtn.disabled = false;
    saveBtn.innerHTML = `${uiIcon('upload')} Enviar`;

    
    setTimeout(async () => {
        closeSkinsUploadModal();
        await loadSkins();
    }, 1200);
}





function bindSkinsEvents() {
    
    document.getElementById('sk-upload-btn')?.addEventListener('click', openSkinsUploadModal);
    document.getElementById('sk-modal-close')?.addEventListener('click', closeSkinsUploadModal);
    document.getElementById('sk-modal-cancel')?.addEventListener('click', closeSkinsUploadModal);
    document.getElementById('sk-modal-save')?.addEventListener('click', doSkinsUpload);
    document.getElementById('sk-upload-modal')?.addEventListener('click', e => {
        if (e.target === document.getElementById('sk-upload-modal')) closeSkinsUploadModal();
    });

    
    document.getElementById('sk-view-close')?.addEventListener('click', closeSkinViewModal);
    document.getElementById('sk-view-modal')?.addEventListener('click', e => {
        if (e.target === document.getElementById('sk-view-modal')) closeSkinViewModal();
    });

    
    document.getElementById('sk-refresh-btn')?.addEventListener('click', loadSkins);

    
    document.getElementById('sk-search')?.addEventListener('input', e => {
        skinsFilter.search = e.target.value;
        renderSkinsGrid();
    });

    
    document.getElementById('sk-filter-player')?.addEventListener('change', e => {
        skinsFilter.player = e.target.value;
        renderSkinsGrid();
    });
    document.getElementById('sk-filter-cat')?.addEventListener('change', e => {
        skinsFilter.category = e.target.value;
        renderSkinsGrid();
    });

    
    const fileInput = document.getElementById('sk-file-input');
    const dropZone = document.getElementById('sk-drop-zone');

    dropZone?.addEventListener('click', () => fileInput.click());
    fileInput?.addEventListener('change', () => {
        if (fileInput.files?.length) handleMultipleFiles(fileInput.files);
    });
    dropZone?.addEventListener('dragover', e => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });
    dropZone?.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone?.addEventListener('drop', e => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        if (e.dataTransfer.files?.length) handleMultipleFiles(e.dataTransfer.files);
    });

    
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') { closeSkinViewModal(); closeSkinsUploadModal(); }
    });
}
