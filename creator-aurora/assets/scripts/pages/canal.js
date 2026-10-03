





const _YT_KEY   = () => window.YOUTUBE_API_KEY || '';
const _GROQ_KEY = () => window.GROQ_API_KEY    || '';
const _CANAL_PUBLIC = () => window.CANAL_PUBLIC_MODE === true || document.body?.dataset.publicTool === 'canal';
const _GROQ_MODELS = ['openai/gpt-oss-120b', 'qwen/qwen3.6-27b'];
let _groqModel = _GROQ_MODELS[0];


let _canalTab = 'canal';      


let _channelData   = null;
let _allVideos     = [];
let _nextPageToken = null;
let _uploadsId     = null;
let _sortMode      = 'recent';
let _searchQuery   = '';
let _modalVideo    = null;
let _chatHistory   = [];
let _chatContext   = null;
let _channelPreview = null;


let _tvResults      = [];
let _tvSuggestions  = [];
let _tvSearching    = false;
let _tvBmVideo      = null;   



function _fmtN(n) {
    n = parseInt(n) || 0;
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
    return n.toString();
}

function _fmtDate(iso) {
    return new Date(iso).toLocaleDateString('pt-BR', { day:'2-digit', month:'short', year:'numeric' });
}

function _fmtDuration(iso) {
    if (!iso) return '0:00';
    const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!m) return '0:00';
    const h = +m[1]||0, mn = +m[2]||0, s = +m[3]||0;
    return h ? `${h}:${String(mn).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${mn}:${String(s).padStart(2,'0')}`;
}

function _escHtml(t) {
    if (!t) return '';
    const d = document.createElement('div');
    d.textContent = t;
    return d.innerHTML;
}

function _parseMarkdown(text) {
    if (!text) return '';
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/^### (.+)/gm, '<h4>$1</h4>')
        .replace(/^## (.+)/gm, '<h3>$1</h3>')
        .replace(/^- (.+)/gm, '<li>$1</li>')
        .replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>')
        .replace(/\n/g, '<br>');
}

async function _groq(messages, temp = 0.7, maxTok = 1200) {
    if (!_GROQ_KEY()) throw new Error('Chave da Groq não configurada.');
    let lastError;
    const models = [_groqModel, ..._GROQ_MODELS.filter(model => model !== _groqModel)];
    for (const model of models) {
        try {
            const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type':'application/json', 'Authorization':`Bearer ${_GROQ_KEY()}` },
                body: JSON.stringify({ model, messages, temperature: temp, max_tokens: maxTok }),
            });
            const d = await res.json();
            if (!res.ok) throw new Error(d.error?.message || `Groq ${res.status}`);
            _groqModel = model;
            return d.choices[0].message.content;
        } catch (error) {
            lastError = error;
        }
    }
    throw lastError || new Error('Não foi possível acessar a Groq.');
}



async function renderCanalPage() {
    if (!window.currentUser && !_CANAL_PUBLIC()) return;
    const body = document.getElementById('canal-body');
    if (!body) return;

    
    if (!body.dataset.initialized) {
        body.dataset.initialized = '1';
        _renderShell(body);
        _bindShellEvents();
    }

    
    _switchCanalTab('canal');
}

window.renderCanalPage = renderCanalPage;



function _renderShell(body) {
    body.innerHTML = `
    
    <div class="csh-tabs-bar">
        <button class="csh-tab active" data-ctab="canal">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:14px;height:14px;">
                <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/>
                <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"/>
            </svg>
            Meu Canal
        </button>
        <button class="csh-tab" data-ctab="titulos">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:14px;height:14px;">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            Títulos Validados
        </button>
    </div>

    
    <div id="csh-canal-pane"  class="csh-pane active"></div>
    <div id="csh-titulos-pane" class="csh-pane"></div>
    `;
}

function _bindShellEvents() {
    document.querySelectorAll('.csh-tab').forEach(btn => {
        btn.addEventListener('click', () => _switchCanalTab(btn.dataset.ctab));
    });
}

function _switchCanalTab(tab) {
    _canalTab = tab;
    document.querySelectorAll('.csh-tab').forEach(b => b.classList.toggle('active', b.dataset.ctab === tab));
    document.querySelectorAll('.csh-pane').forEach(p => p.classList.remove('active'));
    document.getElementById(`csh-${tab}-pane`).classList.add('active');

    if (tab === 'canal'   && !document.getElementById('csh-canal-pane').dataset.loaded)   _initCanalPane();
    if (tab === 'titulos' && !document.getElementById('csh-titulos-pane').dataset.loaded) _initTitulosPane();
}



async function _initCanalPane() {
    const pane = document.getElementById('csh-canal-pane');
    pane.dataset.loaded = '1';

    if (_CANAL_PUBLIC()) {
        _renderCanalSetup(pane);
        return;
    }

    pane.innerHTML = `<div class="loading-state" style="padding:60px 0;"><span class="spinner"></span> Verificando canal…</div>`;

    try {
        const { data } = await sb.from('user_profiles')
            .select('youtube_channel_id, youtube_link')
            .eq('id', window.currentUser.id)
            .single();

        if (data?.youtube_channel_id) {
            await _loadCanalDashboard(data.youtube_channel_id, pane);
        } else {
            _renderCanalSetup(pane);
        }
    } catch {
        _renderCanalSetup(pane);
    }
}


function _renderCanalSetup(pane) {
    pane.innerHTML = `
    <div class="canal-setup">
        <div class="canal-setup-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
                <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/>
                <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"/>
            </svg>
        </div>
        <h2 class="canal-setup-title">Conecte seu Canal</h2>
        <p class="canal-setup-desc">Cole o link ou ID do seu canal do YouTube para analisar seus vídeos com IA.</p>
        <div class="canal-setup-form">
            <input id="canal-url-input" class="canal-setup-input" type="text"
                placeholder="https://youtube.com/@seucanal  ou  UC..."
                autocomplete="off"/>
            <button class="btn-new" id="canal-connect-btn" style="width:100%;margin-top:12px;justify-content:center;">
                Conectar Canal
            </button>
            <div id="canal-setup-error" class="canal-setup-error" style="display:none;"></div>
        </div>
        <p class="canal-setup-hint">Funciona com link completo, @handle ou ID do canal (UCxx…)</p>
    </div>`;

    document.getElementById('canal-connect-btn').addEventListener('click', () => _handleConnect(pane));
    document.getElementById('canal-url-input').addEventListener('keydown', e => { if (e.key === 'Enter') _handleConnect(pane); });
}

function _extractChannelId(input) {
    input = input.trim();
    if (/^UC[\w-]{22}$/.test(input)) return { type:'id', value:input };
    const h = input.match(/(?:youtube\.com\/@|^@)([\w.-]+)/);
    if (h) return { type:'handle', value:h[1] };
    const c = input.match(/youtube\.com\/channel\/(UC[\w-]{22})/);
    if (c) return { type:'id', value:c[1] };
    const cu = input.match(/youtube\.com\/(?:c\/|user\/)([\w.-]+)/);
    if (cu) return { type:'handle', value:cu[1] };
    return { type:'handle', value: input.replace('@','') };
}

async function _handleConnect(pane) {
    const input = document.getElementById('canal-url-input');
    const btn   = document.getElementById('canal-connect-btn');
    const errEl = document.getElementById('canal-setup-error');
    const raw   = input.value.trim();
    if (!raw) { _showSetupErr('Cole o link ou ID do canal.'); return; }

    errEl.style.display = 'none';
    btn.disabled = true; btn.textContent = 'Conectando…';

    try {
        const parsed = _extractChannelId(raw);
        const ch = parsed.type === 'id'
            ? await _ytChannelById(parsed.value)
            : await _ytChannelByHandle(parsed.value);

        if (!_CANAL_PUBLIC()) {
            const { error } = await sb.from('user_profiles').update({
                youtube_channel_id: ch.id,
                youtube_link: raw,
            }).eq('id', window.currentUser.id);
            if (error) throw error;
        }

        _channelData = ch;
        if (typeof showToast === 'function') showToast('Canal conectado!');
        await _loadCanalDashboard(ch.id, pane);
    } catch (e) {
        _showSetupErr(e.message || 'Não foi possível conectar. Verifique o link.');
        btn.disabled = false; btn.textContent = 'Conectar Canal';
    }
}

function _showSetupErr(msg) {
    const el = document.getElementById('canal-setup-error');
    if (el) { el.textContent = msg; el.style.display = 'block'; }
}


async function _ytFetch(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`YouTube API ${res.status}`);
    return res.json();
}

