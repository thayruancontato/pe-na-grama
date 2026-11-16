// Catálogo padrão de artes: temas (cores) e modelos (camadas). A Central pode editar tudo isso (aba Criativos);
// o que for salvo lá substitui este catálogo. Os modelos são dados puros (JSON) interpretados por motor.js.
// Cada modelo aparece para a escola combinado com cada um dos seus temas (modelo x tema).

// ---------------- temas ----------------
const T = (id, nome, tokens) => ({ id, nome, tokens });
const TEMAS_CARTEIRINHA = [
    T('escola', 'Escola', { fundo: '#ffffff', forte: '@escura', forte2: '@secundaria', texto: 'sobre($fundo)', suave: 'legivel(mix($texto,$fundo,0.45),$fundo)', acento: 'acento($forte)', marca: 'marca($fundo)', sobreForte: 'sobre($forte)' }),
    T('primaria', 'Primária', { fundo: '#ffffff', forte: '@primaria', forte2: 'mix(@primaria,#000000,0.35)', texto: 'sobre($fundo)', suave: 'legivel(mix($texto,$fundo,0.45),$fundo)', acento: 'acento($forte)', marca: 'marca($fundo)', sobreForte: 'sobre($forte)' }),
    T('destaque', 'Destaque', { fundo: '#ffffff', forte: '@destaque', forte2: 'mix(@destaque,#000000,0.22)', texto: 'sobre($fundo)', suave: 'legivel(mix($texto,$fundo,0.45),$fundo)', acento: 'acento($forte)', marca: 'marca($fundo)', sobreForte: 'sobre($forte)' }),
    T('noite', 'Noite', { fundo: 'mix(@escura,#000000,0.6)', forte: 'mix($fundo,#ffffff,0.1)', forte2: 'mix($fundo,#ffffff,0.2)', texto: 'sobre($fundo)', suave: 'legivel(mix($texto,$fundo,0.45),$fundo)', acento: 'acento($fundo)', marca: 'marca($fundo)', sobreForte: 'sobre($forte)' }),
    T('clara', 'Clara', { fundo: '#f3f6fa', forte: '#ffffff', forte2: '#e8edf4', texto: 'sobre($fundo)', suave: 'legivel(mix($texto,$fundo,0.45),$fundo)', acento: 'marca($fundo)', marca: 'marca($fundo)', sobreForte: 'sobre($forte)' }),
    T('grafite', 'Grafite', { fundo: '#ffffff', forte: '#1f2933', forte2: '#3d4a5c', texto: 'sobre($fundo)', suave: 'legivel(mix($texto,$fundo,0.45),$fundo)', acento: 'acento($forte)', marca: 'marca($fundo)', sobreForte: 'sobre($forte)' }),
    T('ouro', 'Ouro', { fundo: '#14151a', forte: '#000000', forte2: '#2b2618', texto: 'sobre($fundo)', suave: 'legivel(mix($texto,$fundo,0.45),$fundo)', acento: '#d4a72c', marca: '#d4a72c', sobreForte: 'sobre($forte)' })
];
const ANIV = { meio: 'mix($fundo,$fundo2,0.5)', texto: 'sobre($meio)', suave: 'legivel(mix($texto,$meio,0.35),$meio)', acento: 'acento($meio)', marca: 'marca($meio)' };
const TEMAS_ANIVERSARIO = [
    T('escola', 'Escola', { fundo: '@secundaria', fundo2: '@escura', ...ANIV }),
    T('primaria', 'Primária', { fundo: '@primaria', fundo2: 'mix(@primaria,#000000,0.4)', ...ANIV }),
    T('destaque', 'Destaque', { fundo: '@destaque', fundo2: 'mix(@destaque,#000000,0.2)', ...ANIV }),
    T('noite', 'Noite', { fundo: 'mix(@escura,#000000,0.6)', fundo2: '#000000', ...ANIV }),
    T('clara', 'Clara', { fundo: 'mix(@secundaria,#ffffff,0.88)', fundo2: '#ffffff', ...ANIV }),
    T('papel', 'Papel', { fundo: '#f6f1e7', fundo2: '#efe6d4', ...ANIV }),
    T('ouro', 'Ouro', { fundo: '#17181d', fundo2: '#000000', ...ANIV, acento: '#d4a72c', marca: '#d4a72c' })
];

