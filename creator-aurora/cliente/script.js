


const SUPABASE_URL    = 'https://buujbhfmpujtlnbncget.supabase.co';
const SUPABASE_ANON   = 'sb_publishable_hHILUYQVX0Qh4yuug3xOrA_ECy98XHw';
const EDGE_SEND_OTP   = SUPABASE_URL + '/functions/v1/send-otp-email';
const EDGE_RESET_PASS = SUPABASE_URL + '/functions/v1/reset-password';

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON);


let otpCtx         = { email: '', name: '', type: '', passwordPending: '' };
let countdownTimer = null;
let resendCooldown = null;


const elLoad  = () => document.getElementById('loadingState');
const elAuth  = () => document.getElementById('authWrap');
const elDash  = () => document.getElementById('dashboardWrap');

function showLoading() {
    elLoad().style.display = 'flex';
    elAuth().style.display = 'none';
    elDash().style.display = 'none';
}

function showAuth() {
    elLoad().style.display = 'none';
    elAuth().style.display = 'flex';
    elDash().style.display = 'none';
}

function showDash() {
    elLoad().style.display = 'none';
    elAuth().style.display = 'none';
    elDash().style.display = 'block';
}




function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

function setTab(tab) {
    document.getElementById('tabLogin').classList.toggle('active', tab === 'login');
    document.getElementById('tabRegister').classList.toggle('active', tab === 'register');
    document.getElementById('loginForm').style.display    = tab === 'login'    ? 'flex' : 'none';
    document.getElementById('registerForm').style.display = tab === 'register' ? 'flex' : 'none';
    clearMsg('mainMsg');
}




function showMsg(id, text, type = 'error') {
    const el = document.getElementById(id);
    el.textContent = text;
    el.className = 'auth-msg show ' + type;
}

function clearMsg(id) {
    document.getElementById(id).className = 'auth-msg';
}

const ARROW_SVG = '<svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const SPIN_SVG  = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" style="animation:spin .7s linear infinite"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" opacity=".25"/><path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

function setBtnLoading(id, loading, label = '') {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.disabled  = loading;
    btn.innerHTML = loading ? SPIN_SVG + ' Aguarde…' : label + ' ' + ARROW_SVG;
}




function initOtpInputs() {
    const digits = document.querySelectorAll('.otp-digit');
    digits.forEach((d, i) => {
        d.value = '';
        d.addEventListener('input', e => {
            const val = e.target.value.replace(/\D/g, '');
            e.target.value = val.slice(-1);
            if (val && i < digits.length - 1) digits[i + 1].focus();
        });
        d.addEventListener('keydown', e => {
            if (e.key === 'Backspace' && !d.value && i > 0)      digits[i - 1].focus();
            if (e.key === 'ArrowLeft'  && i > 0)                 digits[i - 1].focus();
            if (e.key === 'ArrowRight' && i < digits.length - 1) digits[i + 1].focus();
            if (e.key === 'Enter') handleVerifyOtp();
        });
        d.addEventListener('paste', e => {
            e.preventDefault();
            const pasted = (e.clipboardData || window.clipboardData)
                .getData('text').replace(/\D/g, '').slice(0, 6);
            pasted.split('').forEach((ch, j) => { if (digits[i + j]) digits[i + j].value = ch; });
            digits[Math.min(i + pasted.length, digits.length - 1)].focus();
        });
    });
    digits[0].focus();
}

function getOtpValue() {
    return Array.from(document.querySelectorAll('.otp-digit')).map(d => d.value).join('');
}




function startCountdown(seconds = 900) {
    clearInterval(countdownTimer);
    const el = document.getElementById('otpCountdown');
    let remaining = seconds;
    function tick() {
        const m = String(Math.floor(remaining / 60)).padStart(2, '0');
        const s = String(remaining % 60).padStart(2, '0');
        el.textContent = m + ':' + s;
        if (remaining <= 0) { clearInterval(countdownTimer); el.textContent = 'Expirado'; }
        remaining--;
    }
    tick();
    countdownTimer = setInterval(tick, 1000);
}

function startResendCooldown(seconds = 60) {
    clearInterval(resendCooldown);
    const btn = document.getElementById('resendBtn');
    btn.disabled = true;
    let remaining = seconds;
    function tick() {
        btn.textContent = 'Reenviar (' + remaining + 's)';
        if (remaining <= 0) {
            clearInterval(resendCooldown);
            btn.disabled    = false;
            btn.textContent = 'Reenviar código';
        }
        remaining--;
    }
    tick();
    resendCooldown = setInterval(tick, 1000);
}




