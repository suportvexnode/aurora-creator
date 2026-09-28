




const RANKING_SCORING = {
    videosPosted: 5,         
    viewsMilestone: 5,       
    roteiro: 2,              
    watchTimeBonus: 3,       
};


const RANKING_TABLE = 'ranking_entries';

let rankingData = [];
let rankingCurrentUser = null;
let rankingUserEntry = null;





function calcPoints(entry) {
    let pts = 0;

    
    const videos = parseInt(entry.videos_posted) || 0;
    pts += videos * RANKING_SCORING.videosPosted;

    
    const views = parseInt(entry.total_views) || 0;
    if (views >= 5000) {
        pts += 5; 
        const extra = Math.floor((views - 5000) / 10000);
        pts += extra * 5;
    }


    
    const scripts = parseInt(entry.scripts_done) || 0;
    pts += scripts * RANKING_SCORING.roteiro;

    
    if (entry.watch_time_ok) {
        pts += RANKING_SCORING.watchTimeBonus;
    }

    return pts;
}





async function loadRanking() {
    try {
        const { data, error } = await sb
            .from(RANKING_TABLE)
            .select('*')
            .order('updated_at', { ascending: false });

        if (error) throw error;
        rankingData = (data || []).map(e => ({ ...e, points: calcPoints(e) }));
        rankingData.sort((a, b) => b.points - a.points);
    } catch (err) {
        console.error('Erro ao carregar ranking:', err);
        rankingData = [];
    }
}

async function saveRankingEntry(entry) {
    const payload = {
        user_id: window.currentUser.id,
        display_name: getDisplayName(window.currentUser),
        videos_posted: parseInt(entry.videos_posted) || 0,
        total_views: parseInt(entry.total_views) || 0,
        scripts_done: parseInt(entry.scripts_done) || 0,
        watch_time_ok: !!entry.watch_time_ok,
        updated_at: new Date().toISOString(),
    };

    const { data, error } = await sb
        .from(RANKING_TABLE)
        .upsert(payload, { onConflict: 'user_id' })
        .select()
        .single();

    if (error) throw error;
    return data;
}





function renderRankingPage() {
    const allowedRoles = window.userPlan?.ranking_roles || ['guardians', 'admin'];
    
    const myRole = window.userRole || currentUserRole;
    
    if (!allowedRoles.includes(myRole)) {
        const body = document.getElementById('ranking-body');
        if (body) body.innerHTML = `
            <div class="projects-empty">
                <h3>${uiIcon('lock')} Acesso restrito</h3>
                <p>O ranking é exclusivo para membros Guardians.</p>
                <button class="action-btn primary" onclick="openUpgradeModal('ranking')" style="margin-top:16px;">
                    Ver planos
                </button>
            </div>`;
        return;
    }
    rankingCurrentUser = window.currentUser;

    const body = document.getElementById('ranking-body');
    if (!body) return;

    body.innerHTML = '<div class="loading-state"><span class="spinner"></span> Carregando ranking…</div>';

    loadRanking().then(() => {
        rankingUserEntry = rankingData.find(e => e.user_id === rankingCurrentUser?.id) || null;
        _drawRanking(body);
    });
}

