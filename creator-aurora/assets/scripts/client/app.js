







const UPGRADE_MESSAGES = {
    roteiros: { icon: uiIcon('file'), desc: 'Acesso aos roteiros não está disponível no seu plano atual.' },
    assets: { icon: uiIcon('folder'), desc: 'Você atingiu o limite de assets ou este recurso não está no seu plano.' },
    estrategia: { icon: uiIcon('compass'), desc: 'A aba Estratégia não está disponível no seu plano atual.' },
    titulos: { icon: uiIcon('search'), desc: 'A aba Títulos não está disponível no seu plano atual.' },
    ranking: { icon: uiIcon('trophy'), desc: 'A aba Ranking não está disponível no seu plano atual.' },
    skins: { icon: uiIcon('image'), desc: 'A aba Skins não está disponível no seu plano atual.' },
    board: { icon: uiIcon('board'), desc: 'A aba Board não está disponível no seu plano atual.' },
    projects: { icon: uiIcon('folder'), desc: 'Você atingiu o limite de projetos do seu plano atual.' },
    motions: { icon: uiIcon('video'), desc: 'Você atingiu o limite de motions do seu plano atual.' },
};

function openUpgradeModal(context) {
    const msg = UPGRADE_MESSAGES[context] || { icon: uiIcon('lock'), desc: 'Este recurso não está disponível no seu plano.' };
    document.getElementById('upgrade-modal-icon').innerHTML = msg.icon;
    document.getElementById('upgrade-modal-desc').textContent = msg.desc;
    document.getElementById('upgrade-current-plan').textContent = window.userPlan?.name?.toUpperCase() || 'FREE';
    document.getElementById('upgrade-modal').classList.add('open');
}


if (typeof window.isScriptEditorActive === 'undefined') {
    window.isScriptEditorActive = true;
}
if (typeof window.scriptRichEditor === 'undefined') {
    window.scriptRichEditor = null;
}
if (typeof window.scriptTextarea === 'undefined') {
    window.scriptTextarea = null;
}

let currentTab = 'roteiros';

let isScriptEditorActive = window.isScriptEditorActive;
let scriptRichEditor = window.scriptRichEditor;
let scriptTextarea = window.scriptTextarea;





function switchTab(tab) {
    
    if (tab !== 'admin') {
        const allowed = window.userPlan?.allowed_tabs || ['roteiros'];
        if (!allowed.includes(tab)) {
            openUpgradeModal(tab);
            return;
        }
    }
 
    currentTab = tab;
    document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.toggle('active', p.id === 'tab-' + tab));
 
    if (tab === 'assets' && allAssets && allAssets.length === 0) loadAssetsFromR2();
    if (tab === 'estrategia' && typeof renderStrategyPage === 'function') renderStrategyPage();
    if (tab === 'ranking'    && typeof renderRankingPage   === 'function') renderRankingPage();
    if (tab === 'titulos'    && typeof renderTitulosPage   === 'function') renderTitulosPage();
    if (tab === 'skins'      && typeof renderSkinsPage     === 'function') renderSkinsPage();
    if (tab === 'admin'      && typeof renderAdminPage     === 'function') renderAdminPage();
    if (tab === 'canal' && typeof renderCanalPage === 'function') renderCanalPage();
    if (tab === 'musicas' && typeof renderMusicasPage === 'function') renderMusicasPage();
}