async function _ytChannelById(id) {
    const d = await _ytFetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,brandingSettings,contentDetails&id=${id}&key=${_YT_KEY()}`);
    if (!d.items?.length) throw new Error('Canal não encontrado.');
    return d.items[0];
}

async function _ytChannelByHandle(handle) {
    const d = await _ytFetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,brandingSettings,contentDetails&forHandle=${encodeURIComponent(handle)}&key=${_YT_KEY()}`);
    if (!d.items?.length) throw new Error(`Canal "@${handle}" não encontrado.`);
    return d.items[0];
}

async function _ytPlaylistItems(playlistId, pageToken) {
    const p = new URLSearchParams({ part:'snippet,contentDetails', playlistId, maxResults:'50', key:_YT_KEY() });
    if (pageToken) p.set('pageToken', pageToken);
    const d = await _ytFetch(`https://www.googleapis.com/youtube/v3/playlistItems?${p}`);
    return { items: d.items||[], nextPageToken: d.nextPageToken||null };
}

async function _ytVideoStats(ids) {
    if (!ids.length) return [];
    const d = await _ytFetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails,snippet&id=${ids.join(',')}&key=${_YT_KEY()}`);
    return d.items||[];
}


function _calcScore(video) {
    const v = parseInt(video.statistics?.viewCount)||0;
    const l = parseInt(video.statistics?.likeCount)||0;
    const c = parseInt(video.statistics?.commentCount)||0;
    const lr = v > 0 ? (l/v)*100 : 0;
    const cr = v > 0 ? (c/v)*100 : 0;
    return Math.min(100, Math.round((lr*15)+(cr*25)+Math.min(50,Math.log10(v+1)*10)));
}

function _scoreClass(s) { return s>=71?'score-high':s>=41?'score-medium':'score-low'; }


async function _loadCanalDashboard(channelId, pane) {
    pane.innerHTML = `<div class="loading-state" style="padding:60px 0;"><span class="spinner"></span> Carregando canal…</div>`;

    try {
        if (!_channelData) _channelData = await _ytChannelById(channelId);
        _uploadsId = _channelData.contentDetails?.relatedPlaylists?.uploads;
        if (!_uploadsId) throw new Error('Playlist de uploads não encontrada.');

        const { items, nextPageToken } = await _ytPlaylistItems(_uploadsId);
        _nextPageToken = nextPageToken;
        const ids = items.map(i=>i.contentDetails?.videoId).filter(Boolean);
        _allVideos = await _ytVideoStats(ids);

        _renderDashboard(pane);
    } catch (e) {
        pane.innerHTML = `
        <div style="text-align:center;padding:80px 20px;color:var(--muted);">
            <div style="color:var(--red);margin-bottom:8px;font-family:var(--font-ui);font-size:.75rem;letter-spacing:2px;">ERRO AO CARREGAR CANAL</div>
            <div style="font-size:.85rem;margin-bottom:20px;">${_escHtml(e.message)}</div>
            <button class="btn-new" style="margin:0 auto;display:inline-flex;" onclick="
                document.getElementById('csh-canal-pane').dataset.loaded='';
                _initCanalPane();
            ">Tentar novamente</button>
        </div>`;
    }
}

function _renderDashboard(pane) {
    const ch = _channelData;
    const avatar = ch.snippet?.thumbnails?.high?.url||ch.snippet?.thumbnails?.default?.url||'';
    const name   = ch.snippet?.title||'Canal';
    const banner = ch.brandingSettings?.image?.bannerExternalUrl||'';

    pane.innerHTML = `
    
    <div class="canal-header-card">
        ${banner?`<div class="canal-banner" style="background-image:url('${banner}')"></div>`:''}
        <div class="canal-header-inner">
            <img class="canal-avatar" src="${avatar}" alt="${name}" onerror="this.style.display='none'">
            <div class="canal-header-info">
                <div class="canal-channel-name">${_escHtml(name)}</div>
                <div class="canal-stats-row">
                    <div class="canal-stat-item"><span class="canal-stat-value">${_fmtN(ch.statistics?.subscriberCount)}</span><span class="canal-stat-label">Inscritos</span></div>
                    <div class="canal-stat-item"><span class="canal-stat-value">${_fmtN(ch.statistics?.videoCount)}</span><span class="canal-stat-label">Vídeos</span></div>
                    <div class="canal-stat-item"><span class="canal-stat-value">${_fmtN(ch.statistics?.viewCount)}</span><span class="canal-stat-label">Views totais</span></div>
                </div>
            </div>
            <div class="canal-header-actions">
                <button class="action-btn" id="canal-preview-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="14" height="14"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>Testar preview</button>
                <button class="action-btn" id="canal-change-btn">Trocar canal</button>
                <button class="action-btn primary" id="canal-refresh-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 5v4h4M4 13a8.1 8.1 0 0 0 15.5 2M20 19v-4h-4"/></svg>Atualizar</button>
            </div>
        </div>
    </div>

    
    <div class="canal-insights" id="canal-insights"></div>

    
    <div class="canal-filters">
        <input id="canal-search" class="canal-filter-search" type="text" placeholder="Buscar por título…">
        <div class="canal-sort-btns">
            <button class="action-btn canal-sort-btn active" data-sort="recent">Recentes</button>
            <button class="action-btn canal-sort-btn" data-sort="views">Views</button>
            <button class="action-btn canal-sort-btn" data-sort="score">Score</button>
            <button class="action-btn canal-sort-btn" data-sort="engagement">Engajamento</button>
        </div>
    </div>

    
    <div class="canal-videos-grid" id="canal-videos-grid"></div>

    
    <div id="canal-load-more-wrap" style="text-align:center;margin-top:28px;padding-bottom:40px;"></div>
    `;

    _renderInsights();
    _renderVideoGrid();
    _renderLoadMore();
    _bindDashboardEvents(pane);
}


function _renderInsights() {
    const el = document.getElementById('canal-insights');
    if (!el || !_allVideos.length) return;

    const sorted = [..._allVideos].sort((a,b)=>
        (parseInt(b.statistics?.viewCount)||0)-(parseInt(a.statistics?.viewCount)||0)
    );
    const top    = sorted[0];
    const avgV   = Math.round(_allVideos.reduce((s,v)=>s+(parseInt(v.statistics?.viewCount)||0),0)/_allVideos.length);
    const avgL   = Math.round(_allVideos.reduce((s,v)=>s+(parseInt(v.statistics?.likeCount)||0),0)/_allVideos.length);
    const avgScore = Math.round(_allVideos.reduce((s,v)=>s+_calcScore(v),0)/_allVideos.length);

    el.innerHTML = `
    <div class="canal-insight-card">
        <div class="canal-insight-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg></div>
        <div class="canal-insight-val">${_fmtN(avgV)}</div>
        <div class="canal-insight-label">Média de views</div>
    </div>
    <div class="canal-insight-card">
        <div class="canal-insight-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 10v10"/><path d="M3 10h4V4h9.5a3.5 3.5 0 0 1 0 7H14l-2.5 4H7"/></svg></div>
        <div class="canal-insight-val">${_fmtN(avgL)}</div>
        <div class="canal-insight-label">Média de likes</div>
    </div>
    <div class="canal-insight-card">
        <div class="canal-insight-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m13 2-9 12h7l-1 8 10-13h-7z"/></svg></div>
        <div class="canal-insight-val">${avgScore}</div>
        <div class="canal-insight-label">Score médio</div>
    </div>
    <div class="canal-insight-card canal-insight-top" title="${_escHtml(top?.snippet?.title||'')}">
        <div class="canal-insight-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="5"/><path d="M8 13 6 22l6-3 6 3-2-9"/></svg></div>
        <div class="canal-insight-val">${_fmtN(top?.statistics?.viewCount)}</div>
        <div class="canal-insight-label">Maior vídeo</div>
    </div>
    `;
}


function _getFiltered() {
    let list = [..._allVideos];
    if (_searchQuery.trim()) {
        const q = _searchQuery.toLowerCase();
        list = list.filter(v=>v.snippet?.title?.toLowerCase().includes(q));
    }
    const sorts = {
        recent:      (a,b) => new Date(b.snippet.publishedAt)-new Date(a.snippet.publishedAt),
        views:       (a,b) => (parseInt(b.statistics?.viewCount)||0)-(parseInt(a.statistics?.viewCount)||0),
        score:       (a,b) => _calcScore(b)-_calcScore(a),
        engagement:  (a,b) => {
            const er = v => {
                const vi = parseInt(v.statistics?.viewCount)||1;
                return ((parseInt(v.statistics?.likeCount)||0)+(parseInt(v.statistics?.commentCount)||0))/vi;
            };
            return er(b)-er(a);
        },
    };
    list.sort(sorts[_sortMode]||sorts.recent);
    return list;
}

function _renderVideoGrid() {
    const grid = document.getElementById('canal-videos-grid');
    if (!grid) return;
    const videos = _getFiltered();
    const previewMatches = _channelPreview && (!_searchQuery.trim() || _channelPreview.title.toLowerCase().includes(_searchQuery.toLowerCase()));

    if (!videos.length && !previewMatches) {
        grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--muted);font-size:.85rem;">Nenhum vídeo encontrado.</div>`;
        return;
    }
    grid.innerHTML = `${previewMatches ? _previewCardHtml() : ''}${videos.map(v=>_videoCardHtml(v)).join('')}`;
    grid.querySelectorAll('.canal-analyze-btn').forEach(btn=>{
        btn.addEventListener('click',()=>{
            const v = _allVideos.find(x=>x.id===btn.dataset.vid);
            if (v) _openAnalysisModal(v);
        });
    });
    grid.querySelector('#canal-preview-remove')?.addEventListener('click', ()=>{
        _channelPreview = null;
        _renderVideoGrid();
    });
}

