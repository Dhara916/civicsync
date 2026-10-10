import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon, type IconName } from './Icon';
export function Button({children, className = '', variant = 'primary', busy = false, disabled, ...props}: ButtonHTMLAttributes<HTMLButtonElement> & {variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; busy?: boolean}) {
  return <button type="button" {...props} disabled={disabled || busy} aria-busy={busy || undefined} className={`btn btn-${variant} ${className}`}>{busy && <span className="spinner" aria-hidden="true"/>}{children}</button>;
}
export function PageHeading({eyebrow, title, description, actions}: {eyebrow?: string; title: string; description?: string; actions?: ReactNode}) {
  return <header className="page-heading"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description && <p className="page-description">{description}</p>}</div>{actions && <div className="heading-actions">{actions}</div>}</header>;
}
export function Loading({label = 'Loading saved data…'}: {label?: string}) { return <div className="loading-state" role="status"><span className="spinner"/>{label}</div>; }
export function ErrorPanel({message, retry}: {message: string; retry?: () => void}) { return <section className="notice notice-error" role="alert"><Icon name="alert"/><div><strong>We couldn’t complete this request</strong><p>{message}</p>{retry && <Button variant="secondary" onClick={retry}><Icon name="refresh" size={16}/>Retry</Button>}</div></section>; }
export function Notice({children, tone = 'info'}: {children: ReactNode; tone?: 'info' | 'warning' | 'success'}) { return <div className={`notice notice-${tone}`} role={tone === 'success' ? 'status' : undefined}><Icon name={tone === 'success' ? 'check' : tone === 'warning' ? 'alert' : 'info'}/><div>{children}</div></div>; }
export function EmptyState({title, description, icon = 'projects', action}: {title: string; description: string; icon?: IconName; action?: ReactNode}) { return <div className="empty-state"><span className="empty-icon"><Icon name={icon} size={28}/></span><h3>{title}</h3><p>{description}</p>{action}</div>; }
export function Field({id, label, hint, children}: {id: string; label: string; hint?: string; children: ReactNode}) { return <div className="field"><label htmlFor={id}>{label}</label>{children}{hint && <small id={`${id}-hint`}>{hint}</small>}</div>; }
export function Pager({page, total, pageSize, onChange}: {page: number; total: number; pageSize: number; onChange: (page: number) => void}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return <nav className="pagination" aria-label="Results pagination"><span>{total ? `${Math.min((page - 1) * pageSize + 1, total)}–${Math.min(page * pageSize, total)} of ${total.toLocaleString('en-IN')}` : '0 results'}</span><div><Button variant="secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</Button><span className="page-counter">{page} / {pages}</span><Button variant="secondary" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next</Button></div></nav>;
}
export function BackLink({to = '/projects', children = 'Back to projects'}: {to?: string; children?: ReactNode}) { return <Link to={to} className="back-link"><Icon name="back" size={16}/>{children}</Link>; }
