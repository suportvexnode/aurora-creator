



let projects = [];
let currentProjectId = null;
let activeStepId = null;
let autoSaveTimeout = null;
let dashboardLoading = false;
let publicProjectView = null;

function isProjectReadOnly() { return publicProjectView !== null; }

function getActiveProject() {
    return publicProjectView || getProject(currentProjectId);
}

function getProject(id) {
    return projects.find(p => p.id === id);
}

function setAutosaveBadge(state) {
    const el = document.getElementById('autosave-badge');
    if (isProjectReadOnly()) {
        el.textContent = 'Somente leitura';
        el.classList.remove('saved');
        return;
    }
    if (state === 'saved') {
        el.innerHTML = `${uiIcon('check')} salvo`;
        el.classList.add('saved');
    } else {
        el.textContent = '…';
        el.classList.remove('saved');
    }
}

function updateWordCount() {
    const text = document.getElementById('script-textarea').value;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    document.getElementById('word-count').textContent = words;
    document.getElementById('char-count').textContent = text.length;
}





let pendingConfirmResolve = null;

function ensureConfirmModal() {
    let modal = document.getElementById('roteiro-confirm-modal');

    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'roteiro-confirm-modal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
        <div class="modal" style="max-width:420px;text-align:center;">
            <div class="modal-header" style="justify-content:flex-end;padding-bottom:8px;">
                <button class="modal-close" id="rcm-close-btn">
                    <svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
            <div style="padding:0 32px 32px;display:flex;flex-direction:column;align-items:center;gap:16px;">
                <div id="rcm-icon" style="font-size:2.5rem;">${uiIcon('warning')}</div>
                <div id="rcm-title" style="font-family:var(--font-display);font-size:1.4rem;letter-spacing:2px;color:var(--text);"></div>
                <div id="rcm-desc" style="font-family:var(--font-body);font-size:.85rem;color:var(--muted);line-height:1.6;white-space:pre-line;"></div>
                <div style="display:flex;gap:12px;margin-top:8px;">
                    <button class="action-btn" id="rcm-cancel-btn" style="min-width:100px;">Cancelar</button>
                    <button class="action-btn primary" id="rcm-confirm-btn" style="background:var(--red);border-color:var(--red);min-width:100px;">Excluir</button>
                </div>
            </div>
        </div>`;
        document.body.appendChild(modal);

        
        const closeModal = () => {
            modal.classList.remove('open');
            if (pendingConfirmResolve) {
                pendingConfirmResolve(false);
                pendingConfirmResolve = null;
            }
        };

        document.getElementById('rcm-close-btn').addEventListener('click', closeModal);
        document.getElementById('rcm-cancel-btn').addEventListener('click', closeModal);

        document.getElementById('rcm-confirm-btn').addEventListener('click', () => {
            modal.classList.remove('open');
            if (pendingConfirmResolve) {
                pendingConfirmResolve(true);
                pendingConfirmResolve = null;
            }
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    }

    return modal;
}

function roteiroConfirm(title, message, icon = 'warning') {
    return new Promise((resolve) => {
        
        const modal = ensureConfirmModal();

        
        const iconEl = document.getElementById('rcm-icon');
        const titleEl = document.getElementById('rcm-title');
        const descEl = document.getElementById('rcm-desc');

        if (iconEl) iconEl.innerHTML = uiIcon(icon);
        if (titleEl) titleEl.textContent = title;
        if (descEl) descEl.textContent = message;

        
        pendingConfirmResolve = resolve;

        
        modal.classList.add('open');
    });
}




async function loadProjectsFromDB() {
    const { data, error } = await withTimeout(
        sb.from('vexarco_projects')
            .select('*')
            .eq('user_id', window.currentUser.id)
            .order('updated_at', { ascending: false })
    );
    if (error) throw error;
    projects = (data || []).map(dbToLocal);
}

async function loadPublicProjects() {
    if (!canAccessTab('roteiros')) return;
    try {
        const authorIds = await sameRoleUserIds();
        if (!authorIds.length) { renderPublicProjects([]); return; }
        const { data: pubs, error } = await withTimeout(
            sb.from('vexarco_projects')
                .select('*')
                .eq('visibility', 'public')
                .in('user_id', authorIds)
                .neq('user_id', window.currentUser.id)
                .order('updated_at', { ascending: false })
        );
        if (error) throw error;

        if (!pubs || !pubs.length) {
            renderPublicProjects([]);
            return;
        }

        const uniqueIds = [...new Set(pubs.map(p => p.user_id))];
        const { data: profiles } = await withTimeout(
            sb.from('user_profiles')
                .select('id, email, display_name')
                .in('id', uniqueIds)
        );

        const profileMap = new Map((profiles || []).map(p => [p.id, p]));
        const projectsWithAuthor = pubs.map(proj => ({
            ...proj,
            author_name: profileMap.get(proj.user_id)?.display_name ||
                profileMap.get(proj.user_id)?.email?.split('@')[0] ||
                'Autor desconhecido'
        }));

        renderPublicProjects(projectsWithAuthor);
    } catch (err) {
        renderPublicProjects([]);
    }
}

async function saveProjectToDB(p) {
    if (isProjectReadOnly()) return;
    if (!window.currentUser) return;
    try {
        const { error } = await withTimeout(
            sb.from('vexarco_projects').upsert({
                id: p.id,
                user_id: window.currentUser.id,
                name: p.name,
                script: p.script,
                notes: p.notes,
                done: p.done,
                updated_at: new Date().toISOString()
            }, { onConflict: 'id' }),
            10000
        );
        if (error) throw error;
    } catch (err) {
        showToast(err.message === 'TIMEOUT' ? 'Timeout ao salvar.' : 'Erro ao salvar.');
    }
}

async function deleteProjectFromDB(id) {
    try {
        const { error } = await withTimeout(
            sb.from('vexarco_projects')
                .delete()
                .eq('id', id)
                .eq('user_id', window.currentUser.id)
        );
        if (error) throw error;
    } catch {
        showToast('Erro ao excluir.');
    }
}




async function createProject(name) {
    const maxProjects = window.userPlan?.max_projects ?? 3;

    if (maxProjects !== -1) {
        
        const { count, error } = await sb
            .from('vexarco_projects')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', window.currentUser.id);

        if (!error && count >= maxProjects) {
            openUpgradeModal('projects');
            return null;
        }
    }

    const p = {
        id: crypto.randomUUID(),
        name: name || 'Sem título',
        script: '',
        notes: {},
        done: {},
        visibility: 'private',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    projects.unshift(p);
    await saveProjectToDB(p);
    return p;
}


async function deleteProject(id) {
    const p = getProject(id);
    if (!p) return;

    
    const confirmed = await roteiroConfirm(
        'Excluir projeto',
        `Tem certeza que deseja excluir "${p.name}"?\n\nTodas as anotações e o roteiro serão removidos permanentemente.`,
        'trash'
    );

    if (confirmed) {
        projects = projects.filter(p => p.id !== id);
        await deleteProjectFromDB(id);
        showToast('Projeto excluído.');
        return true;
    }
    return false;
}

async function duplicateProject(id) {
    const p = getProject(id);
    if (!p) return;
    const copy = {
        ...JSON.parse(JSON.stringify(p)),
        id: crypto.randomUUID(),
        name: `${p.name} (cópia)`,
        visibility: 'private',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    projects.unshift(copy);
    await saveProjectToDB(copy);
    await renderDashboard();
    showToast('Projeto duplicado!');
}

function exportProjectTxt(id) {
    const p = getProject(id);
    if (!p) return;
    const text = p.script?.trim() || STEPS.filter(s => p.notes?.[s.id]?.trim())
        .map(s => `## ${s.id}. ${s.name}\n\n${p.notes[s.id]}`)
        .join('\n\n');
    if (!text) {
        showToast('Projeto sem conteúdo!');
        return;
    }
    const a = Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' })),
        download: `${p.name || 'roteiro'}.txt`
    });
    a.click();
    showToast('Exportado!');
}




