







const YT_API_KEY = window.YOUTUBE_API_KEY || '';   
const GROQ_API_KEY = window.GROQ_API_KEY || '';   
const GROQ_MODEL = 'openai/gpt-oss-120b';      


let titulosLastResults = [];
let titulosLastSuggestions = [];
let titulosSearching = false;





let tvBmVideo = null; 

function initBoardModal() {
    
    document.addEventListener('click', function(e) {
        
        if (e.target.id === 'tv-bm-close' || e.target.id === 'tv-bm-cancel') {
            closeBoardModal();
            return;
        }
        
        if (e.target.id === 'tv-board-modal') {
            closeBoardModal();
            return;
        }
        
        if (e.target.id === 'tv-bm-save') {
            saveToBoardModal();
            return;
        }
    });

    
    document.addEventListener('change', function(e) {
        if (e.target.id === 'tv-bm-board') {
            loadListsForBoard(e.target.value);
        }
    });
}

async function openAddToBoardModal(video) {
    console.log('◆ openAddToBoardModal chamado', video);
    
    const modal = document.getElementById('tv-board-modal');
    console.log('◆ modal encontrado?', modal);
    
    if (!modal) {
        alert('ERRO: modal não encontrado no DOM');
        return;
    }
    
    modal.classList.add('open');
    console.log('◆ classe open adicionada, classes agora:', modal.className);
    tvBmVideo = video;

    const thumbWrap = document.getElementById('tv-bm-thumb');
    const thumbImg  = document.getElementById('tv-bm-thumb-img');
    if (video.thumb) {
        thumbImg.src = video.thumb;
        thumbWrap.style.display = 'block';
    } else {
        thumbWrap.style.display = 'none';
    }

    document.getElementById('tv-bm-info').innerHTML =
        `<strong style="color:var(--text);font-size:.85rem;">${escapeHtml(video.title)}</strong><br>` +
        `${escapeHtml(video.channel)} · ${fmtViews(video.views)} views`;

    const boardSel = document.getElementById('tv-bm-board');
    boardSel.innerHTML = '<option value="">Carregando…</option>';
    document.getElementById('tv-bm-list').innerHTML = '<option value="">Selecione um board primeiro</option>';

    
    document.getElementById('tv-board-modal').classList.add('open');

    try {
        const { data: boards, error } = await sb
            .from('boards')
            .select('id, title')
            .eq('user_id', window.currentUser.id)
            .order('created_at');

        if (error || !boards?.length) {
            boardSel.innerHTML = '<option value="">Nenhum board encontrado</option>';
            return;
        }

        boardSel.innerHTML = boards.map(b =>
            `<option value="${b.id}">${escapeHtml(b.title)}</option>`
        ).join('');

        await loadListsForBoard(boards[0].id);

    } catch (err) {
        boardSel.innerHTML = '<option value="">Erro ao carregar</option>';
        showToast('Erro: ' + err.message);
    }
}

async function loadListsForBoard(boardId) {
    const listSel = document.getElementById('tv-bm-list');
    if (!boardId) { listSel.innerHTML = '<option value="">Selecione um board primeiro</option>'; return; }

    listSel.innerHTML = '<option value="">Carregando…</option>';

    try {
        const { data: lists, error } = await sb
            .from('lists')
            .select('id, title')
            .eq('board_id', boardId)
            .order('position');

        if (error || !lists?.length) {
            listSel.innerHTML = '<option value="">Nenhuma lista neste board</option>';
            return;
        }

        listSel.innerHTML = lists.map(l =>
            `<option value="${l.id}">${escapeHtml(l.title)}</option>`
        ).join('');

    } catch (err) {
        listSel.innerHTML = '<option value="">Erro ao carregar listas</option>';
    }
}

