// Abas padrão do sistema (modalidades, seções). O visual vive em styles/consistencia.css (.ux-tabs / .ux-tab).
interface TabsProps {
    items: { id: string; label: string; count?: number | string }[];
    active: string | null;
    onChange: (id: string) => void;
}

export default function Tabs({ items, active, onChange }: TabsProps) {
    return (
        <div className="ux-tabs" role="tablist" data-ux-skip>
            {items.map((t) => (
                <button key={t.id} type="button" role="tab" aria-selected={active === t.id} className={`ux-tab${active === t.id ? ' on' : ''}`} onClick={() => onChange(t.id)}>
                    {t.label}
                    {t.count !== undefined && <span className="ux-tab-n">{t.count}</span>}
                </button>
            ))}
        </div>
    );
}
