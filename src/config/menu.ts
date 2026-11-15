import {
    Users, CreditCard, BarChart2, Cake, DollarSign, GraduationCap, FileText, FolderOpen, ScanLine,
    Trophy, Medal, UsersRound, School
} from 'lucide-react';

export interface MenuSubItem { to: string; label: string; badge?: any }
export interface MenuItem {
    path: string;
    label: string;
    icon: any; // componente de ícone do Lucide
    /** Título da seção do menu; aparece uma vez, acima do primeiro item visível da seção. */
    section?: string;
    subItems?: MenuSubItem[];
}

const SEM_FIREBASE = import.meta.env.MODE === 'sem-firebase';

// Menu do painel da escola, organizado em seções. Um item com subItems vira um grupo que abre e fecha;
// o grupo aparece quando pelo menos um dos subitens é permitido para o usuário (ver AdminLayout).
export const ADMIN_MENU_ITEMS: MenuItem[] = [
    {
        path: '/admin/stats', label: 'Visão geral', icon: BarChart2,
        subItems: [
            { to: '/admin/stats', label: 'Estatísticas' },
            { to: '/admin/relatorios', label: 'Relatórios' },
            { to: '/admin/simulador', label: 'Simulador de receita' }
        ]
    },

    // ---- Alunos ----
    {
        path: '/admin/dashboard', label: 'Cadastros', icon: Users, section: 'Alunos',
        subItems: [
            { to: '/admin/dashboard', label: 'Alunos cadastrados' },
            { to: '/admin/cadastros/pendentes', label: 'Pendentes de aprovação' },
            { to: '/admin/cadastros/novo', label: 'Novo cadastro' },
            { to: '/admin/cadastros/desativados', label: 'Alunos desativados' }
        ]
    },
    {
        path: '/admin/turmas', label: 'Turmas', icon: UsersRound, section: 'Alunos',
        subItems: [
            { to: '/admin/turmas', label: 'Lista de turmas' },
            { to: '/admin/turmas/chamadas', label: 'Chamadas' }
        ]
    },
    { path: '/admin/professores', label: 'Professores', icon: GraduationCap, section: 'Alunos' },
    { path: '/admin/aniversariantes', label: 'Aniversariantes', icon: Cake, section: 'Alunos' },
    { path: '/admin/portaria', label: 'Portaria', icon: ScanLine, section: 'Alunos' },

    // ---- Financeiro ----
    {
        path: '/admin/financeiro', label: 'Financeiro', icon: DollarSign, section: 'Financeiro',
        subItems: [
            { to: '/admin/financeiro', label: 'Mensalidades' },
            { to: '/admin/financeiro/relatorio', label: 'Relatório' },
            { to: '/admin/financeiro/gastos', label: 'Gastos' },
            { to: '/admin/plans', label: 'Planos' },
            { to: '/admin/financeiro/bancos', label: 'Bancos e APIs' },
            { to: '/admin/financeiro/cobrancas', label: 'Cobranças' }
        ]
    },
    {
        path: '/admin/contratos', label: 'Contratos', icon: FileText, section: 'Financeiro',
        subItems: [
            { to: '/admin/contratos', label: 'Lista de contratos' },
            { to: '/admin/contratos/modelo', label: 'Modelo de contrato' }
        ]
    },

    // ---- Atividades ----
    {
        path: '/admin/jogos/convocacao', label: 'Jogos', icon: Trophy, section: 'Atividades',
        subItems: [
            { to: '/admin/jogos/convocacao', label: 'Convocações' },
            { to: '/admin/midias', label: 'Mídias dos atletas' }
        ]
    },
    { path: '/admin/eventos', label: 'Eventos', icon: Medal, section: 'Atividades' },
    { path: '/admin/carteirinhas', label: 'Carteirinhas', icon: CreditCard, section: 'Atividades' },
    { path: '/admin/documentos', label: 'Documentos', icon: FolderOpen, section: 'Atividades' },

    // ---- Escola: tudo o que é configuração fica num grupo só ----
    {
        path: '/admin/dados-escola', label: 'Minha escola', icon: School, section: 'Escola',
        subItems: [
            // Dados da escola, servidor de WhatsApp e backup só existem na versão sem Firebase (rotas /sys).
            ...(SEM_FIREBASE ? [{ to: '/admin/dados-escola', label: 'Dados da escola' }] : []),
            { to: '/admin/patrocinadores', label: 'Patrocinadores' },
            ...(SEM_FIREBASE
                ? [{ to: '/admin/whatsapp-servidor', label: 'WhatsApp da escola' }, { to: '/admin/escola-controle', label: 'Inscrições e backup' }]
                : [{ to: '/admin/mensagens-evolution', label: 'Mensagens' }]),
            { to: '/admin/settings', label: 'Configurações' }
        ]
    }
];