async function saveToBoardModal() {
    if (!tvBmVideo) return;
    if (!window.currentUser) { showToast('Faça login para salvar.'); return; }

    const boardId = document.getElementById('tv-bm-board').value;
    const listId = document.getElementById('tv-bm-list').value;

    if (!boardId || !listId) { showToast('Selecione um board e uma lista.'); return; }

    const btn = document.getElementById('tv-bm-save');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';

    try {
        
        const meta = {
            ytUrl: tvBmVideo.url,
            notes: tvBmVideo.title,           
            tags: [tvBmVideo.channel, fmtViews(tvBmVideo.views) + ' views'],
            priority: 'normal',
            dueDate: '',
            checklist: [],
        };
        const description = '__VEXDATA__' + JSON.stringify(meta);

        const { data: cards } = await sb
            .from('cards')
            .select('id')
            .eq('list_id', listId)
            .order('position', { ascending: false })
            .limit(1);

        const nextPos = cards?.length ? (cards[0].position ?? 0) + 1 : 0;

        const { error } = await sb.from('cards').insert({
            title: tvBmVideo.title,
            description,
            list_id: listId,
            board_id: boardId,
            user_id: window.currentUser.id,
            position: nextPos,
        });

        if (error) throw error;

        showToast('Vídeo adicionado ao Board!');
        closeBoardModal();

    } catch (err) {
        showToast('Erro ao salvar: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Adicionar';
    }
}

function closeBoardModal() {
    document.getElementById('tv-board-modal')?.classList.remove('open');
    tvBmVideo = null;
}





function renderTitulosPage() {
    const body = document.getElementById('titulos-body');
    if (!body) return;
    
    if (body.dataset.initialized) return;
    body.dataset.initialized = '1';


    body.innerHTML = `
    
    <div class="tv-search-wrap">
        <div class="tv-search-box">
            <div class="tv-search-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
            </div>
            <input class="tv-search-input" id="tv-theme-input"
                placeholder="Ex: guerra no minecraft, server SMP, traição..."
                maxlength="120" autocomplete="off">
            <button class="tv-search-btn" id="tv-search-btn">
                <span id="tv-search-btn-label">Analisar</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:14px;height:14px;">
                    <line x1="5" y1="12" x2="19" y2="12"/>
                    <polyline points="12 5 19 12 12 19"/>
                </svg>
            </button>
        </div>

        
        <div class="tv-filters" id="tv-filters-row">
            <div class="tv-filter-group">
                <label class="tv-filter-label">Idioma</label>
                <select class="tv-filter-select" id="tv-lang">
                    <option value="pt">Português</option>
                    <option value="en">Inglês</option>
                    <option value="es">Espanhol</option>
                    <option value="">Todos</option>
                </select>
            </div>
            <div class="tv-filter-group">
                <label class="tv-filter-label">Período</label>
                <select class="tv-filter-select" id="tv-period">
                    <option value="7">Últimos 7 dias</option>
                    <option value="30" selected>Últimos 30 dias</option>
                    <option value="90">Últimos 3 meses</option>
                    <option value="365">Último ano</option>
                    <option value="0">Qualquer período</option>
                </select>
            </div>
            <div class="tv-filter-group">
                <label class="tv-filter-label">Views mínimas</label>
                <select class="tv-filter-select" id="tv-min-views">
                    <option value="0">Qualquer</option>
                    <option value="10000">10k+</option>
                    <option value="50000" selected>50k+</option>
                    <option value="100000">100k+</option>
                    <option value="500000">500k+</option>
                    <option value="1000000">1M+</option>
                </select>
            </div>
            <div class="tv-filter-group">
                <label class="tv-filter-label">Estilo</label>
                <select class="tv-filter-select" id="tv-style">
                    <option value="">Qualquer</option>
                    <option value="storytelling">Storytelling</option>
                    <option value="desafio">Desafio</option>
                    <option value="drama">Drama/Traição</option>
                    <option value="guerra">Guerra/Conflito</option>
                    <option value="survival">Survival</option>
                    <option value="cinematico">Cinematográfico</option>
                </select>
            </div>
            <div class="tv-filter-group">
                <label class="tv-filter-label">Nicho</label>
                <input class="tv-filter-input" id="tv-niche" placeholder="Ex: minecraft smp" maxlength="40">
            </div>
        </div>
    </div>

    
    <div class="tv-empty" id="tv-empty">
        <div class="tv-empty-icon">◆</div>
        <div class="tv-empty-title">Digite um tema para começar</div>
        <div class="tv-empty-sub">O sistema vai analisar títulos reais do YouTube e gerar sugestões otimizadas para CTR</div>
    </div>

    
    <div class="tv-loading" id="tv-loading" style="display:none;">
        <div class="tv-loading-steps" id="tv-loading-steps">
            <div class="tv-step active" id="tvstep-1">◆ Buscando vídeos no YouTube…</div>
            <div class="tv-step" id="tvstep-2">◆ Analisando performance e padrões…</div>
            <div class="tv-step" id="tvstep-3">◆ Gerando títulos com IA…</div>
        </div>
    </div>

    
    <div class="tv-config-warn" id="tv-config-warn" style="display:none;">
        <div class="tv-config-warn-title">◆ Chaves de API não configuradas</div>
        <div class="tv-config-warn-body">
            Configure as chaves no arquivo <code>titulos.js</code> ou em <code>config.js</code>:<br><br>
            <code>window.YOUTUBE_API_KEY = 'AIza...';</code><br>
            <code>window.GROQ_API_KEY = 'gsk_...';</code><br><br>
            <b>YouTube Data API v3</b> → <a href="https://console.cloud.google.com" target="_blank">console.cloud.google.com</a> (gratuito, 10k req/dia)<br>
            <b>Groq</b> → <a href="https://console.groq.com" target="_blank">console.groq.com</a> (100% gratuito)
        </div>
    </div>

    
    <div id="tv-results-wrap" style="display:none;">

        
        <div class="tv-saturation-bar" id="tv-saturation-bar"></div>

        
        <div class="tv-section">
            <div class="tv-section-header">
                <div class="tv-section-title">◆ Vídeos analisados</div>
                <div class="tv-section-count" id="tv-videos-count"></div>
            </div>
            <div class="tv-videos-grid" id="tv-videos-grid"></div>
        </div>

        
        <div class="tv-pattern-box" id="tv-pattern-box"></div>

        
        <div class="tv-section">
            <div class="tv-section-header">
                <div class="tv-section-title">◆ Títulos gerados pela IA</div>
                <button class="action-btn" id="tv-regen-btn" style="gap:6px;">
                    <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" style="width:13px;height:13px;">
                        <polyline points="23 4 23 10 17 10"/>
                        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                    </svg>
                    Regenerar
                </button>
            </div>
            <div class="tv-titles-grid" id="tv-titles-grid"></div>
        </div>

        
        <div class="tv-section" id="tv-angles-section">
            <div class="tv-section-header">
                <div class="tv-section-title">◆ Ângulos alternativos</div>
            </div>
            <div class="tv-angles-list" id="tv-angles-list"></div>
        </div>

    </div>  

    
    <div class="tv-board-modal-overlay" id="tv-board-modal">
        <div class="tv-board-modal">
            <div class="tv-board-modal-header">
                <div class="tv-board-modal-title">◆ Adicionar ao Board</div>
                <button class="tv-board-modal-close" id="tv-bm-close">◆</button>
            </div>
            <div class="tv-board-modal-thumb" id="tv-bm-thumb" style="display:none;">
                <img id="tv-bm-thumb-img" src="" alt="">
            </div>
            <div class="tv-board-modal-info" id="tv-bm-info"></div>
            <div class="tv-board-modal-body">
                <div class="tv-filter-group" style="width:100%;">
                    <label class="tv-filter-label">Board</label>
                    <select class="tv-filter-select" id="tv-bm-board" style="width:100%;"></select>
                </div>
                <div class="tv-filter-group" style="width:100%;margin-top:10px;">
                    <label class="tv-filter-label">Lista</label>
                    <select class="tv-filter-select" id="tv-bm-list" style="width:100%;"></select>
                </div>
            </div>
            <div class="tv-board-modal-footer">
                <button class="action-btn" id="tv-bm-cancel">Cancelar</button>
                <button class="action-btn primary" id="tv-bm-save">Adicionar</button>
            </div>
        </div>
    </div>

    `;

    
    document.getElementById('tv-search-btn').addEventListener('click', runTitulosSearch);
    document.getElementById('tv-theme-input').addEventListener('keypress', e => {
        if (e.key === 'Enter') runTitulosSearch();
    });
    document.getElementById('tv-regen-btn')?.addEventListener('click', () => {
        if (titulosLastResults.length) regenTituloSuggestions();
    });
    
    initBoardModal();
}





async function runTitulosSearch() {
    if (titulosSearching) return;

    const theme = document.getElementById('tv-theme-input')?.value.trim();
    if (!theme) { showToast('Digite um tema primeiro!'); return; }

    
    if (!YT_API_KEY || !GROQ_API_KEY) {
        document.getElementById('tv-empty').style.display = 'none';
        document.getElementById('tv-config-warn').style.display = 'block';
        document.getElementById('tv-results-wrap').style.display = 'none';
        return;
    }

    titulosSearching = true;
    setTitulosLoading(true);

    try {
        
        setStep(1);
        const videos = await searchYouTubeVideos(theme);

        
        setStep(2);
        let filtered = filterByMinViews(videos);

        if (filtered.length === 0) {
            showToast('Nenhum vídeo encontrado. Tente ampliar os filtros ou mudar o tema.');
            setTitulosLoading(false);
            titulosSearching = false;
            return;
        }

        const patterns = analyzePatterns(filtered);

        
        setStep(3);
        const suggestions = await generateTitlesGroq(theme, filtered, patterns);

        titulosLastResults = filtered;
        titulosLastSuggestions = suggestions;

        renderResults(theme, filtered, patterns, suggestions);

    } catch (err) {
        console.error('Títulos error:', err);
        showToast('Erro: ' + err.message);
        setTitulosLoading(false);
    } finally {
        titulosSearching = false;
    }
}

async function regenTituloSuggestions() {
    if (titulosSearching || !titulosLastResults.length) return;
    titulosSearching = true;

    const theme = document.getElementById('tv-theme-input')?.value.trim();
    const regenBtn = document.getElementById('tv-regen-btn');
    if (regenBtn) { regenBtn.disabled = true; regenBtn.innerHTML = '<span class="spinner"></span> Gerando…'; }

    try {
        const patterns = analyzePatterns(titulosLastResults);
        const suggestions = await generateTitlesGroq(theme, titulosLastResults, patterns);
        titulosLastSuggestions = suggestions;
        renderTitlesGrid(suggestions);
        showToast('Novos títulos gerados!');
    } catch (err) {
        showToast('Erro ao regenerar: ' + err.message);
    } finally {
        titulosSearching = false;
        if (regenBtn) { regenBtn.disabled = false; regenBtn.innerHTML = '<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" style="width:13px;height:13px;"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> Regenerar'; }
    }
}






function buildSearchQueries(theme, niche) {
    if (niche) {
        return [
            `${theme} ${niche}`,
            `${niche} ${theme}`,
            `${theme} ${niche} ep`,
        ];
    }
    return [
        theme,
        `${theme} ep`,
        `${theme} historia`,
    ];
}

async function ytSearch(query, period, lang, maxResults = 15) {
    const params = new URLSearchParams({
        part: 'snippet',
        q: query,
        type: 'video',
        maxResults: String(maxResults),
        order: 'viewCount',
        relevanceLanguage: lang || 'pt',
        key: YT_API_KEY,
    });

    if (period > 0) {
        const after = new Date();
        after.setDate(after.getDate() - period);
        params.set('publishedAfter', after.toISOString());
    }

    const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || `YouTube API error ${res.status}`);
    }
    const data = await res.json();
    return data.items || [];
}

