// Controle do dono (modo "dono master"): catálogo de opções por escola, guardado em sys_owner/controle de cada escola.
// Cada opção tem efeito real: o Worker aplica (limites, bloqueios, permissões, estado) e o sistema da escola aplica o que é de tela
// (módulos, cores, avisos, rodapé, botão de WhatsApp), recebendo o resultado em window.__MARCA__.controle.
// Tipos: bool | num (0 = sem limite, quando for limite) | txt | cor | sel.
const M = (k, r, paths, a) => ({ k, g: 'Módulos do painel da escola', r, t: 'bool', d: true, paths, a });
const P = (k, r, paths, a) => ({ k, g: 'Portais de pais e professores', r, t: 'bool', d: true, paths, a });
const B = (g, k, r, d, a) => ({ k, g, r, t: 'bool', d, a });
const N = (g, k, r, d, a) => ({ k, g, r, t: 'num', d, a });
const T = (g, k, r, d, a, pub) => ({ k, g, r, t: 'txt', d, a, pub });
const C = (g, k, r, d, a) => ({ k, g, r, t: 'cor', d, a, pub: true });

// Fontes do Google Fonts liberadas para a assinatura de cada escola (o sistema carrega só a escolhida).
export const FONTES_ASSINATURA = ['Poppins', 'Montserrat', 'Nunito', 'Nunito Sans', 'Fredoka', 'Baloo 2', 'Rubik', 'Barlow', 'Barlow Condensed', 'Oswald', 'Kanit', 'Lexend', 'Quicksand', 'Manrope', 'Sora', 'Outfit', 'Exo 2', 'Archivo', 'Archivo Black', 'Playfair Display', 'DM Serif Display', 'Fraunces', 'Lora', 'Bree Serif', 'Varela Round', 'Lato', 'Inter', 'DM Sans', 'Work Sans', 'Source Sans 3', 'Open Sans', 'Montserrat Alternates'];

