import { useState } from 'react';
import StudentCard from '../components/StudentCard';
import { User, FileText, AlertTriangle, IdCard, Download, Camera, Loader, X, RefreshCw } from 'lucide-react';
import { compressImage } from '../utils/imageUtils';
import { useDialog } from '../context/CustomDialogContext';
import StudentGalleryTab from './StudentGalleryTab';
import { validateCPF } from '../utils/cpfUtils';
import '../styles/aluno.css';

interface StudentDetailsProps {
    aluno: any;
    index: number;
    data: any;
    setData: (data: any) => void;
    turmas: any[];
    generateStudentCardPDF: (student: any) => void;
    navigate: (path: string) => void;
    isEditing?: boolean;
    onTransfer?: () => void;
    allRegistrations?: any[];
    onRemoveModality?: (regId: string, modalityName: string) => void;
    canEdit?: boolean;
    activeTab: 'overview' | 'galerie';
    setActiveTab: (tab: 'overview' | 'galerie') => void;
    onBirthDateSet?: (alunoIndex: number, birthDate: string) => void;
}

export default function StudentDetailsSection({
    aluno,
    index,
    data,
    setData,
    turmas,
    generateStudentCardPDF,
    navigate,
    isEditing: _isEditing = false,
    onTransfer,
    allRegistrations = [],
    onRemoveModality,
    canEdit = true,
    activeTab,
    setActiveTab,
    onBirthDateSet
}: StudentDetailsProps) {
    const { showAlert, showConfirm } = useDialog();
    const [uploading, setUploading] = useState(false);
    const [uploadingDoc, setUploadingDoc] = useState(false);

    const handlePhotoUpload = async (e: any) => {
        if (!canEdit) return;
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        try {
            const compressedFile = await compressImage(file);
            const formData = new FormData();
            formData.append('file', compressedFile, file.name);
            formData.append('folder', 'rumo_ao_esporte_2026_photos');

            const workerUrl = import.meta.env.VITE_WORKER_URL || 'https://SEU-WORKER.SEU-SUBDOMINIO.workers.dev';
            const response = await fetch(`${workerUrl}/images/upload`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            const uploadedUrl = result.data?.url || result.url || result.photoUrl;

            if (response.ok && uploadedUrl) {
                const updatedAlunos = [...data.alunos];
                updatedAlunos[index] = { ...updatedAlunos[index], fotoUrl: uploadedUrl };
                setData({ ...data, alunos: updatedAlunos });
                showAlert('Foto atualizada com sucesso!', 'success');
            } else {
                showAlert(result.error || 'Erro ao atualizar foto.', 'error');
            }
        } catch (error: any) {
            console.error(error);
            showAlert(`Erro ao enviar foto: ${error.message || 'Erro desconhecido'}`, 'error');
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    const handleRemovePhoto = () => {
        if (!canEdit) return;
        showConfirm(
            'Tem certeza que deseja remover a foto deste aluno?',
            () => {
                const updatedAlunos = [...data.alunos];
                updatedAlunos[index] = { ...updatedAlunos[index], fotoUrl: '' };
                setData({ ...data, alunos: updatedAlunos });
                showAlert('Foto removida com sucesso!', 'success');
            },
            'warning',
            'Remover Foto'
        );
    };

    const handleDocumentUpload = async (e: any) => {
        if (!canEdit) return;
        const file = e.target.files[0];
        if (!file) return;

        setUploadingDoc(true);
        try {
            // PDFs vao direto; so imagens (foto do RG) sao comprimidas.
            const fileToSend = file.type.startsWith('image/') ? await compressImage(file) : file;
            const formData = new FormData();
            formData.append('file', fileToSend, file.name);
            formData.append('folder', 'rumo_ao_esporte_2026_docs');

            const workerUrl = import.meta.env.VITE_WORKER_URL || 'https://SEU-WORKER.SEU-SUBDOMINIO.workers.dev';
            const response = await fetch(`${workerUrl}/images/upload`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            const uploadedUrl = result.data?.url || result.url || result.photoUrl;

            if (response.ok && uploadedUrl) {
                const updatedAlunos = [...data.alunos];
                updatedAlunos[index] = { ...updatedAlunos[index], documentoUrl: uploadedUrl };
                setData({ ...data, alunos: updatedAlunos });
                showAlert('Documento de identidade atualizado com sucesso!', 'success');
            } else {
                showAlert(result.error || 'Erro ao atualizar documento.', 'error');
            }
        } catch (error: any) {
            console.error(error);
            showAlert(`Erro ao enviar documento: ${error.message || 'Erro desconhecido'}`, 'error');
        } finally {
            setUploadingDoc(false);
            e.target.value = '';
        }
    };

    const handleRemoveDocument = () => {
        if (!canEdit) return;
        showConfirm(
            'Tem certeza que deseja remover o documento de identidade deste aluno?',
            () => {
                const updatedAlunos = [...data.alunos];
                updatedAlunos[index] = { ...updatedAlunos[index], documentoUrl: '' };
                setData({ ...data, alunos: updatedAlunos });
                showAlert('Documento removido com sucesso!', 'success');
            },
            'warning',
            'Remover Documento'
        );
    };

    const getAge = (birthDate: string) => {
        const birth = parseBirthDate(birthDate);
        if (!birth) return '-';

        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
            age--;
        }
        return `${age} anos`;
    };

    const parseBirthDate = (birthDate?: string) => {
        if (!birthDate) return null;

        const normalized = birthDate.trim();
        const brDateMatch = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

        if (brDateMatch) {
            const [, day, month, year] = brDateMatch;
            const parsed = new Date(Number(year), Number(month) - 1, Number(day));
            const isValid =
                parsed.getFullYear() === Number(year) &&
                parsed.getMonth() === Number(month) - 1 &&
                parsed.getDate() === Number(day);

            return isValid ? parsed : null;
        }

        const parsed = new Date(normalized);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    const formatBirthDate = (birthDate?: string) => {
        const parsed = parseBirthDate(birthDate);
        return parsed ? parsed.toLocaleDateString('pt-BR') : birthDate || '-';
    };

    const maskDate = (v: string) => v.replace(/\D/g, '').replace(/(\d{2})(\d)/, '$1/$2').replace(/(\d{2})(\d)/, '$1/$2').slice(0, 10);

    const maskCPF = (v: string) => v.replace(/\D/g, '').slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})/, '$1-$2');

    const inputAluno = (patch: (v: string) => any, valor: string, extra: any = {}) => (
        <input
            className="sd-input"
            type="text"
            value={valor}
            onChange={(e) => {
                const updatedAlunos = [...data.alunos];
                updatedAlunos[index] = { ...updatedAlunos[index], ...patch(e.target.value) };
                setData({ ...data, alunos: updatedAlunos });
            }}
            {...extra}
        />
    );
    const cpfInvalido = Boolean(aluno.cpf && aluno.cpf.replace(/\D/g, '').length === 11 && !validateCPF(aluno.cpf));
    const regs = allRegistrations.length > 0 ? allRegistrations : [{ ...aluno, id: aluno.id || 'temp', modalidade: aluno.modalidade }];
    const statusTom = (s?: string) => (s === 'pago' ? 'ok' : s === 'atrasado' || s === 'overdue' ? 'bad' : 'warn');
    const turmaDe = (reg: any) => {
        const t = turmas.find((x) => x.id === (reg.alunos?.[0]?.turmaId || reg.turmaId));
        return t ? `${t.horario} · ${t.nome}` : 'Sem turma definida';
    };

    return (
        <div className="sd">
            <div className="sd-abas" role="tablist">
                <button role="tab" aria-selected={activeTab === 'overview'} className={activeTab === 'overview' ? 'on' : ''} onClick={() => setActiveTab('overview')}><User size={16} /> Visão geral</button>
                <button role="tab" aria-selected={activeTab === 'galerie'} className={activeTab === 'galerie' ? 'on' : ''} onClick={() => setActiveTab('galerie')}><Camera size={16} /> Galeria de mídias</button>
            </div>

            {activeTab === 'overview' && (
                <div className="sd-grade">
                    <div className="sd-col">
                        {/* PERFIL */}
                        <section className="sd-painel sd-perfil">
                            <div className="sd-foto">
                                <input type="file" id={`photo-upload-${index}`} style={{ display: 'none' }} accept="image/*" onChange={handlePhotoUpload} disabled={!canEdit} />
                                <label htmlFor={`photo-upload-${index}`} className={canEdit ? 'pode' : ''}>
                                    {aluno.fotoUrl ? <img src={aluno.fotoUrl} alt={aluno.nome} /> : <span className="vazio"><User size={34} /><small>Sem foto</small></span>}
                                    {canEdit && <span className="sd-foto-ov">{uploading ? <Loader className="spin" size={20} /> : <Camera size={20} />}<small>{uploading ? 'Enviando…' : 'Alterar foto'}</small></span>}
                                </label>
                                {canEdit && aluno.fotoUrl && (
                                    <button type="button" className="sd-foto-x" title="Remover foto" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleRemovePhoto(); }}><X size={13} /></button>
                                )}
                            </div>
                            <div className="sd-id">
                                {_isEditing
                                    ? inputAluno((v) => ({ nome: v }), aluno.nome || '', { placeholder: 'Nome completo do aluno', 'aria-label': 'Nome do aluno', style: { fontSize: '1.15rem', fontWeight: 700 } })
                                    : <h3>{aluno.nome}</h3>}
                                <div className="sd-badges">
                                    {data.contractStatus === 'desativado' && <span className="sd-tag warn">Desativado</span>}
                                    {aluno.sexo && <span className="sd-tag">{aluno.sexo === 'M' ? 'Masculino' : 'Feminino'}</span>}
                                    <span className="sd-tag">{getAge(aluno.dataNascimento)}</span>
                                    {regs.map((r: any, i: number) => <span key={r.id || i} className="sd-tag azul">{r.modalidade || 'Sem modalidade'}</span>)}
                                </div>
                            </div>
                        </section>

                        {/* DADOS */}
                        <section className="sd-painel">
                            <header><h4>Dados do aluno</h4></header>
                            <dl className="sd-dados">
                                <div><dt>Nascimento</dt><dd>
                                    {_isEditing
                                        ? inputAluno((v) => ({ dataNascimento: maskDate(v) }), aluno.dataNascimento || '', { placeholder: 'DD/MM/AAAA', onBlur: (e: any) => onBirthDateSet?.(index, e.target.value) })
                                        : formatBirthDate(aluno.dataNascimento)}
                                </dd></div>
                                <div><dt>CPF do aluno</dt><dd>
                                    {_isEditing ? (<>
                                        {inputAluno((v) => ({ cpf: maskCPF(v) }), aluno.cpf || '', { placeholder: '000.000.000-00', maxLength: 14, style: cpfInvalido ? { borderColor: '#d64538' } : undefined })}
                                        {cpfInvalido && <small className="sd-erro">CPF inválido</small>}
                                    </>) : (aluno.cpf || '—')}
                                </dd></div>
                                <div><dt>Nº da camisa</dt><dd>
                                    {_isEditing ? inputAluno((v) => ({ camisa: v }), aluno.camisa || '', { placeholder: 'Ex.: 10' }) : (aluno.camisa || '—')}
                                </dd></div>
                                <div><dt>Nº da cota</dt><dd>
                                    {_isEditing
                                        ? <input className="sd-input" type="text" value={data.numeroCota || ''} placeholder="Ex.: 123" onChange={(e) => setData({ ...data, numeroCota: e.target.value })} />
                                        : (data.numeroCota || '—')}
                                </dd></div>
                            </dl>
                        </section>

                        {/* SAÚDE */}
                        {(aluno.alergia || aluno.medicamento || aluno.planoSaude) && (
                            <section className="sd-painel sd-saude">
                                <header><h4><AlertTriangle size={15} /> Informações de saúde</h4></header>
                                <dl className="sd-dados">
                                    {aluno.alergia && <div><dt>Alergia</dt><dd>{aluno.alergia}</dd></div>}
                                    {aluno.medicamento && <div><dt>Medicamento</dt><dd>{aluno.medicamento}</dd></div>}
                                    {aluno.planoSaude && <div><dt>Plano de saúde</dt><dd>{aluno.planoSaude}</dd></div>}
                                </dl>
                            </section>
                        )}

                        {/* MODALIDADES */}
                        <section className="sd-painel">
                            <header><h4>Modalidades e turmas</h4><small>{regs.length} {regs.length === 1 ? 'matrícula' : 'matrículas'}</small></header>
                            <div className="sd-mods">
                                {regs.map((reg: any, regIndex: number) => {
                                    const m = String(reg.modalidade || '').toLowerCase();
                                    const extra = m === 'futebol' ? reg.categoriaFutebol : (['voleibol', 'hidroginástica', 'natação'].includes(m) ? (reg.planoVoleibol || reg.planId) : '');
                                    return (
                                        <div key={reg.id || regIndex} className="sd-mod">
                                            <div className="sd-mod-nome"><b>{reg.modalidade || 'Modalidade não definida'}</b>{extra ? <small>{m === 'futebol' ? 'Categoria ' : 'Plano '}{extra}</small> : null}</div>
                                            <div className="sd-mod-turma"><small>Turma / horário</small><span>{turmaDe(reg)}</span></div>
                                            <span className={`sd-tag ${statusTom(reg.status)}`}>{(reg.status || 'pendente').toUpperCase()}</span>
                                            <div className="sd-mod-acoes">
                                                <button type="button" className="sd-btn" onClick={() => navigate(`/admin/contract/${reg.id}/${regIndex}`)}>Contrato</button>
                                                {onTransfer && canEdit && <button type="button" className="sd-btn" onClick={() => (onTransfer as any)(reg)}>Remanejar</button>}
                                                {onRemoveModality && canEdit && <button type="button" className="sd-btn perigo" onClick={() => onRemoveModality(reg.id, reg.modalidade)}>Excluir</button>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>

                        {/* DOCUMENTO */}
                        <section className="sd-painel">
                            <header><h4>Documento de identidade</h4></header>
                            <div className="sd-doc">
                                {canEdit && <input type="file" id={`doc-upload-${index}`} style={{ display: 'none' }} accept="image/*,application/pdf" onChange={handleDocumentUpload} disabled={uploadingDoc} />}
                                {aluno.documentoUrl ? (<>
                                    <a href={aluno.documentoUrl} target="_blank" rel="noreferrer" className="sd-btn forte"><FileText size={15} /> Ver documento</a>
                                    {canEdit && <>
                                        <label htmlFor={`doc-upload-${index}`} className="sd-btn" title="Substituir documento">{uploadingDoc ? <Loader className="spin" size={14} /> : <RefreshCw size={14} />} Substituir</label>
                                        <button type="button" className="sd-btn perigo" onClick={handleRemoveDocument}><X size={14} /> Remover</button>
                                    </>}
                                </>) : canEdit ? (
                                    <label htmlFor={`doc-upload-${index}`} className="sd-btn forte">{uploadingDoc ? <Loader className="spin" size={14} /> : <FileText size={14} />} {uploadingDoc ? 'Enviando…' : 'Adicionar documento'}</label>
                                ) : <span className="sd-vazio">Nenhum documento enviado.</span>}
                            </div>
                        </section>
                    </div>

                    {/* CARTEIRINHA */}
                    <div className="sd-col sd-lado">
                        <section className="sd-painel">
                            <header><h4><IdCard size={15} /> Carteirinha</h4><button type="button" className="sd-btn" onClick={() => generateStudentCardPDF(aluno)}><Download size={14} /> Baixar</button></header>
                            <div className="sd-cart"><StudentCard student={aluno} responsavel={data.responsavel} numeroCota={data.numeroCota} modalidade={data.modalidade} /></div>
                        </section>
                    </div>
                </div>
            )}

            {activeTab === 'galerie' && <div style={{ paddingTop: '8px' }}><StudentGalleryTab alunoId={`${data.id}_${index}`} /></div>}
        </div>
    );
}