function _previewCardHtml() {
    const preview = _channelPreview;
    const thumb = preview.thumbnail
        ? `<img src="${_escHtml(preview.thumbnail)}" alt="" onerror="this.remove()">`
        : `<div class="canal-preview-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3z"/></svg></div>`;
    return `
    <div class="canal-video-card canal-preview-card">
        <div class="canal-video-thumb">${thumb}<span class="canal-preview-badge">PREVIEW</span></div>
        <div class="canal-video-info">
            <div class="canal-video-title">${_escHtml(preview.title || 'Título do vídeo de teste')}</div>
            <div class="canal-video-date">Vídeo simulado · não será salvo</div>
            <div class="canal-video-stats"><span>Dados de desempenho indisponíveis</span></div>
            <p class="canal-preview-description">${_escHtml(preview.description || 'Adicione uma descrição para testar a apresentação.')}</p>
            <button class="action-btn canal-preview-remove" id="canal-preview-remove">Remover preview</button>
        </div>
    </div>`;
}

function _videoCardHtml(video) {
    const score  = _calcScore(video);
    const sc     = _scoreClass(score);
    const thumb  = video.snippet?.thumbnails?.medium?.url||video.snippet?.thumbnails?.default?.url||'';
    const title  = video.snippet?.title||'Sem título';
    const dur    = _fmtDuration(video.contentDetails?.duration);
    const date   = _fmtDate(video.snippet?.publishedAt);
    const barClr = score>=71?'#50dc78':score>=41?'var(--gold)':'var(--red)';
    const cached = !!localStorage.getItem('canal_analysis_'+video.id);

    return `
    <div class="canal-video-card">
        <a href="https://youtube.com/watch?v=${video.id}" target="_blank" class="canal-thumb-link">
            <div class="canal-video-thumb">
                <img src="${thumb}" alt="" loading="lazy" onerror="this.parentElement.style.background='var(--panel2)'">
                <span class="canal-video-duration">${dur}</span>
                ${cached?`<span class="canal-analyzed-badge">${uiIcon('search')}Analisado</span>`:''}
            </div>
        </a>
        <div class="canal-video-info">
            <div class="canal-video-title" title="${_escHtml(title)}">${_escHtml(title)}</div>
            <div class="canal-video-date">${date}</div>
            <div class="canal-video-stats">
                <span>${uiIcon('eye')}${_fmtN(video.statistics?.viewCount)}</span>
                <span>${uiIcon('like')}${_fmtN(video.statistics?.likeCount)}</span>
                <span>${uiIcon('message')}${_fmtN(video.statistics?.commentCount)}</span>
            </div>
            <div class="canal-score-wrap">
                <div class="canal-score-bar"><div class="canal-score-fill" style="width:${score}%;background:${barClr}"></div></div>
                <span class="canal-score-badge ${sc}">${score}</span>
            </div>
            <button class="action-btn primary canal-analyze-btn" data-vid="${video.id}" style="width:100%;margin-top:10px;justify-content:center;">
                ${cached?`${uiIcon('eye')}Ver análise`:`${uiIcon('search')}Analisar com IA`}
            </button>
        </div>
    </div>`;
}

function _renderLoadMore() {
    const wrap = document.getElementById('canal-load-more-wrap');
    if (!wrap) return;
    wrap.innerHTML = _nextPageToken
        ? `<button class="action-btn primary" id="canal-load-more-btn" style="min-width:180px;">Carregar mais vídeos</button>`
        : '';
    document.getElementById('canal-load-more-btn')?.addEventListener('click', _handleLoadMore);
}

async function _handleLoadMore() {
    const btn = document.getElementById('canal-load-more-btn');
    if (btn) { btn.disabled=true; btn.textContent='Carregando…'; }
    try {
        const { items, nextPageToken } = await _ytPlaylistItems(_uploadsId, _nextPageToken);
        _nextPageToken = nextPageToken;
        const ids = items.map(i=>i.contentDetails?.videoId).filter(Boolean);
        const stats = await _ytVideoStats(ids);
        _allVideos = [..._allVideos, ...stats];
        _renderInsights();
        _renderVideoGrid();
        _renderLoadMore();
    } catch (e) {
        if (typeof showToast === 'function') showToast('Erro: '+e.message);
        if (btn) { btn.disabled=false; btn.textContent='Carregar mais'; }
    }
}

function _bindDashboardEvents(pane) {
    document.getElementById('canal-preview-btn')?.addEventListener('click', _openChannelPreview);
    document.getElementById('canal-change-btn')?.addEventListener('click', async ()=>{
        if (!_CANAL_PUBLIC()) {
            await sb.from('user_profiles').update({ youtube_channel_id:null }).eq('id', window.currentUser.id);
        }
        _channelData=null; _allVideos=[]; _nextPageToken=null; _uploadsId=null;
        _renderCanalSetup(pane);
    });
    document.getElementById('canal-refresh-btn')?.addEventListener('click', async ()=>{
        const channelId = _channelData?.id;
        _allVideos=[]; _nextPageToken=null; _uploadsId=null;
        if (_CANAL_PUBLIC()) {
            if (channelId) await _loadCanalDashboard(channelId, pane);
            return;
        }
        _channelData=null;
        const { data } = await sb.from('user_profiles').select('youtube_channel_id').eq('id',window.currentUser.id).single();
        if (data?.youtube_channel_id) await _loadCanalDashboard(data.youtube_channel_id, pane);
    });
    document.getElementById('canal-search')?.addEventListener('input', e=>{
        _searchQuery = e.target.value;
        _renderVideoGrid();
    });
    document.querySelectorAll('.canal-sort-btn').forEach(btn=>{
        btn.addEventListener('click',()=>{
            _sortMode = btn.dataset.sort;
            document.querySelectorAll('.canal-sort-btn').forEach(b=>b.classList.remove('active'));
            btn.classList.add('active');
            _renderVideoGrid();
        });
    });
}


