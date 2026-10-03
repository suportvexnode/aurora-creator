





const ALL_TABS = [
    { id: 'roteiros',   label: 'Roteiros'   },
    { id: 'board',      label: 'Board'      },
    { id: 'take',      label: 'Take'      },
    { id: 'canal',     label: 'Canal'     },
    { id: 'skins',      label: 'Skins'      },
    { id: 'avatar',     label: 'Avatar'     },
    { id: 'musicas',   label: 'Músicas'   },
    { id: 'assets',     label: 'Assets'     },
    { id: 'estrategia', label: 'Estratégia' },
];


let adminPlans   = [];
let adminUsers   = [];
let adminSigs    = [];
let adminRoles  = [];
let adminRolesLoaded = false;
let adminPlanModal = { mode: 'create', plan: null };
let adminUserFilter = '';
let adminUserPlanFilter = 'all';







async function renderAdminPage() {
    if (!isAdmin()) {
        document.getElementById('admin-body').innerHTML = `
            <div class="admin-forbidden">
                <div class="admin-forbidden-icon">${uiIcon('lock')}</div>
                <div class="admin-forbidden-title">Acesso negado</div>
                <div class="admin-forbidden-sub">Apenas administradores podem acessar esta área.</div>
            </div>`;
        return;
    }

    document.getElementById('admin-body').innerHTML = `<div class="loading-state"><span class="spinner"></span> Carregando…</div>`;

    await Promise.all([fetchAdminPlans(), fetchAdminUsers(), fetchAdminSigs(), fetchAdminRoles()]);
    renderAdminTabs();
}

function renderAdminTabs() {
    document.getElementById('admin-body').innerHTML = `
        <div class="admin-tabs-bar">
            <button class="admin-tab active" data-atab="plans">Planos</button>
            <button class="admin-tab" data-atab="users">Usuários</button>
            <button class="admin-tab" data-atab="roles">Roles</button>
        </div>
        <div id="admin-tab-plans" class="admin-tab-pane active"></div>
        <div id="admin-tab-users" class="admin-tab-pane"></div>
        <div id="admin-tab-roles" class="admin-tab-pane"></div>
    `;

    document.querySelectorAll('.admin-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.admin-tab').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.admin-tab-pane').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('admin-tab-' + btn.dataset.atab).classList.add('active');
        });
    });

    renderPlansTab();
    renderUsersTab();
    renderRolesTab();
}

async function fetchAdminRoles() {
    const { data, error } = await sb.from('sharing_roles').select('id, name').order('name');
    adminRolesLoaded = !error;
    adminRoles = data || [];
}

function sharingRoleLabel(id) {
    return adminRoles.find(role => role.id === id)?.name || id || 'Sem role';
}

function renderRolesTab() {
    const el = document.getElementById('admin-tab-roles');
    if (!adminRolesLoaded) {
        el.innerHTML = '<div class="admin-empty">Não foi possível carregar as roles. Verifique a conexão e se a migração de permissões foi aplicada no Supabase.</div>';
        return;
    }
    el.innerHTML = `
        <div class="admin-section-header"><div>
            <div class="admin-section-title">Roles de compartilhamento</div>
            <p class="admin-section-sub">Roteiros e boards públicos são visíveis apenas entre pessoas da mesma role. Roles não concedem administração nem acesso a abas.</p>
        </div></div>
        <form id="admin-role-form" class="admin-users-filters">
            <input class="assets-search-input" id="admin-role-id" aria-label="Identificador da role" placeholder="Identificador: equipe_aurora" pattern="[a-z0-9][a-z0-9_-]{0,39}" maxlength="40" required>
            <input class="assets-search-input" id="admin-role-name" aria-label="Nome da role" placeholder="Nome: Equipe Aurora" maxlength="60" required>
            <button class="action-btn primary" type="submit">Criar role</button>
        </form>
        <div class="admin-users-table-wrap"><table class="admin-users-table">
            <thead><tr><th>Role</th><th>Identificador</th><th>Usuários</th></tr></thead>
            <tbody>${adminRoles.map(role => `<tr><td>${escapeHtml(role.name)}</td><td>${escapeHtml(role.id)}</td><td>${adminUsers.filter(user => user.role === role.id).length}</td></tr>`).join('')}</tbody>
        </table></div>`;
    document.getElementById('admin-role-form').addEventListener('submit', createSharingRole);
}