export const CATALOGO = [
  // ---- Módulos do painel (desligado = some do menu e a página é bloqueada) ----
  M('m_estatisticas', 'Estatísticas, relatórios e simulador', ['/admin/stats', '/admin/relatorios', '/admin/simulador']),
  M('m_cadastros_novo', 'Cadastro manual de aluno', ['/admin/cadastros/novo']),
  M('m_cadastros_pendentes', 'Fila de pendentes de aprovação', ['/admin/cadastros/pendentes']),
  M('m_cadastros_desativados', 'Lista de alunos desativados', ['/admin/cadastros/desativados']),
  M('m_aniversariantes', 'Aniversariantes', ['/admin/aniversariantes']),
  M('m_financeiro', 'Financeiro (visão geral)', ['/admin/financeiro']),
  M('m_relatorio_fin', 'Relatório financeiro', ['/admin/financeiro/relatorio']),
  M('m_gastos', 'Gastos da escola', ['/admin/financeiro/gastos']),
  M('m_bancos', 'Bancos e APIs de pagamento', ['/admin/financeiro/bancos']),
  M('m_cobrancas', 'Cobranças', ['/admin/financeiro/cobrancas', '/admin/mensagens/cobrancas']),
  M('m_planos', 'Planos', ['/admin/plans']),
  M('m_turmas', 'Turmas', ['/admin/turmas']),
  M('m_chamadas', 'Histórico de chamadas', ['/admin/turmas/chamadas']),
  M('m_migracao', 'Migração e alocação automática de turmas', ['/admin/turmas/migration', '/admin/turmas/auto-allocation']),
  M('m_professores', 'Professores', ['/admin/professores']),
  M('m_funcionarios', 'Funcionários', ['/admin/funcionarios']),
  M('m_jogos', 'Jogos e convocações', ['/admin/jogos']),
  M('m_midias', 'Mídias dos atletas', ['/admin/midias']),
  M('m_eventos', 'Eventos, inscrições e súmula', ['/admin/eventos', '/eventos']),
  M('m_contratos', 'Contratos', ['/admin/contratos', '/admin/contract']),
  M('m_carteirinhas', 'Carteirinhas', ['/admin/carteirinhas']),
  M('m_documentos', 'Documentos', ['/admin/documentos']),
  M('m_mensagens', 'Disparos e histórico de mensagens', ['/admin/mensagens']),
  M('m_whatsapp', 'WhatsApp e servidor WhatsApp', ['/admin/whatsapp']),
  M('m_patrocinadores', 'Patrocinadores', ['/admin/patrocinadores']),
  M('m_portaria', 'Portaria', ['/admin/portaria']),
  M('m_alugueis', 'Aluguel de espaços', ['/admin/alugueis']),
  M('m_exportacao', 'Exportação de dados', ['/admin/export']),
  M('m_links', 'Links úteis', ['/admin/links']),
  M('m_dados_escola', 'Página "Dados da escola"', ['/admin/dados-escola']),
  M('m_backup_escola', 'Página "Inscrições e backup"', ['/admin/escola-controle']),
  M('m_configuracoes', 'Configurações do sistema', ['/admin/settings']),

  // ---- Portais ----
  P('p_portal_pais', 'Portal do responsável (tudo)', ['/aluno/dashboard', '/aluno/perfil', '/aluno/carteirinha', '/aluno/financeiro', '/aluno/frequencia', '/aluno/horarios', '/aluno/loja', '/aluno/autorizacoes', '/aluno/whatsapp', '/aluno/configuracoes', '/aluno/radio', '/aluno/acessos', '/aluno/reservas']),
  P('p_financeiro', 'Pagamentos no portal do responsável', ['/aluno/financeiro']),
  P('p_frequencia', 'Frequência no portal do responsável', ['/aluno/frequencia']),
  P('p_horarios', 'Horários no portal do responsável', ['/aluno/horarios']),
  P('p_carteirinha', 'Carteirinha no portal do responsável', ['/aluno/carteirinha']),
  P('p_loja', 'Loja do clube', ['/aluno/loja']),
  P('p_autorizacoes', 'Autorizações de convocação', ['/aluno/autorizacoes']),
  P('p_whatsapp', 'Fale conosco (WhatsApp)', ['/aluno/whatsapp']),
  P('p_perfil', 'Meus dados (responsável)', ['/aluno/perfil']),
  P('p_configuracoes', 'Configurações do responsável', ['/aluno/configuracoes']),
  P('p_radio', 'Rádio', ['/aluno/radio']),
  P('p_acessos', 'Histórico de acessos do aluno', ['/aluno/acessos']),
  P('p_reservas', 'Reservas de espaços pelo responsável', ['/aluno/reservas']),
  P('p_professor', 'Portal do professor (tudo)', ['/professor']),
  P('p_professor_reservas', 'Reservas no portal do professor', ['/professor/reservas']),
  P('p_professor_convocacao', 'Convocação no portal do professor', ['/professor/convocacao']),

  // ---- Estado da escola ----
  B('Estado da escola', 'suspensa', 'Escola suspensa (tira o sistema do ar)', false, 'O endereço mostra a mensagem de suspensão e nenhuma rota responde.'),
  T('Estado da escola', 'suspensa_msg', 'Mensagem de suspensão', 'Este sistema está temporariamente indisponível. Fale com a secretaria.', '', true),
  B('Estado da escola', 'manutencao', 'Modo manutenção (só administradores usam)', false),
  T('Estado da escola', 'manutencao_msg', 'Mensagem de manutenção', 'Sistema em manutenção. Volte em instantes.', '', true),
  B('Estado da escola', 'somente_leitura', 'Somente leitura (ninguém grava nada)', false),
  B('Estado da escola', 'bloq_inscricoes', 'Bloquear inscrições pelo formulário público', false),
  B('Estado da escola', 'bloq_login_pais', 'Bloquear login dos responsáveis', false),
  B('Estado da escola', 'bloq_login_professor', 'Bloquear login dos professores', false),
  B('Estado da escola', 'bloq_login_admin', 'Bloquear login dos administradores da escola', false),
  B('Estado da escola', 'bloq_wa', 'Bloquear envio de WhatsApp pela escola', false),
  B('Estado da escola', 'bloq_exportar', 'Bloquear exportação de dados pela escola', false),

  // ---- Avisos na tela ----
  B('Avisos na tela', 'banner_ativo', 'Faixa de aviso no topo de todas as telas', false),
  T('Avisos na tela', 'banner_texto', 'Texto da faixa de aviso', '', '', true),
  C('Avisos na tela', 'banner_cor', 'Cor da faixa de aviso', '#b45309'),
  T('Avisos na tela', 'banner_link', 'Link da faixa de aviso (opcional)', '', 'https://...', true),
  T('Avisos na tela', 'aviso_login', 'Mensagem na tela de login', '', '', true),
  T('Avisos na tela', 'aviso_admin', 'Mensagem no painel da escola (início)', '', '', true),
  T('Avisos na tela', 'aviso_pais', 'Mensagem no início do portal do responsável', '', '', true),
  T('Avisos na tela', 'aviso_professor', 'Mensagem no início do portal do professor', '', '', true),
  T('Avisos na tela', 'aviso_financeiro', 'Mensagem na tela de pagamentos do responsável', '', '', true),

  // ---- Marca e aparência ----
  C('Marca e aparência', 'cor_primaria', 'Cor primária (verde do sistema)', '#00a63a'),
  C('Marca e aparência', 'cor_secundaria', 'Cor secundária (azul do sistema)', '#17428f'),
  C('Marca e aparência', 'cor_escura', 'Cor escura (azul-marinho)', '#09245c'),
  C('Marca e aparência', 'cor_destaque', 'Cor de destaque (dourado)', '#f4c20d'),
  T('Marca e aparência', 'titulo_aba', 'Título da aba do navegador', '', 'Vazio = nome da escola', true),
  { k: 'fonte_titulo', g: 'Marca e aparência', r: 'Letra dos títulos (assinatura da escola)', t: 'sel', d: 'padrao', o: [['padrao', 'Padrão do sistema'], ...FONTES_ASSINATURA.map((f) => [f, f])], pub: true },
  { k: 'fonte_texto', g: 'Marca e aparência', r: 'Letra dos textos (assinatura da escola)', t: 'sel', d: 'padrao', o: [['padrao', 'Padrão do sistema'], ...FONTES_ASSINATURA.map((f) => [f, f])], pub: true },
  { k: 'fonte', g: 'Marca e aparência', r: 'Tipo de letra', t: 'sel', d: 'padrao', o: [['padrao', 'Padrão'], ['sans', 'Sem serifa (Arial)'], ['serif', 'Com serifa (Georgia)'], ['mono', 'Máquina de escrever']], pub: true },
  T('Marca e aparência', 'rodape_texto', 'Texto de rodapé em todas as telas', '', '', true),
  T('Marca e aparência', 'rodape_link', 'Link do rodapé (opcional)', '', 'https://...', true),
  B('Marca e aparência', 'wa_flutuante', 'Botão flutuante de WhatsApp', false),
  T('Marca e aparência', 'wa_numero', 'Número do botão de WhatsApp (com DDD)', '', '5531999999999', true),
  T('Marca e aparência', 'wa_texto', 'Texto do botão de WhatsApp', 'Fale com a secretaria', '', true),
  T('Marca e aparência', 'wa_mensagem', 'Mensagem inicial do WhatsApp', 'Olá! Preciso de ajuda.', '', true),
  B('Marca e aparência', 'cantos_retos', 'Cantos retos nos botões e cartões', false),
  B('Marca e aparência', 'ocultar_whatsapp_pais', 'Esconder os botões de WhatsApp do portal do responsável', false),
  T('Marca e aparência', 'instagram_url', 'Link do Instagram da escola (aparece no menu do responsável)', '', 'https://instagram.com/...', true),
  B('Marca e aparência', 'ocultar_instalar_app', 'Esconder o convite para instalar o aplicativo', false),
  B('Marca e aparência', 'sem_animacoes', 'Desligar animações do sistema', false),
  B('Marca e aparência', 'letra_grande', 'Aumentar o tamanho das letras', false),

  // ---- Limites do plano (0 = sem limite) ----
  N('Limites do plano', 'lim_matriculas', 'Máximo de matrículas', 0),
  N('Limites do plano', 'lim_usuarios', 'Máximo de usuários (logins)', 0),
  N('Limites do plano', 'lim_admins', 'Máximo de administradores', 0),
  N('Limites do plano', 'lim_turmas', 'Máximo de turmas', 0),
  N('Limites do plano', 'lim_planos', 'Máximo de planos de mensalidade', 0),
  N('Limites do plano', 'lim_professores', 'Máximo de professores', 0),
  N('Limites do plano', 'lim_funcionarios', 'Máximo de funcionários', 0),
  N('Limites do plano', 'lim_patrocinadores', 'Máximo de patrocinadores', 0),
  N('Limites do plano', 'lim_alunos_inscricao', 'Alunos por inscrição (padrão 8)', 8, 'Vale para o formulário público.'),
  N('Limites do plano', 'lim_armazenamento_mb', 'Armazenamento de dados (MB)', 0),
  N('Limites do plano', 'lim_doc_kb', 'Tamanho máximo de um registro (KB)', 900),
  N('Limites do plano', 'lim_wa_dia', 'Mensagens de WhatsApp por dia', 0),
  N('Limites do plano', 'lim_inscricoes_ip', 'Inscrições por endereço, por hora', 6),
  N('Limites do plano', 'lim_chamadas_dia', 'Chamadas por turma, por dia (0 = sem limite)', 0),

  // ---- Segurança e senhas ----
  N('Segurança e senhas', 'lim_login_tentativas', 'Tentativas de login por e-mail antes de bloquear', 8),
  N('Segurança e senhas', 'lim_login_ip', 'Tentativas de login por endereço antes de bloquear', 30),
  N('Segurança e senhas', 'lim_login_janela_min', 'Minutos de bloqueio após excesso de tentativas', 15),
  N('Segurança e senhas', 'lim_sessao_horas', 'Duração da sessão (horas)', 12),
  N('Segurança e senhas', 'senha_minima', 'Tamanho mínimo da senha', 6),
  B('Segurança e senhas', 'senha_forte', 'Exigir letras e números nas senhas novas', false),
  B('Segurança e senhas', 'cpf_senha', 'Permitir CPF como senha no primeiro acesso', true),
  B('Segurança e senhas', 'primeiro_acesso_pais', 'Permitir primeiro acesso do responsável (e-mail + CPF)', true),
  B('Segurança e senhas', 'primeiro_acesso_prof', 'Permitir primeiro acesso do professor (cadastro + senha/CPF)', true),
  T('Segurança e senhas', 'admin_ips', 'Endereços (IP) autorizados a entrar como administrador', '', 'Vários, separados por vírgula. Vazio = qualquer um.'),
  B('Segurança e senhas', 'log_logins', 'Registrar cada login no registro de ações', false),
  N('Segurança e senhas', 'auditoria_dias', 'Guardar o registro de ações por (dias, 0 = sempre)', 0),

  // ---- O que o administrador da escola pode fazer ----
  B('Permissões do administrador da escola', 'adm_criar_usuarios', 'Criar usuários', true),
  B('Permissões do administrador da escola', 'adm_redefinir_senhas', 'Redefinir senhas de outros usuários', true),
  B('Permissões do administrador da escola', 'adm_exportar', 'Baixar o backup dos dados', true),
  B('Permissões do administrador da escola', 'adm_importar', 'Importar alunos por planilha', true),
  B('Permissões do administrador da escola', 'adm_dados_escola', 'Editar "Dados da escola" (CNPJ, assinatura...)', true),
  B('Permissões do administrador da escola', 'adm_whatsapp_config', 'Configurar o servidor de WhatsApp', true),
  B('Permissões do administrador da escola', 'adm_apagar_matriculas', 'Apagar matrículas', true),
  B('Permissões do administrador da escola', 'adm_apagar_turmas', 'Apagar turmas', true),
  B('Permissões do administrador da escola', 'adm_ver_auditoria', 'Ver o registro de ações', true),
  B('Permissões do administrador da escola', 'adm_financeiro_gravar', 'Alterar pagamentos e cobranças', true),
  B('Permissões do administrador da escola', 'adm_planos_gravar', 'Alterar planos de mensalidade', true),
  B('Permissões do administrador da escola', 'adm_contrato_gravar', 'Alterar modelo de contrato e dados de contrato', true),
  B('Permissões do administrador da escola', 'adm_inscricoes_config', 'Abrir ou fechar as inscrições', true),
  B('Permissões do administrador da escola', 'adm_patrocinadores_gravar', 'Alterar patrocinadores', true),
  B('Permissões do administrador da escola', 'adm_professores_gravar', 'Cadastrar e alterar professores', true),
];

