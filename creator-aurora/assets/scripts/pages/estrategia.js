



let strategyDocs = [];
let currentStrategyDocId = null;
let strategyAutoSave = null;
let isRichEditorActive = true;
let strategyPDFs = [];


const RICH_EDITOR_TOOLS = {
    bold: { icon: 'B', command: 'bold', shortcut: 'Ctrl+B' },
    italic: { icon: 'I', command: 'italic', shortcut: 'Ctrl+I' },
    underline: { icon: 'U', command: 'underline', shortcut: 'Ctrl+U' },
    h1: { icon: 'H1', command: 'formatBlock', value: 'h1' },
    h2: { icon: 'H2', command: 'formatBlock', value: 'h2' },
    h3: { icon: 'H3', command: 'formatBlock', value: 'h3' },
    ul: { icon: '• Lista', command: 'insertUnorderedList' },
    ol: { icon: '1. Lista', command: 'insertOrderedList' },
    link: { icon: '◆ Link', command: 'createLink' },
    image: { icon: '◆ Imagem', command: 'insertImage' },
    alignLeft: { icon: '⬅', command: 'justifyLeft' },
    alignCenter: { icon: '⬌', command: 'justifyCenter' },
    alignRight: { icon: '◆', command: 'justifyRight' },
    code: { icon: '</>', command: 'formatBlock', value: 'pre' },
    quote: { icon: '"', command: 'formatBlock', value: 'blockquote' },
    hr: { icon: '—', command: 'insertHorizontalRule' },
    clear: { icon: '◆ Limpar', command: 'removeFormat' }
};

async function loadStrategyDocs() {
    try {
        const { data, error } = await withTimeout(
            sb.from('vexarco_strategy').select('*').order('updated_at', { ascending: false })
        );
        if (error) throw error;
        strategyDocs = data || [];
    } catch (err) {
        console.error('loadStrategyDocs:', err);
        strategyDocs = [];
    }
}

async function loadStrategyPDFs() {
    try {
        const { data, error } = await withTimeout(
            sb.from('vexarco_strategy_pdfs').select('*').order('created_at', { ascending: false })
        );
        if (error) throw error;
        strategyPDFs = data || [];
        renderStrategyPDFList();
    } catch (err) {
        console.error('loadStrategyPDFs:', err);
        strategyPDFs = [];
    }
}

function renderStrategyPage() {
    const allowed = window.userPlan?.allowed_tabs || ['roteiros'];
    if (!allowed.includes('estrategia')) {
        openUpgradeModal('estrategia');
        return;
    }
    const body = document.getElementById('strategy-body');
    const headerActions = document.getElementById('strategy-header-actions');
    
    if (!isAdmin()) {
        if (headerActions) headerActions.style.display = 'none';
        renderStrategyReadOnly(body);
        return;
    }
    
    if (headerActions) headerActions.style.display = 'flex';
    renderStrategyAdminEditor(body);
}

