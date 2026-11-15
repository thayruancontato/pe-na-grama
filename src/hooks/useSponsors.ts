/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { sponsors as listaAntiga, type Sponsor } from '../data/sponsors';

export const SPONSORS_COLLECTION = 'patrocinadores';
export const SPONSORS_SETTINGS = { collection: 'system_settings', id: 'patrocinadores' } as const;

export interface SponsorDoc {
    id: string;
    nome: string;
    logo: string;
    whatsapp: string;
    ordem: number;
    ativo: boolean;
}

const paraPublico = (d: any): Sponsor => ({ name: String(d.nome || ''), logo: String(d.logo || ''), whatsapp: String(d.whatsapp || '') });

/**
 * Patrocinadores que o público vê. Regras:
 *  - o dono liga/desliga em Patrocinadores (system_settings/patrocinadores.mostrar);
 *  - desligado, ou sem nenhum cadastrado e ativo, nada aparece (nem o título);
 *  - a lista fixa antiga (src/data/sponsors.ts) só vale para a escola original que nunca configurou nada.
 */
export async function carregarPatrocinadores(): Promise<{ mostrar: boolean; itens: Sponsor[] }> {
    try {
        if (import.meta.env.MODE === 'sem-firebase') {
            const j = await (await fetch('/sys/public/patrocinadores')).json();
            return { mostrar: j.mostrar !== false, itens: (j.itens || []).map(paraPublico) };
        }
        const [cfg, snap] = await Promise.all([getDoc(doc(db, SPONSORS_SETTINGS.collection, SPONSORS_SETTINGS.id)), getDocs(collection(db, SPONSORS_COLLECTION))]);
        const mostrar = cfg.exists() ? cfg.data()?.mostrar !== false : true;
        const itens = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })).filter((d: any) => d.ativo !== false)
            .sort((a: any, b: any) => (a.ordem ?? 0) - (b.ordem ?? 0)).map(paraPublico);
        if (!cfg.exists() && snap.empty) return { mostrar: true, itens: listaAntiga };
        return { mostrar, itens };
    } catch {
        return { mostrar: false, itens: [] };
    }
}

export function useSponsors() {
    const [estado, setEstado] = useState<{ mostrar: boolean; itens: Sponsor[]; pronto: boolean }>({ mostrar: false, itens: [], pronto: false });
    useEffect(() => {
        let vivo = true;
        carregarPatrocinadores().then((r) => { if (vivo) setEstado({ ...r, pronto: true }); });
        return () => { vivo = false; };
    }, []);
    return estado;
}