function buildScriptToolbar() {
    const toolbar = document.createElement('div');
    toolbar.className = 'script-editor-toolbar';
    toolbar.innerHTML = `
        <button class="script-toolbar-btn" data-cmd="bold" title="Negrito (Ctrl+B)"><b>B</b></button>
        <button class="script-toolbar-btn" data-cmd="italic" title="Itálico (Ctrl+I)"><i>I</i></button>
        <button class="script-toolbar-btn" data-cmd="underline" title="Sublinhado (Ctrl+U)"><u>U</u></button>
        <div class="script-toolbar-sep"></div>
        <button class="script-toolbar-btn" data-cmd="h1" title="Título 1">H1</button>
        <button class="script-toolbar-btn" data-cmd="h2" title="Título 2">H2</button>
        <button class="script-toolbar-btn" data-cmd="h3" title="Título 3">H3</button>
        <div class="script-toolbar-sep"></div>
        <button class="script-toolbar-btn" data-cmd="ul" title="Lista com marcadores">• Lista</button>
        <button class="script-toolbar-btn" data-cmd="ol" title="Lista numerada">1. Lista</button>
        <div class="script-toolbar-sep"></div>
        <button class="script-toolbar-btn" data-cmd="link" title="Inserir link">${uiIcon('link')} Link</button>
        <div class="script-toolbar-sep"></div>
        <button class="script-toolbar-btn" data-cmd="alignLeft" title="Alinhar esquerda">⬅</button>
        <button class="script-toolbar-btn" data-cmd="alignCenter" title="Centralizar">⬌</button>
        <button class="script-toolbar-btn" data-cmd="alignRight" title="Alinhar direita">${uiIcon('alignRight')}</button>
        <div class="script-toolbar-sep"></div>
        <button class="script-toolbar-btn" data-cmd="clear" title="Limpar formatação">${uiIcon('eraser')}</button>
        <div style="flex:1;"></div>
        <button class="script-toolbar-btn" id="toggle-script-mode" title="Alternar entre visualização HTML e Rich Text">
            ${uiIcon('code')} HTML
        </button>
    `;
    return toolbar;
}

function initScriptEditor() {
    const scriptPanel = document.querySelector('.script-panel');
    scriptTextarea = document.getElementById('script-textarea');
    if (!scriptPanel || !scriptTextarea) return;

    
    const existing = scriptPanel.querySelector('.script-editor-wrapper');
    if (existing) existing.remove();
    scriptRichEditor = null;
    window.scriptRichEditor = null;
    isScriptEditorActive = true;
    window.isScriptEditorActive = true;

    

    if (!scriptPanel || !scriptTextarea) return;

    if (scriptPanel.querySelector('.script-editor-wrapper')) return;

    const editorWrapper = document.createElement('div');
    editorWrapper.className = 'script-editor-wrapper';

    const toolbar = buildScriptToolbar();

    scriptRichEditor = document.createElement('div');
    scriptRichEditor.className = 'script-content-editable';
    scriptRichEditor.contentEditable = 'true';
    scriptRichEditor.setAttribute('data-placeholder', scriptTextarea.placeholder);

    scriptTextarea.style.display = 'none';

    editorWrapper.appendChild(toolbar);
    editorWrapper.appendChild(scriptRichEditor);

    const header = scriptPanel.querySelector('.script-panel-header');
    scriptPanel.insertBefore(editorWrapper, header.nextSibling);

    scriptRichEditor.innerHTML = scriptTextarea.value || '<p><br></p>';

    function syncContent() {
        if (isScriptEditorActive) {
            scriptTextarea.value = scriptRichEditor.innerHTML;
        } else {
            scriptRichEditor.innerHTML = scriptTextarea.value || '<p><br></p>';
        }
        updateWordCount();
        scheduleAutoSave();
    }

    scriptRichEditor.addEventListener('input', () => {
        scriptTextarea.value = scriptRichEditor.innerHTML;
        updateWordCount();
        scheduleAutoSave();
    });

    scriptRichEditor.addEventListener('keydown', (e) => {
        if (e.ctrlKey) {
            switch (e.key) {
                case 'b': e.preventDefault(); document.execCommand('bold', false, null); break;
                case 'i': e.preventDefault(); document.execCommand('italic', false, null); break;
                case 'u': e.preventDefault(); document.execCommand('underline', false, null); break;
            }
        }
    });

    toolbar.querySelectorAll('[data-cmd]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            if (!isScriptEditorActive) {
                showToast('Mude para o modo Rich Text para usar a formatação visual.');
                return;
            }
            scriptRichEditor.focus();
            const cmd = btn.dataset.cmd;

            switch (cmd) {
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
                case 'alignLeft': document.execCommand('justifyLeft', false, null); break;
                case 'alignCenter': document.execCommand('justifyCenter', false, null); break;
                case 'alignRight': document.execCommand('justifyRight', false, null); break;
                case 'clear': document.execCommand('removeFormat', false, null); break;
            }
            syncContent();
        });
    });

    const toggleBtn = document.getElementById('toggle-script-mode');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            isScriptEditorActive = !isScriptEditorActive;

            if (isScriptEditorActive) {
                scriptRichEditor.innerHTML = scriptTextarea.value || '<p><br></p>';
                scriptRichEditor.style.display = 'block';
                scriptTextarea.style.display = 'none';
                toggleBtn.innerHTML = `${uiIcon('code')} HTML`;
            } else {
                scriptTextarea.value = scriptRichEditor.innerHTML;
                scriptRichEditor.style.display = 'none';
                scriptTextarea.style.display = 'block';
                toggleBtn.innerHTML = `${uiIcon('text')} Rich Text`;
            }
            updateWordCount();
        });
    }

    syncContent();
}





