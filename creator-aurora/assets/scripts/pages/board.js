




console.log('board.js carregado');

let currentBoardId = null;
let currentUserRole = null;
let isOwner = true;


let cardModalData = null;  


document.addEventListener('DOMContentLoaded', async function () {
    let waitCount = 0;
    while (!window.currentUser && waitCount < 30) {
        await new Promise(r => setTimeout(r, 200));
        waitCount++;
    }
    if (!window.currentUser) { console.error('Usuário não encontrado'); return; }

    await loadUserRole();
    await loadBoards();
    setupEvents();
    injectCardModal();
    injectConfirmModal();
});





function getYouTubeId(url) {
    if (!url) return null;
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/
    ];
    for (const p of patterns) {
        const m = url.match(p);
        if (m) return m[1];
    }
    return null;
}

function getYouTubeThumbnail(url) {
    const id = getYouTubeId(url);
    return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : null;
}



function parseCardMeta(description) {
    if (!description) return { notes: '', tags: [], priority: 'normal', dueDate: '', ytUrl: '', checklist: [] };
    try {
        const idx = description.indexOf('__VEXDATA__');
        if (idx !== -1) {
            return JSON.parse(description.slice(idx + 11));
        }
    } catch (e) { }
    
    return { notes: description, tags: [], priority: 'normal', dueDate: '', ytUrl: '', checklist: [] };
}

function serializeCardMeta(meta) {
    return '__VEXDATA__' + JSON.stringify(meta);
}

const PRIORITY_LABELS = { low: 'Baixa', normal: 'Normal', high: 'Alta', urgent: 'Urgente' };
const PRIORITY_COLORS = { low: '#4caf50', normal: '#888', high: '#ff9800', urgent: '#e8111a' };