async function searchYouTubeVideos(theme) {
    const lang = document.getElementById('tv-lang')?.value || 'pt';
    const niche = document.getElementById('tv-niche')?.value?.trim() || '';
    let period = parseInt(document.getElementById('tv-period')?.value || '30');

    const queries = buildSearchQueries(theme, niche);

    
    let allItems = [];
    for (const q of queries) {
        try {
            const items = await ytSearch(q, period, lang, 15);
            allItems.push(...items);
        } catch (e) {
            console.warn('Query falhou:', q, e.message);
        }
    }

    
    if (allItems.length < 5 && period > 0 && period <= 90) {
        const fallbackQuery = niche ? `${theme} ${niche}` : theme;
        for (const q of [fallbackQuery, queries[0]]) {
            try {
                const items = await ytSearch(q, 365, lang, 15);
                allItems.push(...items);
            } catch (e) { }
        }
    }

    
    if (allItems.length < 5) {
        const fallbackQuery = niche ? `${theme} ${niche}` : theme;
        try {
            const items = await ytSearch(fallbackQuery, 0, lang, 20);
            allItems.push(...items);
        } catch (e) { }
    }

    
    if (allItems.length < 3 && lang === 'pt') {
        const fallbackQuery = niche ? `${theme} ${niche}` : theme;
        try {
            const items = await ytSearch(fallbackQuery, 0, '', 20);
            allItems.push(...items);
        } catch (e) { }
    }

    
    const seen = new Set();
    allItems = allItems.filter(item => {
        const id = item.id?.videoId;
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
    });

    if (!allItems.length) return [];

    
    const ids = allItems.map(i => i.id.videoId).filter(Boolean).join(',');
    const statsRes = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet,contentDetails&id=${ids}&key=${YT_API_KEY}`
    )
    const statsData = await statsRes.json();
    const statsMap = new Map();
    (statsData.items || []).forEach(v => statsMap.set(v.id, v));

    const videos = allItems.map(item => {
        const id = item.id.videoId;
        const stats = statsMap.get(id);
        const views = parseInt(stats?.statistics?.viewCount || 0);
        const publishedAt = item.snippet.publishedAt;
        const daysAgo = Math.max(1, Math.floor((Date.now() - new Date(publishedAt)) / 86400000));
        const titleOrig = item.snippet.title;
        const duration = stats?.contentDetails?.duration || '';
        const isShort = isYouTubeShort(duration, titleOrig);

        return {
            id,
            title: titleOrig,
            titleOrig,
            channel: item.snippet.channelTitle,
            publishedAt,
            daysAgo,
            views,
            thumb: item.snippet.thumbnails?.medium?.url || '',
            url: `https://youtube.com/watch?v=${id}`,
            viewsPerDay: Math.round(views / daysAgo),
            lang: item.snippet.defaultAudioLanguage || item.snippet.defaultLanguage || '',
            isShort,  
        };
    }).filter(v => !v.isShort);;


    
    if (lang === 'pt') {
        const toTranslate = videos.filter(v => isLikelyNotPt(v.titleOrig));
        if (toTranslate.length > 0) {
            try {
                const translated = await translateTitlesGroq(toTranslate.map(v => v.titleOrig));
                toTranslate.forEach((v, i) => {
                    if (translated[i]) v.title = `${translated[i]} *(traduzido)*`;
                });
            } catch (e) {
                console.warn('Tradução falhou, usando originais:', e.message);
            }
        }
    }

    return videos;
}

