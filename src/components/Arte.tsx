import { useEffect, useRef, useState } from 'react';
import type React from 'react';

interface ArteProps {
    /** Função que desenha a arte; `chave` muda quando o desenho precisa ser refeito. */
    desenhar: () => Promise<HTMLCanvasElement>;
    chave: string;
    /** altura / largura, para reservar o espaço antes de a imagem chegar. */
    proporcao: number;
    alt: string;
    raio?: number | string;
    style?: React.CSSProperties;
}

// Mostra uma arte desenhada em canvas como imagem. Só desenha quando chega perto da tela (listas longas ficam leves).
export default function Arte({ desenhar, chave, proporcao, alt, raio = 12, style }: ArteProps) {
    const [src, setSrc] = useState('');
    const [razao, setRazao] = useState(proporcao);
    const caixa = useRef<HTMLDivElement>(null);
    const fn = useRef(desenhar);
    useEffect(() => { fn.current = desenhar; });

    useEffect(() => {
        let vivo = true, url = '';
        const faz = () => fn.current().then((c) => c.toBlob((b) => { if (!b || !vivo) return; url = URL.createObjectURL(b); setRazao(c.height / c.width); setSrc(url); }, 'image/jpeg', 0.9)).catch(() => {});
        const el = caixa.current;
        let obs: IntersectionObserver | null = null;
        if (!el || !('IntersectionObserver' in window)) faz();
        else { obs = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) { obs?.disconnect(); faz(); } }, { rootMargin: '300px' }); obs.observe(el); }
        return () => { vivo = false; obs?.disconnect(); if (url) URL.revokeObjectURL(url); };
    }, [chave]);

    return (
        <div ref={caixa} style={{ position: 'relative', width: '100%', paddingBottom: `${razao * 100}%`, borderRadius: raio, overflow: 'hidden', background: '#eef2f7', ...style }}>
            {src && <img src={src} alt={alt} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} />}
        </div>
    );
}