function renderStrategyReadOnly(body) {
    Promise.all([loadStrategyDocs(), loadStrategyPDFs()]).then(() => {
        if (!strategyDocs.length && !strategyPDFs.length) {
            body.innerHTML = `
                <div class="strategy-locked">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M2 20h.01M7 20v-4M12 20V10M17 20V4M22 20h.01"/>
                    </svg>
                    <h3>EM BREVE</h3>
                    <p>Os documentos de estratégia ainda estão sendo preparados pelo time.</p>
                </div>`;
            return;
        }
        
        let content = '<div style="display:flex;flex-direction:column;gap:20px;">';
        
        
        if (strategyDocs.length) {
            strategyDocs.forEach(doc => {
                content += `
                    <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden;">
                        <div style="padding:20px 24px;border-bottom:1px solid var(--border);background:rgba(255, 77, 77, 0.05);">
                            <div style="font-family:var(--font-mono);font-size:0.55rem;color:var(--red);letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;">${escapeHtml(doc.emoji || '◆')} Documento</div>
                            <div style="font-family:var(--font-display);font-size:1.4rem;letter-spacing:2px;color:var(--white);">${escapeHtml(doc.title || 'Sem título')}</div>
                            <div style="font-family:var(--font-mono);font-size:0.55rem;color:var(--text-muted);margin-top:6px;">${doc.updated_at ? 'Atualizado em ' + new Date(doc.updated_at).toLocaleDateString('pt-BR') : ''}</div>
                        </div>
                        <div style="padding:24px;font-family:var(--font-body);font-size:0.9rem;line-height:1.85;color:var(--text);">${doc.content || '<em>Sem conteúdo</em>'}</div>
                    </div>`;
            });
        }
        
        
        if (strategyPDFs.length) {
            content += `<div style="margin-top:20px;">
                <h3 style="font-family:var(--font-display);font-size:1.2rem;letter-spacing:1px;color:var(--text);margin-bottom:16px;">◆ PDFs</h3>
                <div style="display:flex;flex-direction:column;gap:12px;">`;
            
            strategyPDFs.forEach(pdf => {
                const pdfUrl = getStrategyPDFUrl(pdf.file_path);
                content += `
                    <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:16px;display:flex;align-items:center;justify-content:space-between;">
                        <div style="display:flex;align-items:center;gap:12px;flex:1;">
                            <span style="font-family:var(--font-mono);font-size:0.85rem;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(pdf.name)}</span>
                        </div>
                        <div style="display:flex;gap:8px;flex-shrink:0;">
                            <button onclick="openPDFViewer('${pdf.file_path}', '${escapeHtml(pdf.name)}')" style="background:transparent;border:1px solid var(--border);color:var(--muted);padding:6px 10px;border-radius:4px;cursor:pointer;transition:all .15s;font-size:0.85rem;" onmouseover="this.style.borderColor='var(--gold)';this.style.color='var(--gold)';" onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--muted)';">Ver</button>
                            <a href="${pdfUrl}" download style="background:transparent;border:1px solid var(--border);color:var(--muted);padding:6px 10px;border-radius:4px;cursor:pointer;transition:all .15s;font-size:0.85rem;text-decoration:none;display:inline-flex;align-items:center;" onmouseover="this.style.borderColor='var(--gold)';this.style.color='var(--gold)';" onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--muted)';">Download</a>
                        </div>
                    </div>`;
            });
            
            content += `</div></div>`;
        }
        
        content += '</div>';
        body.innerHTML = content;
    });
}

function renderStrategyAdminEditor(body) {
    loadStrategyDocs().then(() => {
        body.innerHTML = `
            <div class="strategy-grid">
                <div class="strategy-sidebar">
                    <div class="strategy-sidebar-header">
                        <span class="strategy-sidebar-title">Documentos</span>
                        <button class="toolbar-btn" id="new-doc-btn" style="padding:4px 8px;font-size:0.7rem;">+ Novo</button>
                    </div>
                    <div class="strategy-list" id="strategy-list"></div>
                    
                    <div class="strategy-sidebar-header" style="margin-top:20px;">
                        <span class="strategy-sidebar-title">PDFs</span>
                        <button class="toolbar-btn" id="upload-pdf-btn" style="padding:4px 8px;font-size:0.7rem;">+ PDF</button>
                    </div>
                    <div class="strategy-pdf-list" id="strategy-pdf-list"></div>
                </div>
                <div class="strategy-editor-area" id="strategy-editor-area">
                    <div class="strategy-empty-state">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                        </svg>
                        <p>Selecione ou crie um documento</p>
                    </div>
                </div>
            </div>
            <input type="file" id="pdf-file-input" accept="application/pdf" style="display:none;">`;
        
        renderStrategyList();
        loadStrategyPDFs();
        
        document.getElementById('new-doc-btn').addEventListener('click', createNewStrategyDoc);
        document.getElementById('upload-pdf-btn').addEventListener('click', () => {
            document.getElementById('pdf-file-input').click();
        });
        document.getElementById('pdf-file-input').addEventListener('change', (e) => {
            if (e.target.files[0]) {
                uploadStrategyPDF(e.target.files[0]);
                e.target.value = '';
            }
        });
        
        if (currentStrategyDocId) {
            const doc = strategyDocs.find(d => d.id === currentStrategyDocId);
            if (doc) openStrategyDocEditor(doc);
        }
    });
}

