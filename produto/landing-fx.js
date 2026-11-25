/* Costura da landing: faz as seções conversarem entre si.
   - trilho de capítulos com progresso e seção atual
   - "costuras": elo entre uma seção e a próxima, cruzando a divisa
   - revelação ao rolar (scroll-driven animations; IntersectionObserver como reserva)
   - troca de telas do tour com View Transitions
   - simulador -> plano recomendado -> card de preço (com destaque)
   - botão flutuante que muda de fala conforme a seção
   Tudo respeita prefers-reduced-motion. */
(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduz = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CAPS = [
    ['.hero', 'Início', 'Comece por aqui'],
    ['#sistema', 'Benefícios', 'O que muda na rotina'],
    ['#produto', 'O sistema', 'Veja o sistema por dentro'],
    ['.automation', 'Cobrança', 'Como a cobrança funciona'],
    ['#sua-marca', 'Sua marca', 'Com a cara da sua escola'],
    ['#calculadora', 'Simulador', 'Quanto fica fora do caixa'],
    ['#planos', 'Planos', 'Escolha o plano'],
    ['#duvidas', 'Dúvidas', 'Tire suas dúvidas'],
    ['#demo', 'Testar', 'Comece o teste grátis'],
  ].map(([sel, nome, ponte]) => ({ el: $(sel), nome, ponte })).filter((c) => c.el);
  CAPS.forEach((c, i) => { c.el.dataset.cap = String(i); if (!c.el.id) c.el.id = 'cap-' + i; c.el.classList.add('cap'); });
  const rolar = (el) => el.scrollIntoView({ behavior: reduz ? 'auto' : 'smooth', block: 'start' });

  /* 1) trilho de capítulos */
  const rail = document.createElement('nav');
  rail.className = 'rail'; rail.setAttribute('aria-label', 'Capítulos da página');
  rail.innerHTML = '<i class="rail-fio"><b></b></i>' + CAPS.map((c, i) => `<button type="button" data-i="${i}" aria-label="${c.nome}"><span>${c.nome}</span></button>`).join('');
  document.body.appendChild(rail);
  rail.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) rolar(CAPS[+b.dataset.i].el); });
  const fio = $('.rail-fio b', rail);
  let atual = -1;
  const marcar = (i) => {
    if (i === atual) return; atual = i;
    $$('button', rail).forEach((b, k) => { b.classList.toggle('on', k === i); b.classList.toggle('feito', k < i); k === i ? b.setAttribute('aria-current', 'true') : b.removeAttribute('aria-current'); });
    document.body.dataset.cap = String(i);
    ctaDaSecao(i);
  };
  const obs = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) marcar(+e.target.dataset.cap); }), { rootMargin: '-45% 0px -50% 0px' });
  CAPS.forEach((c) => obs.observe(c.el));
  const progresso = () => { const m = document.documentElement.scrollHeight - innerHeight; fio.style.height = (m > 0 ? Math.min(100, scrollY / m * 100) : 0) + '%'; };
  addEventListener('scroll', () => requestAnimationFrame(progresso), { passive: true }); progresso();

  /* 2) costuras entre seções */
  CAPS.forEach((c, i) => {
    const prox = CAPS[i + 1]; if (!prox) return;
    const a = document.createElement('a');
    a.className = 'costura'; a.href = '#' + prox.el.id; a.setAttribute('aria-label', 'Próximo: ' + prox.ponte);
    a.innerHTML = `<span>${prox.ponte}</span><i aria-hidden="true">↓</i>`;
    a.addEventListener('click', (e) => { e.preventDefault(); rolar(prox.el); });
    c.el.appendChild(a);
  });

  /* 3) revelação ao rolar */
  const ALVOS = '.hero-copy, .section-top, .benefits article, .brand-art, .brand-section > div:last-child, .logo-grid li, .calculator, .calc-grid > div:first-child, .price, .plans > div:first-child, .faq details, .faq > *, .demo-inner > *, .sys-card, .automation-grid > div:first-child, .tabs, .browser';
  const alvos = $$(ALVOS);
  alvos.forEach((el, i) => { el.classList.add('rv'); el.style.setProperty('--d', (i % 6) * 40 + 'ms'); });
  if (!(CSS.supports && CSS.supports('animation-timeline: view()')) && !reduz) {
    document.documentElement.classList.add('sem-timeline');
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12 });
    alvos.forEach((el) => io.observe(el));
  }

  /* 4) troca de telas do tour com View Transitions */
  ['alunos', 'financeiro', 'turmas', 'chamadas', 'contratos', 'carteirinhas', 'portal', 'professor', 'cobrancas'].forEach((k) => { const im = new Image(); im.src = `assets/lp/sys/${k}.webp?v=2`; });
  const tela = $('#screen'); if (tela) tela.style.viewTransitionName = 'tour-tela';
  if (typeof selectTab === 'function' && document.startViewTransition && !reduz) {
    const base = selectTab;
    // eslint-disable-next-line no-global-assign
    selectTab = function (n) { if (n === activeArea) return base(n); document.startViewTransition(() => base(n)); };
  }

  /* 5) simulador -> plano recomendado -> card de preço */
  const campos = ['students', 'fee', 'late'].map((id) => $('#' + id));
  const res = $('.calc-result');
  let rec = null;
  if (res) { rec = document.createElement('div'); rec.className = 'calc-rec'; rec.hidden = true; res.appendChild(rec); }
  const planos = () => $$('#price-tiers li').map((li) => ({ li, nome: $('b', li).textContent, limite: +(/(\d+)/.exec($('span', li).textContent) || [0, 1e9])[1] || 1e9, preco: $('em', li).textContent, valor: +$('em', li).textContent.replace(/\D/g, '') }));
  const recomenda = () => {
    if (!rec) return;
    const n = +$('#students').value, perda = (n * Math.max(0, +$('#fee').value) * Math.min(100, Math.max(0, +$('#late').value)) / 100), lista = planos();
    if (!lista.length) return;
    const p = lista.find((x) => n <= x.limite) || lista[lista.length - 1];
    const vezes = p.valor ? perda / p.valor : 0;
    rec.hidden = false;
    rec.innerHTML = `<span>PLANO QUE CABE NA SUA ESCOLA</span><b>${p.nome} · ${p.preco}/mês</b><p>${vezes >= 1 ? `O atraso estimado equivale a ${vezes.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mensalidades do plano.` : 'Para uma escola desse tamanho, o plano cabe no orçamento.'}</p><button type="button" class="calc-ver">Ver este plano ↓</button>`;
    rec.dataset.plano = p.nome;
  };
  campos.forEach((c) => c && c.addEventListener('input', recomenda));
  setTimeout(recomenda, 600); setTimeout(recomenda, 2500); // espera /api/planos atualizar os preços
  res && res.addEventListener('click', (e) => {
    if (!e.target.closest('.calc-ver')) return;
    const alvo = $('#planos'); rolar(alvo);
    const p = planos().find((x) => x.nome === rec.dataset.plano);
    $$('#price-tiers li').forEach((li) => li.classList.remove('sugerido'));
    if (p) setTimeout(() => p.li.classList.add('sugerido'), reduz ? 0 : 700);
  });

  /* 6) botão flutuante com fala por seção */
  const cta = $('.floating-cta span');
  const original = cta ? cta.textContent : '';
  const FALAS = { 3: 'Veja o sistema funcionando na sua escola.', 5: 'Descubra o plano ideal para o tamanho da sua escola.', 6: 'Escolha o plano e teste 14 dias grátis.', 7: 'Ficou uma dúvida? Teste sem compromisso.' };
  function ctaDaSecao(i) { if (cta) cta.textContent = FALAS[i] || original; }
})();