// ---------------- atalhos para montar camadas ----------------
const ret = (nome, x, y, w, h, fill, o = {}) => ({ t: 'ret', nome, x, y, w, h, fill, ...o });
const elipse = (nome, x, y, w, h, fill, o = {}) => ({ t: 'elipse', nome, x, y, w, h, fill, ...o });
const poli = (nome, pts, fill, o = {}) => ({ t: 'poli', nome, pts, fill, ...o });
const texto = (nome, txt, x, y, w, tam, cor, o = {}) => ({ t: 'texto', nome, txt, x, y, w, tam, cor, ...o });
const foto = (nome, x, y, w, h, raio, o = {}) => ({ t: 'foto', nome, x, y, w, h, raio, ...o });
const logo = (nome, x, y, w, h, o = {}) => ({ t: 'logo', nome, x, y, w, h, ...o });
const qr = (nome, x, y, w, o = {}) => ({ t: 'qr', nome, x, y, w, ...o });
const grad = (tipo, ...c) => ({ tipo, c });
const grao = (op = 0.07, q = 9000) => ({ t: 'grao', nome: 'Grão', q, op, cor: '#000000' });

// ---------------- carteirinha (1012 x 638, cartão 85,6 x 54 mm a 300 dpi) ----------------
const ROTULOS = [['Matrícula', '{matricula}'], ['CPF', '{cpf}'], ['Nascimento', '{nascimento}'], ['Modalidade', '{modalidade}']];
/** Quatro dados do aluno (rótulo pequeno e valor), em colunas. */
function dados(x, y, larg, passo, cols, corRot, corVal) {
    const lc = larg / cols, out = [];
    ROTULOS.forEach(([rot, v], i) => {
        const cx = x + (i % cols) * lc, cy = y + Math.floor(i / cols) * passo;
        out.push(texto('Rótulo ' + rot, rot, cx, cy, lc - 16, 23, corRot, { peso: 700, esp: 1.5, caixaAlta: true }));
        out.push(texto('Valor ' + rot, v, cx, cy + 32, lc - 16, 36, corVal, { peso: 800, min: 22 }));
    });
    return out;
}
const fundoCart = () => ret('Fundo', 0, 0, 1012, 638, '$fundo');
const SEG = 'Pessoal e intransferível';

