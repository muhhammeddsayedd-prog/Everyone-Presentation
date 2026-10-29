'use client';

import { useId, useState } from 'react';
import type { CandidateFacts } from '@eps/domain';

export const emptyCandidateFacts = (): CandidateFacts => ({ name: null, casting_id: null, age_or_range: null, stated_gender: null,
  height_measurements: null, languages: [], accents: [], skills_experience: null, city: null, previous_projects_roles: null, classification: null });
export const factLabels: Record<keyof CandidateFacts, string> = { name: 'Name', casting_id: 'Casting ID', age_or_range: 'Age / range', stated_gender: 'Stated gender',
  height_measurements: 'Height / measurements', languages: 'Languages', accents: 'Accents', skills_experience: 'Skills / experience', city: 'City', previous_projects_roles: 'Previous projects / roles', classification: 'Classification' };

function SuppliedArrayInput({id,value,disabled,onChange}:{id:string;value:string[];disabled:boolean;onChange:(value:string[])=>void}) {
  // Keep the unfinished separator/word visible. Parsing may update the parent,
  // but never replaces text under the user's cursor during this editor session.
  const [text,setText]=useState(()=>value.join(', '));
  return <input id={id} dir="auto" disabled={disabled} maxLength={4000} placeholder="Not provided" value={text}
    onChange={event=>{setText(event.target.value);onChange(event.target.value.split(',').map(item=>item.trim()).filter(Boolean));}}/>;
}

export function CandidateFactsEditor({ facts, onChange, disabled = false }: { facts: CandidateFacts; onChange: (facts: CandidateFacts) => void; disabled?: boolean }) {
  const prefix = useId();
  return <div className="form-grid candidate-facts-editor">{(Object.keys(factLabels) as (keyof CandidateFacts)[]).map(key => <div className="field" key={key}>
    <label htmlFor={`${prefix}-${key}`}>{factLabels[key]}{['languages','accents'].includes(key) ? ' (comma separated)' : ''}</label>
    {key==='languages'||key==='accents'?<SuppliedArrayInput id={`${prefix}-${key}`} value={facts[key]} disabled={disabled} onChange={value=>onChange({...facts,[key]:value})}/>:<input id={`${prefix}-${key}`} dir="auto" disabled={disabled} maxLength={4000} placeholder="Not provided"
      value={facts[key] ?? ''} onChange={event => onChange({ ...facts, [key]: event.target.value || null })} />}
  </div>)}</div>;
}

export function CandidateFactsView({ facts }: { facts: CandidateFacts }) {
  return <dl className="candidate-facts">{(Object.keys(factLabels) as (keyof CandidateFacts)[]).map(key => <div key={key}><dt>{factLabels[key]}</dt><dd dir="auto">{Array.isArray(facts[key]) ? (facts[key] as string[]).join(', ') || 'Not provided' : facts[key] || 'Not provided'}</dd></div>)}</dl>;
}