async function saveProject(silent) {
    if (isProjectReadOnly()) return;
    const p = getProject(currentProjectId);
    if (!p) return;
    p.name = document.getElementById('project-name-input').value || 'Sem título';
    p.script = document.getElementById('script-textarea').value;
    p.updatedAt = new Date().toISOString();
    await saveProjectToDB(p);
    setAutosaveBadge('saved');
    if (!silent) showToast('Projeto salvo!');
}

function scheduleAutoSave() {
    if (isProjectReadOnly()) return;
    setAutosaveBadge('');
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(async () => {
        await saveProject(true);
        setAutosaveBadge('saved');
    }, 1400);
}

function generateScript() {
    if (isProjectReadOnly()) return;
    const p = getProject(currentProjectId);
    if (!p) return;
    let result = `# ${p.name || 'MEU ROTEIRO'}\n\n`;
    STEPS.forEach(step => {
        if (p.notes[step.id]?.trim()) {
            result += `## ${step.id}. ${step.name.toUpperCase()}\n\n${p.notes[step.id].trim()}\n\n`;
        }
    });
    if (result.trim() === `# ${p.name || 'MEU ROTEIRO'}`) {
        showToast('Adicione notas nas etapas primeiro!');
        return;
    }
    document.getElementById('script-textarea').value = result.trim();
    updateWordCount();
    scheduleAutoSave();
    showToast('Roteiro gerado com sucesso!');
}

