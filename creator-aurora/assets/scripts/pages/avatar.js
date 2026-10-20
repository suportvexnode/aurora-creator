// ═══════════════════════════════════════════════════════════════════════
// AVATAR MAKER - Aurora Creator
// ═══════════════════════════════════════════════════════════════════════

(function () {
    // Verifica se já foi inicializado para evitar duplicidade
    if (window.avatarMakerInitialized) return;
    window.avatarMakerInitialized = true;

    // Elementos DOM
    const elements = {
        skin: new Image(),
        fileDataUrl: null,
        isAlex: false,

        // Canvas
        cvFront: null,
        cvLeft: null,
        cvRight: null,
        cvArms: null,

        // Elementos de UI
        nickInput: null,
        loadNickBtn: null,
        loadFileBtn: null,
        fileInput: null,
        dropZone: null,
        dropLabel: null,
        errorDiv: null,
        modelBadge: null,
        uuid: null,
        playerId: null
    };

    // Inicialização
    function init() {
        // Cache dos elementos
        elements.cvFront = document.getElementById('cv-front');
        elements.cvLeft = document.getElementById('cv-left');
        elements.cvRight = document.getElementById('cv-right');
        elements.cvArms = document.getElementById('cv-arms');
        elements.nickInput = document.getElementById('avatar-nick');
        elements.loadNickBtn = document.getElementById('avatar-load-nick');
        elements.loadFileBtn = document.getElementById('avatar-load-file');
        elements.fileInput = document.getElementById('avatar-file-input');
        elements.dropZone = document.getElementById('avatar-drop-zone');
        elements.dropLabel = document.getElementById('avatar-drop-label');
        elements.errorDiv = document.getElementById('avatar-error');
        elements.modelBadge = document.getElementById('model-badge');
        elements.uuid = document.getElementById('avatar-uuid');
        elements.playerId = document.getElementById('avatar-player-id');

        if (!elements.cvFront) return; // Sai se não estiver na página

        // Configurar listeners
        setupTabs();
        setupEventListeners();
        setupDragAndDrop();

        // Configurar crossOrigin para a imagem
        elements.skin.crossOrigin = "Anonymous";
    }

    // Sistema de abas
    function setupTabs() {
        const tabs = document.querySelectorAll('.avatar-tab');
        const panels = {
            nick: document.getElementById('avatar-panel-nick'),
            file: document.getElementById('avatar-panel-file')
        };

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetTab = tab.dataset.tab;

                // Atualizar abas
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                // Atualizar painéis
                Object.values(panels).forEach(panel => {
                    if (panel) panel.classList.remove('active');
                });

                if (targetTab === 'nick' && panels.nick) {
                    panels.nick.classList.add('active');
                } else if (targetTab === 'file' && panels.file) {
                    panels.file.classList.add('active');
                }

                // Limpar erro
                if (elements.errorDiv) elements.errorDiv.textContent = '';
            });
        });
    }

    // Event listeners principais
    // Event listeners principais
    function setupEventListeners() {
        // Botão de refresh (ATUALIZADO - limpa os canvases)
        const refreshBtn = document.getElementById('avatar-refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                // Limpa todos os canvases
                clearAllCanvases();

                // Se já tem uma skin carregada, recarrega
                if (elements.skin.src && elements.skin.complete && elements.skin.src !== '') {
                    renderAll();
                } else if (elements.nickInput && elements.nickInput.value.trim()) {
                    loadByNick();
                } else if (elements.fileDataUrl) {
                    loadByFileTrigger();
                } else {
                    // Se não tem nada carregado, apenas mostra mensagem
                    showError('Carregue uma skin primeiro usando Nick ou Arquivo.');
                }
            });
        }

        // Carregar por Nick
        if (elements.loadNickBtn) {
            elements.loadNickBtn.addEventListener('click', loadByNick);
        }
        if (elements.nickInput) {
            elements.nickInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') loadByNick();
            });
        }

        // Carregar por Arquivo
        if (elements.loadFileBtn) {
            elements.loadFileBtn.addEventListener('click', loadByFileTrigger);
        }
        if (elements.fileInput) {
            elements.fileInput.addEventListener('change', (e) => loadByFile(e.target));
        }

        // Botões de download (delegação de eventos)
        document.querySelectorAll('.download').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const canvasId = btn.dataset.canvas;
                const name = btn.dataset.name;
                if (canvasId && name) {
                    downloadCanvas(canvasId, name);
                }
            });
        });

        document.getElementById('avatar-copy-uuid')?.addEventListener('click', async () => {
            if (!elements.uuid?.textContent || elements.uuid.textContent === '—') return;
            await navigator.clipboard?.writeText(elements.uuid.textContent);
            showToast('UUID copiado.');
        });


    }

    // Drag and drop
    function setupDragAndDrop() {
        if (!elements.dropZone) return;

        elements.dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            elements.dropZone.classList.add('dragover');
        });

        elements.dropZone.addEventListener('dragleave', () => {
            elements.dropZone.classList.remove('dragover');
        });

        elements.dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            elements.dropZone.classList.remove('dragover');

            const file = e.dataTransfer.files[0];
            if (!file || file.type !== 'image/png') {
                showError('Use um arquivo .png de skin.');
                return;
            }

            const reader = new FileReader();
            reader.onload = (ev) => {
                elements.fileDataUrl = ev.target.result;
                if (elements.dropLabel) {
                    elements.dropLabel.textContent = 'Skin selecionada: ' + file.name;
                }
                elements.dropZone.classList.add('has-file');
            };
            reader.readAsDataURL(file);
        });

        elements.dropZone.addEventListener('click', () => {
            if (elements.fileInput) elements.fileInput.click();
        });

        // Downloads de skin
        const btnDownloadOriginal = document.getElementById('avatar-download-skin-original');
        const btnDownloadUpscaled = document.getElementById('avatar-download-skin-2048');

        if (btnDownloadOriginal) {
            btnDownloadOriginal.addEventListener('click', downloadSkinOriginal);
        }
        if (btnDownloadUpscaled) {
            btnDownloadUpscaled.addEventListener('click', () => downloadSkinUpscaled(2048));
        }
    }

    // Funções de carregamento
    function loadByNick() {
        if (!elements.nickInput) return;
        const nick = elements.nickInput.value.trim();
        if (!nick) {
            showError('Digite um nick.');
            return;
        }

        showError('');
        lookupUuid(nick);
        elements.skin.onload = () => {
            renderAll();
        };
        elements.skin.onerror = () => {
            showError('Nick não encontrado ou skin inválida.');
        };
        elements.skin.src = `https://minotar.net/skin/${nick}?t=${Date.now()}`;
    }

    function loadByFile(inputElement) {
        const file = inputElement.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            elements.fileDataUrl = e.target.result;
            if (elements.dropLabel) {
                elements.dropLabel.textContent = 'Skin selecionada: ' + file.name;
            }
            if (elements.dropZone) {
                elements.dropZone.classList.add('has-file');
            }
        };
        reader.readAsDataURL(file);
    }

    function loadByFileTrigger() {
        if (!elements.fileDataUrl) {
            showError('Selecione um arquivo de skin primeiro.');
            return;
        }

        showError('');
        elements.skin.onload = () => {
            renderAll();
        };
        elements.skin.onerror = () => {
            showError('Arquivo inválido ou corrompido.');
        };
        elements.skin.src = elements.fileDataUrl;
    }

    // Detecção de modelo (Alex x Steve)
    function detectModel() {
        if (!elements.skin.complete || elements.skin.width === 0) return;

        const off = document.createElement('canvas');
        off.width = elements.skin.width;
        off.height = elements.skin.height;
        const ctx = off.getContext('2d');
        ctx.drawImage(elements.skin, 0, 0);

        try {
            const pixel = ctx.getImageData(50, 16, 1, 1).data;
            elements.isAlex = pixel[3] < 128;
        } catch (e) {
            elements.isAlex = false;
        }

        if (elements.modelBadge) {
            elements.modelBadge.style.display = 'inline-block';
            elements.modelBadge.textContent = elements.isAlex ? 'Alex' : 'Steve';
            elements.modelBadge.className = 'model-badge ' + (elements.isAlex ? 'badge-alex' : 'badge-steve');
        }
    }

    // Função para limpar todos os canvases
    function clearAllCanvases() {
        const canvases = ['cv-front', 'cv-left', 'cv-right', 'cv-arms'];

        canvases.forEach(canvasId => {
            const canvas = document.getElementById(canvasId);
            if (canvas) {
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                // Preenche com fundo escuro para feedback visual
                ctx.fillStyle = '#111118';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
        });

        // Limpa a mensagem de erro
        if (elements.errorDiv) {
            elements.errorDiv.textContent = '';
        }

        // Mostra feedback visual (opcional)
        showToast('Canvases limpos! Carregue uma nova skin.', 1500);
    }

    // Função auxiliar para toast (adicione se não existir)
    function showToast(message, duration = 2000) {
        const toast = document.getElementById('toast');
        if (toast) {
            toast.textContent = message;
            toast.classList.add('show');
            setTimeout(() => {
                toast.classList.remove('show');
            }, duration);
        }
    }

    // Funções de renderização
    function setupCanvas(id, width, height) {
        const canvas = document.getElementById(id);
        if (!canvas) return null;
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, width, height);
        return ctx;
    }

    function drawPixelated(ctx, sx, sy, sw, sh, dx, dy, dw, dh) {
        ctx.drawImage(elements.skin, sx, sy, sw, sh, dx, dy, dw, dh);
    }

    function renderFront() {
        const S = 400;
        const PAD = 20;
        const ctx = setupCanvas('cv-front', S + PAD * 2, S + PAD * 2);
        if (!ctx) return;

        drawPixelated(ctx, 8, 8, 8, 8, PAD, PAD, S, S);
        drawPixelated(ctx, 40, 8, 8, 8, PAD - 6, PAD - 6, S + 12, S + 12);
    }

    function renderLeft() {
        const W = 190, H = 250, PAD = 20;
        const ctx = setupCanvas('cv-left', W + W + PAD * 2, H + PAD * 2);
        if (!ctx) return;
        const HO = 6;

        drawPixelated(ctx, 0, 8, 8, 8, PAD, PAD, W, H);
        drawPixelated(ctx, 8, 8, 8, 8, PAD + W, PAD, W, H);
        drawPixelated(ctx, 32, 8, 8, 8, PAD - HO, PAD - HO, W + HO * 2, H + HO * 2);
        drawPixelated(ctx, 40, 8, 8, 8, PAD + W - HO, PAD - HO, W + HO * 2, H + HO * 2);

        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(PAD, PAD, W, H);
    }

    function renderRight() {
        const W = 190, H = 250, PAD = 20;
        const ctx = setupCanvas('cv-right', W + W + PAD * 2, H + PAD * 2);
        if (!ctx) return;
        const HO = 6;

        drawPixelated(ctx, 8, 8, 8, 8, PAD, PAD, W, H);
        drawPixelated(ctx, 16, 8, 8, 8, PAD + W, PAD, W, H);
        drawPixelated(ctx, 40, 8, 8, 8, PAD - HO, PAD - HO, W + HO * 2, H + HO * 2);
        drawPixelated(ctx, 48, 8, 8, 8, PAD + W - HO, PAD - HO, W + HO * 2, H + HO * 2);

        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(PAD + W, PAD, W, H);
    }

    function renderArms() {
        const armW = elements.isAlex ? 3 : 4;
        const armH = 12;
        const SCALE = 20;
        const SW = armW * SCALE;
        const SH = armH * SCALE;
        const GAP = 30;
        const PAD = 20;
        const CW = SW * 2 + GAP + PAD * 2;
        const CH = SH + PAD * 2;

        const ctx = setupCanvas('cv-arms', CW, CH);
        if (!ctx) return;

        const xL = PAD;
        const xR = PAD + SW + GAP;

        // Braço esquerdo
        drawPixelated(ctx, 36, 52, armW, 12, xL, PAD, SW, SH);
        drawPixelated(ctx, 52, 52, armW, 12, xL - 2, PAD - 2, SW + 4, SH + 4);

        // Braço direito
        drawPixelated(ctx, 44, 20, armW, 12, xR, PAD, SW, SH);
        drawPixelated(ctx, 44, 36, armW, 12, xR - 2, PAD - 2, SW + 4, SH + 4);

        // Labels
        ctx.font = "bold 11px 'DM Sans', monospace";
        ctx.fillStyle = '#888';
        ctx.textAlign = 'center';
        ctx.fillText("ESQUERDO", xL + SW / 2, CH - 8);
        ctx.fillText("DIREITO", xR + SW / 2, CH - 8);
    }

    function renderAll() {
        if (!elements.skin.complete || elements.skin.width === 0) {
            showError('Aguardando carregamento da skin...');
            return;
        }

        detectModel();
        renderFront();
        renderLeft();
        renderRight();
        renderArms();
    }

    async function lookupUuid(nick) {
        if (elements.uuid && elements.playerId) {
            elements.uuid.textContent = 'Consultando…';
            elements.playerId.style.display = 'flex';
        }
        try {
            const response = await fetch(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(nick)}`);
            if (!response.ok) throw new Error('Perfil não encontrado');
            const data = await response.json();
            const id = data.id?.replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
            if (id && elements.uuid && elements.playerId) {
                elements.uuid.textContent = id;
                elements.playerId.style.display = 'flex';
            }
        } catch {
            try {
                const response = await fetch(`https://api.minetools.eu/uuid/${encodeURIComponent(nick)}`);
                const data = await response.json();
                const id = (data.id || data.uuid || '').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
                if (!id) throw new Error('UUID indisponível');
                elements.uuid.textContent = id;
            } catch {
                if (elements.uuid) elements.uuid.textContent = 'UUID indisponível para este nick';
            }
        }
    }

    function downloadCanvas(canvasId, name) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const link = document.createElement('a');
        link.download = `minecraft-avatar-${name}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    }

    async function downloadSkinOriginal() {
        if (!elements.skin.src || !elements.skin.complete) {
            showError('Carregue uma skin primeiro.');
            return;
        }

        try {
            const res = await fetch(elements.skin.src);
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.download = 'skin-original.png';
            link.href = url;
            link.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            // Fallback: desenha no canvas e exporta
            const canvas = document.createElement('canvas');
            canvas.width = elements.skin.width || 64;
            canvas.height = elements.skin.height || 64;
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(elements.skin, 0, 0);
            const link = document.createElement('a');
            link.download = 'skin-original.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
        }
    }

    function downloadSkinUpscaled(targetSize = 2048) {
        if (!elements.skin.complete || elements.skin.width === 0) {
            showError('Carregue uma skin primeiro.');
            return;
        }

        // Skin Minecraft é 64×64 — escala por pixel sem interpolação
        const scale = targetSize / 64;
        const canvas = document.createElement('canvas');
        canvas.width = targetSize;
        canvas.height = targetSize;

        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(elements.skin, 0, 0, 64, 64, 0, 0, targetSize, targetSize);

        const link = document.createElement('a');
        link.download = `skin-${targetSize}x${targetSize}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    }

    function showError(message) {
        if (elements.errorDiv) {
            elements.errorDiv.textContent = message;
        }
    }

    // Inicializar quando o DOM estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
