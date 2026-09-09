'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

const PREFIX = '__BRANCH_MULTI__:';
const identity = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, ' ').trim().toUpperCase();

export function branchSelectionValues(value, allValue = 'ALL') {
  if (value == null || value === '' || value === allValue) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (String(value).startsWith(PREFIX)) {
    try {
      const parsed = JSON.parse(decodeURIComponent(String(value).slice(PREFIX.length)));
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch { return []; }
  }
  return [String(value)];
}

export function encodeBranchSelection(values, allValue = 'ALL') {
  const unique = [];
  for (const value of values || []) if (value && !unique.some(item => identity(item) === identity(value))) unique.push(value);
  if (!unique.length) return allValue;
  if (unique.length === 1) return unique[0];
  return `${PREFIX}${encodeURIComponent(JSON.stringify(unique))}`;
}

export function branchSelectionMatches(selection, branch, allValue = 'ALL') {
  const values = branchSelectionValues(selection, allValue);
  return values.length === 0 || values.some(value => identity(value) === identity(branch));
}

export function branchSelectionLabel(selection, allValue = 'ALL', allLabel = 'Todas las sucursales') {
  const values = branchSelectionValues(selection, allValue);
  if (!values.length) return allLabel;
  if (values.length === 1) return values[0];
  if (values.length === 2) return values.join(' + ');
  return `${values.length} sucursales`;
}

export default function BranchMultiSelect({ label = 'Sucursal', value, onChange, options = [], allValue = 'ALL', allLabel = 'Todas las sucursales', disabled = false, className = '' }) {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const names = useMemo(() => options.map(option => typeof option === 'string' ? option : option?.name).filter(Boolean), [options]);
  const selected = branchSelectionValues(value, allValue).filter(item => names.some(name => identity(name) === identity(item)));
  const selectedKeys = new Set(selected.map(identity));

  useEffect(() => {
    const close = event => { if (!rootRef.current?.contains(event.target)) setOpen(false); };
    const escape = event => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', escape); };
  }, []);

  const toggle = name => {
    const key = identity(name);
    const next = selectedKeys.has(key) ? selected.filter(item => identity(item) !== key) : [...selected, name];
    onChange(encodeBranchSelection(next, allValue));
  };

  return <div className={`branch-multi-select ${className}`} ref={rootRef}>
    <span className="branch-multi-label">{label}</span>
    <button type="button" className="branch-multi-trigger" disabled={disabled} onClick={() => setOpen(current => !current)} aria-haspopup="listbox" aria-expanded={open}>
      <span title={selected.length > 1 ? selected.join(', ') : undefined}>{branchSelectionLabel(value, allValue, allLabel)}</span>
      <ChevronDown size={14}/>
    </button>
    {open && <div className="branch-multi-menu" role="listbox" aria-multiselectable="true">
      <button type="button" className={!selected.length ? 'selected' : ''} onClick={() => onChange(allValue)}>
        <i>{!selected.length && <Check size={13}/>}</i><span>{allLabel}</span>
      </button>
      <div className="branch-multi-divider"/>
      {names.map(name => <button type="button" key={name} className={selectedKeys.has(identity(name)) ? 'selected' : ''} onClick={() => toggle(name)}>
        <i>{selectedKeys.has(identity(name)) && <Check size={13}/>}</i><span>{name}</span>
      </button>)}
    </div>}
  </div>;
}

export const BRANCH_MULTI_CSS = `
.branch-multi-select{position:relative;display:grid;min-width:0;gap:5px}.branch-multi-label{color:#74859e;font-size:9px;font-weight:900;text-transform:uppercase}.branch-multi-trigger{display:flex!important;align-items:center;justify-content:space-between;gap:8px;width:100%;height:38px;padding:0 10px;border:1px solid #d5dfeb;border-radius:9px;background:#fff;color:#102b57;font:inherit;font-size:11px;font-weight:750;cursor:pointer}.branch-multi-trigger>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.branch-multi-trigger:focus{border-color:#4f86ee;outline:3px solid rgba(59,130,246,.12)}.branch-multi-trigger:disabled{cursor:not-allowed;opacity:.55}.branch-multi-menu{position:absolute;top:calc(100% + 6px);left:0;z-index:1200;display:grid;width:max-content;min-width:100%;max-width:310px;max-height:310px;padding:6px;overflow:auto;border:1px solid #cbd8e8;border-radius:11px;background:#fff;box-shadow:0 16px 38px rgba(15,35,70,.2)}.branch-multi-menu>button{display:grid!important;grid-template-columns:22px minmax(0,1fr);align-items:center;gap:7px;min-height:34px;padding:5px 8px;border:0;border-radius:7px;background:#fff;color:#263c58;font:inherit;font-size:11px;text-align:left;cursor:pointer}.branch-multi-menu>button:hover{background:#f1f6fd}.branch-multi-menu>button.selected{color:#164fae;font-weight:850}.branch-multi-menu i{display:grid;width:18px;height:18px;place-items:center;border:1px solid #cbd8e8;border-radius:5px;background:#fff;color:#fff;font-style:normal}.branch-multi-menu button.selected i{border-color:#2563eb;background:#2563eb}.branch-multi-divider{height:1px;margin:4px 3px;background:#e4eaf2}
`;