const CART_FRENTE = {
    faixa: () => [
        fundoCart(),
        ret('Faixa', 0, 0, 1012, 196, grad('h', '$forte', '$forte2')),
        { t: 'guilloche', nome: 'Guilloché', x: 0, y: 0, w: 1012, h: 196, cor: '$sobreForte', op: 0.13, linhas: 12 },
        ret('Filete', 0, 196, 1012, 8, '$acento'),
        logo('Logo', 36, 22, 250, 152, { placa: true, raio: 20 }),
        texto('Escola', '{escola}', 322, 58, 654, 42, '$sobreForte', { peso: 800 }),
        texto('Subtítulo', 'Carteirinha do aluno', 322, 116, 654, 24, 'alfa($sobreForte,0.8)', { peso: 600, esp: 2, caixaAlta: true }),
        foto('Foto', 36, 228, 270, 340, 22, { borda: { cor: '$marca', larg: 5 } }),
        texto('Nome', '{nomeCurto}', 338, 236, 640, 46, '$marca', { peso: 900, caixaAlta: true }),
        ...dados(338, 306, 440, 108, 2, '$suave', '$texto'),
        qr('QR Code', 820, 392, 148),
        ret('Rodapé', 0, 594, 1012, 44, '$marca'),
        texto('Aviso', SEG, 36, 606, 940, 20, 'sobre($marca)', { peso: 700, al: 'center', esp: 2, caixaAlta: true })
    ],
    lateral: () => [
        fundoCart(),
        ret('Coluna', 0, 0, 340, 638, grad('v', '$forte', '$forte2')),
        { t: 'meiotom', nome: 'Meio-tom', x: 0, y: 0, w: 340, h: 638, cor: '$sobreForte', op: 0.1, passo: 24, canto: 'se' },
        elipse('Aro da foto', 42, 62, 256, 256, '$acento'),
        foto('Foto', 50, 70, 240, 240, 120),
        logo('Logo', 36, 360, 268, 214, { placa: true, raio: 24 }),
        texto('Escola', '{escola}', 388, 52, 590, 30, '$texto', { peso: 800 }),
        ret('Filete', 388, 98, 100, 6, '$marca'),
        texto('Subtítulo', 'Aluno', 388, 130, 590, 22, '$suave', { peso: 700, esp: 2, caixaAlta: true }),
        texto('Nome', '{nomeCurto}', 388, 160, 590, 54, '$texto', { peso: 900 }),
        ...dados(388, 258, 420, 108, 2, '$suave', '$texto'),
        qr('QR Code', 818, 432, 146),
        texto('Aviso', SEG, 388, 590, 420, 20, '$suave', { peso: 600, esp: 2, caixaAlta: true })
    ],
    arcos: () => [
        ret('Fundo', 0, 0, 1012, 638, grad('d1', '$forte', '$forte2')),
        { t: 'arcos', nome: 'Arcos', x: 1052, y: -40, w: 0, h: 0, r0: 190, passo: 70, n: 5, cor: 'alfa($acento,0.5)', larg: 3 },
        logo('Logo', 36, 24, 232, 140, { placa: true, raio: 22 }),
        texto('Escola', '{escola}', 298, 52, 680, 36, '$sobreForte', { peso: 800 }),
        texto('Subtítulo', 'Atleta', 298, 104, 680, 24, '$acento', { peso: 800, esp: 4, caixaAlta: true }),
        ret('Moldura da foto', 36, 196, 280, 392, '$acento', { raio: 28 }),
        foto('Foto', 44, 204, 264, 376, 22),
        texto('Nome', '{nomeCurto}', 356, 214, 620, 48, '$sobreForte', { peso: 900, caixaAlta: true }),
        ret('Filete', 356, 276, 120, 6, '$acento'),
        ...dados(356, 318, 440, 108, 2, 'alfa($sobreForte,0.72)', '$sobreForte'),
        qr('QR Code', 812, 400, 148),
        texto('Aviso', SEG, 356, 580, 500, 20, 'alfa($sobreForte,0.6)', { peso: 600, esp: 2, caixaAlta: true })
    ],
    diagonal: () => [
        fundoCart(),
        poli('Painel', [[0, 0], [450, 0], [300, 638], [0, 638]], grad('v', '$forte', '$forte2')),
        poli('Faixa 1', [[450, 0], [474, 0], [324, 638], [300, 638]], '$acento'),
        poli('Faixa 2', [[474, 0], [486, 0], [336, 638], [324, 638]], '$marca'),
        logo('Logo', 30, 22, 276, 160, { placa: true, raio: 22 }),
        ret('Moldura da foto', 40, 198, 248, 352, '#ffffff', { raio: 20, sombra: { cor: 'rgba(0,0,0,0.25)', blur: 14, y: 6 } }),
        foto('Foto', 48, 206, 232, 336, 14),
        texto('Temporada', 'Temporada {ano}', 40, 568, 280, 22, '$sobreForte', { peso: 800, esp: 3, caixaAlta: true }),
        texto('Escola', '{escola}', 500, 44, 476, 30, '$texto', { peso: 800, al: 'right' }),
        texto('Nome', '{nomeCurto}', 500, 100, 476, 52, '$marca', { peso: 900, al: 'right', caixaAlta: true }),
        ...dados(510, 236, 460, 104, 2, '$suave', '$texto'),
        qr('QR Code', 824, 448, 138)
    ],
    campo: () => [
        { t: 'listras', nome: 'Gramado', x: 0, y: 0, w: 1012, h: 638, n: 8, dir: 'h', cor1: '$forte', cor2: 'mix($forte,$sobreForte,0.12)' },
        { t: 'campo', nome: 'Linhas do campo', x: 22, y: 22, w: 968, h: 594, cor: 'alfa($sobreForte,0.35)', larg: 5 },
        ret('Painel', 56, 56, 900, 526, '$fundo', { raio: 30 }),
        logo('Logo', 84, 72, 236, 130, { placa: true, raio: 20 }),
        texto('Escola', '{escola}', 340, 92, 590, 32, '$texto', { peso: 800 }),
        texto('Subtítulo', 'Carteirinha do aluno', 340, 136, 590, 22, '$suave', { peso: 700, esp: 2, caixaAlta: true }),
        foto('Foto', 84, 214, 232, 300, 18, { borda: { cor: '$marca', larg: 4 } }),
        texto('Nome', '{nomeCurto}', 348, 222, 580, 44, '$marca', { peso: 900, caixaAlta: true }),
        ...dados(348, 290, 400, 96, 2, '$suave', '$texto'),
        qr('QR Code', 790, 390, 138)
    ],
    limpa: () => [
        fundoCart(),
        ret('Borda', 2, 2, 1008, 634, 'nenhum', { borda: { cor: 'alfa($texto,0.14)', larg: 4 } }),
        ret('Barra', 0, 0, 16, 638, '$marca'),
        logo('Logo', 690, 30, 282, 140, { placa: true, raio: 20 }),
        texto('Escola', '{escola}', 62, 52, 560, 26, '$suave', { peso: 700, esp: 1 }),
        texto('Nome', '{nomeCurto}', 62, 92, 560, 58, '$texto', { peso: 800 }),
        ret('Linha', 62, 196, 888, 3, 'alfa($texto,0.1)'),
        foto('Foto', 62, 226, 232, 306, 16),
        ...dados(330, 248, 450, 104, 2, '$suave', '$texto'),
        qr('QR Code', 790, 402, 148),
        texto('Aviso', SEG, 62, 574, 600, 20, '$suave', { peso: 600, esp: 2, caixaAlta: true })
    ],
    banda: () => [
        fundoCart(),
        ret('Banda', 0, 442, 1012, 196, grad('h', '$forte', '$forte2')),
        { t: 'guilloche', nome: 'Guilloché', x: 0, y: 442, w: 1012, h: 196, cor: '$sobreForte', op: 0.13, linhas: 10 },
        ret('Filete', 0, 434, 1012, 8, '$acento'),
        logo('Logo', 36, 24, 250, 150, { placa: true, raio: 20 }),
        texto('Escola', '{escola}', 322, 52, 654, 34, '$texto', { peso: 800 }),
        texto('Subtítulo', 'Carteirinha do aluno', 322, 104, 654, 22, '$suave', { peso: 700, esp: 2, caixaAlta: true }),
        ret('Moldura da foto', 30, 170, 282, 366, '$fundo', { raio: 28, sombra: { cor: 'rgba(0,0,0,0.25)', blur: 16, y: 6 } }),
        foto('Foto', 40, 180, 262, 346, 20),
        ...dados(344, 190, 560, 124, 2, '$suave', '$texto'),
        texto('Subtítulo do nome', 'Aluno', 344, 462, 460, 22, 'alfa($sobreForte,0.72)', { peso: 700, esp: 3, caixaAlta: true }),
        texto('Nome', '{nomeCurto}', 344, 494, 450, 52, '$sobreForte', { peso: 900, caixaAlta: true }),
        texto('Aviso', SEG, 344, 576, 440, 19, 'alfa($sobreForte,0.65)', { peso: 600, esp: 2, caixaAlta: true }),
        qr('QR Code', 828, 468, 126)
    ]
};
/** Verso, igual para todos os formatos (cores vêm do tema). */
function versoCart() {
    const rot = (r, x, y, w) => texto('Rótulo ' + r, r, x, y, w, 20, 'alfa($sobreForte,0.68)', { peso: 700, esp: 1.5, caixaAlta: true });
    return [
        ret('Fundo', 0, 0, 1012, 638, grad('d1', '$forte', '$forte2')),
        { t: 'guilloche', nome: 'Guilloché', x: 0, y: 0, w: 1012, h: 638, cor: '$sobreForte', op: 0.1, linhas: 18 },
        ret('Filete', 0, 0, 1012, 10, '$acento'),
        logo('Logo', 36, 30, 232, 120, { placa: true, raio: 20 }),
        texto('Escola', '{escola}', 296, 64, 420, 30, '$sobreForte', { peso: 800 }),
        texto('Título', 'Responsável financeiro', 676, 72, 300, 20, 'alfa($sobreForte,0.68)', { peso: 700, al: 'right', esp: 2, caixaAlta: true }),
        texto('Responsável', '{respNome}', 48, 186, 916, 46, '$sobreForte', { peso: 800 }),
        rot('CPF', 48, 262, 400), texto('CPF', '{respCpf}', 48, 292, 400, 30, '$sobreForte', { peso: 700 }),
        rot('Telefone', 520, 262, 400), texto('Telefone', '{respFone}', 520, 292, 440, 30, '$sobreForte', { peso: 700 }),
        rot('E-mail', 48, 356, 400), texto('E-mail', '{respEmail}', 48, 386, 916, 30, '$sobreForte', { peso: 700 }),
        rot('Endereço', 48, 450, 400), texto('Endereço', '{respEndereco}', 48, 480, 916, 28, '$sobreForte', { peso: 700, quebra: { linhas: 2, alt: 1 } }),
        ret('Linha', 48, 566, 916, 2, 'alfa($sobreForte,0.25)'),
        texto('Devolução', 'Se encontrado, devolva na secretaria de {escola}.', 48, 580, 916, 22, 'alfa($sobreForte,0.8)', { peso: 600 })
    ];
}
const cartMod = (id, nome) => ({ id, nome, tipo: 'carteirinha', w: 1012, h: 638, ativo: true, temas: TEMAS_CARTEIRINHA.map((t) => t.id), lados: { frente: CART_FRENTE[id](), verso: versoCart() } });