async function callSendOtp(email, type, name = '') {
    const { data: { session } } = await sb.auth.getSession();
    const bearerToken = session?.access_token ?? SUPABASE_ANON;

    const res = await fetch(EDGE_SEND_OTP, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON,
            'Authorization': 'Bearer ' + bearerToken,
        },
        body: JSON.stringify({ email, type, name }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Erro ao enviar e-mail');
    return data;
}




async function verifyOtpInDb(email, type, code) {
    const { data, error } = await sb
        .from('otp_codes')
        .select('id')
        .match({ email, type, code, used: false })
        .gt('expires_at', new Date().toISOString())
        .single();

    if (error || !data) return false;
    await sb.from('otp_codes').update({ used: true }).eq('id', data.id);
    return true;
}




async function callResetPassword(email, password) {
    const { data: { session } } = await sb.auth.getSession();
    const bearerToken = session?.access_token ?? SUPABASE_ANON;

    const res = await fetch(EDGE_RESET_PASS, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON,
            'Authorization': 'Bearer ' + bearerToken,
        },
        body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Erro ao redefinir senha');
    return data;
}




function goToOtp(email, name, type) {
    otpCtx = { email, name, type, passwordPending: '' };

    if (type === 'reset') {
        document.getElementById('otpTitle').textContent = 'Redefinição de senha';
        document.getElementById('otpSub').innerHTML =
            'Enviamos um código para <strong>' + email + '</strong>. Digite-o para criar uma nova senha.';
    } else {
        document.getElementById('otpTitle').textContent = 'Confirme seu e-mail';
        document.getElementById('otpSub').innerHTML =
            'Enviamos um código para <strong>' + email + '</strong>. Digite-o para ativar sua conta.';
    }

    showScreen('screenOtp');
    initOtpInputs();
    startCountdown(900);
    startResendCooldown(60);
    clearMsg('otpMsg');
}




async function resendOtp() {
    try {
        await callSendOtp(otpCtx.email, otpCtx.type, otpCtx.name);
        startCountdown(900);
        startResendCooldown(60);
        showMsg('otpMsg', 'Novo código enviado para ' + otpCtx.email, 'success');
    } catch (err) {
        showMsg('otpMsg', err.message, 'error');
    }
}




async function handleVerifyOtp() {
    clearMsg('otpMsg');
    const code = getOtpValue();
    if (code.length < 6) {
        showMsg('otpMsg', 'Digite todos os 6 dígitos.', 'error');
        return;
    }

    setBtnLoading('verifyBtn', true);
    try {
        const valid = await verifyOtpInDb(otpCtx.email, otpCtx.type, code);
        if (!valid) throw new Error('Código inválido ou expirado. Tente novamente.');

        clearInterval(countdownTimer);

        if (otpCtx.type === 'confirm') {
            showMsg('otpMsg', 'E-mail confirmado! Entrando…', 'success');
            setTimeout(() => showScreen('screenMain'), 1500);
        } else {
            showScreen('screenNewPass');
            clearMsg('newPassMsg');
            document.getElementById('new-pass').value         = '';
            document.getElementById('new-pass-confirm').value = '';
        }
    } catch (err) {
        showMsg('otpMsg', err.message, 'error');
    } finally {
        setBtnLoading('verifyBtn', false, 'Confirmar código');
    }
}




async function handleLogin(e) {
    e.preventDefault();
    clearMsg('mainMsg');
    const email = document.getElementById('login-email').value.trim();
    const pass  = document.getElementById('login-pass').value;

    setBtnLoading('loginBtn', true);
    try {
        const { error } = await sb.auth.signInWithPassword({ email, password: pass });
        if (error) throw error;
        
    } catch (err) {
        const msg = err.message.includes('Invalid login')
            ? 'E-mail ou senha incorretos.'
            : (err.message || 'Erro ao entrar.');
        showMsg('mainMsg', msg, 'error');
        setBtnLoading('loginBtn', false, 'Entrar na minha conta');
    }
}




async function handleRegister(e) {
    e.preventDefault();
    clearMsg('mainMsg');
    const name  = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const pass  = document.getElementById('reg-pass').value;

    setBtnLoading('registerBtn', true);
    try {
        const { error: signUpError } = await sb.auth.signUp({
            email,
            password: pass,
            options: { data: { full_name: name } },
        });

        if (signUpError && !signUpError.message.toLowerCase().includes('already registered')) {
            throw signUpError;
        }

        await callSendOtp(email, 'confirm', name);
        goToOtp(email, name, 'confirm');

    } catch (err) {
        showMsg('mainMsg', err.message || 'Erro ao criar conta.', 'error');
        setBtnLoading('registerBtn', false, 'Criar minha conta');
    }
}




async function showForgot() {
    const email = document.getElementById('login-email').value.trim();
    if (!email) {
        showMsg('mainMsg', 'Preencha o campo de e-mail antes de solicitar a redefinição.', 'info');
        return;
    }

    clearMsg('mainMsg');
    showMsg('mainMsg', 'Enviando código…', 'info');
    try {
        await callSendOtp(email, 'reset');
        goToOtp(email, '', 'reset');
        clearMsg('mainMsg');
    } catch (err) {
        showMsg('mainMsg', err.message || 'Não foi possível enviar o código. Verifique o e-mail.', 'error');
    }
}




async function handleNewPassword(e) {
    e.preventDefault();
    clearMsg('newPassMsg');
    const p1 = document.getElementById('new-pass').value;
    const p2 = document.getElementById('new-pass-confirm').value;

    if (p1 !== p2)   { showMsg('newPassMsg', 'As senhas não coincidem.', 'error'); return; }
    if (p1.length < 8) { showMsg('newPassMsg', 'A senha precisa ter pelo menos 8 caracteres.', 'error'); return; }

    setBtnLoading('newPassBtn', true);
    try {
        const { data: { session } } = await sb.auth.getSession();

        if (session) {
            const { error } = await sb.auth.updateUser({ password: p1 });
            if (error) throw error;
        } else {
            await callResetPassword(otpCtx.email, p1);
        }

        showMsg('newPassMsg', 'Senha atualizada com sucesso! Redirecionando…', 'success');
        setTimeout(() => {
            showScreen('screenMain');
            document.getElementById('new-pass').value         = '';
            document.getElementById('new-pass-confirm').value = '';
        }, 1800);

    } catch (err) {
        showMsg('newPassMsg', err.message || 'Erro ao atualizar senha.', 'error');
    } finally {
        setBtnLoading('newPassBtn', false, 'Salvar nova senha');
    }
}




async function handleGoogle() {
    const { error } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.href },
    });
    if (error) showMsg('mainMsg', error.message, 'error');
}




