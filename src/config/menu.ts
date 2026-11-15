import {
    Users,
    CreditCard,
    BarChart2,
    Settings,
    Cake,
    DollarSign,
    GraduationCap,
    FileText,
    FolderOpen,
    ScanLine,
    MessageCircle,
    Trophy,
    Medal,
    Handshake,
    Server,
    ShieldCheck
} from 'lucide-react';

export interface MenuItem {
    path: string;
    label: string;
    icon: any; // Lucide icon component
    subItems?: { to: string; label: string; badge?: any }[];
}

export const ADMIN_MENU_ITEMS: MenuItem[] = [
    {
        path: '/admin/stats',
        label: 'Estatísticas',
        icon: BarChart2,
        subItems: [
            { to: '/admin/stats', label: 'Visão Geral' },
            { to: '/admin/relatorios', label: 'Relatórios' },
            { to: '/admin/simulador', label: 'Simulador de Receita' }
        ]
    },
    {
        path: '/admin/dashboard',
        label: 'Cadastros',
        icon: Users,
        subItems: [
            { to: '/admin/dashboard', label: 'Alunos Cadastrados' },
            { to: '/admin/cadastros/pendentes', label: 'Pendentes de Aprovação' }, // Badge logic handled in component
            { to: '/admin/cadastros/novo', label: 'Novo Cadastro' },
            { to: '/admin/cadastros/desativados', label: 'Alunos Desativados' }
        ]
    },
    {
        path: '/admin/aniversariantes',
        label: 'Aniversariantes',
        icon: Cake
    },
    {
        path: '/admin/financeiro',
        label: 'Financeiro',
        icon: DollarSign,
        subItems: [
            { to: '/admin/financeiro', label: 'Geral' },
            { to: '/admin/financeiro/relatorio', label: 'Relatório' },
            { to: '/admin/financeiro/gastos', label: 'Gastos' },
            { to: '/admin/plans', label: 'Planos' },
            { to: '/admin/financeiro/bancos', label: 'Bancos e APIs' },
            { to: '/admin/financeiro/cobrancas', label: 'Cobranças' }
        ]
    },
    {
        path: '/admin/turmas',
        label: 'Turmas',
        icon: Users,
        subItems: [
            { to: '/admin/turmas', label: 'Lista de Turmas' },
            { to: '/admin/turmas/chamadas', label: 'Chamadas' }
        ]
    },
    {
        path: '/admin/professores',
        label: 'Professores',
        icon: GraduationCap
    },
    {
        path: '/admin/jogos/convocacao',
        label: 'Jogos',
        icon: Trophy,
        subItems: [
            { to: '/admin/jogos/convocacao', label: 'Convocações' },
            { to: '/admin/midias', label: 'Mídias dos Atletas' }
        ]
    },
    {
        path: '/admin/eventos',
        label: 'Eventos',
        icon: Medal
    },
    {
        path: '/admin/contratos',
        label: 'Contratos',
        icon: FileText,
        subItems: [
            { to: '/admin/contratos', label: 'Lista de Contratos' },
            { to: '/admin/contratos/modelo', label: 'Modelo de Contrato' }
        ]
    },
    {
        path: '/admin/carteirinhas',
        label: 'Carteirinhas',
        icon: CreditCard
    },
    {
        path: '/admin/documentos',
        label: 'Documentos',
        icon: FolderOpen
    },
    // O servidor de WhatsApp próprio de cada escola só existe na versão sem Firebase (rotas /sys/wa).
    ...(import.meta.env.MODE === 'sem-firebase' ? [{ path: '/admin/whatsapp-servidor', label: 'Servidor WhatsApp', icon: Server }, { path: '/admin/escola-controle', label: 'Inscrições e backup', icon: ShieldCheck }] : []),
    {
        path: '/admin/patrocinadores',
        label: 'Patrocinadores',
        icon: Handshake
    },
    {
        path: '/admin/settings',
        label: 'Configurações',
        icon: Settings
    },
    // A tela de instâncias usa o servidor global do projeto original; na versão sem Firebase vale "Servidor WhatsApp".
    ...(import.meta.env.MODE === 'sem-firebase' ? [] : [{
        path: '/admin/mensagens-evolution',
        label: 'Mensagens',
        icon: MessageCircle
    }]),
    {
        path: '/admin/portaria',
        label: 'Portaria',
        icon: ScanLine
    },


];