function _openAnalysisModal(video) {
    _modalVideo = video;
    _chatHistory = [];
    _chatContext = null;

    const score  = _calcScore(video);
    const thumb  = video.snippet?.thumbnails?.medium?.url||'';
    const title  = video.snippet?.title||'';
    const cached = _getCache(video.id);

    
    document.getElementById('canal-modal-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.className = 'canal-modal-overlay';
    overlay.id = 'canal-modal-overlay';
    overlay.innerHTML = `
    <div class="canal-modal">
        <button class="canal-modal-close" id="canal-modal-close">&times;</button>
        <div class="canal-modal-hero">
            ${thumb?`<img src="${thumb}" alt="" class="canal-modal-thumb">`:''}
            <div class="canal-modal-hero-info">
                <div class="canal-modal-title">${_escHtml(title)}</div>
                <div class="canal-modal-meta">
                    <span>${uiIcon('eye')}${_fmtN(video.statistics?.viewCount)}</span>
                    <span>${uiIcon('like')}${_fmtN(video.statistics?.likeCount)}</span>
                    <span>${uiIcon('message')}${_fmtN(video.statistics?.commentCount)}</span>
                    <span>⏱ ${_fmtDuration(video.contentDetails?.duration)}</span>
                    <span class="${_scoreClass(score)}" style="font-weight:700;">Score ${score}/100</span>
                </div>
                
                <button class="action-btn" id="modal-find-titles-btn" style="margin-top:10px;gap:6px;">
                    ${uiIcon('search')}Buscar títulos similares
                </button>
            </div>
        </div>

        <div id="canal-analysis-wrap" class="canal-analysis-wrap">
            ${cached ? _renderAnalysisHtml(cached, score) : `
            <div style="text-align:center;padding:40px;">
                <button class="btn-new" id="canal-run-analysis-btn" style="display:inline-flex;">${uiIcon('search')}Analisar com IA</button>
                <div id="canal-analysis-loading" style="display:none;padding:20px;color:var(--muted);"><span class="spinner"></span> Analisando…</div>
            </div>`}
        </div>

        <div class="canal-chat-wrap" id="canal-chat-wrap" style="${cached?'':'display:none'}">
            <div class="canal-chat-header">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="16" height="16"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                Pergunte sobre este vídeo
            </div>
            <div class="canal-chat-messages" id="canal-chat-messages"></div>
            <div class="canal-chat-input-row">
                <input id="canal-chat-input" class="canal-chat-input" type="text" placeholder="Ex: Como melhorar o título?" autocomplete="off"/>
                <button class="action-btn primary" id="canal-chat-send">Enviar</button>
            </div>
        </div>
    </div>`;

    document.body.appendChild(overlay);
    requestAnimationFrame(()=>overlay.classList.add('open'));

    if (cached) {
        _chatContext = _buildCtx(video, cached, score);
    }

    
    const close = ()=>{ overlay.classList.remove('open'); setTimeout(()=>overlay.remove(),300); };
    document.getElementById('canal-modal-close').addEventListener('click', close);
    overlay.addEventListener('click', e=>{ if(e.target===overlay) close(); });
    const esc = e=>{ if(e.key==='Escape'){ close(); document.removeEventListener('keydown',esc); } };
    document.addEventListener('keydown', esc);

    
    document.getElementById('canal-run-analysis-btn')?.addEventListener('click', async ()=>{
        const wrap    = document.getElementById('canal-analysis-wrap');
        const loadEl  = document.getElementById('canal-analysis-loading');
        document.getElementById('canal-run-analysis-btn').style.display = 'none';
        loadEl.style.display = 'block';
        try {
            const analise = await _analyzeVideo(video, score);
            _setCache(video.id, analise);
            _chatContext = _buildCtx(video, analise, score);
            wrap.innerHTML = _renderAnalysisHtml(analise, score);
            document.getElementById('canal-chat-wrap').style.display = '';

            
            const cardBtn = document.querySelector(`.canal-analyze-btn[data-vid="${video.id}"]`);
            if (cardBtn) cardBtn.innerHTML = `${uiIcon('eye')}Ver análise`;
        } catch (e) {
            wrap.innerHTML = `<div style="text-align:center;padding:40px;color:var(--muted);">
                <div style="color:var(--red);margin-bottom:12px;">${_escHtml(e.message)}</div>
                <button class="action-btn primary" id="canal-retry-btn">Tentar novamente</button>
            </div>`;
            document.getElementById('canal-retry-btn')?.addEventListener('click',()=>{
                wrap.innerHTML = `<div style="text-align:center;padding:40px;"><button class="btn-new" id="canal-run-analysis-btn" style="display:inline-flex;">${uiIcon('search')}Analisar com IA</button></div>`;
                document.getElementById('canal-run-analysis-btn').addEventListener('click', arguments.callee);
            });
        }
    });

    
    document.getElementById('modal-find-titles-btn')?.addEventListener('click', ()=>{
        close();
        _switchCanalTab('titulos');
        
        setTimeout(()=>{
            const inp = document.getElementById('tv-theme-input');
            if (inp) {
                inp.value = video.snippet?.title?.slice(0,60)||'';
                const btn = document.getElementById('tv-search-btn');
                btn?.click();
            }
        }, 300);
    });

    
    const send = async ()=>{
        const input = document.getElementById('canal-chat-input');
        const msg   = input?.value?.trim();
        if (!msg) return;
        input.value = '';
        _appendBubble(msg,'user');
        _chatHistory.push({ role:'user', content:msg });
        const tid = _appendBubble('…','ai',true);
        try {
            const msgs = _chatContext
                ? [{ role:'system', content:_chatContext }, ..._chatHistory]
                : [..._chatHistory];
            const reply = await _groq(msgs, 0.7, 800);
            _chatHistory.push({ role:'assistant', content:reply });
            _updateBubble(tid, reply);
        } catch(e) { _updateBubble(tid,'Erro: '+e.message); }
    };
    document.getElementById('canal-chat-send')?.addEventListener('click', send);
    document.getElementById('canal-chat-input')?.addEventListener('keydown', e=>{ if(e.key==='Enter') send(); });
}

function _buildCtx(video, analise, score) {
    return `Você é especialista em YouTube e criação de conteúdo brasileiro.
Vídeo analisado:
Título: ${video.snippet?.title}
Views: ${video.statistics?.viewCount||0}
Likes: ${video.statistics?.likeCount||0}
Comentários: ${video.statistics?.commentCount||0}
Duração: ${_fmtDuration(video.contentDetails?.duration)}
Score: ${score}/100
Análise prévia: ${JSON.stringify(analise,null,2)}
Responda de forma direta e prática em Português brasileiro.`;
}


function _getCache(id) { try { return JSON.parse(localStorage.getItem('canal_analysis_'+id)); } catch { return null; } }
function _setCache(id, d) { try { localStorage.setItem('canal_analysis_'+id, JSON.stringify(d)); } catch {} }

async function _analyzeVideo(video, score) {
    const sys = `Você é especialista em YouTube brasileiro. Analise os dados e retorne JSON puro (sem markdown) com este formato exato:
{"pontos_fortes":["..."],"pontos_fracos":["..."],"sugestoes":["..."],"analise_titulo":"...","analise_thumbnail":"...","veredicto":"...","nota":7.5}`;
    const user = `Título: ${video.snippet.title}
Descrição: ${(video.snippet.description||'').slice(0,400)}
Tags: ${video.snippet.tags?.join(', ')||'nenhuma'}
Duração: ${_fmtDuration(video.contentDetails?.duration)}
Data: ${video.snippet.publishedAt}
Views: ${video.statistics?.viewCount||0}  Likes: ${video.statistics?.likeCount||0}  Comentários: ${video.statistics?.commentCount||0}
Score: ${score}/100`;
    const raw = await _groq([{role:'system',content:sys},{role:'user',content:user}], 0.6, 1200);
    try { return JSON.parse(raw.replace(/```json|```/g,'').trim()); }
    catch { throw new Error('IA retornou formato inválido. Tente novamente.'); }
}

function _renderAnalysisHtml(a, score) {
    const nota = parseFloat(a.nota)||0;
    const nc   = nota>=7?'#50dc78':nota>=5?'var(--gold)':'var(--red)';
    const li   = (arr,icon) => (arr||[]).map(x=>`<div class="canal-analysis-item">${icon} ${_escHtml(x)}</div>`).join('');
    return `
    <div class="canal-analysis-nota">
        <span style="color:${nc};font-size:52px;font-family:var(--font-display);line-height:1;">${nota.toFixed(1)}</span>
        <span style="color:var(--muted);font-size:18px;font-family:var(--font-display);">/10</span>
    </div>
    <div class="canal-analysis-grid">
        <div class="canal-analysis-col canal-col-strong"><div class="canal-analysis-col-title">${uiIcon('like')}Pontos Fortes</div>${li(a.pontos_fortes,uiIcon('like'))}</div>
        <div class="canal-analysis-col canal-col-weak"><div class="canal-analysis-col-title">${uiIcon('close')}Pontos Fracos</div>${li(a.pontos_fracos,uiIcon('close'))}</div>
        <div class="canal-analysis-col canal-col-suggest"><div class="canal-analysis-col-title">${uiIcon('spark')}Sugestões</div>${li(a.sugestoes,uiIcon('spark'))}</div>
    </div>
    <div class="canal-analysis-blocks">
        <div class="canal-analysis-block"><div class="canal-analysis-block-title">${uiIcon('file')}Análise do Título</div>${_escHtml(a.analise_titulo)}</div>
        <div class="canal-analysis-block"><div class="canal-analysis-block-title">${uiIcon('image')}Análise da Thumbnail</div>${_escHtml(a.analise_thumbnail)}</div>
        <div class="canal-analysis-block canal-veredicto"><div class="canal-analysis-block-title">${uiIcon('spark')}Veredicto</div>${_escHtml(a.veredicto)}</div>
    </div>`;
}


let _bubbleId = 0;
function _appendBubble(text, role, typing=false) {
    const id = 'b'+(++_bubbleId);
    const el = document.createElement('div');
    el.className = `canal-chat-bubble ${role}`;
    el.id = id;
    el.innerHTML = typing ? '<span class="spinner" style="width:14px;height:14px;"></span>' : _parseMarkdown(text);
    const c = document.getElementById('canal-chat-messages');
    if (c) { c.appendChild(el); c.scrollTop = c.scrollHeight; }
    return id;
}
function _updateBubble(id, text) {
    const el = document.getElementById(id);
    if (el) { el.innerHTML = _parseMarkdown(text); const c = el.closest('.canal-chat-messages'); if(c) c.scrollTop=c.scrollHeight; }
}



function _initTitulosPane() {
    const pane = document.getElementById('csh-titulos-pane');
    pane.dataset.loaded = '1';

    pane.innerHTML = `
    
    <div class="tv-search-wrap">
        <div class="tv-search-box">
            <div class="tv-search-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </div>
            <input class="tv-search-input" id="tv-theme-input" placeholder="Ex: guerra no minecraft, server SMP, traição..." maxlength="120" autocomplete="off">
            <button class="tv-search-btn" id="tv-search-btn">
                <span id="tv-search-btn-label">Analisar</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:13px;height:13px;"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </button>
        </div>
        <div class="tv-filters">
            <div class="tv-filter-group"><label class="tv-filter-label">Idioma</label>
                <select class="tv-filter-select" id="tv-lang"><option value="pt">Português</option><option value="en">Inglês</option><option value="es">Espanhol</option><option value="">Todos</option></select>
            </div>
            <div class="tv-filter-group"><label class="tv-filter-label">Período</label>
                <select class="tv-filter-select" id="tv-period"><option value="7">Últimos 7 dias</option><option value="30" selected>Últimos 30 dias</option><option value="90">Últimos 3 meses</option><option value="365">Último ano</option><option value="0">Qualquer</option></select>
            </div>
            <div class="tv-filter-group"><label class="tv-filter-label">Views mín.</label>
                <select class="tv-filter-select" id="tv-min-views"><option value="0">Qualquer</option><option value="10000">10k+</option><option value="50000" selected>50k+</option><option value="100000">100k+</option><option value="500000">500k+</option><option value="1000000">1M+</option></select>
            </div>
            <div class="tv-filter-group"><label class="tv-filter-label">Estilo</label>
                <select class="tv-filter-select" id="tv-style"><option value="">Qualquer</option><option value="storytelling">Storytelling</option><option value="desafio">Desafio</option><option value="drama">Drama/Traição</option><option value="guerra">Guerra</option><option value="survival">Survival</option></select>
            </div>
            <div class="tv-filter-group"><label class="tv-filter-label">Nicho</label>
                <input class="tv-filter-input" id="tv-niche" placeholder="Ex: minecraft smp" maxlength="40">
            </div>
        </div>
    </div>

    
    <div class="tv-empty" id="tv-empty">
        <div class="tv-empty-icon">${uiIcon('search')}</div>
        <div class="tv-empty-title">Digite um tema para começar</div>
        <div class="tv-empty-sub">O sistema analisa vídeos reais do YouTube e gera títulos otimizados para CTR</div>
    </div>

    <div class="tv-loading" id="tv-loading" style="display:none;">
        <div class="tv-loading-steps">
            <div class="tv-step active" id="tvstep-1">${uiIcon('search')}Buscando vídeos no YouTube…</div>
            <div class="tv-step" id="tvstep-2">${uiIcon('eye')}Analisando performance e padrões…</div>
            <div class="tv-step" id="tvstep-3">${uiIcon('spark')}Gerando títulos com IA…</div>
        </div>
    </div>

    <div class="tv-config-warn" id="tv-config-warn" style="display:none;">
        <div class="tv-config-warn-title">${uiIcon('lock')}Chaves de API não configuradas</div>
        <div class="tv-config-warn-body">
            Configure em <code>config.js</code>:<br><code>window.YOUTUBE_API_KEY = 'AIza...';</code><br>
            <code>window.GROQ_API_KEY = 'gsk_...';</code>
        </div>
    </div>

    <div id="tv-results-wrap" style="display:none;"></div>

    <div class="tv-preview-overlay" id="tv-preview-modal" aria-hidden="true">
        <div class="tv-preview-modal" role="dialog" aria-modal="true" aria-labelledby="tv-preview-title">
            <div class="tv-preview-header">
                <div><span class="tv-preview-eyebrow">SIMULADOR DE PUBLICAÇÃO</span><h3 id="tv-preview-title">Preview do vídeo</h3></div>
                <button class="tv-preview-close" id="tv-preview-close" aria-label="Fechar">&times;</button>
            </div>
            <div class="tv-preview-layout">
                <div class="tv-preview-player">
                    <div class="tv-preview-thumb" id="tv-preview-thumb"><span>Thumbnail</span></div>
                    <div class="tv-preview-video-title" id="tv-preview-video-title"></div>
                    <div class="tv-preview-meta"><span id="tv-preview-channel">Seu canal</span><span>•</span><span>Agora</span></div>
                    <p class="tv-preview-description" id="tv-preview-description"></p>
                </div>
                <div class="tv-preview-controls">
                    <label>Título <span id="tv-preview-count">0/100</span></label>
                    <input id="tv-preview-title-input" maxlength="100" autocomplete="off">
                    <label>Thumbnail (URL)</label>
                    <input id="tv-preview-thumb-input" type="url" placeholder="https://...">
                    <label>ou envie uma imagem</label>
                    <input id="tv-preview-file-input" type="file" accept="image/*">
                    <label>Descrição</label>
                    <textarea id="tv-preview-description-input" maxlength="500" placeholder="Uma breve descrição para testar a apresentação."></textarea>
                </div>
            </div>
        </div>
    </div>

    
    <div class="tv-board-modal-overlay" id="tv-board-modal">
        <div class="tv-board-modal">
            <div class="tv-board-modal-header">
                <div class="tv-board-modal-title">${uiIcon('board')} Adicionar ao Board</div>
                <button class="tv-board-modal-close" id="tv-bm-close" aria-label="Fechar">${uiIcon('close')}</button>
            </div>
            <div class="tv-board-modal-thumb" id="tv-bm-thumb" style="display:none;"><img id="tv-bm-thumb-img" src="" alt=""></div>
            <div class="tv-board-modal-info" id="tv-bm-info"></div>
            <div class="tv-board-modal-body">
                <div class="tv-filter-group" style="width:100%;"><label class="tv-filter-label">Board</label><select class="tv-filter-select" id="tv-bm-board" style="width:100%;"></select></div>
                <div class="tv-filter-group" style="width:100%;margin-top:10px;"><label class="tv-filter-label">Lista</label><select class="tv-filter-select" id="tv-bm-list" style="width:100%;"></select></div>
            </div>
            <div class="tv-board-modal-footer">
                <button class="action-btn" id="tv-bm-cancel">Cancelar</button>
                <button class="action-btn primary" id="tv-bm-save">Adicionar</button>
            </div>
        </div>
    </div>
    `;

    
    document.getElementById('tv-search-btn').addEventListener('click', _tvRun);
    document.getElementById('tv-theme-input').addEventListener('keypress', e=>{ if(e.key==='Enter') _tvRun(); });

    
    document.getElementById('tv-bm-close')?.addEventListener('click', _tvCloseBm);
    document.getElementById('tv-bm-cancel')?.addEventListener('click', _tvCloseBm);
    document.getElementById('tv-board-modal')?.addEventListener('click', e=>{ if(e.target.id==='tv-board-modal') _tvCloseBm(); });
    document.getElementById('tv-bm-save')?.addEventListener('click', _tvSaveBm);
    document.getElementById('tv-bm-board')?.addEventListener('change', e=>_tvLoadLists(e.target.value));
    document.getElementById('tv-preview-close')?.addEventListener('click', _tvClosePreview);
    document.getElementById('tv-preview-modal')?.addEventListener('click', e=>{ if (e.target.id === 'tv-preview-modal') _tvClosePreview(); });
    document.getElementById('tv-preview-title-input')?.addEventListener('input', _tvUpdatePreview);
    document.getElementById('tv-preview-thumb-input')?.addEventListener('input', _tvUpdatePreview);
    document.getElementById('tv-preview-description-input')?.addEventListener('input', _tvUpdatePreview);
    document.getElementById('tv-preview-file-input')?.addEventListener('change', _tvPreviewFile);
}


async function _tvRun() {
    if (_tvSearching) return;
    const theme = document.getElementById('tv-theme-input')?.value.trim();
    if (!theme) { if(typeof showToast==='function') showToast('Digite um tema!'); return; }
    if (!_YT_KEY()||!_GROQ_KEY()) {
        document.getElementById('tv-empty').style.display='none';
        document.getElementById('tv-config-warn').style.display='block';
        return;
    }
    _tvSearching = true;
    _tvSetLoading(true);
    try {
        _tvStep(1);
        const videos = await _tvSearchYT(theme);
        _tvStep(2);
        const filtered = _tvFilterViews(videos);
        if (!filtered.length) {
            if(typeof showToast==='function') showToast('Sem resultados. Tente ampliar os filtros.');
            _tvSetLoading(false); _tvSearching=false; return;
        }
        const patterns = _tvAnalyzePatterns(filtered);
        _tvStep(3);
        const suggestions = await _tvGenerateTitles(theme, filtered, patterns);
        _tvResults = filtered; _tvSuggestions = suggestions;
        _tvRenderResults(theme, filtered, patterns, suggestions);
    } catch(e) {
        if(typeof showToast==='function') showToast('Erro: '+e.message);
        _tvSetLoading(false);
    } finally { _tvSearching = false; }
}


async function _tvYtSearch(query, period, lang, max=15) {
    const p = new URLSearchParams({ part:'snippet', q:query, type:'video', maxResults:String(max), order:'viewCount', relevanceLanguage:lang||'pt', key:_YT_KEY() });
    if (period>0) { const a=new Date(); a.setDate(a.getDate()-period); p.set('publishedAfter',a.toISOString()); }
    const r = await fetch(`https://www.googleapis.com/youtube/v3/search?${p}`);
    if (!r.ok) { const e=await r.json().catch(()=>{}); throw new Error(e?.error?.message||`YT ${r.status}`); }
    const d = await r.json();
    return d.items||[];
}

function _tvBuildQueries(theme, niche) {
    if (niche) return [`${theme} ${niche}`, `${niche} ${theme}`, `${theme} ${niche} ep`];
    return [theme, `${theme} ep`, `${theme} minecraft`];
}

function _tvIsShort(dur, title) {
    if (/\bshorts?\b/i.test(title)||/#shorts?\b/i.test(title)) return true;
    if (!dur) return false;
    const m = dur.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!m) return false;
    return (+m[1]||0)*3600+(+m[2]||0)*60+(+m[3]||0) <= 65;
}

function _tvIsNotPt(title) {
    return /\b(the|this|that|how|when|why|best|most|top|i |my |we |our |was|were|has|have|will|with|for |from|into|they|them|their|what|who)\b/i.test(title);
}

async function _tvSearchYT(theme) {
    const lang   = document.getElementById('tv-lang')?.value||'pt';
    const niche  = document.getElementById('tv-niche')?.value?.trim()||'';
    const period = parseInt(document.getElementById('tv-period')?.value||'30');
    const queries= _tvBuildQueries(theme, niche);

    let items = [];
    for (const q of queries) {
        try { items.push(...await _tvYtSearch(q, period, lang, 15)); } catch {}
    }
    
    if (items.length < 5) {
        try { items.push(...await _tvYtSearch(niche?`${theme} ${niche}`:theme, 365, lang, 15)); } catch {}
    }
    if (items.length < 5) {
        try { items.push(...await _tvYtSearch(niche?`${theme} ${niche}`:theme, 0, lang, 20)); } catch {}
    }
    if (items.length < 3 && lang==='pt') {
        try { items.push(...await _tvYtSearch(niche?`${theme} ${niche}`:theme, 0, '', 20)); } catch {}
    }

    
    const seen = new Set();
    items = items.filter(i=>{ const id=i.id?.videoId; if(!id||seen.has(id)) return false; seen.add(id); return true; });
    if (!items.length) return [];

    
    const ids = items.map(i=>i.id.videoId).join(',');
    const sd = await _ytFetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet,contentDetails&id=${ids}&key=${_YT_KEY()}`);
    const sm = new Map((sd.items||[]).map(v=>[v.id,v]));

    let videos = items.map(item=>{
        const id = item.id.videoId;
        const st = sm.get(id);
        const views = parseInt(st?.statistics?.viewCount||0);
        const days  = Math.max(1, Math.floor((Date.now()-new Date(item.snippet.publishedAt))/86400000));
        const dur   = st?.contentDetails?.duration||'';
        return {
            id, title:item.snippet.title, titleOrig:item.snippet.title,
            channel:item.snippet.channelTitle, publishedAt:item.snippet.publishedAt,
            daysAgo:days, views, viewsPerDay:Math.round(views/days),
            thumb:item.snippet.thumbnails?.medium?.url||'',
            url:`https://youtube.com/watch?v=${id}`,
            isShort:_tvIsShort(dur, item.snippet.title),
        };
    }).filter(v=>!v.isShort);

    
    const anchor = niche.toLowerCase()||theme.split(' ')[0].toLowerCase();
    if (anchor && videos.length > 5) {
        const inNiche = videos.filter(v=> v.title.toLowerCase().includes(anchor)||v.channel.toLowerCase().includes(anchor));
        if (inNiche.length >= 4) videos = inNiche;
    }

    
    if (lang==='pt') {
        const toTr = videos.filter(v=>_tvIsNotPt(v.titleOrig));
        if (toTr.length) {
            try {
                const raw = await _groq([{role:'user',content:`Traduza para Português Brasileiro, preservando nomes, siglas (SMP,PVP) e emojis. Retorne APENAS um array JSON de strings na mesma ordem:\n${JSON.stringify(toTr.map(v=>v.titleOrig))}`}], 0.3, 1000);
                const tr = JSON.parse(raw.replace(/```json|```/g,'').trim());
                toTr.forEach((v,i)=>{ if(tr[i]) v.title=`${tr[i]} *(traduzido)*`; });
            } catch {}
        }
    }
    return videos;
}

