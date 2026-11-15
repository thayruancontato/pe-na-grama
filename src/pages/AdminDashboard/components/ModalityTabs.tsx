import React from 'react';
import type { Student } from '../types';
import Tabs from '../../../components/Tabs';

interface ModalityTabsProps {
    activeModality: string | null;
    allStudents: Student[];
    filterStatus?: string;
    onModalityClick: (mod: string) => void;
}

export const ModalityTabs: React.FC<ModalityTabsProps> = ({ activeModality, allStudents, filterStatus, onModalityClick }) => {
    const count = allStudents.filter(s => {
        const isArchived = s.contractStatus === 'desativado' || s.status === 'desativado';

        if (filterStatus === 'desativados') {
            return isArchived;
        }

        if (isArchived) return false;
        return filterStatus === 'pendente' ? s.contractStatus !== 'aprovado' : s.contractStatus === 'aprovado';
    }).length;

    return <Tabs items={[{ id: '', label: 'Todos', count }]} active={activeModality === null ? '' : activeModality} onChange={onModalityClick} />;
};