function checkPasswordStrength(password) {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.match(/[a-z]/)) strength++;
    if (password.match(/[A-Z]/)) strength++;
    if (password.match(/[0-9]/)) strength++;
    if (password.match(/[^a-zA-Z0-9]/)) strength++;

    if (strength <= 2) return { level: 'weak', text: 'Fraca - Use pelo menos 8 caracteres, maiúsculas, minúsculas, números e símbolos' };
    if (strength <= 3) return { level: 'medium', text: 'Média - Adicione mais variedade para uma senha forte' };
    return { level: 'strong', text: 'Forte - Excelente senha!' };
}

function openChangePasswordModal() {
    const modal = document.getElementById('change-password-modal');
    if (!modal) return;

    document.getElementById('current-password').value = '';
    document.getElementById('new-password').value = '';
    document.getElementById('confirm-password').value = '';
    document.getElementById('password-strength').innerHTML = '';
    document.getElementById('password-strength').className = 'password-strength';
    modal.classList.add('open');
}

function closeChangePasswordModal() {
    const modal = document.getElementById('change-password-modal');
    if (modal) modal.classList.remove('open');
}

async function changePassword() {
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (!currentPassword || !newPassword || !confirmPassword) {
        showToast('Preencha todos os campos!');
        return;
    }

    if (newPassword !== confirmPassword) {
        showToast('As senhas não coincidem!');
        return;
    }

    if (newPassword.length < 6) {
        showToast('A nova senha deve ter pelo menos 6 caracteres!');
        return;
    }

    const btn = document.getElementById('change-password-save-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Alterando...';

    try {
        const { error: signInError } = await sb.auth.signInWithPassword({
            email: currentUser.email,
            password: currentPassword
        });

        if (signInError) {
            showToast('Senha atual incorreta!');
            btn.disabled = false;
            btn.innerHTML = 'Alterar Senha';
            return;
        }

        const { error } = await sb.auth.updateUser({ password: newPassword });
        if (error) throw error;

        try {
            await sb.from('password_history').insert({
                user_id: currentUser.id,
                changed_at: new Date().toISOString()
            });
        } catch (e) {
            console.log('Password history not saved:', e);
        }

        showToast('Senha alterada com sucesso!');
        closeChangePasswordModal();

    } catch (error) {
        showToast('Erro ao alterar senha: ' + error.message);
        console.error(error);
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Alterar Senha';
    }
}





function bindEvents() {
    
    document.getElementById('login-btn')?.addEventListener('click', doLogin);
    document.getElementById('login-email')?.addEventListener('keypress', e => { if (e.key === 'Enter') doLogin(); });
    document.getElementById('login-password')?.addEventListener('keypress', e => { if (e.key === 'Enter') doLogin(); });
    document.getElementById('google-login-btn')?.addEventListener('click', doGoogleLogin);

    
    document.getElementById('nav-folder-premium-btn')?.addEventListener('click', () => {
        const folder = document.getElementById('nav-folder-premium');
        folder.classList.toggle('open');
    });
    
    document.querySelectorAll('.nav-item[data-tab]').forEach(btn => {
        btn.addEventListener('click', () => { switchTab(btn.dataset.tab); closeSidebar(); });
    });

    
    document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('open');
        document.getElementById('sidebar-overlay')?.classList.toggle('show');
    });
    document.getElementById('sidebar-overlay')?.addEventListener('click', closeSidebar);

    
    document.getElementById('logout-btn')?.addEventListener('click', doLogout);
    document.getElementById('profile-btn')?.addEventListener('click', openProfileModal);

    
    document.getElementById('new-project-btn')?.addEventListener('click', () => {
        document.getElementById('new-project-name').value = '';
        document.getElementById('new-project-modal').classList.add('open');
        setTimeout(() => document.getElementById('new-project-name').focus(), 200);
    });
    document.getElementById('back-btn')?.addEventListener('click', goToDashboard);
    document.getElementById('project-name-input')?.addEventListener('input', scheduleAutoSave);
    document.getElementById('script-textarea')?.addEventListener('input', () => { updateWordCount(); scheduleAutoSave(); });
    document.getElementById('generate-script-btn')?.addEventListener('click', generateScript);
    document.getElementById('export-btn')?.addEventListener('click', exportScript);
    document.getElementById('save-project-btn')?.addEventListener('click', () => saveProject(false));

    
    document.getElementById('new-project-modal-close')?.addEventListener('click', () => document.getElementById('new-project-modal').classList.remove('open'));
    document.getElementById('new-project-cancel-btn')?.addEventListener('click', () => document.getElementById('new-project-modal').classList.remove('open'));
    document.getElementById('new-project-create-btn')?.addEventListener('click', async () => {
        const name = document.getElementById('new-project-name').value.trim() || 'Novo Projeto';
        document.getElementById('new-project-modal').classList.remove('open');

        const maxProjects = window.userPlan?.max_projects ?? 3;
        if (maxProjects !== -1) {
            const { count } = await sb.from('vexarco_projects').select('*', { count: 'exact', head: true }).eq('user_id', window.currentUser.id);
            if (count >= maxProjects) { openUpgradeModal('projects'); return; }
        }

        const p = await createProject(name);
        if (p) openEditor(p.id);
    });
    document.getElementById('new-project-name')?.addEventListener('keypress', e => { if (e.key === 'Enter') document.getElementById('new-project-create-btn').click(); });
    document.getElementById('new-project-modal')?.addEventListener('click', e => { if (e.target === document.getElementById('new-project-modal')) document.getElementById('new-project-modal').classList.remove('open'); });

    
    document.getElementById('step-modal-close')?.addEventListener('click', closeStepModal);
    document.getElementById('modal-close-btn')?.addEventListener('click', closeStepModal);
    document.getElementById('modal-save-btn')?.addEventListener('click', () => saveStepNote(false));
    document.getElementById('step-modal')?.addEventListener('click', e => { if (e.target === document.getElementById('step-modal')) closeStepModal(); });

    
    document.getElementById('viewer-modal-close')?.addEventListener('click', closeViewerModal);
    document.getElementById('viewer-close-btn')?.addEventListener('click', closeViewerModal);
    document.getElementById('vtab-script')?.addEventListener('click', () => switchViewerTab('script'));
    document.getElementById('vtab-steps')?.addEventListener('click', () => switchViewerTab('steps'));
    document.getElementById('viewer-modal')?.addEventListener('click', e => { if (e.target === document.getElementById('viewer-modal')) closeViewerModal(); });

    
    document.getElementById('profile-modal-close')?.addEventListener('click', closeProfileModal);
    document.getElementById('profile-cancel-btn')?.addEventListener('click', closeProfileModal);
    document.getElementById('profile-save-btn')?.addEventListener('click', saveProfileName);
    document.getElementById('profile-logout-btn')?.addEventListener('click', doLogout);
    document.getElementById('profile-modal')?.addEventListener('click', e => { if (e.target === document.getElementById('profile-modal')) closeProfileModal(); });

    
    document.getElementById('change-password-btn')?.addEventListener('click', () => { closeProfileModal(); openChangePasswordModal(); });
    document.getElementById('change-password-modal-close')?.addEventListener('click', closeChangePasswordModal);
    document.getElementById('change-password-cancel-btn')?.addEventListener('click', closeChangePasswordModal);
    document.getElementById('change-password-save-btn')?.addEventListener('click', changePassword);
    document.getElementById('change-password-modal')?.addEventListener('click', e => { if (e.target === document.getElementById('change-password-modal')) closeChangePasswordModal(); });
    document.getElementById('new-password')?.addEventListener('input', (e) => {
        const strength = checkPasswordStrength(e.target.value);
        const el = document.getElementById('password-strength');
        if (el) { el.textContent = strength.text; el.className = `password-strength ${strength.level}`; }
    });

    
    document.getElementById('asset-modal-close')?.addEventListener('click', () => document.getElementById('asset-modal').classList.remove('open'));
    document.getElementById('asset-modal-close-btn')?.addEventListener('click', () => document.getElementById('asset-modal').classList.remove('open'));
    document.getElementById('asset-modal')?.addEventListener('click', e => { if (e.target === document.getElementById('asset-modal')) document.getElementById('asset-modal').classList.remove('open'); });
    document.getElementById('asset-copy-url-btn')?.addEventListener('click', () => {
        const url = document.getElementById('asset-url-display')?.textContent;
        if (url) navigator.clipboard.writeText(url).then(() => showToast('URL copiada!')).catch(() => showToast('Erro ao copiar.'));
    });

    
    document.getElementById('upgrade-modal-close')?.addEventListener('click', () => document.getElementById('upgrade-modal').classList.remove('open'));
    document.getElementById('upgrade-modal')?.addEventListener('click', e => { if (e.target === document.getElementById('upgrade-modal')) document.getElementById('upgrade-modal').classList.remove('open'); });

    
    document.getElementById('assets-refresh-btn')?.addEventListener('click', () => { allAssets = []; loadAssetsFromR2(); });
    document.getElementById('assets-search')?.addEventListener('input', () => { if (typeof renderAssets === 'function') renderAssets(); });

    
    document.getElementById('strategy-new-doc-btn')?.addEventListener('click', () => { if (typeof createNewStrategyDoc === 'function') createNewStrategyDoc(); });

    
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            ['step-modal', 'new-project-modal', 'viewer-modal', 'profile-modal', 'asset-modal', 'change-password-modal', 'upgrade-modal'].forEach(id => {
                document.getElementById(id)?.classList.remove('open');
            });
        }
    });

    document.addEventListener('userReady', () => {
        const adminNav = document.querySelector('.admin-only-nav');
        if (adminNav) {
            adminNav.style.display = window.userRole === 'admin' ? 'flex' : 'none';
        }
    });
 
    
    document.getElementById('admin-refresh-btn')?.addEventListener('click', () => {
        if (typeof renderAdminPage === 'function') renderAdminPage();
    });
}