function renderStrategyList() {
    const list = document.getElementById('strategy-list');
    if (!list) return;
    
    if (!strategyDocs.length) {
        list.innerHTML = '<div style="padding:16px;font-family:var(--font-mono);font-size:0.6rem;color:var(--text-muted);text-align:center;letter-spacing:1px;">Nenhum documento</div>';
        return;
    }
    
    list.innerHTML = strategyDocs.map(doc => `
        <div class="strategy-list-item ${currentStrategyDocId === doc.id ? 'active' : ''}" data-id="${doc.id}">
            <span class="strategy-list-item-icon">${escapeHtml(doc.emoji || '◆')}</span>
            <span class="strategy-list-item-name">${escapeHtml(doc.title || 'Sem título')}</span>
            <button class="strategy-list-item-del" data-del="${doc.id}">
                <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="14" height="14">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                </svg>
            </button>
        </div>
    `).join('');
    
    list.querySelectorAll('.strategy-list-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.closest('[data-del]')) return;
            const doc = strategyDocs.find(d => d.id === item.dataset.id);
            if (doc) openStrategyDocEditor(doc);
        });
    });
    
    list.querySelectorAll('[data-del]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!confirm('Excluir este documento?')) return;
            const id = btn.dataset.del;
            try {
                const { error } = await sb.from('vexarco_strategy').delete().eq('id', id);
                if (error) throw error;
                strategyDocs = strategyDocs.filter(d => d.id !== id);
                if (currentStrategyDocId === id) {
                    currentStrategyDocId = null;
                    const area = document.getElementById('strategy-editor-area');
                    if (area) {
                        area.innerHTML = `
                            <div class="strategy-empty-state">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                                    <polyline points="14 2 14 8 20 8"/>
                                </svg>
                                <p>Selecione ou crie um documento</p>
                            </div>`;
                    }
                }
                renderStrategyList();
                showToast('Documento excluído.');
            } catch (err) {
                showToast('Erro ao excluir.');
                console.error(err);
            }
        });
    });
}

function renderStrategyPDFList() {
    const list = document.getElementById('strategy-pdf-list');
    if (!list) return;
    
    if (!strategyPDFs.length) {
        list.innerHTML = '<div style="padding:16px;font-family:var(--font-mono);font-size:0.6rem;color:var(--text-muted);text-align:center;letter-spacing:1px;">Nenhum PDF</div>';
        return;
    }
    
    list.innerHTML = strategyPDFs.map(pdf => `
        <div class="strategy-pdf-item" data-id="${pdf.id}">
            <span class="strategy-pdf-icon">◆</span>
            <span class="strategy-pdf-name" title="${escapeHtml(pdf.name)}">${escapeHtml(pdf.name)}</span>
            <div style="display:flex;gap:4px;">
                <button class="strategy-pdf-btn" onclick="openPDFViewer('${pdf.file_path}', '${escapeHtml(pdf.name)}')" title="Visualizar">
                    <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="14" height="14">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                    </svg>
                </button>
                <button class="strategy-pdf-btn" onclick="deleteStrategyPDF('${pdf.id}', '${pdf.file_path}')" title="Deletar">
                    <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="14" height="14">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                    </svg>
                </button>
            </div>
        </div>
    `).join('');
}

