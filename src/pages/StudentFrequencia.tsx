import { useEffect, useState } from 'react';
import { CalendarCheck, Check, X } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import PageContainer from '../components/PageContainer';

type Linha = { data: string; turmaNome: string; presente: boolean };

// Frequência dos alunos do responsável: o servidor devolve só as chamadas das turmas deles e só a situação deles.
export default function StudentFrequencia() {
    const [porAluno, setPorAluno] = useState<Record<string, Linha[]>>({});
    const [carregando, setCarregando] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const snap = await getDocs(collection(db, 'rumo_ao_esporte_2026_chamadas'));
                const mapa: Record<string, Linha[]> = {};
                snap.docs.forEach((d) => {
                    const c = d.data() as any;
                    (c.alunos || []).forEach((a: any) => (mapa[a.nome] = mapa[a.nome] || []).push({ data: c.data, turmaNome: c.turmaNome, presente: a.presente }));
                });
                Object.values(mapa).forEach((l) => l.sort((x, y) => y.data.localeCompare(x.data)));
                setPorAluno(mapa);
            } catch (e) { console.error('Frequência:', e); }
            setCarregando(false);
        })();
    }, []);

    const nomes = Object.keys(porAluno);
    const dia = (iso: string) => iso.split('-').reverse().join('/');

    return (
        <PageContainer>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <CalendarCheck size={28} color="#00a63a" />
                <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#333' }}>Frequência</h1>
            </div>
            {carregando && <p>Carregando...</p>}
            {!carregando && nomes.length === 0 && <div className="native-card" style={{ padding: '20px', textAlign: 'center', color: '#555' }}>Ainda não há chamadas registradas para as turmas do seu atleta.</div>}
            {nomes.map((nome) => {
                const l = porAluno[nome], pres = l.filter((x) => x.presente).length, pct = Math.round((pres / l.length) * 100);
                return (
                    <div key={nome} className="native-card" style={{ padding: '16px', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
                            <strong style={{ textTransform: 'uppercase' }}>{nome}</strong>
                            <span style={{ color: pct >= 75 ? '#2e7d32' : '#c62828', fontWeight: 'bold' }}>{pct}% de presença ({pres} de {l.length} aulas)</span>
                        </div>
                        <div style={{ marginTop: '10px', display: 'grid', gap: '6px' }}>
                            {l.slice(0, 20).map((x, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
                                    {x.presente ? <Check size={16} color="#2e7d32" /> : <X size={16} color="#c62828" />}
                                    <span>{dia(x.data)} · {x.turmaNome}</span>
                                    <span style={{ marginLeft: 'auto', color: x.presente ? '#2e7d32' : '#c62828' }}>{x.presente ? 'Presente' : 'Faltou'}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </PageContainer>
    );
}
