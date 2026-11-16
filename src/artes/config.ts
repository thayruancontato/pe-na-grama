import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { PADRAO_ID, idValido } from './catalogo';

// Modelo de arte escolhido pela escola. Fica em system_settings/artes (o portal do aluno também lê).
export interface Artes { carteirinha: string; aniversario: string }
const PADRAO: Artes = { carteirinha: PADRAO_ID.carteirinha, aniversario: PADRAO_ID.aniversario };
const REF = ['system_settings', 'artes'] as const;

let pedido: Promise<Artes> | null = null;
const ouvintes = new Set<(a: Artes) => void>();

/** Lê a escolha da escola (uma vez por carregamento da página). */
export function lerArtes(): Promise<Artes> {
    if (!pedido) {
        pedido = getDoc(doc(db, ...REF))
            .then(async (s) => { const d = (s.exists() ? s.data() : {}) as Partial<Artes>; return { carteirinha: await idValido('carteirinha', d.carteirinha), aniversario: await idValido('aniversario', d.aniversario) }; })
            .catch(() => PADRAO);
    }
    return pedido;
}
/** Grava o modelo escolhido e avisa as telas abertas. */
export async function salvarArte(tipo: keyof Artes, id: string) {
    const novo = { ...(await lerArtes()), [tipo]: id };
    await setDoc(doc(db, ...REF), novo, { merge: true });
    pedido = Promise.resolve(novo); ouvintes.forEach((f) => f(novo));
}
/** Modelos em uso; muda sozinho quando o admin escolhe outro. */
export function useArtes(): Artes {
    const [a, setA] = useState<Artes>(PADRAO);
    useEffect(() => { let vivo = true; lerArtes().then((x) => vivo && setA(x)); ouvintes.add(setA); return () => { vivo = false; ouvintes.delete(setA); }; }, []);
    return a;
}