function openStrategyDocEditor(doc) {
    currentStrategyDocId = doc.id;
    renderStrategyList();
    
    const area = document.getElementById('strategy-editor-area');
    if (!area) return;
    
    const EMOJIS = ['◆', '◆', '◆', '◆', '◆', '◆', '◆', '◆', '◆', '◆', '◆', '◆', '◆', '◆', '◆', '◆', '◆', '◆'];
    
    area.innerHTML = `
        <div class="strategy-editor-toolbar">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <span style="font-family:var(--font-mono);font-size:0.55rem;color:var(--text-muted);letter-spacing:1px;">Ícone:</span>
                <select id="strategy-emoji" style="background:var(--surface2);border:1px solid var(--border);color:var(--white);padding:4px 8px;border-radius:4px;font-size:1rem;cursor:pointer;outline:none;">
                    ${EMOJIS.map(e => `<option value="${e}" ${doc.emoji === e ? 'selected' : ''}>${e}</option>`).join('')}
                </select>
            </div>
            <div class="toolbar-sep"></div>
            <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;" id="rich-toolbar">
                <button class="toolbar-btn" data-cmd="bold" title="Negrito (Ctrl+B)"><b>B</b></button>
                <button class="toolbar-btn" data-cmd="italic" title="Itálico (Ctrl+I)"><i>I</i></button>
                <button class="toolbar-btn" data-cmd="underline" title="Sublinhado (Ctrl+U)"><u>U</u></button>
                <div class="toolbar-sep"></div>
                <button class="toolbar-btn" data-cmd="h1" title="Título 1">H1</button>
                <button class="toolbar-btn" data-cmd="h2" title="Título 2">H2</button>
                <button class="toolbar-btn" data-cmd="h3" title="Título 3">H3</button>
                <div class="toolbar-sep"></div>
                <button class="toolbar-btn" data-cmd="ul" title="Lista com marcadores">• Lista</button>
                <button class="toolbar-btn" data-cmd="ol" title="Lista numerada">1. Lista</button>
                <div class="toolbar-sep"></div>
                <button class="toolbar-btn" data-cmd="link" title="Inserir link">◆ Link</button>
                <button class="toolbar-btn" data-cmd="image" title="Inserir imagem">◆ Imagem</button>
                <div class="toolbar-sep"></div>
                <button class="toolbar-btn" data-cmd="alignLeft" title="Alinhar esquerda">⬅</button>
                <button class="toolbar-btn" data-cmd="alignCenter" title="Centralizar">⬌</button>
                <button class="toolbar-btn" data-cmd="alignRight" title="Alinhar direita">◆</button>
                <div class="toolbar-sep"></div>
                <button class="toolbar-btn" data-cmd="code" title="Código">&lt;/&gt;</button>
                <button class="toolbar-btn" data-cmd="quote" title="Citação">"</button>
                <button class="toolbar-btn" data-cmd="hr" title="Linha horizontal">—</button>
                <div class="toolbar-sep"></div>
                <button class="toolbar-btn" data-cmd="clear" title="Limpar formatação">◆</button>
            </div>
            <div style="flex:1;"></div>
            <div style="display:flex;align-items:center;gap:8px;">
                <button class="toolbar-btn" id="toggle-editor-mode" title="Alternar entre visualização HTML e Rich Text">
                    ◆ HTML
                </button>
                <span class="strategy-save-hint" id="strategy-save-hint">não salvo</span>
            </div>
        </div>
        
        <input class="strategy-title-input" id="strategy-title-input" value="${escapeHtml(doc.title || '')}" placeholder="TÍTULO DO DOCUMENTO" maxlength="100">
        
        <div id="editor-container" style="flex:1;display:flex;flex-direction:column;">
            <div id="rich-editor" contenteditable="true" class="strategy-rich-editor" style="display:${isRichEditorActive ? 'block' : 'none'};min-height:500px;padding:20px;overflow-y:auto;background:var(--surface2);border-radius:0;outline:none;line-height:1.8;">
                ${doc.content || '<p><br></p>'}
            </div>
            <textarea id="html-editor" class="strategy-textarea" style="display:${isRichEditorActive ? 'none' : 'block'};min-height:500px;font-family:monospace;font-size:0.8rem;">${escapeHtml(doc.content || '')}</textarea>
        </div>
        
        <div class="strategy-editor-footer">
            <div style="display:flex;gap:16px;">
                <span style="font-family:var(--font-mono);font-size:0.55rem;color:var(--text-muted);">◆ Palavras: <span id="word-count-strategy">0</span></span>
                <span style="font-family:var(--font-mono);font-size:0.55rem;color:var(--text-muted);">◆ Caracteres: <span id="char-count-strategy">0</span></span>
                <span style="font-family:var(--font-mono);font-size:0.55rem;color:var(--text-muted);">◆ Última edição: ${doc.updated_at ? new Date(doc.updated_at).toLocaleString('pt-BR') : '—'}</span>
            </div>
            <div style="display:flex;gap:8px;">
                <button class="action-btn" id="preview-btn">◆ Preview</button>
                <button class="action-btn primary" id="strategy-save-btn">◆ Salvar</button>
            </div>
        </div>
    `;
    
    const richEditor = document.getElementById('rich-editor');
    const htmlEditor = document.getElementById('html-editor');
    const titleInput = document.getElementById('strategy-title-input');
    const saveHint = document.getElementById('strategy-save-hint');
    const emojiSelect = document.getElementById('strategy-emoji');
    const wordCountSpan = document.getElementById('word-count-strategy');
    const charCountSpan = document.getElementById('char-count-strategy');
    
    function updateWordCount() {
        const content = isRichEditorActive ? richEditor.innerText : htmlEditor.value;
        const words = content.trim() ? content.trim().split(/\s+/).length : 0;
        const chars = content.length;
        if (wordCountSpan) wordCountSpan.textContent = words;
        if (charCountSpan) charCountSpan.textContent = chars;
    }
    
    function getCurrentContent() {
        return isRichEditorActive ? richEditor.innerHTML : htmlEditor.value;
    }
    
    function setContent(content) {
        if (isRichEditorActive) {
            richEditor.innerHTML = content || '<p><br></p>';
        } else {
            htmlEditor.value = content || '';
        }
        updateWordCount();
    }
    
    function scheduleStrategySave() {
        if (saveHint) { saveHint.textContent = '…'; saveHint.classList.remove('saved'); }
        clearTimeout(strategyAutoSave);
        strategyAutoSave = setTimeout(() => saveCurrentStrategyDoc(true), 1800);
    }
    
    function onContentChange() {
        updateWordCount();
        scheduleStrategySave();
    }
    
    if (richEditor) {
        richEditor.addEventListener('input', onContentChange);
        richEditor.addEventListener('keyup', updateWordCount);
    }
    if (htmlEditor) htmlEditor.addEventListener('input', onContentChange);
    if (titleInput) titleInput.addEventListener('input', scheduleStrategySave);
    if (emojiSelect) emojiSelect.addEventListener('change', scheduleStrategySave);
    
    
    document.querySelectorAll('[data-cmd]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            if (!isRichEditorActive) {
                showToast('Mude para o modo Rich Text para usar a formatação visual.');
                return;
            }
            richEditor.focus();
            const cmd = btn.dataset.cmd;
            switch(cmd) {
                case 'bold': document.execCommand('bold', false, null); break;
                case 'italic': document.execCommand('italic', false, null); break;
                case 'underline': document.execCommand('underline', false, null); break;
                case 'h1': document.execCommand('formatBlock', false, 'h1'); break;
                case 'h2': document.execCommand('formatBlock', false, 'h2'); break;
                case 'h3': document.execCommand('formatBlock', false, 'h3'); break;
                case 'ul': document.execCommand('insertUnorderedList', false, null); break;
                case 'ol': document.execCommand('insertOrderedList', false, null); break;
                case 'link': 
                    const url = prompt('Digite a URL do link:', 'https://');
                    if (url) document.execCommand('createLink', false, url);
                    break;
                case 'image':
                    const imgUrl = prompt('Digite a URL da imagem:', 'https://');
                    if (imgUrl) document.execCommand('insertImage', false, imgUrl);
                    break;
                case 'alignLeft': document.execCommand('justifyLeft', false, null); break;
                case 'alignCenter': document.execCommand('justifyCenter', false, null); break;
                case 'alignRight': document.execCommand('justifyRight', false, null); break;
                case 'code': document.execCommand('formatBlock', false, 'pre'); break;
                case 'quote': document.execCommand('formatBlock', false, 'blockquote'); break;
                case 'hr': document.execCommand('insertHorizontalRule', false, null); break;
                case 'clear': document.execCommand('removeFormat', false, null); break;
            }
            scheduleStrategySave();
        });
    });
    
    
    document.getElementById('toggle-editor-mode').addEventListener('click', () => {
        const currentContent = getCurrentContent();
        isRichEditorActive = !isRichEditorActive;
        
        if (isRichEditorActive) {
            richEditor.innerHTML = currentContent;
            richEditor.style.display = 'block';
            htmlEditor.style.display = 'none';
            document.getElementById('toggle-editor-mode').innerHTML = '◆ HTML';
        } else {
            htmlEditor.value = currentContent;
            richEditor.style.display = 'none';
            htmlEditor.style.display = 'block';
            document.getElementById('toggle-editor-mode').innerHTML = '◆ Rich Text';
        }
        updateWordCount();
    });
    
    
    document.getElementById('preview-btn').addEventListener('click', () => {
        const content = getCurrentContent();
        const title = titleInput?.value || 'Documento';
        const emoji = emojiSelect?.value || '◆';
        
        const previewModal = document.createElement('div');
        previewModal.className = 'modal-overlay';
        previewModal.style.display = 'flex';
        previewModal.innerHTML = `
            <div class="modal" style="max-width:800px;max-height:80vh;overflow-y:auto;">
                <div class="modal-header">
                    <div>
                        <div class="modal-step-num">${emoji} Preview</div>
                        <div class="modal-step-name">${escapeHtml(title)}</div>
                    </div>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
                <div style="padding:24px;font-family:var(--font-body);font-size:0.9rem;line-height:1.85;color:var(--text);">
                    ${content || '<em>Sem conteúdo</em>'}
                </div>
                <div style="padding:16px 24px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;">
                    <button class="action-btn" onclick="this.closest('.modal-overlay').remove()">Fechar</button>
                </div>
            </div>
        `;
        document.body.appendChild(previewModal);
        previewModal.addEventListener('click', (e) => { if (e.target === previewModal) previewModal.remove(); });
    });
    
    const saveBtn = document.getElementById('strategy-save-btn');
    if (saveBtn) saveBtn.addEventListener('click', () => saveCurrentStrategyDoc(false));
    
    updateWordCount();
}