function exportScript() {
    const p = getProject(currentProjectId);
    if (!p) return;
    const text = document.getElementById('script-textarea').value;
    if (!text.trim()) {
        showToast('Roteiro vazio!');
        return;
    }
    const a = Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' })),
        download: `${p.name || 'roteiro'}.txt`
    });
    a.click();
    showToast('Exportado!');
}




function buildCycleSVG() {
    const container = document.getElementById('cycle-container');
    if (!container) return;
    container.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:relative;width:100%;margin:0 auto;';

    const circleGrid = document.createElement('div');
    circleGrid.style.cssText = 'position:relative;width:100%;padding-bottom:100%;background:radial-gradient(circle at center, rgba(169, 150, 224, .12) 0%, transparent 70%);border-radius:50%;';

    STEPS.forEach((step, index) => {
        const angle = (index * 360 / STEPS.length) - 90;
        const radians = (angle * Math.PI) / 180;
        const radius = 42;
        const x = 50 + radius * Math.cos(radians);
        const y = 50 + radius * Math.sin(radians);

        const stepEl = document.createElement('div');
        stepEl.className = 'cycle-step-item';
        stepEl.dataset.stepId = step.id;
        stepEl.style.cssText = `position:absolute;left:${x}%;top:${y}%;transform:translate(-50%,-50%);width:70px;height:70px;`;
        stepEl.innerHTML = `<div style="font-size:18px;font-weight:bold;color:var(--panel-purple, #a996e0);">${step.id}</div><div style="font-size:8px;text-align:center;color:#d8d7da;margin-top:4px;max-width:60px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${step.name.substring(0, 12)}</div>`;
        stepEl.addEventListener('click', () => openStepModal(step.id));
        circleGrid.appendChild(stepEl);
    });

    const center = document.createElement('div');
    center.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:100px;height:100px;background:#16111f;border:2px solid var(--panel-purple, #a996e0);border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:20;box-shadow:0 0 24px rgba(169, 150, 224, .28);';
    center.innerHTML = `<div style="font-family:\'Bebas Neue\',sans-serif;font-size:20px;color:#f0eff0;">ARCO</div><div style="font-family:\'JetBrains Mono\',monospace;font-size:8px;color:var(--panel-purple, #a996e0);letter-spacing:2px;">narrativo</div>`;
    circleGrid.appendChild(center);

    wrapper.appendChild(circleGrid);
    container.appendChild(wrapper);
}

