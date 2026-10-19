/** ORDIUM Identity Graph View */
import React, { useEffect, useState } from 'react';
import { IdentityGraph3D } from '../3d/IdentityGraph3D';
import { IdentityGraphData, IdentityNode } from '../../lib/api/types';
import { ordiumClient } from '../../lib/api/client';
import { LoadingState } from '../common/EmptyState';
import { Button } from '../common/Button';
import { useLanguage } from '../../i18n/LanguageContext';
import { Network, ShieldAlert, RefreshCw, List } from 'lucide-react';

export const IdentityNetworkView: React.FC = () => {
  const { t } = useLanguage();
  const [graphData, setGraphData] = useState<IdentityGraphData | null>(null);
  const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null); const [selectedNode, setSelectedNode] = useState<IdentityNode | null>(null); const [mode, setMode] = useState<'3d'|'list'>('3d');
  const fetchGraph = async () => { setLoading(true); setError(null); try { setGraphData(await ordiumClient.getIdentityGraph()); } catch (e) { setError(e instanceof Error ? e.message : 'تعذر تحميل شبكة الهوية.'); } finally { setLoading(false); } };
  useEffect(() => { void fetchGraph(); }, []);
  const suspicious = graphData?.suspicious_cluster_ids.length || 0;
  return <div className="dashboard-content space-y-6 sm:space-y-8">
    <div className="dashboard-panel p-5 sm:p-6 flex flex-col md:flex-row justify-between gap-4 text-start"><div><h2 className="text-base font-bold text-white font-mono flex items-center gap-2"><Network className="w-4 h-4 text-[#22D3EE]" />{t('dashboard.identity.title','Identity Resolution & Entity Relationship Graph')}</h2><p className="text-xs text-[#94A3B8] mt-1">يتم توليد بيانات الشبكة من API الخاص بـ ORDIUM وفق التاجر والبيئة الحالية، وليست بيانات وهمية من المتصفح.</p></div><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => setMode(mode === '3d' ? 'list' : '3d')} leftIcon={mode === '3d' ? <List className="w-3.5 h-3.5"/> : <Network className="w-3.5 h-3.5"/>}>{mode === '3d' ? 'عرض القائمة' : 'عرض ثلاثي الأبعاد'}</Button><Button variant="outline" size="sm" onClick={() => void fetchGraph()} leftIcon={<RefreshCw className="w-3.5 h-3.5"/>}>تحديث</Button></div></div>
    {error ? <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center"><p className="text-sm text-white">تعذر تحميل شبكة الهوية</p><p className="text-xs text-[#94A3B8] mt-2">{error}</p><Button className="mt-4" variant="outline" size="sm" onClick={() => void fetchGraph()}>إعادة المحاولة</Button></div> : loading ? <LoadingState message="جارٍ تحليل روابط الهوية المحفوظة…" /> : graphData && <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3"><div className="dashboard-panel p-4 sm:p-5"><span className="text-[10px] text-[#64748B]">Nodes</span><div className="text-xl font-bold text-white">{graphData.nodes.length}</div></div><div className="bg-[#0D1320] border border-white/10 rounded-xl p-4"><span className="text-[10px] text-[#64748B]">Edges</span><div className="text-xl font-bold text-white">{graphData.edges.length}</div></div><div className="bg-[#0D1320] border border-white/10 rounded-xl p-4"><span className="text-[10px] text-[#64748B]">Clusters</span><div className="text-xl font-bold text-white">{graphData.clusters_detected}</div></div><div className="bg-[#0D1320] border border-white/10 rounded-xl p-4"><span className="text-[10px] text-[#64748B]">Suspicious</span><div className="text-xl font-bold text-[#EF4444]">{suspicious}</div></div></div>
      {mode === '3d' ? <div className="dashboard-panel p-2 sm:p-3"><div className="h-[360px] sm:h-[480px] xl:h-[580px] w-full rounded-xl overflow-hidden bg-[#080B12] border border-white/[0.06]"><IdentityGraph3D data={graphData} onSelectNode={setSelectedNode} /></div></div> : <div className="dashboard-panel overflow-hidden"><div className="overflow-x-auto"><table className="min-w-[620px] w-full text-xs font-mono"><thead><tr className="border-b border-white/5 text-[#64748B] uppercase"><th className="p-3 text-start">Type</th><th className="p-3 text-start">Label</th><th className="p-3 text-start">Connections</th><th className="p-3 text-start">Risk</th></tr></thead><tbody className="divide-y divide-white/5">{graphData.nodes.map(node => <tr key={node.id} onClick={() => setSelectedNode(node)} className="hover:bg-white/[0.02] cursor-pointer"><td className="p-3 text-[#94A3B8]">{node.type}</td><td className="p-3 text-white" dir="ltr">{node.label}</td><td className="p-3 text-[#94A3B8]">{node.connected_count}</td><td className="p-3"><span className={node.risk_level === 'danger' ? 'text-[#EF4444]' : node.risk_level === 'warning' ? 'text-[#F59E0B]' : 'text-[#10B981]'}>{node.risk_level}</span></td></tr>)}</tbody></table></div></div>}
      {selectedNode && <div className="dashboard-panel p-4 sm:p-5 text-start"><div className="flex items-center gap-2 text-white font-semibold"><ShieldAlert className="w-4 h-4 text-[#22D3EE]"/>{selectedNode.label}</div><p className="text-xs text-[#94A3B8] mt-2">{selectedNode.type} · {selectedNode.connected_count} connected entities · {selectedNode.risk_level} risk</p></div>}
    </>}
  </div>;
};