function observeEditorOpen() {
    const observer = new MutationObserver(() => {
        const editor = document.getElementById('editor');
        if (editor && editor.style.display === 'block') {
            
            const old = editor.querySelector('.script-editor-wrapper');
            if (old) old.remove();
            delete editor.dataset.editorInitialized;
            setTimeout(() => initScriptEditor(), 100);
            observer.disconnect(); 
            
            observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['style'] });
        }
    });
    observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['style'] });
}





window.updateWordCount = function () {
    let text = '';
    if (isScriptEditorActive && scriptRichEditor) {
        text = scriptRichEditor.innerText;
    } else if (scriptTextarea) {
        text = scriptTextarea.value;
    }
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    document.getElementById('word-count').textContent = words;
    document.getElementById('char-count').textContent = text.length;
};

window.saveProject = async function (silent) {
    const p = getProject(currentProjectId);
    if (!p) return;
    p.name = document.getElementById('project-name-input')?.value || 'Sem título';
    if (isScriptEditorActive && scriptRichEditor) {
        p.script = scriptRichEditor.innerHTML;
    } else if (scriptTextarea) {
        p.script = scriptTextarea.value;
    }
    p.updatedAt = new Date().toISOString();
    await saveProjectToDB(p);
    setAutosaveBadge('saved');
    if (!silent) showToast('Projeto salvo!');
};