function _tvFilterViews(videos) {
    const min = parseInt(document.getElementById('tv-min-views')?.value||'0');
    if (!min) return videos;
    let f = videos.filter(v=>v.views>=min);
    if (!f.length) f = [...videos].sort((a,b)=>b.views-a.views).slice(0,15);
    return f.length ? f : videos;
}

function _tvAnalyzePatterns(videos) {
    const titles = videos.map(v=>v.title);
    const freq   = {};
    const stop   = new Set(['o','a','os','as','de','do','da','em','no','na','um','uma','e','é','foi','para','por','com','que','se','não','mas','ao','já']);
    titles.forEach(t=>t.toLowerCase().replace(/[^a-záàãâéêíóôõúç\s]/g,'').split(/\s+/).forEach(w=>{
        if(w.length>2&&!stop.has(w)) freq[w]=(freq[w]||0)+1;
    }));
    const topWords = Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,12).map(([w])=>w);

    const structs = [
        {n:'Primeira pessoa',r:/\b(eu|fui|me|meu|nossa)\b/i},{n:'Número',r:/^\d+/},
        {n:'Pergunta',r:/\?$/},{n:'Traição/Conflito',r:/\b(trai|guerra|inimig|luta)\b/i},
        {n:'Superlativo',r:/\b(maior|pior|melhor|nunca)\b/i},{n:'Surpresa',r:/\b(mas|só que|não esperava)\b/i},
    ].filter(p=>titles.some(t=>p.r.test(t))).map(p=>p.n);

    const emos = [
        ['Traição',/\b(trai|traído)\b/i],['Guerra',/\b(guerra|batalha)\b/i],
        ['Sobrevivência',/\b(sobreviv|destrui)\b/i],['Mistério',/\b(segredo|verdade)\b/i],
        ['Desafio',/\b(desafio|impossível)\b/i],['Drama',/\b(drama|acabou)\b/i],
    ].filter(([,r])=>titles.some(t=>r.test(t))).map(([n])=>n);

    const avgViews = videos.reduce((s,v)=>s+v.views,0)/(videos.length||1);
    const saturation = videos.length>=25&&avgViews>200000?'alta':videos.length>=15&&avgViews>50000?'média':'baixa';
    const top5  = [...videos].sort((a,b)=>b.viewsPerDay-a.viewsPerDay).slice(0,5);
    const avgLen= Math.round(top5.reduce((s,v)=>s+v.title.length,0)/(top5.length||1));

    return { topWords, structures:structs, emotions:emos.length?emos:['Narrativa'], saturation, avgViews, avgTitleLen:avgLen };
}

