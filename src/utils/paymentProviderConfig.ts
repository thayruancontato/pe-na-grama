import { getProviderDef, type ProviderDef } from './paymentProviders';

// Qualquer id do catálogo (src/data/paymentProviders.json). 'asaas' e 'cora' são os legados do Worker.
export type PaymentProviderId = string;
export type PaymentEnvironmentId = string;

export interface PaymentProviderConfig {
    provider: PaymentProviderId;
    environment: PaymentEnvironmentId;
    testMode: boolean;
}

// Cora é o provedor ativo desde 30/07/2026 (conta do cliente).
// O Asaas continua suportado e pode ser reativado pela tela de bancos.
export const DEFAULT_PAYMENT_PROVIDER_CONFIG: PaymentProviderConfig = {
    provider: 'cora',
    environment: 'production',
    testMode: false
};

const workerUrl = import.meta.env.VITE_WORKER_URL || import.meta.env.VITE_PAYMENT_API_URL;
export const ADMIN_KEY_STORAGE = 'pg_provider_admin_key';
export const getAdminKey = () => { try { return localStorage.getItem(ADMIN_KEY_STORAGE) || ''; } catch { return ''; } };

/** Ambiente válido para o provedor; senão o primeiro dele (Asaas só tem produção). */
function pickEnvironment(def: ProviderDef | undefined, wanted: unknown): string {
    const ids = (def?.environments || []).map(e => e.id);
    return ids.includes(String(wanted)) ? String(wanted) : (ids[0] || 'production');
}

// O provedor ativo fica no Worker (KV), sem Firebase.
export async function getPaymentProviderConfig(): Promise<PaymentProviderConfig> {
    try {
        const data = await (await fetch(`${workerUrl}/payment-providers/active`)).json();
        const saved = data?.config;
        const def = getProviderDef(String(saved?.provider));
        if (!def) return DEFAULT_PAYMENT_PROVIDER_CONFIG;
        return { provider: def.id, environment: pickEnvironment(def, saved.environment), testMode: Boolean(saved.testMode) };
    } catch (error) {
        console.error('[PaymentProviderConfig] Error loading config:', error);
        return DEFAULT_PAYMENT_PROVIDER_CONFIG;
    }
}

export async function savePaymentProviderConfig(config: PaymentProviderConfig) {
    const normalized: PaymentProviderConfig = {
        provider: config.provider,
        environment: pickEnvironment(getProviderDef(config.provider), config.environment),
        testMode: Boolean(config.testMode)
    };
    const response = await fetch(`${workerUrl}/payment-providers/active`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAdminKey()}` },
        body: JSON.stringify(normalized)
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error || 'Não foi possível salvar o provedor ativo.');
    return normalized;
}

export function withPaymentProviderPayload<T extends Record<string, any>>(payload: T, config: PaymentProviderConfig): T {
    return {
        ...payload,
        provider: config.provider,
        environment: config.environment,
        paymentProvider: config.provider,
        paymentEnvironment: config.environment,
        financialTestMode: config.testMode
    };
}

export function withPaymentProviderQuery(path: string, config: PaymentProviderConfig) {
    const params = new URLSearchParams({
        provider: config.provider,
        environment: config.environment
    });
    if (config.testMode) params.set('financialTestMode', 'true');

    const separator = path.includes('?') ? '&' : '?';
    return `${path}${separator}${params.toString()}`;
}

export function getPaymentProviderLabel(config: PaymentProviderConfig) {
    const def = getProviderDef(config.provider);
    const name = def?.name || config.provider;
    const env = def?.environments.find(e => e.id === config.environment);
    return env ? `${name} / ${env.label}` : name;
}
