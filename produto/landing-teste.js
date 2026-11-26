/* Teste grátis em 4 passos, tudo automático: logo -> dados -> montagem (loading) -> entra no painel.
   A logo é tratada no navegador (tira fundo, recorta) e as cores do sistema saem dela. Nada passa por aprovação. */
(() => {
  const $ = (s) => document.querySelector(s), dlg = $('#demo-dialog');
  if (!dlg) return;
  const passos = ['logo', 'dados', 'monta', 'pronto'];
  const mostra = (p) => passos.forEach((x) => { const el = $('#t-' + x); if (el) el.hidden = x !== p; });
  const estado = { logo: '', cores: null };

  // ---------- cores a partir da logo ----------
  const lum = (r, g, b) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const hex = (c) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
  const mix = (c, t, a) => c.map((v, i) => v * (1 - a) + t[i] * a);
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const sat = (c) => { const mx = Math.max(...c), mn = Math.min(...c); return mx === 0 ? 0 : (mx - mn) / mx; };
  const escurece = (c, alvo) => { let x = c.slice(); for (let i = 0; i < 30 && lum(...x) > alvo; i++) x = mix(x, [0, 0, 0], 0.1); return x; };

  function paleta(px) { // px: [r,g,b] dos pixels opacos
    const cont = new Map();
    for (const [r, g, b] of px) { const k = (r >> 4) << 8 | (g >> 4) << 4 | (b >> 4); const e = cont.get(k) || { n: 0, r: 0, g: 0, b: 0 }; e.n++; e.r += r; e.g += g; e.b += b; cont.set(k, e); }
    const cs = [...cont.values()].sort((a, b) => b.n - a.n).slice(0, 14).map((e) => [e.r / e.n, e.g / e.n, e.b / e.n]);
    const vivas = cs.filter((c) => sat(c) > 0.35 && lum(...c) > 0.02 && lum(...c) < 0.6);
    let pri = (vivas[0] || cs[0] || [16, 61, 46]);
    const sec = vivas.slice(1).find((c) => dist(c, pri) > 90) || mix(pri, [0, 0, 0], 0.3);
    const dest = vivas.find((c) => dist(c, pri) > 90 && c !== sec) || vivas.find((c) => dist(c, pri) > 90) || mix(pri, [255, 255, 255], 0.35);
    pri = escurece(pri, 0.3); // texto branco precisa ler sobre a cor primária
    const esc = cs.filter((c) => lum(...c) < 0.1).sort((a, b) => lum(...a) - lum(...b))[0];
    const escura = esc && dist(esc, [0, 0, 0]) > 20 ? esc : mix(pri, [0, 0, 0], 0.6);
    return { cor_primaria: hex(pri), cor_secundaria: hex(sec), cor_escura: hex(escura), cor_destaque: hex(escurece(dest, 0.15)) }; // destaque vira texto sobre branco no menu
  }

  // ---------- logo: tira fundo chapado, recorta, limita o tamanho ----------
  function tratar(img) {
    const esc = Math.min(1, 640 / Math.max(img.naturalWidth, img.naturalHeight)), W = Math.max(1, Math.round(img.naturalWidth * esc)), H = Math.max(1, Math.round(img.naturalHeight * esc));
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0, W, H);
    const im = cx.getImageData(0, 0, W, H), d = im.data, at = (x, y) => (y * W + x) * 4;
    const cantos = [at(0, 0), at(W - 1, 0), at(0, H - 1), at(W - 1, H - 1)];
    const ref = [d[cantos[0]], d[cantos[0] + 1], d[cantos[0] + 2]], dd = (i) => Math.hypot(d[i] - ref[0], d[i + 1] - ref[1], d[i + 2] - ref[2]);
    // só tira fundo claro (branco, creme); fundo azul, preto ou colorido é parte da arte e fica como veio
    if (cantos.every((i) => d[i + 3] > 240 && dd(i) < 40) && (0.299 * ref[0] + 0.587 * ref[1] + 0.114 * ref[2]) / 255 > 0.62) {
      const visto = new Uint8Array(W * H), pilha = [], put = (x, y) => { const k = y * W + x; if (!visto[k] && dd(k * 4) < 60) { visto[k] = 1; pilha.push(k); } };
      for (let x = 0; x < W; x++) { put(x, 0); put(x, H - 1); } for (let y = 0; y < H; y++) { put(0, y); put(W - 1, y); }
      while (pilha.length) { const k = pilha.pop(), x = k % W, y = (k / W) | 0; if (x > 0) put(x - 1, y); if (x < W - 1) put(x + 1, y); if (y > 0) put(x, y - 1); if (y < H - 1) put(x, y + 1); }
      for (let k = 0; k < visto.length; k++) if (visto[k]) d[k * 4 + 3] = 0;
    }
    let x0 = W, y0 = H, x1 = -1, y1 = -1; const px = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = at(x, y); if (d[i + 3] > 12) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } if (d[i + 3] > 200) px.push([d[i], d[i + 1], d[i + 2]]); }
    if (x1 < 0) throw new Error('vazia');
    cx.putImageData(im, 0, 0);
    const m = Math.round(Math.max(W, H) * 0.02), cw = x1 - x0 + 1 + m * 2, ch = y1 - y0 + 1 + m * 2, out = document.createElement('canvas'); out.width = cw; out.height = ch;
    out.getContext('2d').drawImage(cv, x0 - m, y0 - m, cw, ch, 0, 0, cw, ch);
    return { url: out.toDataURL('image/png'), cores: paleta(px) };
  }

  function carregaLogo(file) {
    const aviso = $('#t-logo-erro'); aviso.hidden = true;
    if (!file || !/^image\/(png|jpeg|webp|gif|svg\+xml)/.test(file.type)) { aviso.textContent = 'Envie uma imagem (PNG, JPG ou WebP).'; aviso.hidden = false; return; }
    if (file.size > 8e6) { aviso.textContent = 'A imagem é grande demais (máximo 8 MB).'; aviso.hidden = false; return; }
    const u = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      try {
        const r = tratar(img); if (r.url.length > 690000) throw new Error('grande');
        estado.logo = r.url; estado.cores = r.cores;
        $('#t-prev').src = r.url; $('#t-drop').classList.add('tem');
        $('#t-cores').innerHTML = Object.values(r.cores).map((c) => `<i style="background:${c}" title="${c}"></i>`).join('');
        $('#t-cores-box').hidden = false; $('#t-avanca').disabled = false;
      } catch { aviso.textContent = 'Não consegui ler essa imagem. Tente outra, de preferência PNG.'; aviso.hidden = false; }
      URL.revokeObjectURL(u);
    };
    img.onerror = () => { aviso.textContent = 'Não consegui abrir essa imagem.'; aviso.hidden = false; URL.revokeObjectURL(u); };
    img.src = u;
  }
  $('#t-arquivo').addEventListener('change', (e) => carregaLogo(e.target.files[0]));
  const drop = $('#t-drop');
  ['dragover', 'dragenter'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); if (ev === 'drop') carregaLogo(e.dataTransfer.files[0]); }));
  $('#t-avanca').onclick = () => { mostra('dados'); $('#quick-school').focus(); };
  $('#t-sem-logo').onclick = () => { estado.logo = ''; estado.cores = null; mostra('dados'); $('#quick-school').focus(); };
  $('#t-volta').onclick = () => mostra('logo');

  // ---------- abertura: sempre começa pela logo ----------
  // eslint-disable-next-line no-global-assign
  openDemo = function (nome = '') {
    if (nome) $('#quick-school').value = nome;
    mostra('logo'); $('#t-erro').hidden = true;
    dlg.showModal(); document.body.classList.add('modal-open');
  };

  // ---------- envio, loading e entrada ----------
  const ETAPAS = ['Criando o endereço da escola', 'Aplicando as cores da sua logo', 'Montando o painel de gestão', 'Preparando o seu acesso'];
  function animaEtapas() {
    const ul = $('#t-etapas'); ul.innerHTML = ETAPAS.map((t) => `<li>${t}</li>`).join('');
    const lis = [...ul.children]; let i = 0; lis[0].className = 'agora';
    const id = setInterval(() => { if (i < lis.length - 1) { lis[i].className = 'ok'; i++; lis[i].className = 'agora'; } }, 1800);
    return () => { clearInterval(id); lis.forEach((l) => (l.className = 'ok')); };
  }
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  // espera o endereço existir no DNS público (DNS-over-HTTPS). Não consulta o endereço direto de propósito:
  // uma consulta antes da hora faria o provedor de internet guardar "não existe" e atrasar a entrada.
  async function noAr(origem) {
    const host = new URL(origem).hostname;
    for (let i = 0; i < 40; i++) {
      try { const r = await fetch('https://cloudflare-dns.com/dns-query?name=' + host + '&type=A', { headers: { accept: 'application/dns-json' } }); const j = await r.json(); if (j.Answer && j.Answer.length) { await espera(2500); return true; } } catch { /* tenta de novo */ }
      await espera(1500);
    }
    return false;
  }
  $('#quick-demo').onsubmit = async (e) => {
    e.preventDefault();
    const f = $('#quick-demo'), er = $('#t-erro'); er.hidden = true;
    if (!f.checkValidity()) { f.reportValidity(); return; }
    const escola = $('#quick-school').value.trim();
    $('#t-monta-nome').textContent = escola; mostra('monta'); const fim = animaEtapas(), t0 = Date.now();
    try {
      const r = await fetch('/api/teste', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ escola, nome: $('#t-nome').value.trim(), whatsapp: $('#t-zap').value.trim(), email: $('#t-email').value.trim(), senha: $('#t-senha').value, site: $('#t-site').value, logo: estado.logo, cores: estado.cores }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j.erro || 'Não foi possível criar agora. Tente de novo.');
      const origem = new URL(j.url).origin;
      await Promise.all([noAr(origem), espera(Math.max(0, 7000 - (Date.now() - t0)))]);
      fim(); $('#t-entrar').href = j.url; mostra('pronto');
      setTimeout(() => { location.href = j.url; }, 1600);
    } catch (x) { fim(); mostra('dados'); er.textContent = x.message; er.hidden = false; }
  };
})();
