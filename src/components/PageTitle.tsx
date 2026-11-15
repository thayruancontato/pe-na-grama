
import React from 'react';

interface PageTitleProps {
    title: string;
    subtitle?: string;
    count?: number | string;
    children?: React.ReactNode;
    style?: React.CSSProperties;
    className?: string;
}

export default function PageTitle({ title, subtitle, count, children, style, className }: PageTitleProps) {
    return (
        <div className={className} style={{ marginBottom: '22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', ...style }}>
            <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <h1>
                        {title}
                    </h1>
                    {(count !== undefined && count !== null) && (
                        <div style={{ background: '#eef3fa', padding: '3px 12px', borderRadius: '999px', display: 'flex', alignItems: 'center' }}>
                            <span style={{ color: '#09245c', fontWeight: 800, fontSize: '.95rem' }}>{count}</span>
                        </div>
                    )}
                </div>
                {subtitle && <p className="ux-sub">{subtitle}</p>}
            </div>
            {children && (
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    {children}
                </div>
            )}
        </div>
    );
}
