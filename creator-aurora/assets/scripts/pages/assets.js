let allAssets = [];
let currentAssetFilter = 'all';
let currentAssetPack = 'minecraft';
let currentAssetVersion = '26.3';

const TEXTURE_PACKS = {
    minecraft: { label: 'Vanilla', storage: 'minecraft' },
    barebones: { label: 'Bare Bones', storage: 'barebones' }
};

const TEXTURE_FOLDERS = {
    block: 'Blocos',
    item: 'Itens',
    mob_effect: 'Efeitos',
    motions: 'Motions',
    painting: 'Pinturas',
    particle: 'Partículas'
};

const TEXTURE_FOLDER_ORDER = ['block', 'item', 'mob_effect', 'motions', 'painting', 'particle'];

function generateDemoAssets() {
    return [
        'minecraft/26.3/block/grass_block_top.png',
        'minecraft/26.3/item/diamond_sword.png',
        'minecraft/26.3/mob_effect/speed.png',
        'minecraft/26.3/motions/water_flow.png',
        'minecraft/26.3/painting/aztec.png',
        'minecraft/26.3/particle/flame.png',
        'barebones/26.3/block/grass_block_top.png',
        'barebones/26.3/item/diamond_sword.png'
    ].map(key => ({
        key,
        name: key.split('/').pop(),
        ext: 'png',
        type: 'image',
        url: buildR2Url(key)
    }));
}

function buildR2Url(key) {
    const encodedKey = String(key || '').split('/').map(encodeURIComponent).join('/');
    return `${R2_BASE_URL}/${encodedKey}`;
}

async function requestAssetBlob(url) {
    const response = await fetch(url, {
        mode: 'cors',
        credentials: 'omit',
        cache: 'no-store'
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.blob();
}

async function downloadAsset(asset, trigger) {
    const button = trigger || null;
    const originalContent = button?.innerHTML;

    if (button) {
        button.disabled = true;
        button.textContent = 'Baixando…';
        button.classList.add('downloading');
    }

    try {
        const blob = await requestAssetBlob(asset.url);
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = asset.name || 'textura.png';
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);

        if (typeof showToast === 'function') showToast('Download iniciado.');
    } catch (error) {
        console.error('Erro ao baixar textura:', error);
        if (typeof showToast === 'function') showToast('Não foi possível baixar esta textura.');
    } finally {
        if (button) {
            button.disabled = false;
            button.innerHTML = originalContent;
            button.classList.remove('downloading');
        }
    }
}

function parseTexturePath(key) {
    const normalized = String(key || '').replace(/^\/+|\/+$/g, '');
    const parts = normalized.split('/').filter(Boolean);
    const hasPackPrefix = parts.length >= 3 && Object.prototype.hasOwnProperty.call(TEXTURE_PACKS, parts[0]);

    if (hasPackPrefix) {
        return {
            pack: parts[0],
            version: parts[1],
            relativeKey: parts.slice(2).join('/'),
            legacy: false
        };
    }

    // Compatibilidade durante a migração do storage atual.
    return {
        pack: 'minecraft',
        version: '26.3',
        relativeKey: normalized,
        legacy: true
    };
}

function getFolderFromRelativeKey(relativeKey) {
    const parts = String(relativeKey || '').split('/').filter(Boolean);
    return parts.length > 1 ? parts[0] : 'outros';
}

function getFolderLabel(folder) {
    return TEXTURE_FOLDERS[folder] || folder.replace(/_/g, ' ').replace(/^./, char => char.toUpperCase());
}

function getPackLabel(pack) {
    return TEXTURE_PACKS[pack]?.label || pack;
}

function normalizeTextureAsset(file) {
    const key = file.key || file.name || '';
    const location = parseTexturePath(key);
    const name = file.name || location.relativeKey.split('/').pop() || key.split('/').pop();
    const ext = file.ext || (name.split('.').pop() || '');

    return {
        key,
        relativeKey: location.relativeKey,
        pack: location.pack,
        version: location.version,
        legacy: location.legacy,
        folder: getFolderFromRelativeKey(location.relativeKey),
        name,
        ext,
        type: file.type || getFileType(ext),
        size: file.size || 0,
        lastModified: file.lastModified || null,
        // A URL devolvida pela função de listagem codifica a chave inteira e
        // transforma as barras em %2F. Montar pela chave mantém o caminho real
        // do objeto e evita respostas CORS inconsistentes no cache do R2.
        url: buildR2Url(key)
    };
}

async function loadAssetsFromR2() {
    const container = document.getElementById('assets-container');
    if (!container) return;
    container.innerHTML = '<div class="loading-state"><span class="spinner"></span> Carregando biblioteca de texturas…</div>';

    try {
        let files = [];

        if (!DEMO_MODE && R2_LIST_ENDPOINT) {
            const response = await fetch(R2_LIST_ENDPOINT, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }

            const data = await response.json();
            files = data.assets || data.arquivos || [];
        } else {
            files = generateDemoAssets();
        }

        allAssets = files
            .map(normalizeTextureAsset)
            .filter(asset => asset.name && asset.relativeKey && asset.ext);

        setupTextureControls();
        renderAssets();
    } catch (err) {
        console.error('Erro ao carregar texturas:', err);
        container.innerHTML = `
            <div class="projects-empty">
                <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                <h3>Biblioteca indisponível</h3>
                <p>${escapeHtml(err.message)}</p>
                <p style="margin-top:8px;font-size:0.7rem;">Não foi possível consultar o banco de texturas. Tente novamente em instantes.</p>
                <button class="btn-new" style="margin:20px auto 0;display:flex;" id="retry-assets-btn">Tentar novamente</button>
            </div>`;

        document.getElementById('retry-assets-btn')?.addEventListener('click', loadAssetsFromR2);
    }
}

function setupTextureControls() {
    const switchEl = document.getElementById('assets-pack-switch');
    const versionSelect = document.getElementById('assets-version-select');

    if (switchEl && !switchEl.dataset.bound) {
        switchEl.dataset.bound = 'true';
        switchEl.querySelectorAll('[data-pack]').forEach(button => {
            button.addEventListener('click', () => {
                currentAssetPack = button.dataset.pack;
                currentAssetFilter = 'all';
                updateTextureControls();
                renderAssets();
            });
        });
    }

    if (versionSelect && !versionSelect.dataset.bound) {
        versionSelect.dataset.bound = 'true';
        versionSelect.addEventListener('change', () => {
            currentAssetVersion = versionSelect.value;
            currentAssetFilter = 'all';
            renderAssets();
        });
    }

    updateTextureControls();
}

function updateTextureControls() {
    document.querySelectorAll('#assets-pack-switch [data-pack]').forEach(button => {
        const active = button.dataset.pack === currentAssetPack;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
    });

    const versionSelect = document.getElementById('assets-version-select');
    if (!versionSelect) return;

    // Cada pacote pode ser publicado em um ritmo diferente. O seletor deve
    // exibir somente as versões disponíveis no pacote atualmente selecionado.
    const versions = [...new Set(allAssets
        .filter(asset => asset.pack === currentAssetPack)
        .map(asset => asset.version)
        .filter(Boolean))]
        .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));

    if (!versions.length) versions.push('26.3');
    // Mantém a versão ao alternar quando ela existe nos dois pacotes; caso
    // contrário, escolhe automaticamente a versão mais recente disponível.
    if (!versions.includes(currentAssetVersion)) currentAssetVersion = versions[0];

    versionSelect.innerHTML = versions
        .map(version => `<option value="${escapeHtml(version)}">${escapeHtml(version)}</option>`)
        .join('');
    versionSelect.value = currentAssetVersion;
}