function injectCardModal() {
    if (document.getElementById('card-detail-modal')) return;

    const overlay = document.createElement('div');
    overlay.id = 'card-detail-modal';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
    <div class="modal card-modal" style="max-width:680px;width:100%;">

      
      <div class="modal-header card-modal-header">
        <div style="flex:1;min-width:0;">
          <div class="modal-step-num" id="cm-list-name">Lista</div>
          <input class="card-modal-title-input" id="cm-title" placeholder="Título do card…" maxlength="140">
        </div>
        <button class="modal-close" id="cm-close-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      
      <div class="card-modal-body">

        
        <div class="card-modal-main">

          
          <div id="cm-thumb-wrap" style="display:none;margin-bottom:16px;border-radius:8px;overflow:hidden;position:relative;">
            <img id="cm-thumb-img" src="" alt="Thumbnail" style="width:100%;display:block;border-radius:8px;">
            <div id="cm-yt-badge" style="
              position:absolute;bottom:8px;left:8px;
              background:rgba(0,0,0,.75);color:#fff;
              font-family:var(--font-mono);font-size:.55rem;letter-spacing:1px;
              padding:3px 8px;border-radius:4px;text-transform:uppercase;">
              YouTube
            </div>
            <a id="cm-yt-link" href="#" target="_blank" style="
              position:absolute;bottom:8px;right:8px;
              background:var(--red);color:#fff;
              font-family:var(--font-mono);font-size:.55rem;letter-spacing:1px;
              padding:3px 10px;border-radius:4px;text-decoration:none;">
              ▶ Assistir
            </a>
          </div>

          
          <div class="cm-section">
            <div class="cm-section-label">${uiIcon('youtube')} Link YouTube</div>
            <input class="cm-input" id="cm-yt-url" placeholder="https://youtube.com/watch?v=…" type="url">
          </div>

          
          <div class="cm-section">
            <div class="cm-section-label">${uiIcon('note')} Notas / Descrição</div>
            <textarea class="cm-textarea" id="cm-notes" placeholder="Adicione notas, contexto, links…" rows="5"></textarea>
          </div>

          
          <div class="cm-section">
            <div class="cm-section-label" style="display:flex;justify-content:space-between;align-items:center;">
              <span>${uiIcon('checklist')} Checklist</span>
              <button class="cm-add-check-btn" id="cm-add-check">+ Item</button>
            </div>
            <div id="cm-checklist"></div>
          </div>

        </div>

        
        <div class="card-modal-sidebar">

          
          <div class="cm-section">
            <div class="cm-section-label">${uiIcon('flag')} Prioridade</div>
            <div class="cm-priority-row" id="cm-priority-row">
              <button class="cm-pri-btn" data-p="low">Baixa</button>
              <button class="cm-pri-btn active" data-p="normal">Normal</button>
              <button class="cm-pri-btn" data-p="high">Alta</button>
              <button class="cm-pri-btn" data-p="urgent">Urgente</button>
            </div>
          </div>

          
          <div class="cm-section">
            <div class="cm-section-label">${uiIcon('calendar')} Data limite</div>
            <input class="cm-input" id="cm-due-date" type="date">
          </div>

          
          <div class="cm-section">
            <div class="cm-section-label">${uiIcon('tag')} Tags</div>
            <div class="cm-tags-wrap" id="cm-tags-wrap"></div>
            <div style="display:flex;gap:6px;margin-top:8px;">
              <input class="cm-input" id="cm-tag-input" placeholder="Nova tag…" maxlength="20" style="flex:1;">
              <button class="cm-add-check-btn" id="cm-tag-add">+</button>
            </div>
          </div>

          
          <div class="cm-section">
            <label class="ranking-checkbox-row" style="margin:0;">
              <input type="checkbox" id="cm-completed">
              <span style="font-family:var(--font-body);font-size:.85rem;color:var(--text);flex:1;">Marcar como concluído</span>
            </label>
          </div>

        </div>
      </div>

      
      <div class="card-modal-footer">
        <button class="action-btn danger" id="cm-delete-btn"
          style="border-color:rgba(232,17,26,.4);color:#ff8080;display:none;">
          ${uiIcon('trash')} Excluir card
        </button>
        <div style="display:flex;gap:8px;margin-left:auto;">
          <button class="action-btn" id="cm-cancel-btn">Fechar</button>
          <button class="action-btn primary" id="cm-save-btn">Salvar</button>
        </div>
      </div>

    </div>
    `;

    document.body.appendChild(overlay);

    
    overlay.addEventListener('click', e => { if (e.target === overlay) closeCardModal(); });
    document.getElementById('cm-close-btn').addEventListener('click', closeCardModal);
    document.getElementById('cm-cancel-btn').addEventListener('click', closeCardModal);
    document.getElementById('cm-save-btn').addEventListener('click', saveCardModal);

    
    document.getElementById('cm-delete-btn').addEventListener('click', async () => {
        if (!cardModalData) return;
        const ok = await boardConfirm('Excluir card', `"${cardModalData.card.title}" será removido permanentemente.`);
        if (!ok) return;
        await sb.from('cards').delete().eq('id', cardModalData.card.id);
        
        const el = document.querySelector(`[data-card-id="${cardModalData.card.id}"]`);
        if (el) el.remove();
        closeCardModal();
        showBoardToast('Card excluído!');
    });

    
    document.getElementById('cm-yt-url').addEventListener('input', () => {
        const val = document.getElementById('cm-yt-url').value;
        updateYtPreview(val);
    });

    
    document.getElementById('cm-add-check').addEventListener('click', () => {
        addChecklistItem('');
    });

    
    document.getElementById('cm-tag-add').addEventListener('click', addTagFromInput);
    document.getElementById('cm-tag-input').addEventListener('keypress', e => {
        if (e.key === 'Enter') addTagFromInput();
    });

    
    document.getElementById('cm-priority-row').addEventListener('click', e => {
        const btn = e.target.closest('.cm-pri-btn');
        if (!btn) return;
        document.querySelectorAll('.cm-pri-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    });
}

function injectConfirmModal() {
    if (document.getElementById('board-confirm-modal')) return;
    const el = document.createElement('div');
    el.id = 'board-confirm-modal';
    el.className = 'modal-overlay';
    el.innerHTML = `
    <div class="modal" style="max-width:400px;text-align:center;">
        <div class="modal-header" style="justify-content:flex-end;padding-bottom:8px;">
            <button class="modal-close" id="bcm-x">
                <svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        </div>
        <div style="padding:0 32px 32px;display:flex;flex-direction:column;align-items:center;gap:16px;">
            <div id="bcm-icon" style="font-size:2.5rem;">${uiIcon('warning')}</div>
            <div id="bcm-title" style="font-family:var(--font-display);font-size:1.4rem;letter-spacing:2px;color:var(--text);"></div>
            <div id="bcm-desc" style="font-family:var(--font-body);font-size:.85rem;color:var(--muted);line-height:1.6;"></div>
            <div style="display:flex;gap:10px;margin-top:4px;">
                <button class="action-btn" id="bcm-cancel">Cancelar</button>
                <button class="action-btn primary" id="bcm-confirm" style="background:var(--red);border-color:var(--red);">Excluir</button>
            </div>
        </div>
    </div>`;
    document.body.appendChild(el);

    const close = () => el.classList.remove('open');
    document.getElementById('bcm-x').addEventListener('click', close);
    document.getElementById('bcm-cancel').addEventListener('click', close);
    el.addEventListener('click', e => { if (e.target === el) close(); });
}

function boardConfirm(title, desc, icon = 'warning') {
    return new Promise(resolve => {
        const modal = document.getElementById('board-confirm-modal');
        document.getElementById('bcm-icon').innerHTML = uiIcon(icon);
        document.getElementById('bcm-title').textContent = title;
        document.getElementById('bcm-desc').textContent = desc;
        modal.classList.add('open');

        const confirmBtn = document.getElementById('bcm-confirm');
        const cancelBtn = document.getElementById('bcm-cancel');
        const xBtn = document.getElementById('bcm-x');

        
        const newConfirm = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
        const newCancel = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
        const newX = xBtn.cloneNode(true);
        xBtn.parentNode.replaceChild(newX, xBtn);

        const close = (val) => {
            modal.classList.remove('open');
            resolve(val);
        };

        document.getElementById('bcm-confirm').addEventListener('click', () => close(true));
        document.getElementById('bcm-cancel').addEventListener('click', () => close(false));
        document.getElementById('bcm-x').addEventListener('click', () => close(false));
        modal.addEventListener('click', e => { if (e.target === modal) close(false); }, { once: true });
    });
}


function injectInputModal() {
    if (document.getElementById('board-input-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'board-input-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
    <div class="modal" style="max-width:400px;">
        <div class="modal-header" style="justify-content:space-between;">
            <h3 id="bim-title" style="font-family:var(--font-display);font-size:1.2rem;">Digite um valor</h3>
            <button class="modal-close" id="bim-close">×</button>
        </div>
        <div style="padding:0 24px 20px;">
            <input type="text" id="bim-input" class="cm-input" placeholder="..." style="width:100%;margin-bottom:16px;">
            <div style="display:flex;gap:10px;justify-content:flex-end;">
                <button class="action-btn" id="bim-cancel">Cancelar</button>
                <button class="action-btn primary" id="bim-confirm">Confirmar</button>
            </div>
        </div>
    </div>`;

    document.body.appendChild(modal);

    
    const closeModal = () => modal.classList.remove('open');
    document.getElementById('bim-close').addEventListener('click', closeModal);
    document.getElementById('bim-cancel').addEventListener('click', closeModal);
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
}