// ---------------- aniversário (1080 x 1350, post 4:5) ----------------
const W = 1080, H = 1350;
const bgAniv = (tipo = 'd1') => ret('Fundo', 0, 0, W, H, grad(tipo, '$fundo', '$fundo2'));
/** Selo de idade (só aparece quando a idade é conhecida). */
const selo = (x, y, d, rot = 8) => [
    elipse('Selo', x, y, d, d, '$acento', { se: 'idade', rot, borda: { cor: '#ffffff', larg: 8 }, sombra: { cor: 'rgba(0,0,0,0.3)', blur: 22, y: 10 } }),
    texto('Idade', '{idade}', x, y + d * 0.1, d, d * 0.52, 'sobre($acento)', { se: 'idade', rot, pivo: [x + d / 2, y + d / 2], peso: 900, al: 'center', ajusta: false }),
    texto('Anos', 'ANOS', x, y + d * 0.68, d, d * 0.15, 'sobre($acento)', { se: 'idade', rot, pivo: [x + d / 2, y + d / 2], peso: 800, al: 'center', esp: 3, ajusta: false })
];
const rodape = (y = 1200, corTxt = '$texto') => [
    logo('Logo', 60, y, 300, 110, { placa: true, raio: 24 }),
    texto('Escola', '{escola}', 392, y + 36, 628, 30, corTxt, { peso: 700 })
];
const CONFETE = (n = 140, h = H, semente = 7) => ({ t: 'confete', nome: 'Confete', x: 0, y: 0, w: W, h, n, semente, tam: 24, cores: ['$acento', '$texto', '$marca'], op: 0.9 });