window.generateScript = function () {
    const p = getProject(currentProjectId);
    if (!p) return;
    let result = '';
    STEPS.forEach(step => {
        if (p.notes[step.id]?.trim()) {
            result += `<h2>${step.id}. ${step.name.toUpperCase()}</h2>\n<p>${p.notes[step.id].trim().replace(/\n/g, '<br>')}</p>\n`;
        }
    });
    if (!result) { showToast('Adicione notas nas etapas primeiro!'); return; }
    const finalHtml = `<h1>${escapeHtml(p.name || 'MEU ROTEIRO')}</h1>\n${result}`;
    if (isScriptEditorActive && scriptRichEditor) {
        scriptRichEditor.innerHTML = finalHtml;
    } else if (scriptTextarea) {
        scriptTextarea.value = finalHtml.replace(/<[^>]*>/g, '\n');
    }
    updateWordCount();
    scheduleAutoSave();
    showToast('Roteiro gerado com sucesso!');
};

window.exportScript = function () {
    const p = getProject(currentProjectId);
    if (!p) return;
    let text = '';
    if (isScriptEditorActive && scriptRichEditor) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = scriptRichEditor.innerHTML;
        text = tempDiv.innerText;
    } else if (scriptTextarea) {
        text = scriptTextarea.value;
    }
    if (!text.trim()) { showToast('Roteiro vazio!'); return; }
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${p.name || 'roteiro'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exportado!');
};





document.addEventListener('DOMContentLoaded', () => {
    bindEvents();
    observeEditorOpen();
});