function boardPrompt(title, defaultValue = '', placeholder = '') {
    return new Promise(resolve => {
        injectInputModal();
        const modal = document.getElementById('board-input-modal');
        const input = document.getElementById('bim-input');
        const titleEl = document.getElementById('bim-title');

        titleEl.textContent = title;
        input.value = defaultValue;
        input.placeholder = placeholder || 'Digite aqui...';

        const confirmBtn = document.getElementById('bim-confirm');
        const handleConfirm = () => {
            modal.classList.remove('open');
            resolve(input.value.trim() || null);
        };

        
        const newConfirm = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);

        newConfirm.addEventListener('click', handleConfirm);
        input.addEventListener('keypress', e => { if (e.key === 'Enter') handleConfirm(); });

        modal.classList.add('open');
        input.focus();
    });
}


function openCardModal(card, canEdit, listTitle) {
    cardModalData = { card, canEdit };

    const meta = parseCardMeta(card.description);

    document.getElementById('cm-list-name').textContent = listTitle || 'Card';
    document.getElementById('cm-title').value = card.title || '';
    document.getElementById('cm-title').readOnly = !canEdit;
    document.getElementById('cm-yt-url').value = meta.ytUrl || '';
    document.getElementById('cm-yt-url').readOnly = !canEdit;
    document.getElementById('cm-notes').value = meta.notes || '';
    document.getElementById('cm-notes').readOnly = !canEdit;
    document.getElementById('cm-due-date').value = meta.dueDate || '';
    document.getElementById('cm-due-date').disabled = !canEdit;
    document.getElementById('cm-completed').checked = !!card.completed;
    document.getElementById('cm-completed').disabled = !canEdit;

    
    document.querySelectorAll('.cm-pri-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.p === (meta.priority || 'normal'));
        b.disabled = !canEdit;
    });

    
    renderTagsInModal(meta.tags || []);

    
    renderChecklistInModal(meta.checklist || [], canEdit);

    
    updateYtPreview(meta.ytUrl || card.title || '');

    
    document.getElementById('cm-delete-btn').style.display = canEdit ? 'flex' : 'none';
    document.getElementById('cm-save-btn').style.display = canEdit ? 'flex' : 'none';
    document.getElementById('cm-tag-add').style.display = canEdit ? 'flex' : 'none';
    document.getElementById('cm-tag-input').style.display = canEdit ? 'block' : 'none';
    document.getElementById('cm-add-check').style.display = canEdit ? 'flex' : 'none';

    document.getElementById('card-detail-modal').classList.add('open');
}

function closeCardModal() {
    document.getElementById('card-detail-modal')?.classList.remove('open');
    cardModalData = null;
}