function refreshCycleState() {
    const p = getActiveProject();
    if (!p) return;

    STEPS.forEach(step => {
        const stepEl = document.querySelector(`.cycle-step-item[data-step-id="${step.id}"]`);
        const listItem = document.querySelector(`.step-item[data-step-id="${step.id}"]`);
        const isDone = p.done[step.id];
        const isActive = activeStepId === step.id;

        if (stepEl) {
            stepEl.classList.toggle('done', !!isDone);
            stepEl.classList.toggle('active', isActive);
        }
        if (listItem) {
            listItem.classList.toggle('done', !!isDone);
            listItem.classList.toggle('active', isActive);
            const dot = listItem.querySelector('.step-has-notes');
            if (dot) dot.style.display = (p.notes[step.id]?.trim()) ? 'block' : 'none';
        }
    });
}

function buildStepsList() {
    const container = document.getElementById('steps-list');
    container.innerHTML = '';
    STEPS.forEach(step => {
        const div = document.createElement('div');
        div.className = 'step-item';
        div.dataset.stepId = step.id;
        div.innerHTML = `<div class="step-num">${String(step.id).padStart(2, '0')}</div><div class="step-name">${step.name}</div><div class="step-has-notes" style="display:none"></div>`;
        div.addEventListener('click', () => openStepModal(step.id));
        container.appendChild(div);
    });
}




function openStepModal(stepId) {
    const step = STEPS.find(s => s.id === stepId);
    if (!step) return;
    const p = getActiveProject();
    if (!p) return;
    activeStepId = stepId;
    refreshCycleState();

    document.getElementById('modal-step-num').textContent = `ETAPA ${String(step.id).padStart(2, '0')} / 12`;
    document.getElementById('modal-step-name').textContent = step.name.toUpperCase();
    document.getElementById('modal-guide').textContent = step.guide;
    document.getElementById('modal-notes').value = p?.notes?.[stepId] || '';
    document.getElementById('modal-done-check').checked = !!(p?.done?.[stepId]);
    const readOnly = isProjectReadOnly();
    document.getElementById('modal-notes').readOnly = readOnly;
    document.getElementById('modal-notes').placeholder = readOnly ? 'Nenhuma anotação nesta etapa.' : 'Suas anotações para esta etapa…';
    document.getElementById('modal-done-check').disabled = readOnly;
    document.getElementById('modal-save-btn').style.display = readOnly ? 'none' : '';
    document.getElementById('modal-done-text').textContent = readOnly
        ? (p.done?.[stepId] ? 'Etapa concluída' : 'Etapa não concluída') : 'Marcar como concluída';

    document.getElementById('step-modal').classList.add('open');
    setTimeout(() => document.getElementById('modal-notes').focus(), 250);
}

function closeStepModal() {
    saveStepNote(true);
    document.getElementById('step-modal').classList.remove('open');
    activeStepId = null;
    refreshCycleState();
}

function saveStepNote(silent) {
    if (isProjectReadOnly()) return;
    if (!activeStepId) return;
    const p = getProject(currentProjectId);
    if (!p) return;
    p.notes[activeStepId] = document.getElementById('modal-notes').value;
    p.done[activeStepId] = document.getElementById('modal-done-check').checked;
    p.updatedAt = new Date().toISOString();
    refreshCycleState();
    scheduleAutoSave();
    if (!silent) {
        document.getElementById('step-modal').classList.remove('open');
        activeStepId = null;
        refreshCycleState();
        showToast('Nota salva!');
    }
}




async function openEditor(projectId) {
    const p = getProject(projectId);
    if (!p) return;
    await leaveProjectEditor();
    showProjectEditor(p);
}

// Public projects are kept separate from the editable project collection.
async function openPublicProject(project) {
    if (!canAccessTab('roteiros')) return;
    await leaveProjectEditor();
    showProjectEditor(dbToLocal(project), project.author_name || 'Autor');
}

async function leaveProjectEditor() {
    if (activeStepId) closeStepModal();
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = null;
    if (currentProjectId && !isProjectReadOnly()) await saveProject(true);
    document.getElementById('step-modal').classList.remove('open');
    activeStepId = null;
}

