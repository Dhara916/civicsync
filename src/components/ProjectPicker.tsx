import { useState } from 'react';
import type { Project } from '../contracts/database';
import { getProjects } from '../services/projectService';
import { useDebounced } from '../hooks/useDebounced';
import { useResource } from '../hooks/useResource';
import { SearchBar } from './SearchBar';
import { Button, ErrorPanel, Loading } from './UI';
import { StatusBadge } from './StatusBadge';
export function ProjectPicker({selected, onSelect, disabled}: {selected: Project | null; onSelect: (project: Project | null) => void; disabled?: boolean}) {
  const [search, setSearch] = useState(''), query = useDebounced(search);
  const results = useResource(`project-picker:${query}`, () => getProjects({search: query, pageSize: 20}), {enabled: !selected});
  if (selected) return <div className="selected-project"><div><strong>{selected.title}</strong><p>{selected.road_name}</p><StatusBadge status={selected.status}/></div><Button variant="secondary" disabled={disabled} onClick={() => onSelect(null)}>Change</Button></div>;
  return <div className="project-picker"><SearchBar id="report-project-search" value={search} onChange={setSearch} placeholder="Find the project or road involved"/>{results.loading && <Loading label="Finding saved projects…"/>}{results.error && <ErrorPanel message={results.error} retry={results.reload}/>} {results.data && <><div className="project-picker-results" aria-label="Matching projects">{results.data.items.map(p => <button key={p.id} type="button" disabled={disabled} onClick={() => onSelect(p)}><div><strong>{p.title}</strong><small>{p.road_name}</small></div><StatusBadge status={p.status}/></button>)}</div><small className="muted">{results.data.total ? `${results.data.items.length} of ${results.data.total} matches. ${results.data.total > 20 ? 'Refine the search to find another project.' : 'Select a project to continue.'}` : 'No matching projects. A project must be registered before a report can be linked to it.'}</small></>}</div>;
}
