import React from 'react';
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

// Carteirinha do aluno na tela: a frente e, logo abaixo, o verso, os dois do mesmo tamanho.
// Os dois lados são desenhados pelo mesmo código do PDF (src/artes/carteirinha.ts).
const StudentCard: React.FC<StudentCardProps> = ({ student, responsavel, numeroCota, modalidade, width = '100%', modelo }) => {
    const escolhido = useArtes().carteirinha, m = modelo || escolhido;
    const dados: DadosCarteirinha = { ...student, responsavel, numeroCota, modalidade };
    const chave = [m, student.nome, student.cpf, student.dataNascimento, student.fotoUrl, numeroCota, String(modalidade), responsavel?.nome, responsavel?.email].join('|');
    const lado = (l: 'frente' | 'verso') => <Arte desenhar={() => desenharCarteirinha(m, dados, l)} chave={chave + l} proporcao={A / L} alt={`Carteirinha de ${student.nome} (${l})`} raio={10} style={{ boxShadow: '0 6px 18px rgba(9,36,92,0.16)' }} />;

    return (
        <div style={{ width, maxWidth: '100%', display: 'grid', gap: 10 }}>
            {lado('frente')}
            {lado('verso')}
        </div>
    );
};

export default StudentCard;