async function saveCardModal() {
    if (!cardModalData) return;
    const { card } = cardModalData;

    const btn = document.getElementById('cm-save-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';

    const title = document.getElementById('cm-title').value.trim() || 'Sem título';
    const ytUrl = document.getElementById('cm-yt-url').value.trim();
    const notes = document.getElementById('cm-notes').value;
    const dueDate = document.getElementById('cm-due-date').value;
    const completed = document.getElementById('cm-completed').checked;
    const priority = document.querySelector('.cm-pri-btn.active')?.dataset.p || 'normal';

    
    const tags = [...document.querySelectorAll('.cm-tag')].map(t => t.dataset.tag);

    
    const checklist = [...document.querySelectorAll('.cm-check-item')].map(row => ({
        text: row.querySelector('.cm-check-text')?.value || '',
        done: row.querySelector('.cm-check-cb')?.checked || false,
    })).filter(c => c.text.trim());

    const meta = { ytUrl, notes, tags, priority, dueDate, checklist };
    const description = serializeCardMeta(meta);

    try {
        const { error } = await sb.from('cards').update({
            title,
            description,
            completed,
        }).eq('id', card.id);

        if (error) throw error;

        
        card.title = title;
        card.description = description;
        card.completed = completed;

        
        refreshCardInDOM(card);

        showBoardToast('Card salvo!');
        closeCardModal();
    } catch (err) {
        showBoardToast('Erro ao salvar: ' + err.message);
        console.error(err);
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Salvar';
    }
}


function refreshCardInDOM(card) {
    const cardEl = document.querySelector(`[data-card-id="${card.id}"]`);
    if (!cardEl) return;

    const meta = parseCardMeta(card.description);
    const thumb = meta.ytUrl ? getYouTubeThumbnail(meta.ytUrl) : getYouTubeThumbnail(card.title);

    
    const existingThumb = cardEl.querySelector('.card-thumb-area');
    if (existingThumb) existingThumb.remove();
    if (thumb) {
        const thumbArea = document.createElement('div');
        thumbArea.className = 'card-thumb-area';
        thumbArea.innerHTML = `<img src="${thumb}" alt="thumb" loading="lazy">`;
        cardEl.insertBefore(thumbArea, cardEl.firstChild);
    }

    
    const textSpan = cardEl.querySelector('.card-text');
    if (textSpan) textSpan.textContent = card.title;

    
    const existingTags = cardEl.querySelector('.card-tags-row');
    if (existingTags) existingTags.remove();
    if (meta.tags && meta.tags.length > 0) {
        const tagsRow = document.createElement('div');
        tagsRow.className = 'card-tags-row';
        tagsRow.innerHTML = meta.tags.map(t => `<span class="card-tag-chip">${escapeHtml(t)}</span>`).join('');
        cardEl.querySelector('.card-content').appendChild(tagsRow);
    }

    
    const existingDot = cardEl.querySelector('.card-priority-dot');
    if (existingDot) existingDot.remove();
    if (meta.priority && meta.priority !== 'normal') {
        const dot = document.createElement('div');
        dot.className = 'card-priority-dot';
        dot.style.background = PRIORITY_COLORS[meta.priority];
        dot.title = PRIORITY_LABELS[meta.priority];
        cardEl.querySelector('.card-content').prepend(dot);
    }

    
    const existingDate = cardEl.querySelector('.card-due');
    if (existingDate) existingDate.remove();
    if (meta.dueDate) {
        const dateEl = document.createElement('div');
        dateEl.className = 'card-due';
        const d = new Date(meta.dueDate + 'T12:00:00');
        const past = d < new Date();
        dateEl.classList.toggle('overdue', past);
        dateEl.innerHTML = `${uiIcon('calendar')} ${d.toLocaleDateString('pt-BR')}`;
        cardEl.querySelector('.card-content').appendChild(dateEl);
    }

    
    cardEl.classList.toggle('completed', !!card.completed);
    const completeBtn = cardEl.querySelector('.complete-card-btn');
    if (completeBtn) {
        completeBtn.innerHTML = card.completed ? uiIcon('refresh') : uiIcon('checkCircle');
        completeBtn.title = card.completed ? 'Desmarcar' : 'Concluir';
    }
}


function updateYtPreview(url) {
    const wrap = document.getElementById('cm-thumb-wrap');
    const img = document.getElementById('cm-thumb-img');
    const link = document.getElementById('cm-yt-link');
    const thumb = getYouTubeThumbnail(url);

    if (thumb) {
        img.src = thumb;
        link.href = url || '#';
        wrap.style.display = 'block';
    } else {
        wrap.style.display = 'none';
    }
}


function renderTagsInModal(tags) {
    const wrap = document.getElementById('cm-tags-wrap');
    wrap.innerHTML = tags.map(t => `
        <span class="cm-tag" data-tag="${escapeHtml(t)}">
            ${escapeHtml(t)}
            <button class="cm-tag-remove" data-tag="${escapeHtml(t)}">×</button>
        </span>
    `).join('');
    wrap.querySelectorAll('.cm-tag-remove').forEach(btn => {
        btn.addEventListener('click', () => btn.closest('.cm-tag').remove());
    });
}

function addTagFromInput() {
    const input = document.getElementById('cm-tag-input');
    const val = input.value.trim();
    if (!val) return;
    const existing = [...document.querySelectorAll('.cm-tag')].map(t => t.dataset.tag);
    if (existing.includes(val)) { input.value = ''; return; }
    const wrap = document.getElementById('cm-tags-wrap');
    const span = document.createElement('span');
    span.className = 'cm-tag';
    span.dataset.tag = val;
    span.innerHTML = `${escapeHtml(val)}<button class="cm-tag-remove" data-tag="${escapeHtml(val)}">×</button>`;
    span.querySelector('.cm-tag-remove').addEventListener('click', () => span.remove());
    wrap.appendChild(span);
    input.value = '';
}


function renderChecklistInModal(items, canEdit) {
    const container = document.getElementById('cm-checklist');
    container.innerHTML = '';
    items.forEach(item => addChecklistItem(item.text, item.done, canEdit));
}

function addChecklistItem(text, done = false, canEdit = true) {
    const container = document.getElementById('cm-checklist');
    const row = document.createElement('div');
    row.className = 'cm-check-item';
    row.innerHTML = `
        <input type="checkbox" class="cm-check-cb" ${done ? 'checked' : ''} ${!canEdit ? 'disabled' : ''}>
        <input type="text" class="cm-check-text cm-input" value="${escapeHtml(text)}" placeholder="Item…" ${!canEdit ? 'readonly' : ''} style="flex:1;">
        ${canEdit ? '<button class="cm-check-remove">×</button>' : ''}
    `;
    row.querySelector('.cm-check-remove')?.addEventListener('click', () => row.remove());
    container.appendChild(row);
}





async function loadUserRole() {
    try {
        const { data, error } = await sb.from('user_profiles').select('role').eq('id', window.currentUser.id).maybeSingle();
        if (!error && data) currentUserRole = data.role;
    } catch (e) { console.log('Erro role:', e); }
}

async function loadBoards() {
    try {
        const { data: userBoards, error: userError } = await sb
            .from('boards').select('*').eq('user_id', window.currentUser.id).order('created_at', { ascending: true });
        if (userError) throw userError;

        
        
        const { data: sameRoleUsers } = await sb
            .from('user_profiles')
            .select('id')
            .eq('role', currentUserRole)
            .neq('id', window.currentUser.id);

        const sameRoleIds = (sameRoleUsers || []).map(u => u.id);

        
        const { data: publicBoards } = sameRoleIds.length > 0
            ? await sb
                .from('boards')
                .select('*')
                .eq('is_public', true)
                .in('user_id', sameRoleIds)
            : { data: [] };

        let allBoards = [...(userBoards || [])];

        if (publicBoards && publicBoards.length > 0) {
            const authorIds = [...new Set(publicBoards.map(b => b.user_id))];
            const { data: profiles } = await sb.from('user_profiles').select('id, display_name, email').in('id', authorIds);
            const profileMap = new Map();
            if (profiles) profiles.forEach(p => profileMap.set(p.id, p));
            const publicWithInfo = publicBoards.map(board => ({
                ...board,
                is_shared: true,
                author_name: profileMap.get(board.user_id)?.display_name || profileMap.get(board.user_id)?.email?.split('@')[0] || 'Usuário'
            }));
            allBoards = [...allBoards, ...publicWithInfo];
        }

        if (allBoards.length === 0) {
            const { data: newBoard, error: createError } = await sb.from('boards').insert({ title: 'Meu Board', user_id: window.currentUser.id, is_public: false }).select().single();
            if (createError) throw createError;
            allBoards = [newBoard];
        }

        if (!currentBoardId || !allBoards.find(b => b.id === currentBoardId)) currentBoardId = allBoards[0].id;

        const currentBoard = allBoards.find(b => b.id === currentBoardId);
        const titleEl = document.getElementById('boardCurrentTitle');
        if (titleEl && currentBoard) titleEl.innerHTML = `${escapeHtml(currentBoard.title)}${currentBoard.is_shared ? ` ${uiIcon('share')}` : ''}`;

        renderBoardMenu(allBoards);
        await loadLists();
    } catch (error) {
        console.error('loadBoards error:', error);
        showBoardToast('Erro ao carregar boards');
    }
}

function renderBoardMenu(boards) {
    const menuEl = document.getElementById('boardMenu');
    if (!menuEl) return;
    menuEl.innerHTML = '';
    boards.forEach(board => {
        const item = document.createElement('div');
        item.className = 'board-item';
        const sharedIcon = board.is_shared ? `${uiIcon('share')} ` : '';
        const authorInfo = board.is_shared && board.author_name ? ` (${board.author_name})` : '';
        item.innerHTML = `${sharedIcon}${escapeHtml(board.title)}${escapeHtml(authorInfo)}`;
        item.onclick = async () => {
            currentBoardId = board.id;
            const titleEl = document.getElementById('boardCurrentTitle');
            if (titleEl) titleEl.innerHTML = `${escapeHtml(board.title)}${board.is_shared ? ` ${uiIcon('share')}` : ''}`;
            document.getElementById('boardDropdown')?.classList.remove('open');
            await loadLists();
        };
        menuEl.appendChild(item);
    });
}

async function loadLists() {
    if (!currentBoardId) return;
    const container = document.getElementById('boardContainer');
    if (!container) return;

    const { data: board } = await sb.from('boards').select('user_id').eq('id', currentBoardId).single();
    isOwner = board && board.user_id === window.currentUser.id;

    container.querySelectorAll('.list:not(.add-list)').forEach(l => l.remove());
    container.querySelector('.empty-board-message')?.remove();

    try {
        const { data: lists, error } = await sb.from('lists').select('*').eq('board_id', currentBoardId).order('position', { ascending: true });
        if (error) throw error;

        if (lists && lists.length > 0) {
            for (const list of lists) await renderList(list, isOwner);
        }

        const addListArea = container.querySelector('.add-list');
        if (addListArea) addListArea.style.display = isOwner ? 'flex' : 'none';

        if (!isOwner && (!lists || lists.length === 0)) {
            const div = document.createElement('div');
            div.className = 'empty-board-message';
            div.innerHTML = `${uiIcon('info')} Este board está vazio. Apenas o criador pode adicionar conteúdo.`;
            container.appendChild(div);
        }

        if (isOwner) setupListDragAndDrop();
    } catch (error) {
        console.error('loadLists error:', error);
        showBoardToast('Erro ao carregar listas');
    }
}

async function renderList(list, canEdit) {
    const container = document.getElementById('boardContainer');
    if (!container) return;

    const listDiv = document.createElement('div');
    listDiv.className = 'list';
    listDiv.setAttribute('data-list-id', list.id);
    listDiv.setAttribute('data-position', list.position);
    if (canEdit) listDiv.draggable = true;
    const displayTitle = cleanLegacyIconText(list.title);

    listDiv.innerHTML = `
        <div class="list-header">
            <span class="list-title">${escapeHtml(displayTitle)}</span>
            <div class="list-actions">
                ${canEdit ? `<button class="edit-list-btn" title="Editar lista">${uiIcon('edit')}</button>` : ''}
                ${canEdit ? `<button class="delete-list-btn" title="Excluir lista">${uiIcon('trash')}</button>` : ''}
            </div>
        </div>
        <div class="cards-container" data-list-id="${list.id}" data-list-title="${escapeHtml(displayTitle)}"></div>
        ${canEdit ? `
        <div class="new-card-area">
            <input type="text" class="new-card-input" placeholder="Novo card…">
            <button class="add-card-btn">+ Adicionar</button>
        </div>` : ''}
    `;

    await loadCards(list.id, listDiv.querySelector('.cards-container'), canEdit, displayTitle);

    if (canEdit) {
        
        listDiv.querySelector('.edit-list-btn').onclick = async () => {
            const titleSpan = listDiv.querySelector('.list-title');
            const newTitle = await boardPrompt('Editar lista', titleSpan.textContent, 'Nome da lista');
            if (newTitle && newTitle.trim()) {
                await updateListTitle(list.id, newTitle.trim(), titleSpan);
            }
        };
        listDiv.querySelector('.delete-list-btn').onclick = async () => {
            const ok = await boardConfirm('Excluir lista', `"${displayTitle}" e todos os seus cards serão removidos permanentemente.`);
            if (ok) {
                await sb.from('lists').delete().eq('id', list.id);
                await loadLists();
            }
        };
        const cardInput = listDiv.querySelector('.new-card-input');
        const addBtn = listDiv.querySelector('.add-card-btn');
        addBtn.onclick = async () => {
            const title = cardInput.value.trim();
            if (!title) return;
            const cardsContainer = listDiv.querySelector('.cards-container');
            const { data: newCard, error } = await sb.from('cards').insert({
                title, list_id: list.id, board_id: currentBoardId,
                user_id: window.currentUser.id, position: cardsContainer.children.length
            }).select().single();
            if (!error && newCard) {
                cardInput.value = '';
                renderCard(newCard, cardsContainer, canEdit, displayTitle);
                setupCardDragAndDrop(cardsContainer); 
            } else {
                showBoardToast('Erro ao criar card');
            }
        };
        cardInput.onkeypress = e => { if (e.key === 'Enter') addBtn.click(); };
        listDiv.addEventListener('dragstart', handleListDragStart);
        listDiv.addEventListener('dragend', handleListDragEnd);
    }

    container.insertBefore(listDiv, container.querySelector('.add-list'));
}

async function updateListTitle(listId, newTitle, titleSpan) {
    const { error } = await sb.from('lists').update({ title: newTitle }).eq('id', listId);
    if (!error && titleSpan) { titleSpan.textContent = newTitle; showBoardToast('Lista renomeada!'); }
}
async function loadCards(listId, container, canEdit, listTitle) {
    try {
        const { data: cards, error } = await sb.from('cards').select('*').eq('list_id', listId).order('position', { ascending: true });
        if (error) throw error;
        container.innerHTML = '';
        if (cards && cards.length > 0) {
            for (const card of cards) renderCard(card, container, canEdit, listTitle);
        }
        if (canEdit) setupCardDragAndDrop(container); 
    } catch (e) { console.error('loadCards error:', e); }
}





function renderCard(card, container, canEdit, listTitle) {
    const cardDiv = document.createElement('div');
    cardDiv.className = 'board-card' + (card.completed ? ' completed' : '');
    cardDiv.setAttribute('data-card-id', card.id);
    cardDiv.setAttribute('data-list-id', card.list_id);
    cardDiv.setAttribute('data-position', card.position);
    if (canEdit) cardDiv.draggable = true;

    const meta = parseCardMeta(card.description);
    
    const ytUrlFinal = meta.ytUrl || '';
    const thumb = ytUrlFinal ? getYouTubeThumbnail(ytUrlFinal) : getYouTubeThumbnail(card.title);

    const tagsHtml = (meta.tags && meta.tags.length > 0)
        ? `<div class="card-tags-row">${meta.tags.map(t => `<span class="card-tag-chip">${escapeHtml(t)}</span>`).join('')}</div>`
        : '';

    const priorityDot = (meta.priority && meta.priority !== 'normal')
        ? `<div class="card-priority-dot" style="background:${PRIORITY_COLORS[meta.priority]};" title="${PRIORITY_LABELS[meta.priority]}"></div>`
        : '';

    const dueDateHtml = meta.dueDate ? (() => {
        const d = new Date(meta.dueDate + 'T12:00:00');
        const past = d < new Date();
        return `<div class="card-due${past ? ' overdue' : ''}">${uiIcon('calendar')} ${d.toLocaleDateString('pt-BR')}</div>`;
    })() : '';

    const checklistTotal = (meta.checklist || []).length;
    const checklistDone = (meta.checklist || []).filter(c => c.done).length;
    const checklistHtml = checklistTotal > 0
        ? `<div class="card-checklist-bar" title="${checklistDone}/${checklistTotal} concluídos">
             <div class="card-checklist-fill" style="width:${Math.round(checklistDone / checklistTotal * 100)}%"></div>
           </div>
           <div class="card-checklist-count">${checklistDone}/${checklistTotal}</div>`
        : '';

    const notesHtml = (meta.notes && meta.notes.trim())
        ? `<div class="card-notes-preview">${uiIcon('note')} ${escapeHtml(meta.notes.slice(0, 60))}${meta.notes.length > 60 ? '…' : ''}</div>`
        : '';

    cardDiv.innerHTML = `
        ${thumb ? `<div class="card-thumb-area"><img src="${thumb}" alt="thumb" loading="lazy"></div>` : ''}
        <div class="card-content">
            ${priorityDot}
            <span class="card-text">${escapeHtml(card.title || 'Sem título')}</span>
            ${tagsHtml}
            ${notesHtml}
            ${dueDateHtml}
            ${checklistHtml}
        </div>
        <div class="card-actions">
            <button class="complete-card-btn" title="${card.completed ? 'Desmarcar' : 'Concluir'}">${card.completed ? uiIcon('refresh') : uiIcon('checkCircle')}</button>
            <button class="open-card-btn" title="Abrir card">⊞</button>
        </div>
    `;

    
    cardDiv.querySelector('.complete-card-btn').onclick = async (e) => {
        e.stopPropagation();
        const newState = !card.completed;
        cardDiv.classList.toggle('completed', newState);
        cardDiv.querySelector('.complete-card-btn').innerHTML = newState ? uiIcon('refresh') : uiIcon('checkCircle');
        await sb.from('cards').update({ completed: newState }).eq('id', card.id);
        card.completed = newState;
    };

    
    const openFn = (e) => {
        e.stopPropagation();
        openCardModal(card, canEdit, listTitle);
    };
    cardDiv.querySelector('.open-card-btn').onclick = openFn;
    
    cardDiv.querySelector('.card-content').addEventListener('click', openFn);

    
    if (canEdit) {
        cardDiv.addEventListener('dragstart', handleCardDragStart);
        cardDiv.addEventListener('dragend', handleCardDragEnd);
    }

    container.appendChild(cardDiv);
}





let draggedCard = null;
let draggedList = null;

function handleCardDragStart(e) {
    e.stopPropagation();
    draggedCard = this;
    e.dataTransfer.setData('text/plain', this.getAttribute('data-card-id'));
    this.style.opacity = '0.5';
}
function handleCardDragEnd(e) {
    e.stopPropagation();
    if (draggedCard) { draggedCard.style.opacity = ''; draggedCard = null; }
    document.querySelectorAll('.cards-container').forEach(c => c.classList.remove('drag-over'));
}

function setupCardDragAndDrop(container) {
    container.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (!draggedCard) return;
        container.classList.add('drag-over');
        const after = getDragAfterElement(container, e.clientY);
        if (after == null) container.appendChild(draggedCard);
        else container.insertBefore(draggedCard, after);
    });
    container.addEventListener('dragleave', () => container.classList.remove('drag-over'));
    container.addEventListener('drop', async (e) => {
        e.preventDefault();
        container.classList.remove('drag-over');
        if (!draggedCard) return;
        const newListId = container.getAttribute('data-list-id');
        const oldListId = draggedCard.getAttribute('data-list-id');
        const cardId = draggedCard.getAttribute('data-card-id');
        if (newListId !== oldListId) {
            await sb.from('cards').update({ list_id: newListId, position: container.querySelectorAll('.board-card').length - 1 }).eq('id', cardId);
            draggedCard.setAttribute('data-list-id', newListId);
        }
        await reorderCards(container);
        if (oldListId !== newListId) {
            const old = document.querySelector(`.cards-container[data-list-id="${oldListId}"]`);
            if (old) await reorderCards(old);
        }
    });
}