async function _tvGenerateTitles(theme, videos, patterns) {
    const style = document.getElementById('tv-style')?.value||'';
    const lang  = document.getElementById('tv-lang')?.value||'pt';
    const niche = document.getElementById('tv-niche')?.value?.trim()||'';
    const tops  = [...videos].sort((a,b)=>b.viewsPerDay-a.viewsPerDay).slice(0,10)
        .map(v=>`- "${v.title}" (${_fmtN(v.views)} views, ${v.daysAgo}d, ${_fmtN(v.viewsPerDay)}/dia)`).join('\n');

    const prompt = `Você é roteirista e estrategista de YouTube com 10 anos de experiência em títulos virais.

TEMA: "${theme}" | NICHO: ${niche||'geral'} | ESTILO: ${style||'livre'} | IDIOMA: ${lang==='pt'?'Português brasileiro':lang}

REFERÊNCIAS QUE PERFORMARAM BEM:
${tops||'(sem dados — use conhecimento do nicho)'}

PADRÕES ENCONTRADOS:
- Estruturas: ${patterns.structures.join(', ')||'variado'}
- Emoções: ${patterns.emotions.join(', ')}
- Palavras-chave: ${patterns.topWords.slice(0,8).join(', ')}
- Comprimento médio dos tops: ${patterns.avgTitleLen} chars

REGRAS:
1. Gere exatamente 6 títulos únicos e diferentes entre si
2. Cada título deve parecer escrito por um criador humano apaixonado
3. Use vocabulário específico do nicho (Minecraft: SMP, aliança, reino, etc.)
4. Misture tensão, curiosidade, drama e surpresa
5. Comprimento ideal: 50-80 chars
6. Emojis são permitidos se naturais pro nicho
7. NÃO copie as referências — inspire-se mas inove

Responda APENAS JSON puro:
{"titles":[{"title":"","ctr_score":8,"reason":"","keywords":[],"emotion":"","format":""}],"pattern_analysis":"","saturation_note":"","alternative_angles":[]}`;

    const raw = await _groq([{role:'user',content:prompt}], 0.92, 2500);
    try { return JSON.parse(raw.replace(/```json|```/g,'').trim()); }
    catch { return { titles:[], pattern_analysis:raw.slice(0,300), saturation_note:'', alternative_angles:[] }; }
}