async function saveCurrentStrategyDoc(silent) {
    if (!currentStrategyDocId || !isAdmin()) return;
    
    const titleEl = document.getElementById('strategy-title-input');
    const emojiEl = document.getElementById('strategy-emoji');
    const richEditor = document.getElementById('rich-editor');
    const htmlEditor = document.getElementById('html-editor');
    
    if (!titleEl) return;
    
    let content = '';
    if (isRichEditorActive && richEditor) {
        content = richEditor.innerHTML;
    } else if (htmlEditor) {
        content = htmlEditor.value;
    }
    
    const payload = {
        id: currentStrategyDocId,
        title: titleEl.value || 'Sem título',
        content: content || '',
        emoji: emojiEl ? emojiEl.value : '◆',
        updated_at: new Date().toISOString(),
    };
    
    try {
        const { error } = await sb.from('vexarco_strategy').upsert(payload, { onConflict: 'id' });
        if (error) throw error;
        
        const idx = strategyDocs.findIndex(d => d.id === currentStrategyDocId);
        if (idx >= 0) strategyDocs[idx] = { ...strategyDocs[idx], ...payload };
        renderStrategyList();
        
        const hint = document.getElementById('strategy-save-hint');
        if (hint) { hint.textContent = '◆ salvo'; hint.classList.add('saved'); }
        if (!silent) showToast('Documento salvo!');
    } catch (err) {
        showToast('Erro ao salvar documento.');
        console.error(err);
    }
}