function getDragAfterElement(container, y) {
    const elements = [...container.querySelectorAll('.board-card:not([style*="0.5"])')];
    return elements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        return (offset < 0 && offset > closest.offset) ? { offset, element: child } : closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

async function reorderCards(container) {
    const cards = [...container.querySelectorAll('.board-card')];
    for (let i = 0; i < cards.length; i++) {
        const id = cards[i].getAttribute('data-card-id');
        await sb.from('cards').update({ position: i }).eq('id', id);
        cards[i].setAttribute('data-position', i);
    }
}

function handleListDragStart(e) {
    draggedList = this;
    e.dataTransfer.setData('text/plain', this.getAttribute('data-list-id'));
    this.style.opacity = '0.5';
}
function handleListDragEnd() {
    if (draggedList) { draggedList.style.opacity = ''; draggedList = null; }
}

function setupListDragAndDrop() {
    const bc = document.getElementById('boardContainer');
    bc.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (!draggedList) return;
        const after = getListDragAfterElement(bc, e.clientX);
        const addList = bc.querySelector('.add-list');
        if (after == null) bc.insertBefore(draggedList, addList);
        else bc.insertBefore(draggedList, after);
    });
    bc.addEventListener('drop', async (e) => {
        e.preventDefault();
        if (!draggedList) return;
        await reorderLists();
    });
}