function _tvRenderResults(theme, videos, patterns, suggestions) {
    _tvSetLoading(false);
    document.getElementById('tv-empty').style.display='none';
    const wrap = document.getElementById('tv-results-wrap');
    wrap.style.display = 'block';

    const satColor = {alta:'#e8111a',média:'#ff9800',baixa:'#4caf50'}[patterns.saturation];
    const satPct   = {alta:85,média:50,baixa:25}[patterns.saturation];
    const compet   = {alta:'Mercado saturado — aposte em ângulos únicos',média:'Competitividade moderada — boas oportunidades',baixa:'Nicho com espaço — ótimo momento para entrar'}[patterns.saturation];

    const sortedV = [...videos].sort((a,b)=>b.viewsPerDay-a.viewsPerDay);

    wrap.innerHTML = `


    
    <div class="tv-section">
        <div class="tv-section-header">
            <div class="tv-section-title">${uiIcon('video')} Vídeos analisados</div>
            <div class="tv-section-count">${videos.length} encontrados</div>
        </div>
        <div class="tv-videos-grid" id="tv-videos-grid">
            ${sortedV.map((v,i)=>`
            <a class="tv-video-card ${i<3?'tv-top':''}" href="${v.url}" target="_blank" rel="noopener">
                ${i<3?`<div class="tv-top-badge">#${i+1} TOP</div>`:''}
                <div class="tv-video-thumb"><img src="${v.thumb}" loading="lazy" onerror="this.style.display='none'"></div>
                <div class="tv-video-info">
                    <div class="tv-video-title">${_escHtml(v.title)}</div>
                    <div class="tv-video-meta">
                        <span class="tv-views">${_fmtN(v.views)} views</span>
                        <span class="tv-vpd">${_fmtN(v.viewsPerDay)}/dia</span>
                        <span class="tv-days">${v.daysAgo}d atrás</span>
                    </div>
                    <div class="tv-video-channel">${_escHtml(v.channel)}</div>
                </div>
                ${_CANAL_PUBLIC() ? '' : `<button class="tv-add-board-btn" data-idx="${i}" onclick="event.preventDefault();event.stopPropagation();">${uiIcon('board')} Board</button>`}
            </a>`).join('')}
        </div>
    </div>


    
    <div class="tv-section">
        <div class="tv-section-header">
            <div class="tv-section-title">${uiIcon('spark')} Títulos gerados pela IA</div>
            <button class="action-btn" id="tv-regen-btn" style="gap:6px;">
                <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" style="width:13px;height:13px;"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                Regenerar
            </button>
        </div>
        <div class="tv-titles-grid" id="tv-titles-grid"></div>
    </div>

    `;

    _tvRenderTitlesGrid(suggestions);

    
    wrap.querySelectorAll('.tv-add-board-btn').forEach(btn=>{
        btn.addEventListener('click', e=>{ e.preventDefault(); e.stopPropagation(); _tvOpenBm(sortedV[parseInt(btn.dataset.idx)]); });
    });

    
    document.getElementById('tv-regen-btn')?.addEventListener('click', async()=>{
        if (_tvSearching||!_tvResults.length) return;
        _tvSearching = true;
        const btn = document.getElementById('tv-regen-btn');
        btn.disabled=true; btn.innerHTML='<span class="spinner"></span> Gerando…';
        try {
            const p = _tvAnalyzePatterns(_tvResults);
            const s = await _tvGenerateTitles(document.getElementById('tv-theme-input')?.value.trim(), _tvResults, p);
            _tvRenderTitlesGrid(s);
            if(typeof showToast==='function') showToast('Novos títulos!');
        } catch(e) { if(typeof showToast==='function') showToast('Erro: '+e.message); }
        finally { _tvSearching=false; btn.disabled=false; btn.innerHTML='↻ Regenerar'; }
    });
}

function _tvRenderTitlesGrid(suggestions) {
    const grid = document.getElementById('tv-titles-grid');
    if (!grid) return;
    const titles = suggestions.titles||[];
    if (!titles.length) { grid.innerHTML = '<div class="tv-empty-titles">Nenhum título gerado.</div>'; return; }

    grid.innerHTML = titles.map((t,i)=>{
        const score = Math.min(10,Math.max(1,t.ctr_score||7));
        const sc    = score>=8?'#4caf50':score>=6?'#ff9800':'#888';
        const kws   = (t.keywords||[]).map(k=>`<span class="tv-kw">${_escHtml(k)}</span>`).join('');
        return `
        <div class="tv-title-card">
            <div class="tv-title-top">
                <div class="tv-title-emotion">${_escHtml(t.emotion||'')}</div>
                <div class="tv-ctr-score" style="color:${sc};"><span class="tv-ctr-num">${score}</span><span class="tv-ctr-max">/10</span></div>
            </div>
            <div class="tv-title-text">${_escHtml(t.title)}</div>
            <div class="tv-title-reason">${_escHtml(t.reason||'')}</div>
            <div class="tv-title-kws">${kws}</div>
            <div class="tv-title-format">${_escHtml(t.format||'')}</div>
            <div class="tv-title-actions">
                <button class="tv-copy-btn" data-title="${_escHtml(t.title)}">
                    <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" style="width:12px;height:12px;"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                    Copiar
                </button>
                ${_CANAL_PUBLIC() ? '' : `<button class="tv-save-btn" data-title="${_escHtml(t.title)}">
                    <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" style="width:12px;height:12px;"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg>
                    Salvar no Board
                </button>`}
                <button class="tv-preview-btn" data-title="${_escHtml(t.title)}">
                    <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" style="width:12px;height:12px;"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>
                    Testar preview
                </button>
            </div>
        </div>`;
    }).join('');

    grid.querySelectorAll('.tv-copy-btn').forEach(b=>{
        b.addEventListener('click',()=>{ navigator.clipboard.writeText(b.dataset.title).then(()=>{ if(typeof showToast==='function') showToast('Copiado!'); }); });
    });
    grid.querySelectorAll('.tv-save-btn').forEach(b=>{
        b.addEventListener('click',()=>_tvSaveTitle(b.dataset.title));
    });
    grid.querySelectorAll('.tv-preview-btn').forEach(b=>{
        b.addEventListener('click',()=>_tvOpenPreview(b.dataset.title));
    });
}

