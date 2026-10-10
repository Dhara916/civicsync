import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import { Link } from 'react-router-dom';
import type { LatLngExpression } from 'leaflet';
import type { Project, WorkGeometry } from '../contracts/database';
import { StatusBadge } from './StatusBadge';
import { WORK_LABELS } from '../lib/domain';
import { Button } from './UI';
import 'leaflet/dist/leaflet.css';
const STATUS_COLORS: Record<string, string> = {planned: '#5978a7', in_progress: '#168579', delayed: '#d98b20', completed: '#627668', cancelled: '#8b9198'};
const num = (v: unknown, fallback: number, min: number, max: number) => Number.isFinite(Number(v)) && v !== '' && v != null && Number(v) >= min && Number(v) <= max ? Number(v) : fallback;
const defaultCenter: [number, number] = [num(import.meta.env.VITE_MAP_LATITUDE, 13, -85, 85), num(import.meta.env.VITE_MAP_LONGITUDE, 77.59, -180, 180)];
const defaultZoom = num(import.meta.env.VITE_MAP_ZOOM, 11, 1, 18);
function geometryPoints(g: WorkGeometry | null): [number, number][] { if (!g) return []; return (g.type === 'Point' ? [g.coordinates] : g.coordinates).map(([lng, lat]) => [lat, lng]); }
function visiblePoints(project: Project): [number, number][] {
  const points = geometryPoints(project.work_geometry);
  if (points.length) return points;
  return project.latitude != null && project.longitude != null && Number.isFinite(project.latitude) && Number.isFinite(project.longitude) && Math.abs(project.latitude) <= 90 && Math.abs(project.longitude) <= 180 ? [[project.latitude, project.longitude]] : [];
}
function MapEvents({onPick}: {onPick?: (latitude: number, longitude: number) => void}) { useMapEvents({click: e => onPick?.(Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6)))}); return null; }
function Viewport({points}: {points: [number, number][]}) {
  const map = useMap(), signature = JSON.stringify(points);
  useEffect(() => {
    map.invalidateSize();
    if (points.length === 1) map.setView(points[0], 15);
    else if (points.length > 1) map.fitBounds(points, {padding: [35, 35], maxZoom: 16});
  }, [signature, map]);
  return null;
}
export function ProjectMap({projects = [], selection = null, onPick, height = 370}: {projects?: Project[]; selection?: WorkGeometry | null; onPick?: (latitude: number, longitude: number) => void; height?: number}) {
  const [tileError, setTileError] = useState(false), [mapKey, setMapKey] = useState(0);
  const mapped = useMemo(() => projects.map(p => ({project: p, points: visiblePoints(p)})).filter(p => p.points.length), [projects]);
  const selectionPoints = geometryPoints(selection);
  const allPoints = [...mapped.flatMap(p => p.points), ...selectionPoints];
  return <div className="map-wrapper"><div className="project-map" style={{height}} aria-label={onPick ? 'Choose project coordinates on the map; latitude and longitude fields are also available below' : 'Map of saved project locations'}><MapContainer key={mapKey} center={defaultCenter} zoom={defaultZoom} scrollWheelZoom={false} style={{height: '100%', width: '100%'}}><TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' maxZoom={19} eventHandlers={{tileerror: () => setTileError(true)}}/><Viewport points={allPoints}/><MapEvents onPick={onPick}/>{mapped.map(({project: p, points}) => <CircleMarker key={p.id} center={points[0]} radius={8} pathOptions={{color: '#fff', weight: 2, fillColor: STATUS_COLORS[p.status], fillOpacity: 1}}><Popup><div className="map-popup"><StatusBadge status={p.status}/><strong>{p.title}</strong><p>{p.road_name} · {WORK_LABELS[p.work_type]}</p><Link to={`/projects/${p.id}`}>View project →</Link></div></Popup></CircleMarker>)}{mapped.filter(p => p.points.length > 1).map(({project, points}) => <Polyline key={`line-${project.id}`} positions={points as LatLngExpression[]} pathOptions={{color: STATUS_COLORS[project.status], weight: 5, opacity: 0.8}}/>)}{selectionPoints.length > 1 && <Polyline positions={selectionPoints} pathOptions={{color: '#0f766e', weight: 5, dashArray: '8 5'}}/>}{selectionPoints.map((point, i) => <CircleMarker key={`selection-${i}`} center={point} radius={i === 0 ? 8 : 5} pathOptions={{color: '#134e4a', fillColor: '#fff', fillOpacity: 1}}/>)}</MapContainer></div>{tileError && <div className="map-warning" role="status">Map tiles could not load. Saved coordinates remain available.<Button variant="ghost" onClick={() => {setTileError(false); setMapKey(k => k + 1);}}>Retry map</Button></div>}{!onPick && <div className="map-legend"><span><i style={{background: STATUS_COLORS.in_progress}}/>In progress</span><span><i style={{background: STATUS_COLORS.planned}}/>Planned</span><span><i style={{background: STATUS_COLORS.delayed}}/>Delayed</span><span className="map-count">{mapped.length} mapped{projects.length > mapped.length ? ` · ${projects.length - mapped.length} without coordinates` : ''}</span></div>}</div>;
}