function isYouTubeShort(isoDuration, title) {
    
    if (/\bshorts?\b/i.test(title) || /#shorts?\b/i.test(title)) return true;

    
    if (!isoDuration) return false;
    const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return false;
    const h = parseInt(match[1] || 0);
    const m = parseInt(match[2] || 0);
    const s = parseInt(match[3] || 0);
    const totalSeconds = h * 3600 + m * 60 + s;
    return totalSeconds > 0 && totalSeconds <= 65; 
}


function isLikelyNotPt(title) {
    
    const enWords = /\b(the|this|that|how|when|why|best|most|top|i |my |we |our |was|were|has|have|will|with|for |from|into|they|them|their|what|who|got|get|did|can|not|all|new|now|but|and |are |you |its |in |on |at |by |be )\b/i;
    return enWords.test(title);
}


async function translateTitlesGroq(titles) {
    const prompt = `Traduza os títulos abaixo para Português Brasileiro de forma natural, mantendo o estilo e impacto de título de YouTube. Preserve nomes próprios, abreviações de jogos (SMP, PVP, etc) e emojis. Responda APENAS com um array JSON de strings na mesma ordem, sem explicações:
${JSON.stringify(titles)}`;

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_API_KEY}` },
        body: JSON.stringify({
            model: GROQ_MODEL,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
            max_tokens: 1000,
        }),
    });

    if (!res.ok) throw new Error('Groq translation error');
    const data = await res.json();
    let raw = data.choices?.[0]?.message?.content || '[]';
    raw = raw.replace(/```json|```/g, '').trim();
    try { return JSON.parse(raw); } catch { return []; }
}

function filterByMinViews(videos) {
    const minViews = parseInt(document.getElementById('tv-min-views')?.value || '0');
    if (minViews === 0) return videos;

    let filtered = videos.filter(v => v.views >= minViews);

    
    if (filtered.length === 0) {
        const steps = [500000, 100000, 50000, 10000, 1000, 0];
        for (const step of steps) {
            if (step >= minViews) continue; 
            filtered = videos.filter(v => v.views >= step);
            if (filtered.length > 0) {
                if (step > 0) {
                    showToast(`Views mínimas reduzidas para ${fmtViews(step)} (sem resultados com o filtro original)`);
                }
                break;
            }
        }
    }

    return filtered.length > 0 ? filtered : videos; 
}





function analyzePatterns(videos) {
    const titles = videos.map(v => v.title);

    
    const wordFreq = {};
    const stopWords = new Set(['o', 'a', 'os', 'as', 'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'nos', 'nas', 'um', 'uma', 'uns', 'umas', 'e', 'é', 'foi', 'ser', 'para', 'por', 'com', 'que', 'se', 'não', 'mas', 'ao', 'já', 'eu', 'me', 'meu', 'minha', 'seu', 'sua', 'mais', 'muito', 'bem', 'quando', 'como', 'isso', 'este', 'essa', 'um', 'uma']);
    titles.forEach(t => {
        t.toLowerCase().replace(/[^a-záàãâéêíóôõúç\s]/g, '').split(/\s+/).forEach(w => {
            if (w.length > 2 && !stopWords.has(w)) wordFreq[w] = (wordFreq[w] || 0) + 1;
        });
    });
    const topWords = Object.entries(wordFreq).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([w]) => w);

    
    const structures = detectStructures(titles);

    
    const emotions = detectEmotions(titles);

    
    const avgViews = videos.reduce((s, v) => s + v.views, 0) / (videos.length || 1);
    const saturation = videos.length >= 25 && avgViews > 200000 ? 'alta' :
        videos.length >= 15 && avgViews > 50000 ? 'média' : 'baixa';

    
    const topByViews = [...videos].sort((a, b) => b.viewsPerDay - a.viewsPerDay).slice(0, 5);
    const avgTitleLen = Math.round(topByViews.reduce((s, v) => s + v.title.length, 0) / (topByViews.length || 1));

    return { topWords, structures, emotions, saturation, avgViews, avgTitleLen, topByViews };
}

function detectStructures(titles) {
    const patterns = [
        { name: 'Primeira pessoa dramática', regex: /\b(eu|fui|me|meu|minha|nossa|nosso)\b/i },
        { name: 'Número no início', regex: /^\d+/ },
        { name: 'Pergunta direta', regex: /\?$/ },
        { name: 'Dois pontos', regex: /:/ },
        { name: 'Traição/Conflito', regex: /\b(trai|guerra|confl|inimig|luta|batal)\b/i },
        { name: 'Superlativo', regex: /\b(maior|pior|melhor|mais|nunca|jamais|sempre)\b/i },
        { name: 'Elemento temporal', regex: /\b(final|último|primeiro|antes|depois|agora)\b/i },
        { name: 'Quebra de expectativa', regex: /\b(mas|porém|só que|não esperava)\b/i },
    ];
    return patterns.filter(p => titles.some(t => p.regex.test(t))).map(p => p.name);
}

function detectEmotions(titles) {
    const map = [
        ['Traição', /\b(trai|traído|traidores?)\b/i],
        ['Guerra', /\b(guerra|batalha|conflito|ataque)\b/i],
        ['Sobrevivência', /\b(sobreviv|último|fim|destrui|colaps)\b/i],
        ['Mistério', /\b(segredo|escondid|mistério|verdade|revelei)\b/i],
        ['Desafio', /\b(desafio|tentei|impossível|difícil)\b/i],
        ['Tensão', /\b(tenso|suspenso|quase|por pouco)\b/i],
        ['Drama', /\b(drama|chorando|acabou|terminou)\b/i],
        ['Conquista', /\b(venci|ganhei|consegui|finalmente)\b/i],
    ];
    const found = map.filter(([, r]) => titles.some(t => r.test(t))).map(([n]) => n);
    return found.length ? found : ['Narrativa'];
}





async function generateTitlesGroq(theme, videos, patterns) {
    const style = document.getElementById('tv-style')?.value || '';
    const lang = document.getElementById('tv-lang')?.value || 'pt';
    const niche = document.getElementById('tv-niche')?.value?.trim() || ''; 

    const topTitles = [...videos]
        .sort((a, b) => b.viewsPerDay - a.viewsPerDay)
        .slice(0, 10)
        .map(v => `- "${v.title}" (${fmtViews(v.views)} views, ${v.daysAgo}d atrás, ${fmtViews(v.viewsPerDay)} views/dia)`)
        .join('\n');

    const prompt = `Você é um roteirista e estrategista de YouTube com 10 anos de experiência criando títulos virais. Sua especialidade é transformar temas em títulos que geram cliques reais.

TEMA DO VÍDEO: "${theme}"
NICHO/CONTEXTO: ${niche || 'geral'}
ESTILO SOLICITADO: ${style || 'livre'}
IDIOMA: ${lang === 'pt' ? 'Português brasileiro' : lang === 'en' ? 'Inglês' : 'Espanhol'}

REFERÊNCIAS REAIS DO YOUTUBE (vídeos que já performaram bem nesse nicho):
${topTitles || '(sem dados suficientes — use seu conhecimento do nicho)'}

PADRÕES IDENTIFICADOS NAS REFERÊNCIAS:
- Estruturas comuns: ${patterns.structures.join(', ') || 'variado'}
- Gatilhos emocionais: ${patterns.emotions.join(', ')}
- Palavras que aparecem muito: ${patterns.topWords.slice(0, 8).join(', ')}
- Comprimento médio dos tops: ${patterns.avgTitleLen} caracteres

DIRETRIZES CRIATIVAS:
- Os títulos devem parecer escritos por um criador humano apaixonado pelo tema, não por IA
- Use vocabulário específico do nicho (ex: para Minecraft SMP: aliança, reino, traição, server, temporada)
- Misture tensão narrativa com curiosidade — o espectador precisa PRECISAR clicar
- Varie os ângulos: drama pessoal, conflito, revelação, conquista, virada inesperada
- Não precisa seguir os padrões das referências à risca — inove quando fizer sentido
- Títulos podem ter emojis se for natural para o nicho
- Comprimento ideal: entre 50 e 80 caracteres

PROIBIDO:
- Títulos genéricos como "Como fazer X" ou "X explicado"
- Copiar títulos das referências
- Títulos que poderiam ser de qualquer nicho

Responda APENAS em JSON puro, sem markdown, sem texto fora do JSON:
{
  "titles": [
    {
      "title": "string",
      "ctr_score": número de 1 a 10,
      "reason": "frase curta explicando o gatilho psicológico usado",
      "keywords": ["palavra1", "palavra2"],
      "emotion": "emoção principal",
      "format": "estrutura usada (ex: primeira pessoa, revelação, conflito, etc)"
    }
  ],
  "pattern_analysis": "parágrafo explicando o que os vídeos de sucesso têm em comum nesse nicho",
  "saturation_note": "frase honesta sobre a competitividade do tema",
  "alternative_angles": ["ângulo1", "ângulo2", "ângulo3", "ângulo4"]
}`;

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
            model: GROQ_MODEL,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.92,   
            max_tokens: 2500,    
        }),
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(err?.error?.message || `Groq API error ${res.status}`);
    }

    const data = await res.json();
    let raw = data.choices?.[0]?.message?.content || '{}';

    
    raw = raw.replace(/```json|```/g, '').trim();

    try {
        return JSON.parse(raw);
    } catch (e) {
        
        return { titles: [], pattern_analysis: raw.slice(0, 300), saturation_note: '', alternative_angles: [] };
    }
}





function renderResults(theme, videos, patterns, suggestions) {
    setTitulosLoading(false);

    document.getElementById('tv-empty').style.display = 'none';
    document.getElementById('tv-config-warn').style.display = 'none';
    const wrap = document.getElementById('tv-results-wrap');
    wrap.style.display = 'block';

    
    const satEl = document.getElementById('tv-saturation-bar');
    const satColor = { alta: '#e8111a', média: '#ff9800', baixa: '#4caf50' }[patterns.saturation];
    const satPct = { alta: 85, média: 50, baixa: 25 }[patterns.saturation];
    const compet = { alta: 'Mercado saturado — aposte em ângulos únicos', média: 'Competitividade moderada — boas oportunidades', baixa: 'Nicho com espaço — ótimo momento para entrar' }[patterns.saturation];
    satEl.innerHTML = `
        <div class="tv-sat-header">
            <div>
                <div class="tv-sat-title">Saturação do Tema</div>
                <div class="tv-sat-note">${compet}</div>
            </div>
            <div class="tv-sat-level" style="color:${satColor}">${patterns.saturation.toUpperCase()}</div>
        </div>
        <div class="tv-sat-track">
            <div class="tv-sat-fill" style="width:${satPct}%;background:${satColor};"></div>
        </div>
        <div class="tv-sat-stats">
            <span>${videos.length} vídeos analisados</span>
            <span>Média: ${fmtViews(Math.round(patterns.avgViews))} views</span>
            <span>Emoções: ${patterns.emotions.slice(0, 3).join(', ')}</span>
            <span>Tops: ${patterns.topWords.slice(0, 5).join(', ')}</span>
        </div>
    `;

    
    document.getElementById('tv-videos-count').textContent = `${videos.length} encontrados`;
    const vGrid = document.getElementById('tv-videos-grid');
    const sortedV = [...videos].sort((a, b) => b.viewsPerDay - a.viewsPerDay);
    vGrid.innerHTML = sortedV.map((v, i) => `
    <a class="tv-video-card ${i < 3 ? 'tv-top' : ''}" href="${v.url}" target="_blank" rel="noopener">
        ${i < 3 ? '<div class="tv-top-badge">#' + (i + 1) + ' TOP</div>' : ''}
        <div class="tv-video-thumb">
            <img src="${v.thumb}" alt="" loading="lazy" onerror="this.style.display='none'">
        </div>
        <div class="tv-video-info">
            <div class="tv-video-title">${escapeHtml(v.title)}</div>
            <div class="tv-video-meta">
                <span class="tv-views">${fmtViews(v.views)} views</span>
                <span class="tv-vpd">${fmtViews(v.viewsPerDay)}/dia</span>
                <span class="tv-days">${v.daysAgo}d atrás</span>
            </div>
            <div class="tv-video-channel">${escapeHtml(v.channel)}</div>
        </div>
        <button class="tv-add-board-btn" data-index="${i}" title="Adicionar ao Board" onclick="event.preventDefault();event.stopPropagation();">
            ◆ Board
        </button>
    </a>
`).join('');

    
    vGrid.querySelectorAll('.tv-add-board-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const idx = parseInt(btn.dataset.index);
            openAddToBoardModal(sortedV[idx]);
        });
    });

    
    const patternBox = document.getElementById('tv-pattern-box');
    patternBox.innerHTML = `
        <div class="tv-pattern-title">◆ Padrão identificado</div>
        <div class="tv-pattern-text">${escapeHtml(suggestions.pattern_analysis || 'Análise indisponível.')}</div>
        <div class="tv-pattern-tags">
            ${patterns.structures.map(s => `<span class="tv-ptag structure">${s}</span>`).join('')}
            ${patterns.emotions.map(e => `<span class="tv-ptag emotion">${e}</span>`).join('')}
        </div>
    `;

    
    renderTitlesGrid(suggestions);

    
    const angles = suggestions.alternative_angles || [];
    document.getElementById('tv-angles-section').style.display = angles.length ? 'block' : 'none';
    document.getElementById('tv-angles-list').innerHTML = angles.map(a => `
        <div class="tv-angle-item">
            <div class="tv-angle-icon">↗</div>
            <div class="tv-angle-text">${escapeHtml(a)}</div>
        </div>
    `).join('');
}

function renderTitlesGrid(suggestions) {
    const grid = document.getElementById('tv-titles-grid');
    const titles = suggestions.titles || [];

    if (!titles.length) {
        grid.innerHTML = '<div class="tv-empty-titles">Nenhum título gerado. Tente regenerar.</div>';
        return;
    }

    grid.innerHTML = titles.map((t, i) => {
        const score = Math.min(10, Math.max(1, t.ctr_score || 7));
        const scoreColor = score >= 8 ? '#4caf50' : score >= 6 ? '#ff9800' : '#888';
        const kwHtml = (t.keywords || []).map(k => `<span class="tv-kw">${escapeHtml(k)}</span>`).join('');

        return `
        <div class="tv-title-card" data-index="${i}">
            <div class="tv-title-top">
                <div class="tv-title-emotion">${escapeHtml(t.emotion || '')}</div>
                <div class="tv-ctr-score" style="color:${scoreColor};" title="Score de CTR">
                    <span class="tv-ctr-num">${score}</span><span class="tv-ctr-max">/10</span>
                </div>
            </div>
            <div class="tv-title-text">${escapeHtml(t.title)}</div>
            <div class="tv-title-reason">${escapeHtml(t.reason || '')}</div>
            <div class="tv-title-kws">${kwHtml}</div>
            <div class="tv-title-format">${escapeHtml(t.format || '')}</div>
            <div class="tv-title-actions">
                <button class="tv-copy-btn" data-title="${escapeHtml(t.title)}" title="Copiar título">
                    <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" style="width:13px;height:13px;">
                        <rect x="9" y="9" width="13" height="13" rx="2"/>
                        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                    </svg>
                    Copiar
                </button>
                <button class="tv-save-btn" data-title="${escapeHtml(t.title)}" title="Salvar no board">
                    <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" style="width:13px;height:13px;">
                        <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
                        <polyline points="17 21 17 13 7 13 7 21"/>
                    </svg>
                    Salvar no Board
                </button>
            </div>
        </div>
        `;
    }).join('');

    
    grid.querySelectorAll('.tv-copy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            navigator.clipboard.writeText(btn.dataset.title)
                .then(() => showToast('Título copiado!'))
                .catch(() => showToast('Erro ao copiar.'));
        });
    });

    grid.querySelectorAll('.tv-save-btn').forEach(btn => {
        btn.addEventListener('click', () => saveTitleToBoard(btn.dataset.title));
    });
}





async function saveTitleToBoard(title) {
    if (!window.currentUser) { showToast('Faça login para salvar.'); return; }
    try {
        
        const { data: boards } = await sb.from('boards').select('id').eq('user_id', window.currentUser.id).order('created_at').limit(1);
        if (!boards || !boards.length) { showToast('Nenhum board encontrado. Crie um primeiro!'); return; }
        const boardId = boards[0].id;

        
        let { data: lists } = await sb.from('lists').select('id').eq('board_id', boardId).ilike('title', '%ideia%').limit(1);
        let listId;
        if (lists && lists.length) {
            listId = lists[0].id;
        } else {
            const { data: newList } = await sb.from('lists').insert({ title: '◆ Ideias de Títulos', board_id: boardId, user_id: window.currentUser.id, position: 99 }).select().single();
            listId = newList?.id;
        }

        if (!listId) { showToast('Erro ao encontrar lista.'); return; }

        await sb.from('cards').insert({ title, list_id: listId, board_id: boardId, user_id: window.currentUser.id, position: 0 });
        showToast('Título salvo no Board!');
    } catch (err) {
        showToast('Erro ao salvar: ' + err.message);
    }
}





function setTitulosLoading(on) {
    const loading = document.getElementById('tv-loading');
    const btn = document.getElementById('tv-search-btn');
    const label = document.getElementById('tv-search-btn-label');

    if (on) {
        document.getElementById('tv-empty').style.display = 'none';
        document.getElementById('tv-results-wrap').style.display = 'none';
        loading.style.display = 'flex';
        if (btn) btn.disabled = true;
        if (label) label.textContent = 'Analisando…';
    } else {
        loading.style.display = 'none';
        if (btn) btn.disabled = false;
        if (label) label.textContent = 'Analisar';
    }
}

function setStep(n) {
    for (let i = 1; i <= 3; i++) {
        const el = document.getElementById(`tvstep-${i}`);
        if (!el) continue;
        el.classList.remove('active', 'done');
        if (i < n) el.classList.add('done');
        if (i === n) el.classList.add('active');
    }
}

function fmtViews(n) {
    if (!n) return '0';
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return String(n);
}