function _openChannelPreview() {
    document.getElementById('canal-preview-editor')?.remove();
    const preview = _channelPreview || { title:'', thumbnail:'', description:'' };
    const previous = _channelPreview ? { ..._channelPreview } : null;
    const overlay = document.createElement('div');
    overlay.className = 'canal-preview-overlay';
    overlay.id = 'canal-preview-editor';
    overlay.innerHTML = `
    <div class="canal-preview-editor" role="dialog" aria-modal="true" aria-labelledby="canal-preview-heading">
        <div class="canal-preview-editor-head">
            <div><span>VÍDEO TEMPORÁRIO</span><h3 id="canal-preview-heading">Testar preview no canal</h3></div>
            <button class="canal-preview-close" id="canal-preview-close" aria-label="Fechar">&times;</button>
        </div>
        <p>Este vídeo existe apenas nesta página. Nada será enviado ou salvo.</p>
        <label>Título</label>
        <input id="canal-preview-title" maxlength="100" value="${_escHtml(preview.title)}" placeholder="Digite o título do vídeo">
        <label>Thumbnail por URL</label>
        <input id="canal-preview-thumbnail" type="url" value="${_escHtml(preview.thumbnail)}" placeholder="https://...">
        <label>ou envie uma imagem</label>
        <input id="canal-preview-file" type="file" accept="image/*">
        <label>Descrição</label>
        <textarea id="canal-preview-description" maxlength="500" placeholder="Digite uma descrição">${_escHtml(preview.description)}</textarea>
        <div class="canal-preview-editor-footer"><button class="action-btn" id="canal-preview-cancel">Fechar</button><button class="action-btn primary" id="canal-preview-apply">Adicionar ao canal</button></div>
    </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(()=>overlay.classList.add('open'));
    const close = () => { overlay.classList.remove('open'); setTimeout(()=>overlay.remove(), 200); };
    const cancel = () => { _channelPreview = previous; _renderVideoGrid(); close(); };
    const update = () => {
        _channelPreview = {
            title: document.getElementById('canal-preview-title').value.trim(),
            thumbnail: document.getElementById('canal-preview-thumbnail').value.trim(),
            description: document.getElementById('canal-preview-description').value.trim(),
        };
        _renderVideoGrid();
    };
    document.getElementById('canal-preview-title').addEventListener('input', update);
    document.getElementById('canal-preview-thumbnail').addEventListener('input', update);
    document.getElementById('canal-preview-description').addEventListener('input', update);
    document.getElementById('canal-preview-file').addEventListener('change', event=>{
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            document.getElementById('canal-preview-thumbnail').value = reader.result;
            update();
        };
        reader.readAsDataURL(file);
    });
    document.getElementById('canal-preview-apply').addEventListener('click', ()=>{ update(); close(); });
    document.getElementById('canal-preview-close').addEventListener('click', cancel);
    document.getElementById('canal-preview-cancel').addEventListener('click', cancel);
    overlay.addEventListener('click', event=>{ if (event.target === overlay) cancel(); });
}

function _tvOpenPreview(title) {
    const modal = document.getElementById('tv-preview-modal');
    if (!modal) return;
    const channel = _channelData?.snippet?.title || 'Seu canal';
    document.getElementById('tv-preview-title-input').value = title || '';
    document.getElementById('tv-preview-thumb-input').value = '';
    document.getElementById('tv-preview-file-input').value = '';
    document.getElementById('tv-preview-description-input').value = '';
    document.getElementById('tv-preview-channel').textContent = channel;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    _tvUpdatePreview();
}

function _tvClosePreview() {
    const modal = document.getElementById('tv-preview-modal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
}

function _tvUpdatePreview() {
    const title = document.getElementById('tv-preview-title-input')?.value || 'Seu título aparecerá aqui';
    const thumbUrl = document.getElementById('tv-preview-thumb-input')?.value.trim() || '';
    const description = document.getElementById('tv-preview-description-input')?.value || 'A descrição do vídeo aparecerá neste espaço.';
    const thumb = document.getElementById('tv-preview-thumb');
    document.getElementById('tv-preview-video-title').textContent = title;
    document.getElementById('tv-preview-description').textContent = description;
    document.getElementById('tv-preview-count').textContent = `${title.length}/100`;
    if (thumbUrl) {
        thumb.style.backgroundImage = `url("${thumbUrl.replace(/"/g, '%22')}")`;
        thumb.classList.add('has-image');
    } else {
        thumb.style.backgroundImage = '';
        thumb.classList.remove('has-image');
    }
}

function _tvPreviewFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        const thumb = document.getElementById('tv-preview-thumb');
        thumb.style.backgroundImage = `url("${reader.result}")`;
        thumb.classList.add('has-image');
        document.getElementById('tv-preview-thumb-input').value = '';
    };
    reader.readAsDataURL(file);
}

async function _tvSaveTitle(title) {
    if (!window.currentUser) { if(typeof showToast==='function') showToast('Faça login.'); return; }
    try {
        const { data:boards } = await sb.from('boards').select('id').eq('user_id',window.currentUser.id).order('created_at').limit(1);
        if (!boards?.length) { if(typeof showToast==='function') showToast('Crie um board primeiro!'); return; }
        const bid = boards[0].id;
        let { data:lists } = await sb.from('lists').select('id').eq('board_id',bid).ilike('title','%ideia%').limit(1);
        let lid;
        if (lists?.length) { lid = lists[0].id; }
        else {
            const { data:nl } = await sb.from('lists').insert({ title:'Ideias de Títulos', board_id:bid, user_id:window.currentUser.id, position:99 }).select().single();
            lid = nl?.id;
        }
        if (!lid) return;
        await sb.from('cards').insert({ title, list_id:lid, board_id:bid, user_id:window.currentUser.id, position:0 });
        if(typeof showToast==='function') showToast('Título salvo no Board!');
    } catch(e) { if(typeof showToast==='function') showToast('Erro: '+e.message); }
}


async function _tvOpenBm(video) {
    _tvBmVideo = video;
    const modal = document.getElementById('tv-board-modal');
    if (!modal) return;
    modal.classList.add('open');
    const ti = document.getElementById('tv-bm-thumb-img');
    const tw = document.getElementById('tv-bm-thumb');
    if (video.thumb) { ti.src=video.thumb; tw.style.display='block'; } else { tw.style.display='none'; }
    document.getElementById('tv-bm-info').innerHTML = `<strong style="color:var(--text)">${_escHtml(video.title)}</strong><br>${_escHtml(video.channel)} · ${_fmtN(video.views)} views`;

    const bs = document.getElementById('tv-bm-board');
    bs.innerHTML = '<option>Carregando…</option>';
    document.getElementById('tv-bm-list').innerHTML = '<option>Selecione um board</option>';

    const { data:boards } = await sb.from('boards').select('id,title').eq('user_id',window.currentUser.id).order('created_at');
    if (!boards?.length) { bs.innerHTML='<option>Nenhum board</option>'; return; }
    bs.innerHTML = boards.map(b=>`<option value="${b.id}">${_escHtml(b.title)}</option>`).join('');
    await _tvLoadLists(boards[0].id);
}

async function _tvLoadLists(boardId) {
    const ls = document.getElementById('tv-bm-list');
    if (!boardId||!ls) return;
    ls.innerHTML='<option>Carregando…</option>';
    const { data:lists } = await sb.from('lists').select('id,title').eq('board_id',boardId).order('position');
    ls.innerHTML = lists?.length ? lists.map(l=>`<option value="${l.id}">${_escHtml(cleanLegacyIconText(l.title))}</option>`).join('') : '<option>Nenhuma lista</option>';
}

async function _tvSaveBm() {
    if (!_tvBmVideo||!window.currentUser) return;
    const bid = document.getElementById('tv-bm-board')?.value;
    const lid = document.getElementById('tv-bm-list')?.value;
    if (!bid||!lid) { if(typeof showToast==='function') showToast('Selecione board e lista.'); return; }
    const btn = document.getElementById('tv-bm-save');
    btn.disabled=true; btn.innerHTML='<span class="spinner"></span>';
    try {
        const meta = { ytUrl:_tvBmVideo.url, notes:_tvBmVideo.title, tags:[_tvBmVideo.channel,_fmtN(_tvBmVideo.views)+' views'], priority:'normal', dueDate:'', checklist:[] };
        const { data:cards } = await sb.from('cards').select('position').eq('list_id',lid).order('position',{ascending:false}).limit(1);
        const pos = cards?.length ? (cards[0].position||0)+1 : 0;
        await sb.from('cards').insert({ title:_tvBmVideo.title, description:'__VEXDATA__'+JSON.stringify(meta), list_id:lid, board_id:bid, user_id:window.currentUser.id, position:pos });
        if(typeof showToast==='function') showToast('Vídeo adicionado ao Board!');
        _tvCloseBm();
    } catch(e) { if(typeof showToast==='function') showToast('Erro: '+e.message); }
    finally { btn.disabled=false; btn.innerHTML='Adicionar'; }
}

function _tvCloseBm() { document.getElementById('tv-board-modal')?.classList.remove('open'); _tvBmVideo=null; }


function _tvSetLoading(on) {
    const ld = document.getElementById('tv-loading');
    const bt = document.getElementById('tv-search-btn');
    const lb = document.getElementById('tv-search-btn-label');
    if (on) {
        document.getElementById('tv-empty').style.display='none';
        document.getElementById('tv-results-wrap').style.display='none';
        if(ld) ld.style.display='flex';
        if(bt) bt.disabled=true;
        if(lb) lb.textContent='Analisando…';
    } else {
        if(ld) ld.style.display='none';
        if(bt) bt.disabled=false;
        if(lb) lb.textContent='Analisar';
    }
}

function _tvStep(n) {
    for (let i=1;i<=3;i++) {
        const el=document.getElementById(`tvstep-${i}`);
        if(!el) continue;
        el.classList.remove('active','done');
        if(i<n) el.classList.add('done');
        if(i===n) el.classList.add('active');
    }
}
