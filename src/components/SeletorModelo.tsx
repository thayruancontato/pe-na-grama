import { useState } from 'react';
import { Check } from 'lucide-react';
import Arte from './Arte';

interface Modelo { id: string; nome: string; grupo: string }
interface Props {
    titulo: string;
    ajuda: string;
    modelos: readonly Modelo[];
    atual: string;
    proporcao: number;
    /** Largura mínima de cada modelo na galeria (px). */
    largura?: number;
    /** Desenha o modelo com dados de exemplo. */
    desenhar: (id: string) => Promise<HTMLCanvasElement>;
    onEscolher: (id: string) => void;
}

// Galeria para o admin escolher o modelo de uma arte (carteirinha, aniversário), com filtro por formato.
// O visual fica nas classes sm-* de consistencia.css.
export default function SeletorModelo({ titulo, ajuda, modelos, atual, proporcao, largura = 150, desenhar, onEscolher }: Props) {
    const grupos = [...new Set(modelos.map((m) => m.grupo))];
    const escolhido = modelos.find((m) => m.id === atual);
    const [grupo, setGrupo] = useState('');
    const [aberto, setAberto] = useState(false);
    const lista = grupo ? modelos.filter((m) => m.grupo === grupo) : modelos;

    return (
        <section className="sm-box" data-ux-skip>
            <div className="sm-head">
                <div><b>{titulo}</b><span>{ajuda}</span></div>
                <button type="button" className="sm-abrir" aria-expanded={aberto} onClick={() => setAberto(!aberto)}>{aberto ? 'Fechar galeria' : `Trocar modelo (${modelos.length} opções)`}</button>
            </div>
            {!aberto && escolhido && (
                <div className="sm-atual">
                    <div className="sm-mini" style={{ width: Math.max(120, largura * 0.8) }}><Arte desenhar={() => desenhar(escolhido.id)} chave={escolhido.id} proporcao={proporcao} alt={`Modelo ${escolhido.nome}`} raio={8} /></div>
                    <span>Em uso: <b>{escolhido.nome}</b></span>
                </div>
            )}
            {aberto && (
                <>
                    <div className="sm-chips" role="tablist" aria-label="Formato">
                        {['', ...grupos].map((g) => <button type="button" key={g} role="tab" aria-selected={g === grupo} className={`sm-chip${g === grupo ? ' on' : ''}`} onClick={() => setGrupo(g)}>{g || `Todos (${modelos.length})`}</button>)}
                    </div>
                    <div className="sm-grade" role="radiogroup" aria-label={titulo} style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${largura}px, 1fr))` }}>
                        {lista.map((m) => (
                            <button type="button" key={m.id} role="radio" aria-checked={m.id === atual} className={`sm-item${m.id === atual ? ' on' : ''}`} onClick={() => m.id !== atual && onEscolher(m.id)}>
                                <Arte desenhar={() => desenhar(m.id)} chave={m.id} proporcao={proporcao} alt={`Modelo ${m.nome}`} raio={8} />
                                <span className="sm-nome">{m.id === atual && <Check size={15} strokeWidth={3} />}{m.nome}</span>
                            </button>
                        ))}
                    </div>
                </>
            )}
        </section>
    );
}
