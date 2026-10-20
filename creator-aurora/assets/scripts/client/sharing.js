window.isSharedLinkView = new URLSearchParams(window.location?.search || '').has('share');
let sharingContext = null;

function selectedSharingMode() {
    return document.querySelector('.sharing-mode-option.is-selected')?.dataset.sharingMode || 'private';
}

function selectSharingMode(mode) {
    document.querySelectorAll('.sharing-mode-option').forEach(button => {
        const selected = button.dataset.sharingMode === mode;
        button.classList.toggle('is-selected', selected);
        button.setAttribute('aria-checked', String(selected));
    });
}

function sharingUrl(token) {
    const url = new URL('/painel/', window.location.href);
    url.searchParams.set('share', token);
    return url.href;
}

function updateSharingPreview() {
    const mode = selectedSharingMode();
    document.getElementById('sharing-description').textContent = mode === 'link'
        ? 'Qualquer pessoa com este link poderá visualizar o conteúdo completo, sem login e sem poder editar.'
        : mode === 'role'
            ? (window.userRole ? `Somente pessoas com a mesma role (${window.userRole}) poderão visualizar.` : 'Sem role atribuída: o conteúdo continuará visível apenas para você.')
            : 'Apenas você poderá visualizar. Links anteriores deixarão de funcionar ao salvar.';
    const activeLink = mode === 'link' && sharingContext?.settings?.mode === 'link';
    document.getElementById('sharing-link-section').hidden = !activeLink;
    document.getElementById('sharing-link').value = activeLink ? sharingUrl(sharingContext.settings.token) : '';
}

async function openContentSharing(kind, id, title) {
    const context = { kind, id, settings: null };
    sharingContext = context;
    document.getElementById('sharing-title').textContent = title || 'Compartilhar';
    document.getElementById('sharing-kind').textContent = kind === 'board' ? 'Board' : 'Roteiro';
    document.getElementById('sharing-status').textContent = 'Carregando permissões…';
    document.getElementById('sharing-options').hidden = true;
    document.getElementById('sharing-save').disabled = true;
    document.getElementById('content-sharing-modal').classList.add('open');
    try {
        const { data, error } = await sb.rpc('aurora_share_settings', { content_kind: kind, content_id: id });
        if (error) throw error;
        if (sharingContext !== context) return;
        context.settings = data;
        selectSharingMode(data.mode);
        document.getElementById('sharing-options').hidden = false;
        document.getElementById('sharing-status').textContent = '';
        document.getElementById('sharing-save').disabled = false;
        updateSharingPreview();
    } catch (error) {
        if (sharingContext === context) document.getElementById('sharing-status').textContent = 'Não foi possível carregar o compartilhamento. ' + error.message;
    }
}

async function saveContentSharing(rotate = false) {
    const context = sharingContext;
    if (!context?.settings || context.busy) return;
    const mode = selectedSharingMode();
    context.busy = true;
    const controls = [document.getElementById('sharing-save'), document.getElementById('sharing-rotate'),
        ...document.querySelectorAll('.sharing-mode-option')];
    controls.forEach(control => { if (control) control.disabled = true; });
    try {
        const { data, error } = await sb.rpc('aurora_share_settings', {
            content_kind: context.kind, content_id: context.id, requested_mode: mode, rotate_link: rotate,
        });
        if (error) throw error;
        // Keep the in-memory project in sync so autosave cannot restore its old visibility.
        if (context.kind === 'roteiro') {
            const project = getProject(context.id);
            if (project) project.visibility = data.mode === 'role' ? 'public' : 'private';
        }
        if (sharingContext !== context) return;
        context.settings = data;
        document.getElementById('sharing-status').textContent = rotate ? 'Novo link gerado. O link anterior foi revogado.' : 'Compartilhamento atualizado.';
        updateSharingPreview();
    } catch (error) {
        if (sharingContext === context) document.getElementById('sharing-status').textContent = 'Erro ao salvar: ' + error.message;
    } finally {
        context.busy = false;
        if (sharingContext === context) controls.forEach(control => { if (control) control.disabled = false; });
    }
}

function closeContentSharing() {
    if (sharingContext?.busy) return;
    sharingContext = null;
    document.getElementById('content-sharing-modal').classList.remove('open');
}

async function loadSharedLink() {
    document.body.classList.add('shared-link-view');
    document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
    const status = document.getElementById('shared-link-status');
    status.hidden = false;
    status.textContent = 'Carregando conteúdo compartilhado…';
    showPanel();
    hideInitialLoading();
    const token = new URLSearchParams(window.location.search).get('share');
    try {
        if (!/^[a-f0-9]{64}$/.test(token || '')) throw new Error('invalid-link');
        const { data, error } = await sb.rpc('aurora_read_shared_content', { share_token: token });
        if (error) throw error;
        if (!data) throw new Error('invalid-link');
        if (data.kind === 'roteiro') {
            document.getElementById('tab-roteiros').classList.add('active');
            showProjectEditor(dbToLocal(data.project), data.author_name || 'Autor');
        } else if (data.kind === 'board') {
            document.getElementById('tab-board').classList.add('active');
            document.getElementById('shared-link-title').textContent = data.board.title || 'Board compartilhado';
            await renderSharedBoard(data);
        } else throw new Error('invalid-link');
        document.getElementById('shared-link-author').textContent = `Por ${data.author_name || 'Autor'} · Somente leitura`;
        status.hidden = true;
    } catch (error) {
        document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
        status.textContent = error.message === 'invalid-link'
            ? 'Este link é inválido ou não está mais disponível. Peça um novo link ao autor.'
            : 'Não foi possível carregar o conteúdo. Recarregue a página para tentar novamente.';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.sharing-mode-option').forEach(button => button.addEventListener('click', () => {
        if (button.disabled) return;
        selectSharingMode(button.dataset.sharingMode);
        updateSharingPreview();
    }));
    document.getElementById('sharing-save')?.addEventListener('click', () => saveContentSharing());
    document.getElementById('sharing-rotate')?.addEventListener('click', () => saveContentSharing(true));
    document.getElementById('sharing-close')?.addEventListener('click', closeContentSharing);
    document.getElementById('content-sharing-modal')?.addEventListener('click', event => {
        if (event.target.id === 'content-sharing-modal') closeContentSharing();
    });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') closeContentSharing(); });
    document.getElementById('sharing-copy')?.addEventListener('click', async () => {
        const input = document.getElementById('sharing-link');
        try { await navigator.clipboard.writeText(input.value); showToast('Link copiado!'); }
        catch { input.focus(); input.select(); showToast('Selecione e copie o link exibido.'); }
    });
    document.getElementById('share-project-btn')?.addEventListener('click', () => {
        const project = getActiveProject();
        if (project && !isProjectReadOnly()) openContentSharing('roteiro', project.id, project.name);
    });
});
