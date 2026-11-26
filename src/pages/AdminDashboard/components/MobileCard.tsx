import React from 'react';
import { MessageCircle } from 'lucide-react';
import type { Student, Turma } from '../types';
import '../../../styles/student-card.css';

interface MobileCardProps {
    item: Student;
    turmas: Turma[];
    onNavigate: (regId: string) => void;
    onResendApproval: (item: Student) => void;
    filterStatus?: string;
    selectionEnabled?: boolean;
    selected?: boolean;
    onToggleSelection?: (regId: string) => void;
}

export const MobileCard: React.FC<MobileCardProps> = ({
    item,
    turmas,
    onNavigate,
    onResendApproval,
    filterStatus,
    selectionEnabled = false,
    selected = false,
    onToggleSelection
}) => {
    const student = item.aluno;
    const turma = turmas.find(t => t.id === student?.turmaId);
    const isDesativados = filterStatus === 'desativados';

    const tel = String(item.responsavel?.telefonePrincipal || '').replace(/\D/g, '');
    const pendente = item.financialPendingAmount > 0;
    const inicial = String(student?.nome || '?').trim().charAt(0).toUpperCase();

    return (
        <article className={`sc${selected ? ' sc-sel' : ''}`}>
            <div className="sc-topo">
                {selectionEnabled && (
                    <label className="sc-marca">
                        <input type="checkbox" checked={selected} onChange={() => onToggleSelection?.(item.regId)} aria-label={`Selecionar cadastro de ${student?.nome || 'aluno'}`} />
                    </label>
                )}
                {student?.fotoUrl ? <img className="sc-foto" src={student.fotoUrl} alt="" loading="lazy" /> : <div className="sc-foto sc-ini" aria-hidden>{inicial}</div>}
                <div className="sc-id">
                    <h3>{student?.nome || 'Sem Aluno'}</h3>
                    <p>Resp: {item.responsavel?.nome || '-'}</p>
                    <div className="sc-chips">
                        <span className="sc-chip">{turma?.nome || item.modalidade || 'N/A'}</span>
                        {!isDesativados && <span className={`sc-chip ${pendente ? 'pend' : 'ok'}`}>{pendente ? 'Pendente' : 'Em dia'}</span>}
                    </div>
                </div>
            </div>
            <div className="sc-acoes">
                <button type="button" className="sc-btn" onClick={() => onNavigate(item.regId)}>Detalhes</button>
                {tel ? <a className="sc-btn zap" href={`https://wa.me/55${tel}`} target="_blank" rel="noreferrer"><MessageCircle size={15} />WhatsApp</a>
                    : <span className="sc-btn off">Sem telefone</span>}
            </div>
            {item.contractStatus === 'aprovado' && (
                <button type="button" className="sc-reenviar" onClick={() => onResendApproval(item)}><MessageCircle size={14} />Reenviar aprovação</button>
            )}
        </article>
    );
};