function _drawRanking(body) {
    const myEntry = rankingUserEntry;
    const myPoints = myEntry ? myEntry.points : 0;
    const myRank = rankingData.findIndex(e => e.user_id === rankingCurrentUser?.id) + 1;

    body.innerHTML = `
        
        <div class="ranking-my-card" id="ranking-my-card">
            <div class="ranking-my-header">
                <div>
                    <div class="ranking-my-title">MEUS DADOS</div>
                    <div class="ranking-my-sub">${myRank > 0 ? `#${myRank} no ranking · ` : ''}${myPoints} pts</div>
                </div>
                <button class="btn-new" id="ranking-edit-btn">
                    <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" fill="none" style="width:13px;height:13px;">
                        <path d="M17 3l4 4-7 7H10v-4l7-7z"/><path d="M4 20h16"/>
                    </svg>
                    Atualizar meus dados
                </button>
            </div>
            <div class="ranking-my-stats">
                ${_statBadge('video', 'Vídeos', myEntry?.videos_posted || 0)}
                ${_statBadge('eye', 'Views totais', _fmtNum(myEntry?.total_views || 0))}
                ${_statBadge('file', 'Roteiros', myEntry?.scripts_done || 0)}
                ${_statBadge('clock', 'Watch +5min', myEntry?.watch_time_ok ? 'Sim' : 'Não')}
            </div>
        </div>

        
        <div class="ranking-legend">
            <div class="ranking-legend-title">Como funciona a pontuação</div>
            <div class="ranking-legend-items">
                <span class="legend-item"><b>+5 pts</b> por vídeo postado</span>
                <span class="legend-sep">·</span>
                <span class="legend-item"><b>+5 pts</b> ao atingir 5k views, depois +5 a cada 10k</span>
                <span class="legend-sep">·</span>
                <span class="legend-item"><b>+2 pts</b> por roteiro feito</span>
                <span class="legend-sep">·</span>
                <span class="legend-item"><b>+3 pts</b> média de watch time &gt; 5 min</span>
            </div>
        </div>

        
        <div class="ranking-table-wrap">
            ${rankingData.length === 0 ? `
                <div class="projects-empty">
                    <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
                    <h3>Nenhum participante ainda</h3>
                    <p>Seja o primeiro a registrar seus dados!</p>
                </div>
            ` : `
                <table class="ranking-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Criador</th>
                            <th>Pts</th>
                            <th class="ranking-th-hide">${uiIcon('video')} Vídeos</th>
                            <th class="ranking-th-hide">${uiIcon('eye')} Views</th>
                            <th class="ranking-th-hide">${uiIcon('file')} Roteiros</th>
                            <th class="ranking-th-hide">${uiIcon('clock')} Watch</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rankingData.map((e, i) => _rankRow(e, i)).join('')}
                    </tbody>
                </table>
            `}
        </div>
    `;

    
    const editBtn = document.getElementById('ranking-edit-btn');
    if (editBtn) editBtn.addEventListener('click', openRankingModal);
}

function _statBadge(icon, label, val) {
    return `<div class="ranking-stat-badge"><span class="rsb-icon">${uiIcon(icon)}</span><span class="rsb-val">${val}</span><span class="rsb-label">${label}</span></div>`;
}

function _rankRow(e, i) {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;
    const isMe = e.user_id === rankingCurrentUser?.id;
    return `
        <tr class="${isMe ? 'ranking-row-me' : ''}">
            <td class="rank-pos">${medal}</td>
            <td class="rank-name">${escapeHtml(e.display_name || 'Anônimo')}${isMe ? ' <span class="rank-you-badge">você</span>' : ''}</td>
            <td class="rank-pts"><b>${e.points}</b></td>
            <td class="ranking-th-hide rank-muted">${e.videos_posted || 0}</td>
            <td class="ranking-th-hide rank-muted">${_fmtNum(e.total_views || 0)}</td>
            <td class="ranking-th-hide rank-muted">${e.scripts_done || 0}</td>
            <td class="ranking-th-hide rank-muted">${e.watch_time_ok ? uiIcon('check') : '—'}</td>
        </tr>
    `;
}

function _fmtNum(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return String(n);
}





function openRankingModal() {
    const e = rankingUserEntry || {};
    document.getElementById('rank-videos').value = e.videos_posted || 0;
    document.getElementById('rank-views').value = e.total_views || 0;
    document.getElementById('rank-scripts').value = e.scripts_done || 0;
    document.getElementById('rank-watchtime').checked = !!e.watch_time_ok;
    _updateRankPreview();
    document.getElementById('ranking-modal').classList.add('open');
}

function closeRankingModal() {
    document.getElementById('ranking-modal')?.classList.remove('open');
}

function _updateRankPreview() {
    const entry = {
        videos_posted: document.getElementById('rank-videos')?.value,
        total_views: document.getElementById('rank-views')?.value,
        scripts_done: document.getElementById('rank-scripts')?.value,
        watch_time_ok: document.getElementById('rank-watchtime')?.checked,
    };
    const pts = calcPoints(entry);
    const el = document.getElementById('rank-preview-pts');
    if (el) el.textContent = `${pts} pts`;
}

async function saveRankingModal() {
    const btn = document.getElementById('ranking-save-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Salvando…';

    const entry = {
        videos_posted: document.getElementById('rank-videos')?.value,
        total_views: document.getElementById('rank-views')?.value,
        scripts_done: document.getElementById('rank-scripts')?.value,
        watch_time_ok: document.getElementById('rank-watchtime')?.checked,
    };

    try {
        await saveRankingEntry(entry);
        showToast('Ranking atualizado!');
        closeRankingModal();
        await loadRanking();
        rankingUserEntry = rankingData.find(e => e.user_id === window.currentUser?.id) || null;
        const body = document.getElementById('ranking-body');
        if (body) _drawRanking(body);
    } catch (err) {
        showToast('Erro ao salvar: ' + err.message);
        console.error(err);
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Salvar';
    }
}





document.addEventListener('DOMContentLoaded', () => {
    
    document.getElementById('ranking-modal-close')?.addEventListener('click', closeRankingModal);
    document.getElementById('ranking-cancel-btn')?.addEventListener('click', closeRankingModal);
    document.getElementById('ranking-save-btn')?.addEventListener('click', saveRankingModal);
    document.getElementById('ranking-modal')?.addEventListener('click', e => {
        if (e.target === document.getElementById('ranking-modal')) closeRankingModal();
    });

    
    ['rank-videos','rank-views','rank-scripts'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', _updateRankPreview);
    });
    document.getElementById('rank-watchtime')?.addEventListener('change', _updateRankPreview);

    
    document.getElementById('ranking-refresh-btn')?.addEventListener('click', () => {
        const body = document.getElementById('ranking-body');
        if (body) {
            body.innerHTML = '<div class="loading-state"><span class="spinner"></span> Atualizando…</div>';
        }
        loadRanking().then(() => {
            rankingUserEntry = rankingData.find(e => e.user_id === window.currentUser?.id) || null;
            if (body) _drawRanking(body);
        });
    });
});
