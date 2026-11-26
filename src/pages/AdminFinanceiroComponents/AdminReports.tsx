import { useState, useMemo, useEffect } from 'react';
import { FileText, ChevronDown, ChevronUp, Download, Search, Settings, X, Check, Columns } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { tenantProfile } from '../../config/tenantProfile';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getBase64ImageFromURL } from '../AdminDashboard/utils/pdfUtils';
import '../../styles/relatorios.css';

interface AdminReportsProps {
    registrations: any[];
    plans: any[];
    turmas?: any[];
}

interface ReportCategory {
    id: string;
    label: string;
    color: string;
}

interface ReportGroup {
    title: string;
    color: string;
    categories: ReportCategory[];
}

interface ColumnOption {
    id: string;
    label: string;
    getValue: (reg: any, plans: any[], turmas?: any[]) => string;
}

const ALL_COLUMNS: ColumnOption[] = [
    { id: 'aluno', label: 'Aluno', getValue: (reg) => reg.alunos?.[0]?.nome || 'N/A' },
    { id: 'modalidade', label: 'Modalidade', getValue: (reg) => (reg.modalidade || '').toUpperCase() },
    { id: 'plano', label: 'Plano', getValue: (reg, plans) => plans.find(p => p.id === reg.planId)?.nome || 'Sem plano' },
    {
        id: 'valor', label: 'Valor', getValue: (reg, plans) => {
            const plan = plans.find(p => p.id === reg.planId);
            if (!plan) return '—';
            const val = (plan.valores?.mensalidade?.ateVencimento || plan.associado?.mensalidade?.ateVencimento || plan.naoAssociado?.mensalidade?.ateVencimento || plan.valor || 0) / 100;
            return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        }
    },
    { id: 'status', label: 'Status', getValue: (reg) => reg.contractStatus === 'aprovado' ? 'APROVADO' : reg.contractStatus === 'desativado' ? 'DESATIVADO' : 'PENDENTE' },
    { id: 'telefone', label: 'Telefone', getValue: (reg) => reg.responsavel?.telefonePrincipal || reg.responsavel?.celular || '' },
    { id: 'responsavel', label: 'Responsável', getValue: (reg) => reg.responsavel?.nome || '' },
    { id: 'dataNascimento', label: 'Data Nascimento', getValue: (reg) => reg.alunos?.[0]?.dataNascimento || '' },
    {
        id: 'turma', label: 'Turma', getValue: (reg, _plans, turmas) => {
            const turmaId = reg.alunos?.[0]?.turmaId;
            if (!turmaId || !turmas) return '';
            const turma = turmas.find((t: any) => t.id === turmaId);
            return turma ? `${turma.nome}${turma.horario ? ' (' + turma.horario + ')' : ''}` : '';
        }
    }
];

const DEFAULT_COLUMNS = ['aluno', 'plano', 'status', 'telefone'];

// Mapa de modalidades → grupos de relatórios
const allReportGroups: ReportGroup[] = [
    {
        title: 'FUTEBOL', color: '#00a63a',
        categories: [
            { id: 'futebol_geral', label: 'Todos os Alunos', color: '#00a63a' },
            { id: 'futebol_bolsista_50', label: 'Bolsistas 50%', color: '#8b5cf6' },
            { id: 'futebol_bolsista_integral', label: 'Bolsistas Integral', color: '#6d28d9' }
        ]
    },
    {
        title: 'NATAÇÃO', color: '#0891b2',
        categories: [
            { id: 'natacao_geral', label: 'Todos os Alunos', color: '#0891b2' },
            { id: 'natacao_bolsista_50', label: 'Bolsistas 50%', color: '#8b5cf6' },
            { id: 'natacao_bolsista_integral', label: 'Bolsistas Integral', color: '#6d28d9' }
        ]
    },
    {
        title: 'HIDROGINÁSTICA', color: '#14b8a6',
        categories: [
            { id: 'hidro_geral', label: 'Todos os Alunos', color: '#14b8a6' }
        ]
    },
    {
        title: 'VOLEIBOL', color: '#d97706',
        categories: [
            { id: 'voleibol_geral', label: 'Todos os Alunos', color: '#d97706' }
        ]
    },
    {
        title: 'COMPETIÇÃO', color: '#7c3aed',
        categories: [
            { id: 'alunos_competicao', label: 'Alunos Competição', color: '#7c3aed' }
        ]
    },
    {
        title: 'VISÃO GERAL', color: '#1e293b',
        categories: [
            { id: 'todos_bolsistas', label: 'Todos Bolsistas', color: '#8b5cf6' },
            { id: 'todos_aprovados', label: 'Todos Aprovados', color: '#059669' },
            { id: 'todos_pendentes', label: 'Todos Pendentes', color: '#f59e0b' },
            { id: 'todos_desativados', label: 'Todos Desativados', color: '#94a3b8' }
        ]
    }
];