function renderAssets() {
    const container = document.getElementById('assets-container');
    if (!container) return;

    const search = (document.getElementById('assets-search')?.value || '').trim().toLowerCase();
    const scopedAssets = allAssets.filter(asset => asset.pack === currentAssetPack && asset.version === currentAssetVersion);
    const filtered = scopedAssets.filter(asset => {
        const matchSearch = !search || asset.name.toLowerCase().includes(search) || asset.relativeKey.toLowerCase().includes(search);
        const matchFolder = currentAssetFilter === 'all' || asset.folder === currentAssetFilter;
        return matchSearch && matchFolder;
    });

    renderTextureFilters(scopedAssets);

    if (!scopedAssets.length) {
        const storagePath = `${TEXTURE_PACKS[currentAssetPack]?.storage || currentAssetPack}/${currentAssetVersion}/`;
        container.innerHTML = `
            <div class="texture-empty">
                <span class="texture-empty-mark">${uiIcon('folder')}</span>
                <h3>${escapeHtml(getPackLabel(currentAssetPack))} ${escapeHtml(currentAssetVersion)}</h3>
                <p>Este pacote ainda não possui texturas publicadas.</p>
                <code>${escapeHtml(storagePath)}</code>
            </div>`;
        return;
    }

    if (!filtered.length) {
        container.innerHTML = `<div class="texture-empty"><span class="texture-empty-mark">${uiIcon('search')}</span><h3>Nenhuma textura encontrada</h3><p>Tente outro nome ou selecione uma categoria diferente.</p></div>`;
        return;
    }

    const grid = document.createElement('div');
    grid.className = 'assets-grid texture-grid';

    filtered.forEach(asset => {
        const card = document.createElement('article');
        card.className = `asset-card texture-card texture-card-${asset.pack}`;
        const isImage = asset.type === 'image';

        card.innerHTML = `
            <div class="asset-preview texture-preview">
                ${isImage
                    ? `<img src="${escapeHtml(asset.url)}" alt="${escapeHtml(asset.name)}" loading="lazy" onerror="this.style.display='none';this.nextSibling.style.display='flex'">
                       <div class="asset-preview-icon" style="display:none">${getFileIcon(asset.ext)}</div>`
                    : `<div class="asset-preview-icon">${getFileIcon(asset.ext)}</div>`
                }
                <span class="asset-type-badge">${escapeHtml(getFolderLabel(asset.folder))}</span>
                <span class="texture-quality-badge">HQ</span>
            </div>
            <div class="asset-info">
                <div class="asset-name" title="${escapeHtml(asset.relativeKey)}">${escapeHtml(asset.name)}</div>
                <div class="asset-meta">${escapeHtml(getPackLabel(asset.pack))} · Minecraft ${escapeHtml(asset.version)}</div>
                <div class="asset-actions">
                    <button class="asset-btn primary" type="button" data-key="${escapeHtml(asset.key)}">Visualizar</button>
                    <button class="asset-btn" type="button" data-download-key="${escapeHtml(asset.key)}">Baixar</button>
                </div>
            </div>`;

        card.querySelector('[data-key]')?.addEventListener('click', () => openAssetModal(asset));
        card.querySelector('[data-download-key]')?.addEventListener('click', event => downloadAsset(asset, event.currentTarget));
        grid.appendChild(card);
    });

    container.replaceChildren(grid);
}

