import catalog from '../data/paymentProviders.json';

export type BillingMethod = 'PIX' | 'BOLETO' | 'CREDIT_CARD';
export type Verification = 'native' | 'docs' | 'partial' | 'assisted';

export interface ProviderField {
    key: string;
    label: string;
    secret?: boolean;
    required?: boolean;
    placeholder?: string;
    help?: string;
}

export interface ProviderDef {
    id: string;
    name: string;
    color: string;
    logo: string;
    tagline: string;
    methods: BillingMethod[];
    verification: Verification;
    site: string;
    docs: string;
    environments: { id: string; label: string }[];
    fields: ProviderField[];
    webhook: string;
    certificate?: string;
    managed?: boolean;
}

export const PROVIDERS = catalog as ProviderDef[];
export const getProviderDef = (id: string) => PROVIDERS.find(p => p.id === id);

export const METHOD_LABEL: Record<BillingMethod, string> = { PIX: 'Pix', BOLETO: 'Boleto', CREDIT_CARD: 'Cartão' };

export const VERIFICATION_LABEL: Record<Verification, { text: string; hint: string }> = {
    native: { text: 'Integração própria', hint: 'Integração que já roda em produção neste sistema.' },
    docs: { text: 'Conforme a documentação', hint: 'Requisições montadas a partir da documentação oficial e testadas com respostas simuladas. Valide com a sua conta de teste antes de cobrar.' },
    partial: { text: 'Documentação parcial', hint: 'Parte da documentação oficial não pôde ser lida; alguns campos seguem o padrão conhecido do provedor. Valide com a sua conta de teste.' },
    assisted: { text: 'Requer certificado', hint: 'A API exige certificado digital (mTLS). Depois de instalar o certificado no Cloudflare o provedor passa a funcionar.' }
};