async function createNewStrategyDoc() {
    if (!isAdmin()) return;
    const id = crypto.randomUUID();
    const doc = { id, title: 'Novo Documento', content: '<p><br></p>', emoji: '◆', updated_at: new Date().toISOString() };
    try {
        const { error } = await sb.from('vexarco_strategy').insert(doc);
        if (error) throw error;
        strategyDocs.unshift(doc);
        renderStrategyList();
        openStrategyDocEditor(doc);
        showToast('Documento criado!');
    } catch (err) {
        showToast('Erro ao criar documento.');
        console.error(err);
    }
}





async function uploadStrategyPDF(file) {
    if (!file || file.type !== 'application/pdf') {
        showToast('Por favor, selecione um arquivo PDF válido.');
        return;
    }
    
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `strategy-pdfs/${fileName}`;
        
        const { error: uploadError } = await sb.storage
            .from('vexarco-strategy-pdfs')
            .upload(filePath, file);
        
        if (uploadError) throw uploadError;
        
        const { error: dbError } = await sb.from('vexarco_strategy_pdfs').insert({
            name: file.name,
            file_path: filePath,
            created_at: new Date().toISOString()
        });
        
        if (dbError) throw dbError;
        
        showToast('PDF enviado com sucesso!');
        loadStrategyPDFs();
    } catch (err) {
        showToast('Erro ao fazer upload do PDF.');
        console.error('uploadStrategyPDF:', err);
    }
}

