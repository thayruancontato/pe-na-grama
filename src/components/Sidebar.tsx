import { ChevronRight, LogOut, Menu, X } from 'lucide-react';
import { fundoParaLogo, useLogoEscola } from '../lib/logoEscola';
import React from 'react';

interface SidebarProps {
    isOpen: boolean;
    collapsed: boolean;
    setCollapsed: (collapsed: boolean) => void;
    isMobile: boolean;
    onLogout: () => void;
    children: React.ReactNode;
    logoutLabel?: string;
    headerContent?: React.ReactNode; // Optional custom header content
    userName?: string;
    userRole?: string;
}

export default function Sidebar({
    isOpen,
    collapsed,
    setCollapsed,
    isMobile,
    onLogout,
    children,
    logoutLabel = "Sair do Sistema",
    headerContent,
    userName,
    userRole
}: SidebarProps) {
    const logo = useLogoEscola();
    return (
        <aside style={{
            width: collapsed ? '56px' : '240px',
            background: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)',
            borderRight: '1px solid #dce7f3',
            display: 'flex',
            flexDirection: 'column',
            position: isMobile ? 'fixed' : 'sticky',
            top: 0,
            left: 0,
            height: '100vh',
            zIndex: 100,
            transition: 'all 0.3s ease',
            transform: isMobile && !isOpen ? 'translateX(-100%)' : 'translateX(0)',
            boxShadow: isMobile && isOpen ? '4px 0 24px rgba(6, 26, 64, 0.18)' : 'none'
        }}>
            {/* Sidebar Header */}
            <div style={{
                width: '100%',
                borderBottom: '1px solid #dce7f3',
                overflow: 'hidden',
                padding: collapsed ? '8px' : '14px',
                background: fundoParaLogo(logo.clara)
            }}>
                {headerContent || (
                    <img src={logo.src} alt="Logo da escola" data-logo-ok="1" style={{ width: '100%', display: 'block', objectFit: 'contain', height: collapsed ? '48px' : '96px' }} />
                )}
            </div>

            {/* Nav */}
            <nav style={{ flex: 1, padding: '15px 0', overflowY: 'auto' }}>
                {children}
            </nav>

            {/* Sidebar Footer */}
            <div style={{ padding: collapsed ? '15px 5px' : '15px', borderTop: '1px solid #dce7f3', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {!isMobile && (
                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        style={{
                            width: '100%',
                            padding: '8px',
                            background: '#eef8ff',
                            border: 'none',
                            color: '#17428f',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s',
                            fontSize: '0.75rem',
                            fontWeight: '800',
                            gap: '8px'
                        }}
                    >
                        {collapsed ? <ChevronRight size={18} /> : (
                            <>
                                <div style={{ display: 'flex', gap: '2px' }}>
                                    {[1, 2].map(i => <div key={i} style={{ width: '3px', height: '12px', background: '#59c8df', borderRadius: '10px' }} />)}
                                </div>
                                <span>Recolher menu</span>
                            </>
                        )}
                    </button>
                )}
                {userName && !collapsed && (
                    <div className="sb-user" title={userName}>
                        <span className="sb-user-av">{userName.trim().charAt(0).toUpperCase()}</span>
                        <span className="sb-user-tx"><b>{userName}</b><small>{userRole || 'Usuário'}</small></span>
                    </div>
                )}
                <button
                    onClick={onLogout}
                    title={logoutLabel}
                    style={{
                        width: '100%',
                        padding: collapsed ? '10px 0' : '4px 0 0',
                        background: 'none',
                        border: 0,
                        color: '#dfe9f7',
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: '0.82rem',
                        textDecoration: collapsed ? 'none' : 'underline',
                        textUnderlineOffset: '3px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                    }}
                >
                    {collapsed ? <LogOut size={18} /> : 'Sair'}
                </button>
            </div>
        </aside>
    );
}

// Helper for Mobile Overlay logic
export function SidebarOverlay({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
    if (!isOpen) return null;
    return (
        <div
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999, backdropFilter: 'blur(2px)' }}
        />
    );
}

// Helper for Mobile Header
export function MobileHeader({ title, toggleSidebar, isOpen }: { title: string, toggleSidebar: () => void, isOpen: boolean }) {
    const logo = useLogoEscola();
    return (
        <div style={{
            padding: '15px 20px',
            background: 'linear-gradient(135deg, #17428f 0%, #09245c 100%)',
            borderBottom: '1px solid rgba(255,255,255,0.14)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            position: 'sticky',
            top: 0,
            zIndex: 90
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ background: logo.clara ? 'transparent' : '#fff', borderRadius: '8px', padding: logo.clara ? 0 : '3px 8px', display: 'inline-flex' }}><img src={logo.src} alt="Logo da escola" data-logo-ok="1" style={{ height: '34px', maxWidth: '150px', objectFit: 'contain' }} /></span>
                <span style={{ fontWeight: 'bold', color: '#fff', fontSize: '0.9rem' }}>{title}</span>
            </div>
            <button
                onClick={toggleSidebar}
                style={{ border: 'none', background: 'rgba(255,255,255,0.14)', borderRadius: '8px', padding: '8px', cursor: 'pointer', color: '#fff' }}
            >
                {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
        </div>
    );
}