function renderTextureFilters(scopedAssets) {
    const filterEl = document.getElementById('assets-filter-btns');
    if (!filterEl) return;

    const folders = [...new Set(scopedAssets.map(asset => asset.folder))]
        .sort((a, b) => {
            const aIndex = TEXTURE_FOLDER_ORDER.indexOf(a);
            const bIndex = TEXTURE_FOLDER_ORDER.indexOf(b);
            if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
            if (aIndex === -1) return 1;
            if (bIndex === -1) return -1;
            return aIndex - bIndex;
        });

    if (currentAssetFilter !== 'all' && !folders.includes(currentAssetFilter)) currentAssetFilter = 'all';

    filterEl.innerHTML = `
        <button class="filter-btn ${currentAssetFilter === 'all' ? 'active' : ''}" data-folder="all">Todas</button>
        ${folders.map(folder => `<button class="filter-btn ${currentAssetFilter === folder ? 'active' : ''}" data-folder="${escapeHtml(folder)}">${escapeHtml(getFolderLabel(folder))}</button>`).join('')}`;

    filterEl.querySelectorAll('.filter-btn').forEach(button => {
        button.addEventListener('click', () => {
            currentAssetFilter = button.dataset.folder;
            renderAssets();
        });
    });
}

function openAssetModal(asset) {
    document.getElementById('asset-modal-type').textContent = `${getPackLabel(asset.pack).toUpperCase()} · MINECRAFT ${asset.version}`;
    document.getElementById('asset-modal-name').textContent = asset.name;

    const preview = document.getElementById('asset-modal-preview-area');
    if (asset.type === 'image') {
        preview.innerHTML = `<img class="asset-modal-preview" src="${escapeHtml(asset.url)}" alt="${escapeHtml(asset.name)}">`;
    } else {
        preview.innerHTML = `<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:40px;text-align:center;margin-bottom:16px;font-size:4rem;">${getFileIcon(asset.ext)}</div>`;
    }

    document.getElementById('asset-url-display').textContent = asset.url;
    const downloadBtn = document.getElementById('asset-download-btn');
    if (downloadBtn) {
        downloadBtn.onclick = () => downloadAsset(asset, downloadBtn);
    }

    const infoContainer = document.getElementById('asset-modal-info');
    if (infoContainer) {
        infoContainer.innerHTML = `
            <div class="asset-modal-field"><div class="asset-modal-field-label">Pacote</div><div class="asset-modal-field-val">${escapeHtml(getPackLabel(asset.pack))}</div></div>
            <div class="asset-modal-field"><div class="asset-modal-field-label">Versão</div><div class="asset-modal-field-val">Minecraft ${escapeHtml(asset.version)}</div></div>
            <div class="asset-modal-field"><div class="asset-modal-field-label">Categoria</div><div class="asset-modal-field-val">${escapeHtml(getFolderLabel(asset.folder))}</div></div>
            <div class="asset-modal-field" style="grid-column:1/-1;"><div class="asset-modal-field-label">Caminho no storage</div><div class="asset-modal-field-val">${escapeHtml(asset.key)}</div></div>`;
    }

    document.getElementById('asset-modal').classList.add('open');
}