function showProjectEditor(p, author = null) {
    publicProjectView = author === null ? null : p;
    currentProjectId = p.id;
    const readOnly = isProjectReadOnly();
    document.getElementById('editor').classList.toggle('is-readonly', readOnly);
    document.getElementById('project-name-input').readOnly = readOnly;
    document.getElementById('script-textarea').readOnly = readOnly;
    const authorLabel = document.getElementById('project-viewer-author');
    authorLabel.textContent = readOnly ? `Por ${author}` : '';
    authorLabel.style.display = readOnly ? '' : 'none';
    ['generate-script-btn', 'save-project-btn', 'export-btn', 'share-project-btn'].forEach(id => {
        document.getElementById(id).style.display = readOnly ? 'none' : '';
    });

    document.getElementById('project-name-input').value = p.name;
    document.getElementById('script-textarea').value = p.script || '';

    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('editor').style.display = 'block';

    buildStepsList();
    buildCycleSVG();
    refreshCycleState();
    setAutosaveBadge('saved');

    
    if (typeof initScriptEditor === 'function') {
        initScriptEditor();
    }
}

async function goToDashboard() {
    if (window.isSharedLinkView) { window.location.assign('/painel/'); return; }
    await leaveProjectEditor();
    currentProjectId = null;
    publicProjectView = null;
    activeStepId = null;
    document.getElementById('editor').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
    await renderDashboard();
}