function getListDragAfterElement(container, x) {
    const elements = [...container.querySelectorAll('.list:not(.add-list)')].filter(el => el.style.opacity !== '0.5');
    return elements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = x - box.left - box.width / 2;
        return (offset < 0 && offset > closest.offset) ? { offset, element: child } : closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

async function reorderLists() {
    const lists = document.querySelectorAll('#boardContainer .list:not(.add-list)');
    for (let i = 0; i < lists.length; i++) {
        const id = lists[i].getAttribute('data-list-id');
        await sb.from('lists').update({ position: i }).eq('id', id);
        lists[i].setAttribute('data-position', i);
    }
    showBoardToast('Listas reorganizadas!');
}





const canShare = !!currentUserRole; 

function openShareModal(board) {
    if (!(window.userPlan?.can_share)) {
        openUpgradeModal('share');
        return;
    }
    const modal = document.getElementById('board-share-modal');
    const titleEl = document.getElementById('bsm-title');
    const icon = document.getElementById('bsm-status-icon');
    const statusT = document.getElementById('bsm-status-title');
    const statusD = document.getElementById('bsm-status-desc');
    const rolesList = document.getElementById('bsm-roles-list');
    const noPerm = document.getElementById('bsm-no-permission');
    const toggleBtn = document.getElementById('bsm-toggle-btn');
    const toggleLbl = document.getElementById('bsm-toggle-label');

    const isPublic = !!board.is_public;
    const canShare = !!currentUserRole;

    
    titleEl.textContent = escapeHtml(board.title);

    
    icon.innerHTML = isPublic ? uiIcon('share') : uiIcon('lock');
    statusT.textContent = isPublic ? 'Público' : 'Privado';
    statusD.textContent = isPublic
        ? 'Qualquer membro com o mesmo perfil pode ver este board.'
        : 'Apenas você pode ver este board.';

    
    rolesList.innerHTML = '';
    const viewers = isPublic
        ? [currentUserRole] 
        : ['Somente você'];

    viewers.forEach(r => {
        const chip = document.createElement('div');
        chip.style.cssText = `
            display:flex;align-items:center;gap:10px;
            background:var(--panel2);border:1px solid var(--border);
            border-radius:8px;padding:10px 14px;
            font-family:var(--font-body);font-size:.8rem;color:var(--text);
        `;
        chip.innerHTML = `
            <span style="font-size:1rem;">${r === 'Somente você' ? uiIcon('user') : uiIcon('users')}</span>
            <span>${escapeHtml(r.charAt(0).toUpperCase() + r.slice(1))}</span>
        `;
        rolesList.appendChild(chip);
    });

    
    noPerm.style.display = canShare ? 'none' : 'block';
    toggleBtn.style.display = canShare ? 'flex' : 'none';

    if (canShare) {
        toggleLbl.textContent = isPublic ? 'Tornar Privado' : 'Tornar Público';

        
        const newBtn = toggleBtn.cloneNode(true);
        toggleBtn.parentNode.replaceChild(newBtn, toggleBtn);

        document.getElementById('bsm-toggle-btn').addEventListener('click', async () => {
            const btn = document.getElementById('bsm-toggle-btn');
            btn.disabled = true;

            const { error } = await sb.from('boards')
                .update({ is_public: !isPublic })
                .eq('id', board.id);

            if (!error) {
                showBoardToast(isPublic ? 'Board agora é PRIVADO!' : 'Board agora é PÚBLICO!');
                closeShareModal();
                await loadBoards();
            } else {
                showBoardToast('Erro ao atualizar visibilidade');
                btn.disabled = false;
            }
        });
    }

    modal.classList.add('open');
}

function closeShareModal() {
    document.getElementById('board-share-modal')?.classList.remove('open');
}





function setupEvents() {
    
    document.getElementById('board-new-board-btn')?.addEventListener('click', async () => {
        const maxBoards = window.userPlan?.max_boards ?? 1;
        const { count } = await sb.from('boards').select('*', { count: 'exact', head: true }).eq('user_id', window.currentUser.id);

        if (maxBoards !== -1 && count >= maxBoards) {
            if (typeof openUpgradeModal === 'function') openUpgradeModal('boards');
            return;
        }

        
        const title = await boardPrompt('Nome do novo board', 'Novo Board', 'Digite o nome do board...');
        if (title) {
            const { error } = await sb.from('boards').insert({ title, user_id: window.currentUser.id, is_public: false });
            if (!error) {
                await loadBoards();
                showBoardToast('Board criado!');
            } else showBoardToast('Erro ao criar board');
        }
    });

    document.getElementById('boardRenameBtn')?.addEventListener('click', async () => {
        if (!currentBoardId) return;
        const currentBoard = await sb.from('boards').select('title').eq('id', currentBoardId).single();
        const newTitle = await boardPrompt('Renomear board', currentBoard.data?.title || '', 'Novo nome do board');
        if (newTitle) {
            await sb.from('boards').update({ title: newTitle }).eq('id', currentBoardId);
            await loadBoards();
            showBoardToast('Board renomeado!');
        }
    });

    document.getElementById('boardDeleteBtn')?.addEventListener('click', async () => {
        if (!currentBoardId) return;
        const ok = await boardConfirm('Excluir board', 'Este board e todo o seu conteúdo serão removidos permanentemente.');
        if (ok) {
            await sb.from('boards').delete().eq('id', currentBoardId);
            currentBoardId = null;
            await loadBoards();
            showBoardToast('Board excluído!');
        }
    });

    document.getElementById('boardShareBtn')?.addEventListener('click', async () => {
        if (!currentBoardId) return;
        const { data: board, error } = await sb
            .from('boards')
            .select('id, title, is_public')
            .eq('id', currentBoardId)
            .single();
        if (error || !board) { showBoardToast('Erro ao carregar board'); return; }
        openShareModal(board);
    });

    document.getElementById('boardRefreshBtn')?.addEventListener('click', async () => { await loadLists(); showBoardToast('Board atualizado!'); });

    document.getElementById('createListBtn')?.addEventListener('click', async () => {
        if (!isOwner) { showBoardToast('Apenas o dono do board pode criar listas'); return; }
        const input = document.getElementById('newListTitle');
        const title = input?.value.trim();
        if (!title || !currentBoardId) { showBoardToast('Digite um nome para a lista'); return; }
        const listsCount = document.querySelectorAll('#boardContainer .list:not(.add-list)').length;
        const { error } = await sb.from('lists').insert({ title, board_id: currentBoardId, user_id: window.currentUser.id, position: listsCount });
        if (!error) { if (input) input.value = ''; await loadLists(); showBoardToast('Lista criada!'); }
        else showBoardToast('Erro ao criar lista');
    });

    document.getElementById('boardCurrent')?.addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('boardDropdown')?.classList.toggle('open');
    });

    document.addEventListener('click', () => document.getElementById('boardDropdown')?.classList.remove('open'));
    document.getElementById('bsm-close-btn')?.addEventListener('click', closeShareModal);
    document.getElementById('bsm-cancel-btn')?.addEventListener('click', closeShareModal);
    document.getElementById('board-share-modal')?.addEventListener('click', e => {
        if (e.target === document.getElementById('board-share-modal')) closeShareModal();
    });

    
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeCardModal();
    });
}





function showBoardToast(msg) {
    if (typeof showToast === 'function') { showToast(msg); return; }
    const toast = document.getElementById('toast');
    if (toast) {
        toast.textContent = msg;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2200);
    }
}
