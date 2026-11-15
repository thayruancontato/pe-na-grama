import { useState, useEffect } from 'react';
import { collection, getDocs, query } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import StudentCard from '../components/StudentCard';
import { Download, Search, FileDown, Eye } from 'lucide-react';
import PageTitle from '../components/PageTitle';
import PageContainer from '../components/PageContainer';

import Tabs from '../components/Tabs';
import SeletorModelo from '../components/SeletorModelo';
import { A as CART_A, L as CART_L, MODELOS_CARTEIRINHA, desenharCarteirinha, pdfCarteirinhas, type DadosCarteirinha } from '../artes/carteirinha';
import { salvarArte, useArtes } from '../artes/config';

// Aluno de exemplo para a galeria de modelos.
const EXEMPLO: DadosCarteirinha = { nome: 'Pedro Henrique Souza', cpf: '123.456.789-00', dataNascimento: '12/05/2014', numeroCota: '0042', modalidade: 'Futebol' };

export default function AdminCarteirinhas() {
    const navigate = useNavigate();
    const [allStudents, setAllStudents] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [visibleCount, setVisibleCount] = useState(20);
    const [isScrolling, setIsScrolling] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [feitas, setFeitas] = useState(0);
    const [modalityFilter, setModalityFilter] = useState('futebol');

    useEffect(() => {
        const fetchRegs = async () => {
            try {
                const q = query(collection(db, "rumo_ao_esporte_2026_registrations"));
                const querySnapshot = await getDocs(q);
                const rawData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                // Flatten to student level
                const flatList: any[] = [];
                rawData.forEach((reg: any) => {
                    if (reg.contractStatus === 'desativado') return;
                    if (reg.alunos && reg.alunos.length > 0) {
                        reg.alunos.forEach((aluno: any, index: number) => {
                            flatList.push({
                                uniqueId: `${reg.id}_${index}`,
                                regId: reg.id,
                                aluno: aluno,
                                responsavel: reg.responsavel,
                                modalidade: reg.modalidade,
                                numeroCota: reg.numeroCota,
                                contractStatus: reg.contractStatus,
                                createdAt: reg.createdAt
                            });
                        });
                    }
                });

                // Sort alphabetically by student name
                flatList.sort((a, b) => {
                    const nameA = a.aluno?.nome || '';
                    const nameB = b.aluno?.nome || '';
                    return nameA.localeCompare(nameB);
                });

                setAllStudents(flatList);
            } catch (error) {
                console.error("Error fetching:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchRegs();
    }, []);

    // Reset pagination when searching or changing modality
    useEffect(() => {
        setVisibleCount(20);
    }, [searchTerm, modalityFilter]);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        if (scrollHeight - scrollTop - clientHeight < 50 && !isScrolling) {
            if (visibleCount < filteredStudents.length) {
                setIsScrolling(true);
                setTimeout(() => {
                    setVisibleCount(prev => prev + 20);
                    setIsScrolling(false);
                }, 300);
            }
        }
    };

    const filteredStudents = allStudents.filter(item => {
        const search = searchTerm.toLowerCase();
        const studentName = item.aluno?.nome?.toLowerCase() || '';
        const respName = item.responsavel?.nome?.toLowerCase() || '';
        const cpf = item.responsavel?.cpf?.replace(/\D/g, '') || '';
        const cota = item.numeroCota ? String(item.numeroCota) : '';

        // Added modality filter
        const matchesModality = item.modalidade?.toLowerCase() === modalityFilter.toLowerCase();
        const matchesSearch = studentName.includes(search) || respName.includes(search) || cpf.includes(search) || cota.includes(search);

        return matchesModality && matchesSearch;
    });

    // Formatting Logic (First Name + First Surname preserved, abbreviate middle if 4+ parts)
    const formatName = (name: string) => {
        const parts = name.trim().split(/\s+/);
        if (parts.length >= 4) {
            for (let i = 2; i < parts.length - 1; i++) {
                parts[i] = parts[i][0].toUpperCase() + '.';
            }
        }
        return parts.join(' ');
    };

    const modelo = useArtes().carteirinha;
    const dadosDe = (item: any): DadosCarteirinha => ({ ...item.aluno, responsavel: item.responsavel, numeroCota: item.numeroCota, modalidade: item.modalidade });

    const generateSinglePDF = async (item: any) => {
        try { await pdfCarteirinhas(modelo, [dadosDe(item)], `Carteirinha_${String(item.aluno.nome).replace(/\s+/g, '_')}.pdf`); }
        catch (error) { console.error('Error generating PDF card:', error); alert('Erro ao gerar PDF da carteirinha.'); }
    };

    const generateBatchPDF = async () => {
        if (exporting) return;
        setExporting(true); setFeitas(0);
        try { await pdfCarteirinhas(modelo, filteredStudents.map(dadosDe), `Carteirinhas_${new Date().toISOString().slice(0, 10)}.pdf`, setFeitas); }
        catch (error) { console.error('Error generating batch PDF:', error); alert('Erro ao gerar o PDF das carteirinhas.'); }
        finally { setExporting(false); }
    };

    return (
        <PageContainer style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
            {/* Header Content */}
            <div style={{ marginBottom: '30px', flexShrink: 0 }}>
                <PageTitle
                    title="CARTEIRINHAS"
                    subtitle="Visualize e exporte as carteirinhas de todos os alunos"
                >
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', width: '100%', maxWidth: '640px' }}>
                        <div style={{ position: 'relative', flex: '1 1 220px' }}>
                            <input
                                type="text"
                                placeholder="Buscar por nome, cota ou CPF..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{
                                    padding: '10px 15px',
                                    paddingLeft: '35px',
                                    borderRadius: '8px',
                                    border: '1px solid #ddd',
                                    fontSize: '0.9rem',
                                    width: '100%',
                                    boxSizing: 'border-box',
                                    outline: 'none'
                                }}
                            />
                            <Search size={16} color="#888" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                        </div>
                        <button
                            onClick={generateBatchPDF}
                            disabled={exporting || loading || filteredStudents.length === 0}
                            style={{
                                background: '#00a63a',
                                color: '#fff',
                                border: 'none',
                                padding: '10px 20px',
                                borderRadius: '8px',
                                cursor: exporting || loading ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontWeight: '600',
                                opacity: exporting || loading ? 0.7 : 1
                            }}
                        >
                            {exporting ? 'Gerando PDF...' : (
                                <>
                                    <FileDown size={18} />
                                    Exportar Todas ({filteredStudents.length})
                                </>
                            )}
                        </button>
                    </div>
                </PageTitle>

                <SeletorModelo titulo="Modelo da carteirinha" ajuda="Vale para todas as carteirinhas, no painel, no portal do aluno e no PDF." modelos={MODELOS_CARTEIRINHA} atual={modelo}

                    proporcao={CART_A / CART_L} desenhar={(id) => desenharCarteirinha(id, EXEMPLO)} onEscolher={(id) => salvarArte('carteirinha', id).catch(() => alert('Não consegui salvar o modelo.'))} />

                <Tabs items={[{ id: 'futebol', label: 'Futebol' }]} active={modalityFilter} onChange={setModalityFilter} />
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '50px', color: '#666' }}>Carregando dados...</div>
            ) : (
                <div
                    onScroll={handleScroll}
                    style={{
                        background: '#f5f7fa',
                        borderRadius: '12px',
                        flex: 1,
                        overflowY: 'auto',
                        paddingRight: '5px'
                    }}
                >
                    {filteredStudents.length === 0 ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: '#888' }}>
                            Nenhum aluno encontrado.
                        </div>
                    ) : (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                            gap: '20px',
                            paddingBottom: '20px'
                        }}>
                            {filteredStudents.slice(0, visibleCount).map((item) => (
                                <div key={item.uniqueId} style={{
                                    background: '#fff',
                                    padding: '15px',
                                    borderRadius: '12px',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '15px'
                                }}>
                                    <div style={{ width: '100%', borderRadius: '8px', overflow: 'hidden', border: '1px solid #eee' }}>
                                        <StudentCard
                                            student={item.aluno}
                                            responsavel={item.responsavel}
                                            numeroCota={item.numeroCota}
                                            modalidade={item.modalidade}
                                        />
                                    </div>

                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <button
                                            onClick={() => generateSinglePDF(item)}
                                            style={{
                                                flex: 1,
                                                padding: '8px',
                                                background: '#f0f0f0',
                                                border: 'none',
                                                borderRadius: '6px',
                                                color: '#333',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '6px',
                                                fontSize: '0.9rem',
                                                fontWeight: '600',
                                                transition: 'background 0.2s'
                                            }}
                                            onMouseOver={(e) => e.currentTarget.style.background = '#e0e0e0'}
                                            onMouseOut={(e) => e.currentTarget.style.background = '#f0f0f0'}
                                        >
                                            <Download size={16} /> Baixar
                                        </button>
                                        <button
                                            onClick={() => navigate(`/admin/details/${item.regId}`)}
                                            style={{
                                                flex: 1,
                                                padding: '8px',
                                                background: '#fff',
                                                border: '1px solid #00a63a',
                                                borderRadius: '6px',
                                                color: '#00a63a',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '6px',
                                                fontSize: '0.9rem',
                                                fontWeight: '600',
                                                transition: 'all 0.2s'
                                            }}
                                            onMouseOver={(e) => {
                                                e.currentTarget.style.background = '#00a63a';
                                                e.currentTarget.style.color = '#fff';
                                            }}
                                            onMouseOut={(e) => {
                                                e.currentTarget.style.background = '#fff';
                                                e.currentTarget.style.color = '#00a63a';
                                            }}
                                        >
                                            <Eye size={16} /> Detalhes do Aluno
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {isScrolling && (
                        <div style={{ textAlign: 'center', padding: '20px', color: '#888' }}>
                            Carregando mais...
                        </div>
                    )}
                </div>
            )}
            {/* Loading Overlay */}
            {exporting && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(255, 255, 255, 0.9)',
                    zIndex: 9999,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backdropFilter: 'blur(4px)'
                }}>
                    <div style={{
                        width: '40px',
                        height: '40px',
                        border: '4px solid #f3f3f3',
                        borderTop: '4px solid #00a63a',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                    }} />
                    <style>{`
                        @keyframes spin {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                        }
                    `}</style>
                    <h3 style={{ marginTop: '20px', color: '#333', fontSize: '1.2rem' }}>Gerando PDF com todas as carteirinhas...</h3>
                    <p style={{ color: '#666' }}>{feitas} de {filteredStudents.length} prontas. Aguarde, isso pode levar alguns segundos.</p>
                </div>
            )}
        </PageContainer>
    );
}
