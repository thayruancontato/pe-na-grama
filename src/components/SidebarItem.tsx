import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

interface SidebarItemProps {
    to: string;
    label: string;
    icon: React.ReactNode;
    badge?: number;
    subItems?: { to: string; label: string; badge?: number }[];
    collapsed: boolean;
    isMobile: boolean;
    onNavigate: () => void;
}

const semBarra = (p: string) => p.endsWith('/') ? p.slice(0, -1) : p;

// Item do menu lateral (admin e professor). O visual fica nas classes sb-* de styles/consistencia.css.
export default function SidebarItem({ to, label, icon, badge, subItems, collapsed, isMobile: _isMobile, onNavigate }: SidebarItemProps) {
    const navigate = useNavigate();
    const location = useLocation();
    const atual = semBarra(location.pathname), alvo = semBarra(to);

    // O subitem ativo é o de caminho mais longo que casa com a tela atual (ex.: /admin/turmas/chamadas e não /admin/turmas).
    const subAtivo = subItems?.map(s => semBarra(s.to)).filter(s => atual === s || atual.startsWith(s + '/')).sort((a, b) => b.length - a.length)[0];
    const ativo = subItems ? Boolean(subAtivo) : atual === alvo || (alvo !== '/admin/dashboard' && alvo !== '/professor/turmas' && atual.startsWith(alvo + '/'));
    const [aberto, setAberto] = useState(ativo);
    useEffect(() => { if (ativo) setAberto(true); }, [ativo]);

    const ir = (caminho: string) => { navigate(caminho); onNavigate(); };
    const selo = (n?: number) => n !== undefined && n > 0 && <span className="sb-badge">{n}</span>;

    if (!subItems) {
        return (
            <div className="sb-wrap">
                <button type="button" className={`sb-item${ativo ? ' on' : ''}${collapsed ? ' mini' : ''}`} onClick={() => ir(to)} title={collapsed ? label : undefined} aria-current={ativo ? 'page' : undefined}>
                    <span className="sb-ico">{icon}</span>
                    {!collapsed && <span className="sb-label">{label}</span>}
                    {!collapsed && selo(badge)}
                </button>
            </div>
        );
    }

    return (
        <div className="sb-wrap">
            <button type="button" className={`sb-item grupo${ativo ? ' dentro' : ''}${collapsed ? ' mini' : ''}`} onClick={() => collapsed ? ir(to) : setAberto(!aberto)} title={collapsed ? label : undefined} aria-expanded={collapsed ? undefined : aberto}>
                <span className="sb-ico">{icon}</span>
                {!collapsed && <span className="sb-label">{label}</span>}
                {!collapsed && <ChevronRight size={16} className={`sb-seta${aberto ? ' aberta' : ''}`} />}
            </button>
            {aberto && !collapsed && (
                <div className="sb-subs">
                    {subItems.map(sub => {
                        const on = semBarra(sub.to) === subAtivo;
                        return (
                            <button type="button" key={sub.to} className={`sb-sub${on ? ' on' : ''}`} onClick={() => ir(sub.to)} aria-current={on ? 'page' : undefined}>
                                <span className="sb-label">{sub.label}</span>
                                {selo(sub.badge)}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