async function deleteStrategyPDF(id, filePath) {
    if (!confirm('Excluir este PDF?')) return;
    
    try {
        const { error: storageError } = await sb.storage
            .from('vexarco-strategy-pdfs')
            .remove([filePath]);
        
        if (storageError) throw storageError;
        
        const { error: dbError } = await sb.from('vexarco_strategy_pdfs').delete().eq('id', id);
        
        if (dbError) throw dbError;
        
        showToast('PDF excluído.');
        loadStrategyPDFs();
    } catch (err) {
        showToast('Erro ao excluir PDF.');
        console.error('deleteStrategyPDF:', err);
    }
}

function getStrategyPDFUrl(filePath) {
    const { data } = sb.storage.from('vexarco-strategy-pdfs').getPublicUrl(filePath);
    return data.publicUrl;
}

function openPDFViewer(pdfPath, pdfName) {
    let overlay = document.getElementById('pdf-viewer-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'pdf-viewer-overlay';
        overlay.className = 'pdf-viewer-overlay';
        overlay.innerHTML = `
            <div class="pdf-viewer-container">
                <div class="pdf-viewer-header">
                    <div class="pdf-viewer-title" id="pdf-viewer-title"></div>
                    <button class="pdf-viewer-close" onclick="closePDFViewer()">×</button>
                </div>
                <iframe class="pdf-viewer-iframe" id="pdf-viewer-iframe"></iframe>
                <div class="pdf-viewer-footer">
                    <span>Visualizando PDF</span>
                    <a href="" id="pdf-download-link" target="_blank" style="color: var(--gold); text-decoration: none;">⬇ Download</a>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closePDFViewer();
        });
    }
    
    const pdfUrl = getStrategyPDFUrl(pdfPath);
    document.getElementById('pdf-viewer-title').textContent = pdfName;
    document.getElementById('pdf-viewer-iframe').src = pdfUrl;
    document.getElementById('pdf-download-link').href = pdfUrl;
    
    overlay.classList.add('active');
}

function closePDFViewer() {
    const overlay = document.getElementById('pdf-viewer-overlay');
    if (overlay) {
        overlay.classList.remove('active');
        document.getElementById('pdf-viewer-iframe').src = '';
    }
}