async function renderDashboard() {
    if (!canAccessTab('roteiros')) return;
    if (dashboardLoading) return;
    dashboardLoading = true;

    const container = document.getElementById('projects-container');
    container.innerHTML = '<div class="loading-state"><span class="spinner"></span> Carregando projetos…</div>';

    try {
        await loadProjectsFromDB();
    } catch (err) {
        dashboardLoading = false;
        container.innerHTML = `
            <div class="projects-empty">
                <h3>${err.message === 'TIMEOUT' ? 'Tempo esgotado' : 'Erro de conexão'}</h3>
                <p>${err.message === 'TIMEOUT' ? 'O servidor demorou demais.' : 'Não foi possível carregar.'}</p>
                <button class="btn-new" style="margin:20px auto 0;display:flex;" id="retry-btn">Tentar novamente</button>
            </div>`;
        document.getElementById('retry-btn')?.addEventListener('click', () => {
            dashboardLoading = false;
            renderDashboard();
        });
        return;
    }

    dashboardLoading = false;

    const maxProjects = window.userPlan?.max_projects ?? 3;
    const canSeeAll = maxProjects === -1;
    const visibleProjects = canSeeAll ? projects : projects.slice(0, maxProjects);
    const hasMore = !canSeeAll && projects.length > maxProjects;

    if (!projects.length) {
        container.innerHTML = `
            <div class="projects-empty">
                <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
                <h3>Nenhum projeto</h3>
                <p>Clique em "Novo Projeto" para começar.</p>
            </div>`;
    } else {
        container.innerHTML = '';
        const grid = document.createElement('div');
        grid.className = 'projects-grid';

        visibleProjects.forEach(p => {
            const doneCount = STEPS.filter(s => p.done?.[s.id]).length;
            const noteCount = STEPS.filter(s => p.notes?.[s.id]?.trim()).length;
            const updated = new Date(p.updatedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
            const visBadge = p.visibility === 'public'
                ? `<span class="public-badge">
                        <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                        </svg>
                        Público
                   </span>`
                : '';

            const card = document.createElement('div');
            card.className = 'project-card';
            card.innerHTML = `
                <div class="card-title">${escapeHtml(p.name) || 'Sem título'}${visBadge}</div>
                <div class="card-meta">Atualizado em ${updated} · ${noteCount} etapas anotadas</div>
                <div class="card-progress">
                    ${STEPS.map(s => `<div class="prog-dot ${p.done?.[s.id] ? 'done' : ''}"></div>`).join('')}
                </div>
                <div style="font-family:JetBrains Mono,monospace;font-size:0.6rem;color:#5a5a6a;margin-bottom:12px;">
                    ${doneCount}/12 etapas concluídas
                </div>
                <div class="card-actions">
                    <button class="card-btn" data-action="duplicate" data-id="${p.id}">Duplicar</button>
                    <button class="card-btn" data-action="export" data-id="${p.id}">Exportar</button>
                    <button class="card-btn danger" data-action="delete" data-id="${p.id}">Excluir</button>
                </div>`;

            card.addEventListener('click', (e) => {
                if (!e.target.classList.contains('card-btn')) openEditor(p.id);
            });

            grid.appendChild(card);
        });

        
        if (hasMore) {
            const lockCard = document.createElement('div');
            lockCard.className = 'project-card';
            lockCard.style.cssText = `
                display:flex;flex-direction:column;align-items:center;
                justify-content:center;text-align:center;
                opacity:.75;cursor:pointer;border-style:dashed;
                min-height:160px;gap:8px;
            `;
            lockCard.innerHTML = `
                <div style="font-size:1.8rem;">${uiIcon('lock')}</div>
                <div style="
                    font-family:var(--font-ui);
                    font-size:.6rem;
                    letter-spacing:2px;
                    text-transform:uppercase;
                    color:var(--muted);
                ">Plano limitado</div>
                <div style="font-family:var(--font-body);font-size:.8rem;color:var(--text);">
                    ${projects.length - maxProjects} projeto${projects.length - maxProjects !== 1 ? 's' : ''} bloqueado${projects.length - maxProjects !== 1 ? 's' : ''}
                </div>
                <button class="action-btn primary" style="margin-top:4px;">Ver planos</button>
            `;
            lockCard.addEventListener('click', () => openUpgradeModal('projects'));
            grid.appendChild(lockCard);
        }

        container.appendChild(grid);

        document.querySelectorAll('[data-action="duplicate"]').forEach(btn =>
            btn.addEventListener('click', e => { e.stopPropagation(); duplicateProject(btn.dataset.id); }));
        document.querySelectorAll('[data-action="export"]').forEach(btn =>
            btn.addEventListener('click', e => { e.stopPropagation(); exportProjectTxt(btn.dataset.id); }));
        document.querySelectorAll('[data-action="delete"]').forEach(btn =>
            btn.addEventListener('click', async (e) => {  
                e.stopPropagation();
                const p = getProject(btn.dataset.id);
                if (p) {
                    const deleted = await deleteProject(btn.dataset.id);  
                    if (deleted) await renderDashboard();  
                }
            })
        );
    }
    
    const pubSection = document.getElementById('public-projects-section');
    if (canAccessTab('roteiros')) {
        pubSection.classList.add('visible');
        await loadPublicProjects();
    } else {
        pubSection.classList.remove('visible');
    }
}

function renderPublicProjects(publicProjects) {
    const container = document.getElementById('public-projects-container');
    if (!publicProjects.length) {
        container.innerHTML = '<div class="projects-empty"><p>Nenhum roteiro público disponível.</p></div>';
        return;
    }

    container.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'projects-grid';

    publicProjects.forEach(proj => {
        const card = document.createElement('div');
        card.className = 'public-card';
        card.innerHTML = `<div class="public-card-author">${uiIcon('user')} ${escapeHtml(proj.author_name || 'Autor anônimo')}</div><div class="card-title">${escapeHtml(proj.name) || 'Sem título'}</div><div class="card-meta">${uiIcon('calendar')} ${new Date(proj.updated_at).toLocaleDateString('pt-BR')}</div><div class="card-meta" style="margin-top:8px;">${uiIcon('text')} ${proj.script ? proj.script.split(/\s+/).length : 0} palavras</div>`;
        card.addEventListener('click', () => openPublicProject(proj));
        grid.appendChild(card);
    });
    container.appendChild(grid);
}




document.addEventListener('userReady', () => {
    dashboardLoading = false;
    if (canAccessTab('roteiros')) renderDashboard();
});

document.addEventListener('DOMContentLoaded', () => {
    if (canAccessTab('roteiros')) renderDashboard();
});