async function handleLogout() {
    await sb.auth.signOut();
}




async function renderDashboard(user) {
    
    showDash();

    const meta      = user.user_metadata || {};
    const name      = meta.full_name || meta.name || meta.display_name || user.email.split('@')[0];
    const firstName = name.split(' ')[0];

    document.getElementById('dashName').textContent     = firstName;
    document.getElementById('dashFullName').textContent = name;
    document.getElementById('dashEmail').textContent    = user.email;
    document.getElementById('dashAvatar').textContent   = name[0].toUpperCase();
    document.getElementById('dashSince').textContent    = new Date(user.created_at).toLocaleDateString('pt-BR', {
        month: 'long', year: 'numeric',
    });

    
    document.getElementById('dashPlanName').textContent  = '…';
    document.getElementById('dashNextBill').textContent  = '…';
    document.getElementById('dashScripts').textContent   = '…';
    document.getElementById('dashStorage').textContent   = '—';

    
    let planName    = 'Free';
    let isActive    = false;
    let expiresAt   = null;
    let maxProjects = 3;

    const [sigResult, countResult] = await Promise.allSettled([
        sb.from('signatures').select('*, plans(*)').eq('user_id', user.id).maybeSingle(),
        sb.from('vexarco_projects').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    ]);

    
    if (sigResult.status === 'fulfilled' && sigResult.value.data?.plans) {
        const sig     = sigResult.value.data;
        const expired = sig.expires_at && new Date(sig.expires_at) < new Date();
        if (!expired) {
            planName    = sig.plans.name;
            isActive    = true;
            expiresAt   = sig.expires_at;
            maxProjects = sig.plans.max_projects ?? -1;
        }
    }

    
    document.getElementById('dashPlanName').textContent = planName;

    const statusEl = document.getElementById('dashPlanStatus');
    statusEl.className = isActive ? 'plan-status status-active' : 'plan-status status-free';
    statusEl.innerHTML = '<span class="status-dot"></span>' + (isActive ? 'Ativo' : 'Gratuito');

    document.getElementById('dashNextBill').textContent =
        expiresAt   ? new Date(expiresAt).toLocaleDateString('pt-BR') :
        isActive    ? 'Sem expiração' :
                      'Sem cobrança';

    document.getElementById('dashUpgrade').style.display = isActive ? 'none' : 'flex';

    
    if (countResult.status === 'fulfilled') {
        const count = countResult.value.count ?? 0;
        const max   = maxProjects === -1 ? '∞' : maxProjects;
        document.getElementById('dashScripts').textContent = count + ' / ' + max;
    } else {
        document.getElementById('dashScripts').textContent = '— / —';
    }
}




showLoading();



sb.auth.getSession().then(({ data: { session } }) => {
    if (session?.user) {
        renderDashboard(session.user);
    } else {
        showAuth();
    }
});


sb.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session?.user) {
        renderDashboard(session.user);
    } else if (event === 'SIGNED_OUT') {
        showAuth();
    }
    
});