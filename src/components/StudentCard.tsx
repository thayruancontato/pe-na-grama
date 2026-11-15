import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import Arte from './Arte';
import { A, L, desenharCarteirinha, type DadosCarteirinha } from '../artes/carteirinha';
import { useArtes } from '../artes/config';

interface StudentCardProps {
    student: { nome: string; dataNascimento: string; cpf: string; fotoUrl?: string };
    responsavel?: DadosCarteirinha['responsavel'];
    numeroCota?: string;
    modalidade?: string | string[];
    width?: string | number;
    /** Força um modelo (usado na pré-visualização); sem isso vale o modelo escolhido pela escola. */
    modelo?: string;
}

// Carteirinha do aluno na tela: frente e verso desenhados pelo mesmo código do PDF (src/artes/carteirinha.ts).
const StudentCard: React.FC<StudentCardProps> = ({ student, responsavel, numeroCota, modalidade, width = '100%', modelo }) => {
    const [verso, setVerso] = useState(false);
    const escolhido = useArtes().carteirinha, m = modelo || escolhido;
    const dados: DadosCarteirinha = { ...student, responsavel, numeroCota, modalidade };
    const chave = [m, student.nome, student.cpf, student.dataNascimento, student.fotoUrl, numeroCota, String(modalidade), responsavel?.nome, responsavel?.email].join('|');
    const face = (lado: 'frente' | 'verso'): React.CSSProperties => ({
        position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
        transform: lado === 'verso' ? 'rotateY(180deg)' : 'none', borderRadius: 12, boxShadow: '0 8px 24px rgba(9,36,92,0.14)', border: '1px solid rgba(9,36,92,0.12)', overflow: 'hidden'
    });

    return (
        <div style={{ width, maxWidth: '100%', perspective: '1200px' }}>
            <div className="carteirinha-giro" style={{ position: 'relative', paddingBottom: `${(A / L) * 100}%`, transition: 'transform 0.6s ease-in-out', transformStyle: 'preserve-3d', WebkitTransformStyle: 'preserve-3d', transform: verso ? 'rotateY(180deg)' : 'none' }}>
                {(['frente', 'verso'] as const).map((lado) => (
                    <div key={lado} style={face(lado)} aria-hidden={(lado === 'verso') !== verso}>
                        <Arte desenhar={() => desenharCarteirinha(m, dados, lado)} chave={chave + lado} proporcao={A / L} alt={`Carteirinha de ${student.nome} (${lado})`} raio={0} />
                    </div>
                ))}
            </div>
            <button type="button" aria-pressed={verso} onClick={() => setVerso(!verso)} style={{ marginTop: 10, width: '100%', minHeight: 38, background: '#f4f7fb', color: '#09245c', border: '1px solid #dce7f3', borderRadius: 10, cursor: 'pointer', fontSize: '0.88rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <RefreshCw size={15} /> {verso ? 'Ver a frente' : 'Ver o verso'}
            </button>
            <style>{'@media (prefers-reduced-motion: reduce) { .carteirinha-giro { transition-duration: 0.01ms !important; } }'}</style>
        </div>
    );
};

export default StudentCard;