async function createSharingRole(event) {
    event.preventDefault();
    if (!isAdmin()) return;
    const id = document.getElementById('admin-role-id').value.trim().toLowerCase();
    const name = document.getElementById('admin-role-name').value.trim();
    if (!/^[a-z0-9][a-z0-9_-]{0,39}$/.test(id) || !name || name.length > 60) {
        showToast('Informe um identificador válido e um nome de até 60 caracteres.'); return;
    }
    if (id === 'admin') { showToast('Admin é uma permissão reservada. Escolha outro identificador.'); return; }
    const button = event.currentTarget.querySelector('button');
    button.disabled = true;
    try {
        const { error } = await sb.from('sharing_roles').insert({ id, name });
        if (error) throw error;
        await fetchAdminRoles();
        renderRolesTab();
        showToast('Role criada! Atribua-a na aba Usuários.');
    } catch (error) {
        showToast(error.code === '23505' ? 'Esse identificador já existe.' : 'Erro ao criar role: ' + error.message);
    } finally { button.disabled = false; }
}





async function fetchAdminPlans() {
    const { data } = await sb.from('plans').select('*').order('name');
    adminPlans = data || [];
}

async function fetchAdminUsers() {
    const { data } = await sb.from('user_profiles').select('*').order('display_name');
    adminUsers = data || [];
}

async function fetchAdminSigs() {
    const { data, error } = await sb.from('signatures').select('*, plans(name)');
    if (error) console.warn('fetchAdminSigs:', error.message);
    adminSigs = data || [];
}





function renderPlansTab() {
    const el = document.getElementById('admin-tab-plans');
    el.innerHTML = `
        <div class="admin-section-header">
            <div>
                <div class="admin-section-title">Planos cadastrados</div>
                <div class="admin-section-sub">${adminPlans.length} plano(s)</div>
            </div>
            <button class="btn-new" id="admin-new-plan-btn">
                <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Novo Plano
            </button>
        </div>
        <div class="admin-plans-grid" id="admin-plans-grid"></div>
    `;

    document.getElementById('admin-new-plan-btn').addEventListener('click', () => openPlanModal('create', null));
    renderPlansGrid();
}

function renderPlansGrid() {
    const grid = document.getElementById('admin-plans-grid');
    if (!grid) return;

    if (adminPlans.length === 0) {
        grid.innerHTML = `<div class="admin-empty">Nenhum plano cadastrado ainda.</div>`;
        return;
    }

    grid.innerHTML = adminPlans.map(plan => {
        const tabs   = plan.allowed_tabs || [];
        const sigs   = adminSigs.filter(s => s.plan_id === plan.id);
        const active = sigs.filter(s => !s.expires_at || new Date(s.expires_at) >= new Date()).length;

        return `
        <div class="admin-plan-card">
            <div class="admin-plan-card-top">
                <div>
                    <div class="admin-plan-name">${escapeHtml(plan.name)}</div>
                    <div class="admin-plan-id">${plan.id}</div>
                </div>
                <div class="admin-plan-badge">${active} usuário${active !== 1 ? 's' : ''}</div>
            </div>

            <div class="admin-plan-limits">
                <div class="admin-limit-item">
                    <span class="admin-limit-label">Projetos</span>
                    <span class="admin-limit-val">${plan.max_projects === -1 ? '∞' : plan.max_projects}</span>
                </div>
                <div class="admin-limit-item">
                    <span class="admin-limit-label">Assets</span>
                    <span class="admin-limit-val">${plan.max_assets === -1 ? '∞' : plan.max_assets}</span>
                </div>
                <div class="admin-limit-item">
                    <span class="admin-limit-label">Motions</span>
                    <span class="admin-limit-val">${plan.max_motions === -1 ? '∞' : plan.max_motions}</span>
                </div>
            </div>

            <div class="admin-plan-tabs-label">Abas liberadas</div>
            <div class="admin-plan-tabs-chips">
                ${ALL_TABS.map(t => `
                    <span class="admin-tab-chip ${tabs.includes(t.id) ? 'on' : 'off'}">${t.label}</span>
                `).join('')}
            </div>

            <div class="admin-plan-actions">
                <button class="action-btn" onclick="openPlanModal('edit', '${plan.id}')">Editar</button>
                <button class="action-btn danger-btn" onclick="deletePlan('${plan.id}')">Excluir</button>
            </div>
        </div>`;
    }).join('');
}



