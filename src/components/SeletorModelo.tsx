import { Check } from 'lucide-react';
import Arte from './Arte';

interface Modelo { id: string; nome: string; resumo: string }
interface Props {
    titulo: string;
    ajuda: string;
    modelos: readonly Modelo[];
    atual: string;
    proporcao: number;
    /** Desenha o modelo com dados de exemplo. */
    desenhar: (id: string) => Promise<HTMLCanvasElement>;
    onEscolher: (id: string) => void;
}

// Galeria para o admin escolher o modelo de uma arte (carteirinha, aniversário). O visual fica nas classes sm-* de consistencia.css.
export default function SeletorModelo({ titulo, ajuda, modelos, atual, proporcao, desenhar, onEscolher }: Props) {
    return (
        <section className="sm-box" data-ux-skip>
            <div className="sm-head"><b>{titulo}</b><span>{ajuda}</span></div>
            <div className="sm-grade" role="radiogroup" aria-label={titulo}>
                {modelos.map((m) => (
                    <button type="button" key={m.id} role="radio" aria-checked={m.id === atual} className={`sm-item${m.id === atual ? ' on' : ''}`} onClick={() => m.id !== atual && onEscolher(m.id)}>
                        <Arte desenhar={() => desenhar(m.id)} chave={m.id} proporcao={proporcao} alt={`Modelo ${m.nome}`} raio={8} />
                        <span className="sm-nome">{m.id === atual && <Check size={15} strokeWidth={3} />}{m.nome}</span>
                        <small>{m.resumo}</small>
                    </button>
                ))}
            </div>
        </section>
    );
}
