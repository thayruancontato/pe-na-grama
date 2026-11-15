
import { pdfCarteirinhas } from '../artes/carteirinha';
import { lerArtes } from '../artes/config';

export const generateStudentCardPDF = async (student: any, responsible: any, showAlert: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void, modalidade?: string | string[], numeroCota?: string) => {
    try {
        await pdfCarteirinhas((await lerArtes()).carteirinha, [{ ...student, responsavel: responsible, modalidade, numeroCota }], `Carteirinha_${String(student.nome).replace(/\s+/g, '_')}.pdf`);
    } catch (error) {
        console.error('Error generating PDF card:', error);
        showAlert('Erro ao gerar PDF da carteirinha.', 'error');
    }
};