function openPlanModal(mode, planId) {
    adminPlanModal.mode = mode;
    adminPlanModal.plan = mode === 'edit' ? adminPlans.find(p => p.id === planId) : null;
    const plan = adminPlanModal.plan;

    const modal = document.getElementById('admin-plan-modal');
    document.getElementById('admin-plan-modal-title').textContent = mode === 'create' ? 'NOVO PLANO' : 'EDITAR PLANO';
    document.getElementById('apm-id').value          = plan?.id || '';
    document.getElementById('apm-id').disabled       = mode === 'edit';
    document.getElementById('apm-name').value        = plan?.name || '';
    document.getElementById('apm-max-projects').value= plan?.max_projects ?? 3;
    document.getElementById('apm-max-assets').value  = plan?.max_assets ?? 10;
    document.getElementById('apm-max-motions').value = plan?.max_motions ?? 5;

    
    const allowed = plan?.allowed_tabs || [];
    document.getElementById('apm-tabs-grid').innerHTML = ALL_TABS.map(tab => `
        <label class="apm-tab-check" for="apm-tab-${tab.id}">
            <input type="checkbox" id="apm-tab-${tab.id}" ${allowed.includes(tab.id) ? 'checked' : ''}>
            <span class="apm-tab-check-box"></span>${tab.label}
        </label>`).join('');

    modal.classList.add('open');
    setTimeout(() => document.getElementById('apm-name').focus(), 150);
}

function closePlanModal() {
    document.getElementById('admin-plan-modal').classList.remove('open');
}

async function savePlan() {
    if (!isAdmin()) return;
    const id   = document.getElementById('apm-id').value.trim().toLowerCase().replace(/\s+/g, '_');
    const name = document.getElementById('apm-name').value.trim();
    if (!id || !name) { showToast('Preencha ID e nome.'); return; }
    if (adminPlanModal.mode === 'create' && !/^[a-z0-9][a-z0-9_-]{0,39}$/.test(id)) {
        showToast('Use letras minúsculas, números, hífen ou sublinhado no ID do plano.'); return;
    }

    // Preserve settings belonging to legacy/future tabs that are not in this editor.
    const previousTabs = adminPlanModal.plan?.allowed_tabs || [];
    const allowed_tabs = [...new Set([
        ...previousTabs.filter(id => !ALL_TABS.some(tab => tab.id === id)),
        ...ALL_TABS.filter(t => document.getElementById('apm-tab-' + t.id)?.checked).map(t => t.id),
    ])];
    const limit = id => Number(document.getElementById(id).value);
    const limits = ['apm-max-projects', 'apm-max-assets', 'apm-max-motions'].map(limit);
    if (limits.some(value => !Number.isInteger(value) || value < -1)) {
        showToast('Use -1 para ilimitado ou um limite inteiro igual ou maior que zero.'); return;
    }

    const payload = {
        id,
        name,
        allowed_tabs,
        max_projects: limits[0],
        max_assets: limits[1],
        max_motions: limits[2],
    };

    const btn = document.getElementById('admin-plan-save-btn');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';

    const { error } = adminPlanModal.mode === 'create'
        ? await sb.from('plans').insert(payload)
        : await sb.from('plans').update(payload).eq('id', payload.id).select('id').single();

    btn.disabled = false; btn.textContent = 'Salvar';

    if (error) { showToast('Erro: ' + error.message); return; }

    showToast(adminPlanModal.mode === 'create' ? 'Plano criado!' : 'Plano atualizado!');
    closePlanModal();
    await fetchAdminPlans();
    renderPlansGrid();
    await refreshCurrentAccess();
}

async function refreshCurrentAccess() {
    _profileLoaded = false;
    _planCache.data = null;
    await Promise.all([loadUserProfile(), loadUserSignature()]);
    applyPlanRestrictions();
    selectAccessibleTab();
}