// Dados só da Central (não mudam o sistema da escola): ficha comercial e acompanhamento.
export const INTERNO = [
  ['tag', 'Etiqueta / segmento (ex.: futebol, natação)'], ['vendedor', 'Quem vendeu / responsável comercial'], ['origem', 'Como a escola chegou'],
  ['renovacao', 'Data de renovação do contrato (AAAA-MM-DD)'], ['desconto_pct', 'Desconto combinado (%)'], ['contato_financeiro', 'Contato do financeiro (e-mail ou telefone)'],
  ['contato_tecnico', 'Contato técnico da escola'], ['proxima_acao', 'Próxima ação com a escola'], ['proxima_data', 'Data da próxima ação (AAAA-MM-DD)'],
  ['alunos_previstos', 'Quantidade de alunos prevista'], ['cobranca_obs', 'Observações de cobrança'], ['treinamento', 'Treinamento feito (sim/não, data)'],
  ['nps', 'Nota de satisfação (0 a 10)'], ['risco', 'Risco de cancelamento (baixo, médio, alto)'],
];

export const PADROES = Object.fromEntries(CATALOGO.map((o) => [o.k, o.d]));
const CHAVES = new Set(CATALOGO.map((o) => o.k));
const SELS = Object.fromEntries(CATALOGO.filter((o) => o.t === 'sel').map((o) => [o.k, o.o.map((x) => x[0])]));

