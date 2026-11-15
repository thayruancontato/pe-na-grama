import React from 'react';
import { ModalityTabs } from './ModalityTabs';
import { Download } from 'lucide-react';
import type { Student } from '../types';

interface MobileFooterProps {
    activeModality: string | null;
    allStudents: Student[];
    filterStatus?: string;
    onModalityClick: (mod: string) => void;
    onExportClick: () => void;
}

export const MobileFooter: React.FC<MobileFooterProps> = ({
    activeModality, allStudents, filterStatus, onModalityClick, onExportClick
}) => {
    return (
        <div style={{
            position: 'sticky',
            bottom: 0,
            margin: '16px -16px -16px',
            background: '#fff',
            borderTop: '1px solid #eee',
            padding: '8px 16px calc(12px + env(safe-area-inset-bottom))',
            zIndex: 100,
            boxShadow: '0 -4px 12px rgba(0,0,0,0.05)'
        }}>
            <div style={{ marginBottom: '-10px' }}><ModalityTabs
                activeModality={activeModality}
                allStudents={allStudents}
                filterStatus={filterStatus}
                onModalityClick={onModalityClick}
            /></div>

            <button
                onClick={onExportClick}
                className="touch-feedback"
                style={{
                    width: '100%',
                    marginTop: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '12px',
                    background: '#00a63a',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff',
                    fontWeight: 'bold',
                    fontSize: '0.9rem'
                }}
            >
                <Download size={18} /> EXPORTAR RELATÓRIO
            </button>
        </div>
    );
};