const ANIV_MODELOS = {
    festa: () => [
        bgAniv(), { t: 'meiotom', nome: 'Meio-tom', x: 0, y: 0, w: 560, h: 560, cor: '$texto', op: 0.1, passo: 28, canto: 'no' }, { t: 'meiotom', nome: 'Meio-tom 2', x: 520, y: 800, w: 560, h: 550, cor: '$texto', op: 0.1, passo: 28, canto: 'se' },
        CONFETE(),
        texto('Título', 'Parabéns', 60, 84, 960, 170, '$texto', { fam: 'festa', peso: 400, al: 'center' }),
        texto('Nome', '{primeiroNome}', 60, 262, 960, 120, '$acento', { fam: 'festa', peso: 400, al: 'center' }),
        ret('Moldura', 214, 440, 652, 690, '#ffffff', { raio: 44, rot: -3, pivo: [540, 785], sombra: { cor: 'rgba(0,0,0,0.35)', blur: 40, y: 16 } }),
        foto('Foto', 238, 464, 604, 642, 30, { rot: -3, pivo: [540, 785] }),
        ...selo(770, 980, 230), texto('Frase', 'Hoje o dia é todo seu!', 60, 1146, 700, 42, '$texto', { peso: 700, al: 'left', se: 'idade' }),
        ...rodape(1206), grao()
    ],
    campo: () => [
        { t: 'listras', nome: 'Gramado', x: 0, y: 0, w: W, h: H, n: 9, dir: 'v', cor1: '$fundo', cor2: 'mix($fundo,$texto,0.12)' },
        { t: 'campo', nome: 'Linhas do campo', x: 50, y: 50, w: 980, h: 1250, cor: 'alfa($texto,0.45)', larg: 8 },
        texto('Título', 'Feliz aniversário', 80, 110, 920, 110, '$texto', { fam: 'festa', peso: 400, al: 'center' }),
        elipse('Aro', 216, 386, 648, 648, '#ffffff', { sombra: { cor: 'rgba(0,0,0,0.3)', blur: 36, y: 14 } }),
        foto('Foto', 240, 410, 600, 600, 300),
        ret('Faixa do nome', 270, 1000, 540, 132, '$acento', { raio: 66, sombra: { cor: 'rgba(0,0,0,0.25)', blur: 16, y: 8 } }),
        texto('Nome', '{primeiroNome}', 270, 1022, 540, 92, 'sobre($acento)', { peso: 900, al: 'center', caixaAlta: true }),
        ...selo(790, 330, 210), ...rodape(1176), grao()
    ],
    craque: () => [
        bgAniv('d2'),
        poli('Faixa 1', [[1100, 0], [1160, 0], [860, 1350], [800, 1350]], '$marca'), poli('Faixa 2', [[1240, 0], [1264, 0], [964, 1350], [940, 1350]], '$acento'), poli('Faixa 3', [[1340, 0], [1400, 0], [1100, 1350], [1040, 1350]], 'alfa($texto,0.22)'),
        texto('Idade gigante', '{idade}', 20, 300, 1040, 640, '$texto', { se: 'idade', peso: 900, al: 'right', ajusta: false, semPreenchimento: true, contorno: { cor: 'alfa($texto,0.32)', larg: 6 } }),
        texto('Tag', 'Craque do dia', 80, 96, 700, 40, '$acento', { peso: 900, esp: 8, caixaAlta: true }),
        texto('Parabéns', 'Parabéns,', 80, 146, 920, 112, '$texto', { peso: 900 }),
        texto('Nome', '{primeiroNome}!', 80, 264, 920, 132, '$acento', { peso: 900, caixaAlta: true }),
        ret('Moldura', 80, 452, 920, 640, '$acento', { raio: 34, sombra: { cor: 'rgba(0,0,0,0.4)', blur: 30, y: 14 } }),
        foto('Foto', 92, 464, 896, 616, 24, { foco: 0.3 }),
        texto('Frase', 'Que venham muitos gols e conquistas.', 80, 1114, 920, 38, '$texto', { peso: 600 }),
        ...rodape(1190), grao()
    ],
    baloes: () => [
        bgAniv('v'), CONFETE(60, 460, 21),
        { t: 'balao', nome: 'Balão 1', x: 50, y: 210, w: 150, h: 180, fill: '$acento' }, { t: 'balao', nome: 'Balão 2', x: 220, y: 90, w: 120, h: 144, fill: '$marca' }, { t: 'balao', nome: 'Balão 3', x: 880, y: 240, w: 150, h: 180, fill: '$marca' },
        { t: 'balao', nome: 'Balão 4', x: 740, y: 70, w: 116, h: 140, fill: 'mix($acento,$marca,0.5)' }, { t: 'balao', nome: 'Balão 5', x: 50, y: 700, w: 112, h: 134, fill: 'mix($acento,$texto,0.35)' }, { t: 'balao', nome: 'Balão 6', x: 920, y: 700, w: 112, h: 134, fill: '$acento' },
        { t: 'balao', nome: 'Balão da idade', se: 'idade', x: 385, y: 60, w: 310, h: 372, fill: '$acento', txt: '{idade}', tam: 210, cor: 'sobre($acento)' },
        texto('Título 1', 'Feliz', 60, 396, 960, 120, '$texto', { fam: 'festa', peso: 400, al: 'center' }),
        texto('Título 2', 'aniversário!', 60, 490, 960, 120, '$acento', { fam: 'festa', peso: 400, al: 'center' }),
        elipse('Aro', 252, 640, 576, 576, '#ffffff', { sombra: { cor: 'rgba(0,0,0,0.25)', blur: 40, y: 18 } }),
        foto('Foto', 276, 664, 528, 528, 264),
        texto('Nome', '{primeiroNome}', 60, 1214, 960, 96, '$texto', { peso: 900, al: 'center' }), grao(0.05)
    ],
    polaroid: () => [
        bgAniv('d1'), grao(0.12, 12000),
        texto('Título', 'Feliz aniversário', 60, 96, 960, 150, '$texto', { fam: 'mao', peso: 400, al: 'center' }),
        ret('Polaroid', 190, 340, 700, 840, '#ffffff', { rot: -3, pivo: [540, 760], sombra: { cor: 'rgba(0,0,0,0.28)', blur: 44, y: 20 } }),
        foto('Foto', 230, 380, 620, 620, 0, { rot: -3, pivo: [540, 760] }),
        texto('Nome', '{primeiroNome}', 230, 1006, 620, 120, '#2a2a2a', { fam: 'mao', peso: 400, al: 'center', rot: -3, pivo: [540, 760] }),
        ret('Fita', 440, 312, 200, 64, 'alfa($acento,0.85)', { rot: 4, sombra: { cor: 'rgba(0,0,0,0.15)', blur: 6, y: 3 } }),
        ...selo(790, 330, 200, 10),
        texto('Frase', 'com carinho de toda a equipe', 60, 1206, 960, 34, '$suave', { peso: 600, al: 'center' }),
        logo('Logo', 60, 1244, 250, 86, { placa: true, raio: 20 }), texto('Escola', '{escola}', 340, 1268, 680, 28, '$suave', { peso: 700 })
    ],
    limpa: () => [
        ret('Fundo', 0, 0, W, H, '$fundo'),
        foto('Foto', 0, 0, W, 860, 0, { foco: 0.3 }),
        ret('Degradê', 0, 560, W, 302, grad('v', 'alfa($fundo,0)', '$fundo')),
        ret('Selo de idade', 60, 60, 300, 110, '$acento', { se: 'idade', raio: 55, sombra: { cor: 'rgba(0,0,0,0.3)', blur: 20, y: 8 } }),
        texto('Idade', '{idade} anos', 60, 80, 300, 62, 'sobre($acento)', { se: 'idade', peso: 900, al: 'center' }),
        ret('Filete', 80, 900, 120, 10, '$acento'),
        texto('Parabéns', 'Feliz aniversário,', 80, 940, 920, 64, '$suave', { peso: 600 }),
        texto('Nome', '{primeiroNome}!', 80, 1010, 920, 140, '$texto', { peso: 900 }),
        logo('Logo', 640, 1174, 340, 120, { placa: true, raio: 24 }),
        texto('Escola', '{escola}', 80, 1214, 520, 28, '$suave', { peso: 700 })
    ],
    faixas: () => [
        bgAniv('d1'),
        poli('Canto 1', [[0, 250], [0, 330], [330, 0], [250, 0]], '$acento'), poli('Canto 2', [[0, 370], [0, 410], [410, 0], [370, 0]], '$marca'),
        poli('Canto 3', [[1080, 1100], [1080, 1020], [750, 1350], [830, 1350]], '$acento'), poli('Canto 4', [[1080, 980], [1080, 940], [670, 1350], [710, 1350]], '$marca'),
        texto('Título', 'Feliz aniversário', 130, 190, 820, 48, '$acento', { peso: 900, al: 'center', esp: 10, caixaAlta: true }),
        elipse('Aro', 210, 290, 660, 660, '$acento', { sombra: { cor: 'rgba(0,0,0,0.3)', blur: 34, y: 14 } }),
        foto('Foto', 228, 308, 624, 624, 312),
        ...selo(770, 810, 200),
        texto('Nome', '{primeiroNome}', 90, 980, 900, 150, '$texto', { peso: 900, al: 'center', caixaAlta: true }),
        ret('Sublinhado', 470, 1176, 140, 8, '$acento'),
        logo('Logo', 60, 1214, 260, 96, { placa: true, raio: 20 }), texto('Escola', '{escola}', 352, 1240, 340, 26, '$texto', { peso: 700 }), grao()
    ],
    placar: () => [
        bgAniv('v'),
        foto('Foto', 44, 60, 992, 820, 36, { foco: 0.25 }),
        ret('Sombra da foto', 44, 560, 992, 320, grad('v', 'alfa(#000000,0)', 'alfa(#000000,0.55)'), { raio: 36 }),
        ret('Bloco da idade', 44, 820, 260, 300, '$acento', { se: 'idade', raio: 30, sombra: { cor: 'rgba(0,0,0,0.35)', blur: 24, y: 10 } }),
        texto('Idade', '{idade}', 44, 842, 260, 190, 'sobre($acento)', { se: 'idade', peso: 900, al: 'center', ajusta: false }),
        texto('Anos', 'ANOS', 44, 1034, 260, 40, 'sobre($acento)', { se: 'idade', peso: 800, al: 'center', esp: 6 }),
        ret('Painel', 320, 860, 716, 220, 'alfa($fundo2,0.96)', { raio: 30, sombra: { cor: 'rgba(0,0,0,0.35)', blur: 24, y: 10 } }),
        texto('Título', 'Feliz aniversário', 352, 884, 660, 32, '$acento', { peso: 800, esp: 6, caixaAlta: true }),
        texto('Nome', '{primeiroNome}', 352, 928, 660, 118, '$texto', { peso: 900, caixaAlta: true }),
        ...rodape(1170), grao(0.05)
    ],
    gigante: () => [
        bgAniv('d1'), { t: 'meiotom', nome: 'Meio-tom', x: 540, y: 700, w: 540, h: 650, cor: '$texto', op: 0.1, passo: 30, canto: 'se' },
        texto('Nome gigante', '{primeiroNome}', 30, 40, 1020, 380, '$acento', { peso: 900, al: 'center', caixaAlta: true, min: 120 }),
        foto('Foto', 60, 500, 960, 640, 40, { borda: { cor: '$texto', larg: 8 }, sombra: { cor: 'rgba(0,0,0,0.35)', blur: 30, y: 14 } }),
        ret('Faixa', 60, 1090, 580, 84, '$texto', { raio: 42, sombra: { cor: 'rgba(0,0,0,0.3)', blur: 16, y: 6 } }),
        texto('Título', 'Feliz aniversário', 60, 1110, 580, 40, 'sobre($texto)', { peso: 900, al: 'center', esp: 3, caixaAlta: true }),
        ...selo(790, 1020, 230),
        logo('Logo', 60, 1214, 270, 96, { placa: true, raio: 20 }), texto('Escola', '{escola}', 362, 1240, 380, 26, '$texto', { peso: 700 }), grao()
    ]
};
const aniMod = (id, nome) => ({ id, nome, tipo: 'aniversario', w: W, h: H, ativo: true, temas: TEMAS_ANIVERSARIO.map((t) => t.id), camadas: ANIV_MODELOS[id]() });

/** Catálogo completo (cópia nova a cada chamada, para o editor poder alterar sem estragar o padrão). */
export function catalogoPadrao() {
    return {
        versao: 1,
        temas: { carteirinha: TEMAS_CARTEIRINHA.map((t) => ({ ...t, tokens: { ...t.tokens } })), aniversario: TEMAS_ANIVERSARIO.map((t) => ({ ...t, tokens: { ...t.tokens } })) },
        carteirinha: [['faixa', 'Faixa'], ['lateral', 'Lateral'], ['arcos', 'Arcos'], ['diagonal', 'Diagonal'], ['campo', 'Campo'], ['limpa', 'Limpa'], ['banda', 'Banda']].map(([id, n]) => cartMod(id, n)),
        aniversario: [['festa', 'Festa'], ['campo', 'Campo'], ['craque', 'Craque do dia'], ['baloes', 'Balões'], ['polaroid', 'Polaroid'], ['limpa', 'Limpa'], ['faixas', 'Faixas'], ['placar', 'Placar'], ['gigante', 'Gigante']].map(([id, n]) => aniMod(id, n))
    };
}