async function deletePlan(planId) {
    if (!isAdmin()) return;
    if (planId === 'free') { showToast('O plano Free é o padrão e não pode ser excluído.'); return; }
    const plan = adminPlans.find(p => p.id === planId);
    if (!plan) return;
    const sigs = adminSigs.filter(s => s.plan_id === planId);
    if (sigs.length > 0) {
        showToast(`Não é possível: ${sigs.length} usuário(s) neste plano.`);
        return;
    }
    if (!confirm(`Excluir o plano "${plan.name}"? Esta ação é irreversível.`)) return;

    const { error } = await sb.from('plans').delete().eq('id', planId);
    if (error) { showToast('Erro: ' + error.message); return; }

    showToast('Plano excluído.');
    await fetchAdminPlans();
    renderPlansGrid();
}





function renderUsersTab() {
    const el = document.getElementById('admin-tab-users');
    el.innerHTML = `
        <div class="admin-section-header">
            <div>
                <div class="admin-section-title">Usuários cadastrados</div>
                <div class="admin-section-sub">${adminUsers.length} usuário(s)</div>
            </div>
        </div>
        <div class="admin-users-filters">
            <input class="assets-search-input" id="admin-user-search" placeholder="Buscar por nome ou e-mail…" value="${adminUserFilter}">
            <select id="admin-user-plan-filter" class="admin-filter-select">
                <option value="all">Todos os planos</option>
                <option value="none">Sem plano</option>
                ${adminPlans.map(p => `<option value="${p.id}" ${adminUserPlanFilter === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
            </select>
        </div>
        <div class="admin-users-table-wrap">
            <table class="admin-users-table">
                <thead>
                    <tr>
                        <th>Usuário</th>
                        <th>Role</th>
                        <th>Plano atual</th>
                        <th>Expira em</th>
                        <th>Ações</th>
                    </tr>
                </thead>
                <tbody id="admin-users-tbody"></tbody>
            </table>
        </div>
    `;

    document.getElementById('admin-user-search').addEventListener('input', e => {
        adminUserFilter = e.target.value;
        renderUsersRows();
    });

    document.getElementById('admin-user-plan-filter').addEventListener('change', e => {
        adminUserPlanFilter = e.target.value;
        renderUsersRows();
    });

    renderUsersRows();
}

function renderUsersRows() {
    const tbody = document.getElementById('admin-users-tbody');
    if (!tbody) return;

    const q = adminUserFilter.toLowerCase();

    let filtered = adminUsers.filter(u => {
        const match = !q || (u.display_name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
        if (!match) return false;

        if (adminUserPlanFilter === 'all') return true;

        const sig = adminSigs.find(s => s.user_id === u.id);
        if (adminUserPlanFilter === 'none') return !sig;
        return sig?.plan_id === adminUserPlanFilter;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--muted);font-family:var(--font-mono);font-size:.65rem;letter-spacing:1px;">NENHUM USUÁRIO ENCONTRADO</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(user => {
        const sig     = adminSigs.find(s => s.user_id === user.id);
        const plan    = sig ? adminPlans.find(p => p.id === sig.plan_id) : null;
        const expired = sig?.expires_at && new Date(sig.expires_at) < new Date();
        const expStr  = sig?.expires_at
            ? (expired ? `<span style="color:var(--red)">Expirado ${fmtDate(sig.expires_at)}</span>` : fmtDate(sig.expires_at))
            : '—';

        return `
        <tr>
            <td>
                <div class="admin-user-name">${escapeHtml(user.display_name || '—')}</div>
                <div class="admin-user-email">${escapeHtml(user.email || '')}</div>
            </td>
            <td>
                <span class="admin-role-badge">${escapeHtml(sharingRoleLabel(user.role))}</span>
            </td>
            <td>
                ${plan
                    ? `<span class="admin-plan-pill">${escapeHtml(plan.name)}</span>`
                    : `<span style="color:var(--muted);font-size:.75rem;">Free (padrão)</span>`}
            </td>
            <td style="font-family:var(--font-mono);font-size:.65rem;">${expStr}</td>
            <td>
                <div style="display:flex;gap:6px;">
                    <button class="action-btn" onclick="openUserModal('${user.id}')">Gerenciar</button>
                </div>
            </td>
        </tr>`;
    }).join('');
}



function openUserModal(userId) {
    const user = adminUsers.find(u => u.id === userId);
    if (!user) return;
    const sig  = adminSigs.find(s => s.user_id === userId);
    const plan = sig ? adminPlans.find(p => p.id === sig.plan_id) : null;

    document.getElementById('aum-name').textContent  = user.display_name || user.email;
    document.getElementById('aum-email').textContent = user.email || '';
    document.getElementById('aum-user-id').value     = userId;

    
    const roleSelect = document.getElementById('aum-role');
    roleSelect.innerHTML = '<option value="">Sem role</option>' + adminRoles.map(role =>
        `<option value="${escapeHtml(role.id)}">${escapeHtml(role.name)}</option>`).join('');
    if (user.role && !adminRoles.some(role => role.id === user.role)) {
        const legacyOption = document.createElement('option');
        legacyOption.value = user.role;
        legacyOption.textContent = user.role;
        roleSelect.appendChild(legacyOption);
    }
    roleSelect.value = user.role || '';
    roleSelect.disabled = !adminRolesLoaded;

    
    const planSel = document.getElementById('aum-plan');
    planSel.innerHTML = `<option value="">Free (padrão / sem registro)</option>`
        + adminPlans.map(p => `<option value="${p.id}" ${sig?.plan_id === p.id ? 'selected' : ''}>${p.name}</option>`).join('');

    
    const expInput = document.getElementById('aum-expires');
    if (sig?.expires_at) {
        expInput.value = sig.expires_at.split('T')[0];
    } else {
        expInput.value = '';
    }

    
    document.getElementById('aum-sig-id').value = sig?.id || '';

    document.getElementById('admin-user-modal').classList.add('open');
}

function closeUserModal() {
    document.getElementById('admin-user-modal').classList.remove('open');
}

async function saveUserModal() {
    if (!isAdmin() || !adminRolesLoaded) { showToast('Carregue as roles antes de salvar.'); return; }
    const userId  = document.getElementById('aum-user-id').value;
    const role    = document.getElementById('aum-role').value;
    const planId  = document.getElementById('aum-plan').value;
    const expires = document.getElementById('aum-expires').value;
    const btn = document.getElementById('admin-user-save-btn');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
    try {
        const { error } = await sb.rpc('aurora_admin_update_user', {
            target_user: userId,
            sharing_role: role || null,
            selected_plan: planId || null,
            plan_expires_at: expires ? new Date(expires + 'T23:59:59').toISOString() : null,
        });
        if (error) throw error;
    } catch (error) {
        showToast('Erro ao salvar usuário: ' + error.message);
        return;
    } finally {
        btn.disabled = false; btn.textContent = 'Salvar';
    }

    showToast('Usuário atualizado!');
    btn.disabled = false; btn.textContent = 'Salvar';
    closeUserModal();

    await Promise.all([fetchAdminUsers(), fetchAdminSigs()]);
    renderUsersRows();
    renderPlansGrid();
    renderRolesTab();
    if (userId === window.currentUser.id) await refreshCurrentAccess();
}





function fmtDate(iso) {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}




document.addEventListener('DOMContentLoaded', () => {

    document.getElementById('admin-plan-modal-close')?.addEventListener('click', closePlanModal);
    document.getElementById('admin-plan-cancel-btn')?.addEventListener('click', closePlanModal);
    document.getElementById('admin-plan-save-btn')?.addEventListener('click', savePlan);
    document.getElementById('admin-plan-modal')?.addEventListener('click', e => {
        if (e.target === document.getElementById('admin-plan-modal')) closePlanModal();
    });

    document.getElementById('admin-user-modal-close')?.addEventListener('click', closeUserModal);
    document.getElementById('admin-user-cancel-btn')?.addEventListener('click', closeUserModal);
    document.getElementById('admin-user-save-btn')?.addEventListener('click', saveUserModal);
    document.getElementById('admin-user-modal')?.addEventListener('click', e => {
        if (e.target === document.getElementById('admin-user-modal')) closeUserModal();
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            closePlanModal();
            closeUserModal();
        }
    });
});