/** Valida e limpa o que o dono mandou (qualquer chave fora do catálogo é descartada). */
export function limparControle(entrada) {
  const r = {};
  for (const [k, v] of Object.entries(entrada || {})) {
    if (!CHAVES.has(k)) continue;
    const o = CATALOGO.find((x) => x.k === k);
    if (o.t === 'bool') r[k] = v === true || v === 'true';
    else if (o.t === 'num') r[k] = Math.max(0, Math.min(1e7, Math.floor(Number(v) || 0)));
    else if (o.t === 'cor') { if (/^#[0-9a-fA-F]{6}$/.test(String(v))) r[k] = String(v).toLowerCase(); }
    else if (o.t === 'sel') { if (SELS[k].includes(String(v))) r[k] = String(v); }
    else r[k] = String(v == null ? '' : v).slice(0, 400);
  }
  return r;
}
export function limparInterno(entrada) {
  const r = {};
  for (const [k] of INTERNO) if (entrada && entrada[k] != null) r[k] = String(entrada[k]).slice(0, 300);
  return r;
}

const cache = new Map();
/** Valores efetivos (padrão + o que o dono definiu). Cache curto: uma escola com muito movimento não paga uma consulta por gravação. */
export async function controleDe(env, tenant) {
  const c = cache.get(tenant);
  if (c && Date.now() - c.t < 3000) return c.v;
  const x = await env.DB.prepare("SELECT data FROM sys_docs WHERE tenant=? AND col='sys_owner' AND id='controle'").bind(tenant).first();
  const lim = await env.DB.prepare("SELECT data FROM sys_docs WHERE tenant=? AND col='sys_owner' AND id='limites'").bind(tenant).first();
  const v = { ...PADROES, ...limparControle(x ? JSON.parse(x.data).valores : {}) };
  if (!v.lim_matriculas && lim) v.lim_matriculas = JSON.parse(lim.data).maxMatriculas || 0; // limite antigo definido na Central
  cache.set(tenant, { t: Date.now(), v });
  return v;
}
export const esquecerControle = (tenant) => cache.delete(tenant);

/** O que o sistema da escola recebe: opções de tela e a lista de caminhos bloqueados por módulos desligados. */
export function controlePublico(v) {
  const valores = {};
  for (const o of CATALOGO) if (o.pub || o.g === 'Marca e aparência' || o.g === 'Avisos na tela') valores[o.k] = v[o.k];
  for (const k of ['bloq_login_pais', 'bloq_login_professor', 'cantos_retos', 'sem_animacoes', 'letra_grande']) valores[k] = v[k];
  const bloqueados = CATALOGO.filter((o) => o.paths && v[o.k] === false).flatMap((o) => o.paths);
  return { valores, bloqueados };
}

// Coleção → opção de limite (criação de documento novo) e opção de permissão (alterar/apagar).
export const LIMITE_COLECAO = { turmas: 'lim_turmas', rumo_ao_esporte_2026_plans: 'lim_planos', teachers: 'lim_professores', employees: 'lim_funcionarios', patrocinadores: 'lim_patrocinadores' };
export const PERMISSAO_COLECAO = [
  [/^financial_payments$/, 'adm_financeiro_gravar', 'alterar pagamentos'], [/^rumo_ao_esporte_2026_plans$/, 'adm_planos_gravar', 'alterar planos'],
  [/^patrocinadores$/, 'adm_patrocinadores_gravar', 'alterar patrocinadores'], [/^teachers$/, 'adm_professores_gravar', 'alterar professores'],
];