// Filtra grupos de relatórios com base nas modalidades do tenant
const tenantModalities = tenantProfile.modalities.map(m => m.toUpperCase());
const reportGroups: ReportGroup[] = allReportGroups.filter(group => group.title === 'FUTEBOL' && tenantModalities.includes('FUTEBOL'));

const CONFIG_DOC_ID = 'report_category_configs';

export default function AdminReports({ registrations, plans, turmas = [] }: AdminReportsProps) {
    const [recolhidos, setRecolhidos] = useState<string[]>([]);
    const [busca, setBusca] = useState('');
    const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<'all' | 'aprovado' | 'pendente' | 'desativado'>('all');

    // Plan config per category
    const [categoryConfigs, setCategoryConfigs] = useState<Record<string, string[]>>({});
    const [configModal, setConfigModal] = useState<{ categoryId: string; selectedPlanIds: string[] } | null>(null);
    const [savingConfig, setSavingConfig] = useState(false);

    // Column config
    const [selectedColumns, setSelectedColumns] = useState<string[]>(DEFAULT_COLUMNS);
    const [columnsModal, setColumnsModal] = useState(false);
    const [tempColumns, setTempColumns] = useState<string[]>(DEFAULT_COLUMNS);

    // Load configs from Firebase
    useEffect(() => {
        const loadConfigs = async () => {
            try {
                const docRef = doc(db, 'rumo_ao_esporte_2026_settings', CONFIG_DOC_ID);
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    const data = snap.data();
                    setCategoryConfigs(data.configs || {});
                    if (data.columns?.length) setSelectedColumns(data.columns);
                }
            } catch (err) {
                console.error('Error loading report configs:', err);
            }
        };
        loadConfigs();
    }, []);

    const saveConfig = async (categoryId: string, planIds: string[]) => {
        setSavingConfig(true);
        try {
            const newConfigs = { ...categoryConfigs, [categoryId]: planIds };
            setCategoryConfigs(newConfigs);
            const docRef = doc(db, 'rumo_ao_esporte_2026_settings', CONFIG_DOC_ID);
            await setDoc(docRef, { configs: newConfigs }, { merge: true });
            setConfigModal(null);
        } catch (err) {
            console.error('Error saving report config:', err);
        } finally {
            setSavingConfig(false);
        }
    };

    const saveColumns = async (cols: string[]) => {
        setSelectedColumns(cols);
        setColumnsModal(false);
        try {
            const docRef = doc(db, 'rumo_ao_esporte_2026_settings', CONFIG_DOC_ID);
            await setDoc(docRef, { columns: cols }, { merge: true });
        } catch (err) {
            console.error('Error saving columns:', err);
        }
    };

    const filteredRegs = useMemo(() => {
        if (statusFilter === 'all') return registrations.filter(r => r.contractStatus !== 'desativado' && r.status !== 'desativado');
        if (statusFilter === 'aprovado') return registrations.filter(r => r.contractStatus === 'aprovado');
        if (statusFilter === 'pendente') return registrations.filter(r => r.contractStatus !== 'aprovado' && r.contractStatus !== 'desativado' && r.status !== 'desativado');
        if (statusFilter === 'desativado') return registrations.filter(r => r.contractStatus === 'desativado');
        return registrations;
    }, [registrations, statusFilter]);

    const getCategoryData = (categoryId: string) => {
        const configuredPlanIds = categoryConfigs[categoryId];
        if (configuredPlanIds && configuredPlanIds.length > 0) {
            return filteredRegs.filter(reg => configuredPlanIds.includes(reg.planId));
        }
        return [];
    };

    const contagem = useMemo(() => ({
        all: registrations.filter(r => r.contractStatus !== 'desativado' && r.status !== 'desativado').length,
        aprovado: registrations.filter(r => r.contractStatus === 'aprovado').length,
        pendente: registrations.filter(r => r.contractStatus !== 'aprovado' && r.contractStatus !== 'desativado' && r.status !== 'desativado').length,
        desativado: registrations.filter(r => r.contractStatus === 'desativado').length,
    }), [registrations]);
    const todasCategorias = reportGroups.flatMap(g => g.categories);
    const nConfig = todasCategorias.filter(c => (categoryConfigs[c.id]?.length || 0) > 0).length;
    const getStudentCount = (regs: any[]) => regs.reduce((acc, r) => acc + (r.alunos?.length || 0), 0);

    const activeColumns = ALL_COLUMNS.filter(c => selectedColumns.includes(c.id));


    const exportCategoryPDF = async (category: ReportCategory, data: any[]) => {
        const pdfDoc = new jsPDF();
        pdfDoc.setFontSize(16);
        pdfDoc.setFont('helvetica', 'bold');
        pdfDoc.text(`Relatório: ${category.label}`, 14, 20);
        pdfDoc.setFontSize(10);
        pdfDoc.setFont('helvetica', 'normal');
        pdfDoc.text(`Total: ${data.length} cadastros | ${getStudentCount(data)} alunos`, 14, 28);
        pdfDoc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, 34);

        // Fetch photos as base64 in batches
        const photoDataMap: Record<number, string | null> = {};
        const batchSize = 5;
        for (let i = 0; i < data.length; i += batchSize) {
            const batch = data.slice(i, i + batchSize);
            await Promise.all(batch.map(async (reg, batchIdx) => {
                const globalIdx = i + batchIdx;
                const fotoUrl = reg.alunos?.[0]?.fotoUrl;
                if (fotoUrl) {
                    try {
                        const fetchImg = getBase64ImageFromURL(fotoUrl);
                        photoDataMap[globalIdx] = await Promise.race([
                            fetchImg,
                            new Promise<string>((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000))
                        ]) as string;
                    } catch (e) {
                        console.warn(`Erro ao carregar foto do aluno no relatório: ${reg.alunos?.[0]?.nome}`, e);
                        photoDataMap[globalIdx] = null;
                    }
                }
            }));
        }

        const pdfColumns = activeColumns.filter(c => c.id !== 'foto');
        const allHeaders = ['Foto', ...pdfColumns.map(c => c.label)];
        const body = data.map(reg => ['', ...pdfColumns.map(c => c.getValue(reg, plans, turmas))]);

        autoTable(pdfDoc, {
            startY: 40,
            head: [allHeaders],
            body: body,
            styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak', valign: 'middle' },
            headStyles: { fillColor: [0, 125, 47], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
            columnStyles: { 0: { cellWidth: 15, minCellHeight: 16 } },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            tableWidth: 'auto',
            margin: { left: 14, right: 14 },
            didDrawCell: (cellData) => {
                if (cellData.section === 'body' && cellData.column.index === 0) {
                    const photo = photoDataMap[cellData.row.index];
                    if (photo) {
                        try {
                            const size = 12;
                            const x = cellData.cell.x + (cellData.cell.width - size) / 2;
                            const y = cellData.cell.y + (cellData.cell.height - size) / 2;
                            const base64Data = photo.split(',')[1] || photo;
                            const format = photo.includes('png') ? 'PNG' : 'JPEG';
                            pdfDoc.addImage(base64Data, format, x, y, size, size);
                        } catch (e) {
                            console.error("Error drawing photo in report PDF:", e);
                        }
                    }
                }
            }
        });

        pdfDoc.save(`relatorio_${category.id}_${new Date().toISOString().slice(0, 10)}.pdf`);
    };

    const openConfigModal = (categoryId: string) => {
        setConfigModal({ categoryId, selectedPlanIds: categoryConfigs[categoryId] || [] });
    };

    const togglePlanInModal = (planId: string) => {
        if (!configModal) return;
        setConfigModal(prev => {
            if (!prev) return null;
            return {
                ...prev,
                selectedPlanIds: prev.selectedPlanIds.includes(planId)
                    ? prev.selectedPlanIds.filter(id => id !== planId)
                    : [...prev.selectedPlanIds, planId]
            };
        });
    };

    return (
        <div className="rl animate-fade-in">

            {/* ======= PLAN CONFIG MODAL ======= */}
            {configModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
                    onClick={() => setConfigModal(null)}>
                    <div style={{ background: '#fff', borderRadius: '16px', width: '90%', maxWidth: '500px', maxHeight: '80vh', overflow: 'hidden', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}
                        onClick={(e) => e.stopPropagation()}>
                        <div style={{ padding: '20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '900', color: '#1e293b' }}>Configurar Relatório</h3>
                                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>Selecione quais planos pertencem a esta categoria</p>
                            </div>
                            <button onClick={() => setConfigModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                                <X size={20} color="#94a3b8" />
                            </button>
                        </div>
                        <div style={{ padding: '16px 20px', maxHeight: '50vh', overflowY: 'auto' }}>
                            {plans.filter(p => p.active).map(plan => {
                                const isSelected = configModal.selectedPlanIds.includes(plan.id);
                                const monthlyVal = (plan.valores?.mensalidade?.ateVencimento || plan.associado?.mensalidade?.ateVencimento || plan.naoAssociado?.mensalidade?.ateVencimento || plan.valor || 0) / 100;
                                return (
                                    <div key={plan.id} onClick={() => togglePlanInModal(plan.id)} style={{
                                        display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '10px', cursor: 'pointer',
                                        border: isSelected ? '2px solid #00a63a' : '1px solid #f1f5f9', background: isSelected ? '#fef2f2' : '#fff',
                                        marginBottom: '8px', transition: 'all 0.15s'
                                    }}>
                                        <div style={{ width: '22px', height: '22px', borderRadius: '6px', border: isSelected ? '2px solid #00a63a' : '2px solid #d1d5db', background: isSelected ? '#00a63a' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            {isSelected && <Check size={14} color="#fff" />}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: '700', color: '#1e293b', fontSize: '0.9rem' }}>{plan.nome}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: '600' }}>
                                                {plan.modalidade?.toUpperCase() || 'SEM MODALIDADE'} • {monthlyVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/mês
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            {plans.filter(p => !p.active).length > 0 && (
                                <>
                                    <div style={{ fontSize: '0.7rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', padding: '10px 0 6px', marginTop: '8px', borderTop: '1px solid #f1f5f9' }}>Planos Inativos</div>
                                    {plans.filter(p => !p.active).map(plan => {
                                        const isSelected = configModal.selectedPlanIds.includes(plan.id);
                                        return (
                                            <div key={plan.id} onClick={() => togglePlanInModal(plan.id)} style={{
                                                display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', borderRadius: '10px', cursor: 'pointer',
                                                border: isSelected ? '2px solid #94a3b8' : '1px solid #f1f5f9', background: isSelected ? '#f8fafc' : '#fff',
                                                marginBottom: '8px', opacity: 0.7
                                            }}>
                                                <div style={{ width: '22px', height: '22px', borderRadius: '6px', border: isSelected ? '2px solid #94a3b8' : '2px solid #d1d5db', background: isSelected ? '#94a3b8' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                    {isSelected && <Check size={14} color="#fff" />}
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: '700', color: '#64748b', fontSize: '0.85rem' }}>{plan.nome} <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>(inativo)</span></div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </>
                            )}
                        </div>
                        <div style={{ padding: '16px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '600' }}>{configModal.selectedPlanIds.length} plano(s)</span>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={() => setConfigModal(null)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer' }}>Cancelar</button>
                                <button onClick={() => saveConfig(configModal.categoryId, configModal.selectedPlanIds)} disabled={savingConfig} style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: '#00a63a', color: '#fff', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer', opacity: savingConfig ? 0.7 : 1 }}>
                                    {savingConfig ? 'Salvando...' : 'Salvar'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ======= COLUMNS CONFIG MODAL ======= */}
            {columnsModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
                    onClick={() => setColumnsModal(false)}>
                    <div className="animate-scale-in" style={{ background: '#fff', borderRadius: '16px', width: '90%', maxWidth: '400px', padding: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.15)' }}
                        onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0, color: '#1e293b', fontSize: '1.1rem', fontWeight: '900' }}>Colunas do Relatório</h3>
                            <button onClick={() => setColumnsModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                                <X size={20} color="#94a3b8" />
                            </button>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '16px' }}>Selecione as colunas que serão exibidas na tabela e no PDF:</p>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
                            {ALL_COLUMNS.map(col => {
                                const isSelected = tempColumns.includes(col.id);
                                return (
                                    <label key={col.id} style={{
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                        padding: '14px 10px', borderRadius: '12px', cursor: 'pointer', textAlign: 'center',
                                        background: isSelected ? '#fef2f2' : '#f8fafc',
                                        border: `2px solid ${isSelected ? '#00a63a' : '#e2e8f0'}`,
                                        position: 'relative', minHeight: '50px', transition: 'all 0.2s'
                                    }}>
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => {
                                                setTempColumns(prev =>
                                                    prev.includes(col.id)
                                                        ? prev.filter(c => c !== col.id)
                                                        : [...prev, col.id]
                                                );
                                            }}
                                            style={{ position: 'absolute', top: '6px', right: '6px', accentColor: '#00a63a', width: '16px', height: '16px' }}
                                        />
                                        <span style={{ fontSize: '0.8rem', fontWeight: '700', color: isSelected ? '#00a63a' : '#64748b' }}>{col.label}</span>
                                    </label>
                                );
                            })}
                        </div>

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button onClick={() => setColumnsModal(false)} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff', fontWeight: '700', cursor: 'pointer', color: '#64748b' }}>Cancelar</button>
                            <button onClick={() => saveColumns(tempColumns)} disabled={tempColumns.length === 0} style={{ flex: 2, padding: '12px', borderRadius: '10px', border: 'none', background: '#00a63a', color: '#fff', fontWeight: '700', cursor: 'pointer', opacity: tempColumns.length === 0 ? 0.5 : 1 }}>Salvar Colunas</button>
                        </div>
                    </div>
                </div>
            )}

            <header className="rl-topo"><h1>Relatórios</h1><p>Consulte e exporte os cadastros de alunos por modalidade.</p></header>

            {/* ======= FILTROS, BUSCA E COLUNAS ======= */}
            <div className="rl-barra">
                <div className="rl-seg" role="group" aria-label="Situação do cadastro">
                    {([['all', 'Todos'], ['aprovado', 'Aprovados'], ['pendente', 'Pendentes'], ['desativado', 'Desativados']] as const).map(([id, rotulo]) => (
                        <button key={id} type="button" className={statusFilter === id ? 'on' : ''} aria-pressed={statusFilter === id} onClick={() => setStatusFilter(id)}>{rotulo} <b>{contagem[id]}</b></button>
                    ))}
                </div>
                <label className="rl-busca"><Search size={15} /><input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar relatório…" aria-label="Buscar relatório" /></label>
                <button type="button" className="rl-btn" onClick={() => { setTempColumns([...selectedColumns]); setColumnsModal(true); }}><Columns size={15} /> Colunas ({selectedColumns.length})</button>
            </div>

            <div className="rl-kpis">
                <div className="azul"><small>Total de relatórios</small><b>{todasCategorias.length}</b></div>
                <div className="verde"><small>Configurados</small><b>{nConfig}</b></div>
                <div className="verm"><small>Não configurados</small><b>{todasCategorias.length - nConfig}</b></div>
                <div className="cinza"><small>Cadastros</small><b>{filteredRegs.length}</b></div>
            </div>

            {/* ======= GRUPOS DE RELATÓRIOS ======= */}
            {reportGroups.map(group => {
                const q = busca.trim().toLowerCase();
                const categorias = group.categories.filter(c => !q || (c.label + ' ' + group.title).toLowerCase().includes(q));
                if (!categorias.length) return null;
                const aberto = !recolhidos.includes(group.title);
                return (
                    <section key={group.title} className="rl-painel">
                        <button type="button" className="rl-painel-top" aria-expanded={aberto} onClick={() => setRecolhidos(x => aberto ? [...x, group.title] : x.filter(t => t !== group.title))}>
                            <FileText size={19} /><h2>{group.title.charAt(0) + group.title.slice(1).toLowerCase()}</h2><span className="rl-tag">{categorias.length} {categorias.length === 1 ? 'relatório' : 'relatórios'}</span>
                            <span className="rl-seta">{aberto ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</span>
                        </button>
                        {aberto && (
                            <div className="rl-lista">
                                <div className="rl-cab"><span>Relatório</span><span>Situação</span><span className="n">Cadastros</span><span className="n">Alunos</span><span className="n">Ações</span></div>
                                {categorias.map(category => {
                                    const hasConfig = (categoryConfigs[category.id]?.length || 0) > 0;
                                    const data = getCategoryData(category.id);
                                    const studentCount = getStudentCount(data);
                                    const isCatExpanded = expandedCategory === category.id;
                                    return (
                                        <div key={category.id} className={`rl-linha${isCatExpanded ? ' aberta' : ''}`}>
                                            <div className="rl-row" onClick={() => setExpandedCategory(isCatExpanded ? null : category.id)}>
                                                <span className="rl-nome"><i style={{ background: category.color }} />{category.label}</span>
                                                <span><span className={`rl-sit ${hasConfig ? 'ok' : 'no'}`}>{hasConfig ? 'Configurado' : 'Não configurado'}</span></span>
                                                <span className="n" data-r="Cadastros">{data.length}</span>
                                                <span className="n" data-r="Alunos">{studentCount}</span>
                                                <span className="rl-acoes">
                                                    <button type="button" className="rl-btn" onClick={(e) => { e.stopPropagation(); openConfigModal(category.id); }}><Settings size={14} /> Configurar</button>
                                                    <button type="button" className="rl-btn forte" disabled={!data.length} onClick={(e) => { e.stopPropagation(); exportCategoryPDF(category, data); }}><Download size={14} /> Gerar/Baixar</button>
                                                    <span className="rl-seta" aria-hidden>{isCatExpanded ? <ChevronUp size={17} /> : <ChevronDown size={17} />}</span>
                                                </span>
                                            </div>

                                            {isCatExpanded && data.length > 0 && (
                                                <div className="rl-previa">
                                                    <div className="rl-previa-t"><b>Prévia do relatório</b><span className="rl-tag">{data.length} {data.length === 1 ? 'cadastro' : 'cadastros'}</span><small>{activeColumns.length} colunas</small></div>
                                                    <div className="rl-previa-r">
                                                        <table className="est-tab">
                                                            <thead><tr><th>#</th><th data-sem-ordem>Foto</th>{activeColumns.filter(c => c.id !== 'foto').map(col => <th key={col.id}>{col.label}</th>)}</tr></thead>
                                                            <tbody>
                                                                {data.map((reg: any, idx: number) => {
                                                                    const fotoUrl = reg.alunos?.[0]?.fotoUrl;
                                                                    return (
                                                                        <tr key={reg.id} onClick={() => { window.location.href = `/admin/details/${reg.id}`; }}>
                                                                            <td>{idx + 1}</td>
                                                                            <td>{fotoUrl ? <img className="rl-foto" src={fotoUrl} alt="" loading="lazy" /> : <span className="rl-foto" />}</td>
                                                                            {activeColumns.filter(c => c.id !== 'foto').map(col => {
                                                                                const val = col.getValue(reg, plans, turmas);
                                                                                if (col.id === 'status') return <td key={col.id}><span className={`rl-st ${val === 'APROVADO' ? 'ok' : val === 'DESATIVADO' ? 'off' : 'pend'}`}>{val.charAt(0) + val.slice(1).toLowerCase()}</span></td>;
                                                                                return <td key={col.id} className={col.id === 'aluno' ? 'forte' : ''}>{val}</td>;
                                                                            })}
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            )}

                                            {isCatExpanded && !hasConfig && (
                                                <div className="rl-vazio aviso">
                                                    <p>Configure quais planos pertencem a este relatório.</p>
                                                    <button type="button" className="rl-btn forte" onClick={() => openConfigModal(category.id)}>Configurar agora</button>
                                                </div>
                                            )}
                                            {isCatExpanded && hasConfig && data.length === 0 && <div className="rl-vazio">Nenhum cadastro encontrado neste relatório.</div>}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                );
            })}
            {reportGroups.length > 0 && !reportGroups.some(g => g.categories.some(c => !busca.trim() || (c.label + ' ' + g.title).toLowerCase().includes(busca.trim().toLowerCase()))) && <div className="rl-vazio">Nenhum relatório encontrado para "{busca}".</div>}
        </div>
    );
}
