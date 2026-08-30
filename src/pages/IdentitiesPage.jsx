import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { getEffectiveStatus } from '../data/productionCatalog';
import { getCaptureSessionStatus, startCaptureSession, stopCaptureSession } from '../utils/runtimeApi';
import { useStore } from '../context/StoreContext';
import {
  canAdoptCaptureSession,
  capturePhaseLabel,
  captureProgress,
  captureStartFailureMessage,
  captureStatusDisposition,
  normalizeCaptureError
} from '../utils/captureData.mjs';



const IdentitiesPage = () => {

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDept, setEditDept] = useState('');
  const [editGroup, setEditGroup] = useState('');
  const {
    identities,
    groups,
    departments,
    events,
    captureCatalog,
    session,
    saveIdentity,
    removeIdentity,
    refresh,
    addDepartment
  } = useStore();

  const startEditing = () => {
     setEditName(selectedIdentity.name);
     setEditDept(selectedIdentity.department);
     setEditGroup(selectedIdentity.groupId);
     setIsEditingProfile(true);
  };

  const saveProfile = async () => {
     try {
       const saved = await saveIdentity({ ...selectedIdentity, name: editName, department: editDept, groupId: editGroup });
       setSelectedIdentity(saved);
       setIsEditingProfile(false);
     } catch (error) {
       alert(error?.message || '保存人员资料失败。');
     }
  };

  const location = useLocation();
    const [selectedIdentity, setSelectedIdentity] = useState(null);

  useEffect(() => {
    if (location.state?.identityId) {
      const matched = identities.find(id => id.id === location.state.identityId || id.name === location.state.identityId);
      if (matched) setSelectedIdentity(matched);
    }
  }, [location.state, identities]);

    const [selectedGroup, setSelectedGroup] = useState(null);

  const getLastActivity = (name) => {
     const evs = events.filter(e => e.identity === name);
     if (evs.length === 0) return '--';
     return evs[0].time; // already sorted descending
  };


  // 顶层导航状态 (all, groups, queue)
  const [activeTab, setActiveTab] = useState('all');

  // 过滤与搜索状态
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAttention, setFilterAttention] = useState(false);

  // 录入向导状态
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [wizardMode, setWizardMode] = useState('new'); // 'new' | 'reenroll'
  const [enrollStep, setEnrollStep] = useState(1);
  const [captureState, setCaptureState] = useState('idle'); // 'idle', 'starting', 'in_progress', 'stopping', 'done', 'rejected', 'skipped'
  const [captureTargetId, setCaptureTargetId] = useState('');
  const [pendingIdentity, setPendingIdentity] = useState(null);
  const [captureResult, setCaptureResult] = useState(null);
  const [captureStatus, setCaptureStatus] = useState(null);
  const [captureExpectedId, setCaptureExpectedId] = useState('');
  const [captureStartError, setCaptureStartError] = useState('');
  const [captureStatusNotice, setCaptureStatusNotice] = useState('');
  const captureStopSentRef = useRef(false);
  const captureStartPendingRef = useRef(false);

  // 新人员/重采表单状态
  const [newName, setNewName] = useState('');
  const [newDept, setNewDept] = useState('');
  const [newScope, setNewScope] = useState('');
  const [newExpiration, setNewExpiration] = useState('永久 (Permanent)');
  const [isAddingDepartment, setIsAddingDepartment] = useState(false);
  const [departmentDraft, setDepartmentDraft] = useState('');
  const [departmentError, setDepartmentError] = useState('');

  // 其他 UI 状态
  const [isImporting, setIsImporting] = useState(false);

  // New specific dropdown filters
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('全部部门');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('全部录入状态');
  const [selectedScopeFilter, setSelectedScopeFilter] = useState('全部门禁范围');

  const departmentOptions = Array.isArray(departments) ? departments : [];

  // 录入队列中的人数 & 需关注异常的人数
  const queueCount = identities.filter(id => id.enrollment === 'INCOMPLETE' || id.enrollment === 'RECAPTURE').length;
  const attentionCount = identities.filter(id => id.enrollment !== 'READY' || id.status === 'SUSPENDED').length;

  const handleEnrollFinish = async () => {
    const target = wizardMode === 'new' ? pendingIdentity : selectedIdentity;
    if (!target) return;
    const selectedGroupId = newScope || (wizardMode === 'reenroll' ? target.groupId : '');
    if (!selectedGroupId) {
      alert('请选择权限组。');
      return;
    }
    try {
      const saved = await saveIdentity({
        ...target,
        name: newName || target.name,
        department: newDept || target.department,
        groupId: selectedGroupId
      });
      if (selectedIdentity?.id === saved.id) setSelectedIdentity(saved);
      await refresh();
      setIsEnrolling(false);
      setNewName('');
      setNewDept('');
      setNewScope('');
      setPendingIdentity(null);
      setCaptureTargetId('');
      setCaptureState('idle');
      setCaptureResult(null);
      setCaptureStatus(null);
      setCaptureExpectedId('');
      setCaptureStartError('');
      setCaptureStatusNotice('');
    } catch (error) {
      alert(error?.message || '人员档案保存失败。');
    }
  };

  const handleCreateDepartment = async () => {
    const name = departmentDraft.trim();
    if (!name) {
      setDepartmentError('部门名称不能为空。');
      return;
    }
    try {
      const created = await addDepartment(name);
      setNewDept(created);
      setEditDept(created);
      setDepartmentDraft('');
      setDepartmentError('');
      setIsAddingDepartment(false);
    } catch (error) {
      setDepartmentError(error?.message || '部门保存失败。');
    }
  };

  const toggleSuspend = async () => {
    if (!selectedIdentity) return;
    const newStatus = getEffectiveStatus(selectedIdentity) === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
    try {
      const saved = await saveIdentity({ ...selectedIdentity, status: newStatus });
      setSelectedIdentity(saved);
      await refresh();
    } catch (error) {
      alert(error?.message || '更新人员状态失败。');
    }
  };

  const handleImport = () => {
    document.getElementById('csv-upload-input')?.click();
  };

  const startReenroll = () => {
    setWizardMode('reenroll');
    setNewName(selectedIdentity.name);
    setNewDept(selectedIdentity.department);
    setNewScope(selectedIdentity.groupId || '');
    setEnrollStep(2);
    setCaptureState('idle');
    setCaptureResult(null);
    setCaptureStatus(null);
    setCaptureExpectedId('');
    setCaptureStartError('');
    setCaptureStatusNotice('');
    captureStopSentRef.current = false;
    setIsEnrolling(true);
  };

  const startNewEnroll = () => {
    setWizardMode('new');
    setNewName('');
    setNewDept('');
    setNewScope('');
        setEnrollStep(1);
    setCaptureState('idle');
    setPendingIdentity(null);
    setCaptureTargetId('');
    setCaptureResult(null);
    setCaptureStatus(null);
    setCaptureExpectedId('');
    setCaptureStartError('');
    setCaptureStatusNotice('');
    captureStopSentRef.current = false;
    setIsEnrolling(true);
  };


    const handleCsvUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setIsImporting(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            const text = event.target.result;
            const lines = text.split('\n').filter(line => line.trim() !== '');
            // Skip header if it exists
            const startIdx = lines[0].includes('name') ? 1 : 0;
            const imported = [];
            for (let i = startIdx; i < lines.length; i++) {
                const parts = lines[i].split(',');
                if (parts.length >= 2) {
                    const groupValue = parts[2]?.trim();
                    const group = groups.find(g => g.id === groupValue || g.name === groupValue) || groups[0];
                    imported.push({
                        name: parts[0].trim(),
                        department: parts[1]?.trim() || '未分配部门',
                        groupId: group?.id || groups[0]?.id,
                        status: 'ACTIVE',
                        accessPolicy: 'review'
                    });
                }
            }
            try {
                for (const record of imported) await saveIdentity(record);
                await refresh();
            } catch (error) {
                alert(error?.message || 'CSV 导入失败。');
            } finally {
                setIsImporting(false);
                e.target.value = null; // reset input
            }
        };
        reader.readAsText(file);
    };

    useEffect(() => {
      if (captureState !== 'in_progress' || !captureExpectedId || !session?.token) return undefined;
      let stopped = false;
      const pollCapture = async () => {
        try {
          const status = await getCaptureSessionStatus(session.token);
          if (stopped) return;
          const disposition = captureStatusDisposition(status, captureExpectedId);
          if (disposition === 'ignore') return;
          setCaptureStatusNotice('');
          setCaptureStatus(status);
          if (disposition === 'done') {
            captureStopSentRef.current = true;
            setCaptureResult(status?.result || null);
            setCaptureState('done');
            await refresh();
          } else if (disposition === 'rejected') {
            captureStopSentRef.current = true;
            setCaptureResult(status?.result || { quality_status: 'REJECTED', failure_reason: status?.error || '采集未通过质量验证' });
            setCaptureState('rejected');
            await refresh();
          }
        } catch {
          if (!stopped) {
            setCaptureStatusNotice('状态连接暂时中断，系统正在自动重试；请勿重复开始采集。');
          }
        }
      };
      pollCapture();
      const pollTimer = window.setInterval(pollCapture, 1000);
      return () => {
        stopped = true;
        window.clearInterval(pollTimer);
      };
  }, [captureExpectedId, captureState, refresh, session?.token]);

  const cancelCapture = async () => {
    if (captureState !== 'in_progress' || captureStopSentRef.current) return;
    captureStopSentRef.current = true;
    setCaptureState('stopping');
    setCaptureStatusNotice('');
    try {
      const status = session?.token ? await stopCaptureSession(session.token) : null;
      setCaptureStatus(status);
      setCaptureResult(status?.result || { quality_status: 'REJECTED', failure_reason: 'operator_cancelled' });
      setCaptureState(captureStatusDisposition(status, captureExpectedId) === 'done' ? 'done' : 'rejected');
      await refresh();
    } catch {
      captureStopSentRef.current = false;
      setCaptureStatusNotice('中断请求尚未确认，系统仍在跟踪本组采集；可再次中断。');
      setCaptureState('in_progress');
    }
  };

  const closeEnrollment = () => {
    if (captureState === 'starting' || captureState === 'in_progress' || captureState === 'stopping') return;
    setIsEnrolling(false);
  };

  const handleCaptureStart = async () => {
    const target = pendingIdentity || selectedIdentity;
    if (!target?.id || !session?.token || captureStartPendingRef.current || captureState !== 'idle') return;
    captureStartPendingRef.current = true;
    captureStopSentRef.current = false;
    setCaptureTargetId(target.id);
    setCaptureState('starting');
    setCaptureResult(null);
    setCaptureStatus(null);
    setCaptureExpectedId('');
    setCaptureStartError('');
    setCaptureStatusNotice('');
    try {
      const started = await startCaptureSession(session.token, {
        personnelId: target.id,
        durationS: 10,
        audibleCountdownS: 3,
        confirmHardwareStart: true,
        consentConfirmed: true
      });
      const startedCaptureId = String(started?.capture_id || started?.result?.capture_id || '');
      if (!startedCaptureId) throw new Error('capture id missing');
      setCaptureExpectedId(startedCaptureId);
      setCaptureStatus(started);
      setCaptureState('in_progress');
    } catch (error) {
      let current = null;
      try {
        current = await getCaptureSessionStatus(session.token);
      } catch {
        current = null;
      }
      if (canAdoptCaptureSession(current, target.id)) {
        setCaptureExpectedId(String(current.capture_id || current.result?.capture_id || ''));
        setCaptureStatus(current);
        setCaptureStatusNotice('已恢复当前采集会话。');
        setCaptureState('in_progress');
      } else {
        setCaptureState('idle');
        setCaptureStartError(captureStartFailureMessage(error));
      }
    } finally {
      captureStartPendingRef.current = false;
    }
  };

    const handleNotImplemented = (featureName) => {
      alert(`[${featureName}]：该功能目前为锁定状态，仅在完整系统部署后开放使用。`);
    };

  // 综合过滤逻辑 (人员列表)
  const filteredIdentities = identities.filter(id => {
    if (activeTab === 'queue' && id.enrollment !== 'INCOMPLETE' && id.enrollment !== 'RECAPTURE') {
       return false;
    }
    const matchSearch = id.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        id.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        id.department.toLowerCase().includes(searchQuery.toLowerCase());

    const matchAttention = (activeTab === 'all' && filterAttention) ? (id.enrollment !== 'READY' || id.status === 'SUSPENDED') : true;

    const matchDept = selectedDeptFilter === '全部部门' || id.department === selectedDeptFilter;
    const matchStatus = selectedStatusFilter === '全部录入状态' || id.enrollment === selectedStatusFilter;
    const matchScope = selectedScopeFilter === '全部门禁范围' || id.groupId === selectedScopeFilter;

    return matchSearch && matchAttention && matchDept && matchStatus && matchScope;
  });

  const activeCaptureIdentity = identities.find((item) => item.id === captureTargetId)
    || pendingIdentity
    || selectedIdentity;
  const activeCaptureCatalogPerson = (captureCatalog?.people || []).find(
    (item) => String(item.id) === String(activeCaptureIdentity?.id)
  );
  const captureProgressState = captureProgress(captureStatus || {});
  const captureError = normalizeCaptureError(captureStatus || { result: captureResult || {} });
  const captureBusy = captureState === 'starting' || captureState === 'in_progress' || captureState === 'stopping';

  return (
    <div className="w-full h-full bg-background flex flex-col overflow-hidden animate-page-fade relative">

      {/* 导入进度遮罩 */}
      {isImporting && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm">
           <div className="bg-surface-primary p-6 border border-divider shadow-2xl rounded text-center">
             <div className="text-[14px] font-mono font-bold text-primary animate-pulse">正在导入 CSV 数据...</div>
           </div>
        </div>
      )}

      {/* 1. 精简集成的页面头部 (Header & Tabs) */}
      <div className="px-6 lg:px-8 pt-6 pb-0 bg-surface-primary flex flex-col flex-shrink-0">
         <div className="flex justify-between items-end mb-5">
            <div>
               <div className="text-[10px] font-mono text-brand mb-1.5 tracking-widest uppercase">Identities</div>
               <h1 className="text-[24px] font-sans font-medium text-primary tracking-tight leading-none mb-2">人员管理</h1>
               <p className="text-[13px] text-secondary">管理人员身份、生物特征录入及门禁通行权限。</p>
            </div>
         </div>

         <div className="flex justify-between items-center border-b border-divider">
            <div className="flex space-x-8 text-[14px] font-medium">
               <button
                  onClick={() => { setActiveTab('all'); setSelectedIdentity(null); setSelectedGroup(null); }}
                  className={`pb-3 transition-colors ${activeTab === 'all' ? 'border-b-2 border-brand text-primary' : 'border-b-2 border-transparent text-secondary hover:text-primary'}`}
               >
                  所有人员
               </button>
               <button
                  onClick={() => { setActiveTab('groups'); setSelectedIdentity(null); setSelectedGroup(null); }}
                  className={`pb-3 transition-colors ${activeTab === 'groups' ? 'border-b-2 border-brand text-primary' : 'border-b-2 border-transparent text-secondary hover:text-primary'}`}
               >
                  权限组
               </button>
               <button
                  onClick={() => { setActiveTab('queue'); setSelectedIdentity(null); setSelectedGroup(null); }}
                  className={`pb-3 transition-colors flex items-center ${activeTab === 'queue' ? 'border-b-2 border-brand text-primary' : 'border-b-2 border-transparent text-secondary hover:text-primary'}`}
               >
                  录入队列
                  {queueCount > 0 && (
                     <span className={`ml-2 px-1.5 py-0.5 rounded-sm text-[10px] font-mono leading-none ${activeTab === 'queue' ? 'bg-brand text-white' : 'bg-status-tracking text-white'}`}>
                        {queueCount}
                     </span>
                  )}
               </button>
            </div>

            <div className="text-[11px] md:text-[12px] font-mono text-secondary pb-3 hidden sm:block">
               <span className="mr-2 opacity-60">TOTAL /</span>
               <span className="text-primary font-bold">{identities.length} IDENTITIES</span>
            </div>
         </div>
      </div>

      {/* 2. 重构的轻量化工具栏 (Command Bar) */}
      {activeTab !== 'groups' && (
         <div className="min-h-[56px] h-auto px-6 lg:px-8 py-3 bg-surface-primary border-b border-divider flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 flex-shrink-0">
            <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 sm:w-auto sm:space-x-5 sm:gap-0">
               {/* Search Box - 无边框融合设计 */}
               <div className="relative flex min-w-0 basis-full items-center group sm:basis-auto">
                  <svg className="w-4 h-4 text-secondary group-focus-within:text-brand transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="搜索姓名、身份 ID 或部门…"
                    className="w-full sm:w-[240px] ml-2 bg-transparent text-[13px] border-none focus:outline-none focus:ring-0 text-primary placeholder:text-secondary/50 font-sans"
                  />
               </div>

               <div className="hidden sm:block w-[1px] h-4 bg-divider"></div>

               {/* Filter Chip - Needs Attention */}
               {activeTab === 'all' && (
                  <button
                     onClick={() => setFilterAttention(!filterAttention)}
                      className={`h-6 px-2.5 rounded text-[11px] font-medium flex items-center whitespace-nowrap transition-colors ${filterAttention ? 'bg-status-tracking/15 text-status-tracking' : 'bg-transparent text-secondary hover:bg-surface-secondary hover:text-primary'}`}
                  >
                     <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${filterAttention ? 'bg-status-tracking' : 'bg-divider'}`}></span>
                     需关注异常
                     {attentionCount > 0 && <span className="ml-1.5 font-mono">{attentionCount}</span>}
                  </button>
               )}

               {/* Text-based filters */}
               <div className="relative group">
                  <select
                     value={selectedDeptFilter}
                     onChange={e => setSelectedDeptFilter(e.target.value)}
                      className="appearance-none bg-transparent text-[12px] font-medium text-secondary hover:text-primary transition-colors pr-4 focus:outline-none cursor-pointer z-10 relative whitespace-nowrap"
                  >
                     <option>全部部门</option>
 {departments.map((department) => <option key={department}>{department}</option>)}
                  </select>
                  <svg className="w-3 h-3 opacity-50 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none group-hover:text-primary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
               </div>

               <div className="relative group">
                  <select
                     value={selectedStatusFilter}
                     onChange={e => setSelectedStatusFilter(e.target.value)}
                      className="appearance-none bg-transparent text-[12px] font-medium text-secondary hover:text-primary transition-colors pr-4 focus:outline-none cursor-pointer z-10 relative whitespace-nowrap"
                  >
                     <option>全部录入状态</option>
                     <option>READY</option>
                     <option>RECAPTURE</option>
                     <option>INCOMPLETE</option>
                  </select>
                  <svg className="w-3 h-3 opacity-50 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none group-hover:text-primary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
               </div>

               <div className="relative group">
                  <select
                     value={selectedScopeFilter}
                     onChange={e => setSelectedScopeFilter(e.target.value)}
                      className="appearance-none bg-transparent text-[12px] font-medium text-secondary hover:text-primary transition-colors pr-4 focus:outline-none cursor-pointer z-10 relative whitespace-nowrap"
                  >
                     {/* Mapped Scope Filters */}
<option value="全部门禁范围">全部门禁范围</option>
{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                  <svg className="w-3 h-3 opacity-50 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none group-hover:text-primary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
               </div>
            </div>

            <div className="flex w-full items-center justify-end gap-4 sm:w-auto sm:space-x-4 sm:gap-0">
               <button onClick={() => document.getElementById('csv-upload-input').click()} className="whitespace-nowrap text-[13px] font-medium text-secondary hover:text-primary transition-colors">
    批量导入 (CSV)
 </button>
 <input type="file" id="csv-upload-input" accept=".csv" style={{ display: 'none' }} onChange={handleCsvUpload} />
               <button onClick={startNewEnroll} className="h-8 px-4 bg-brand-dark text-white rounded-sm text-[13px] font-medium hover:opacity-90 flex items-center whitespace-nowrap transition-opacity shadow-sm">
                  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                  录入新人员
               </button>
            </div>
         </div>
      )}

      {/* 3. 主视图区域 */}
      <div className="flex-1 overflow-y-auto bg-surface-primary relative">
         <div className="w-full min-w-0">

            {/* --- 视图 A: 人员列表 --- */}
            {(activeTab === 'all' || activeTab === 'queue') && (
               <>
                   <div className="hidden sm:flex px-6 lg:px-8 py-3 border-b border-divider text-[12px] font-sans font-medium text-secondary tracking-wide uppercase bg-surface-primary sticky top-0 z-10">
                     <div className="w-[10%]">身份状态</div>
                     <div className="w-[12%]">身份ID</div>
                     <div className="w-[13%]">姓名</div>
                     <div className="w-[14%]">部门</div>
                     <div className="w-[16%]">录入状态</div>
                     <div className="w-[19%]">门禁范围</div>
                     <div className="w-[16%] text-right">最后活跃</div>
                  </div>

                   <div className="hidden sm:flex flex-col pb-12">
                     {filteredIdentities.length === 0 ? (
                        <div className="px-8 py-12 text-center text-secondary text-[13px]">
                           {activeTab === 'queue' ? '录入队列为空。' : '没有找到记录。'}
                        </div>
                     ) : (
                        filteredIdentities.map((identity) => (
                           <div
                             key={identity.id}
                             onClick={() => setSelectedIdentity(identity)}
                             className={`flex px-6 lg:px-8 h-[52px] items-center border-b border-divider cursor-pointer transition-colors ${selectedIdentity?.id === identity.id ? 'bg-[#F0F2EF] border-l-2 border-l-brand' : 'hover:bg-surface-secondary/50 border-l-2 border-l-transparent'}`}
                           >
                              <div className="w-[10%] flex items-center gap-2 pl-1">
                                 <div className={`w-1.5 h-1.5 rounded-full ${getEffectiveStatus(identity) === 'ACTIVE' ? 'bg-[#2F806E]' : 'bg-[#B65B5B]'}`}></div>
                                 <span className={`text-[11px] font-mono font-medium tracking-widest uppercase ${getEffectiveStatus(identity) === 'ACTIVE' ? 'text-primary' : 'text-secondary'}`}>
                                    {getEffectiveStatus(identity)}
                                 </span>
                              </div>
                              <div className="w-[12%] text-[12px] font-mono text-secondary">{identity.id}</div>
                              <div className="w-[13%] text-[14px] font-medium text-primary">{identity.name}</div>
                              <div className="w-[14%] text-[13px] text-secondary">{identity.department}</div>
                              <div className="w-[16%]">
                                 <span className={`text-[11px] font-mono uppercase tracking-wider ${
                                    identity.enrollment === 'READY' ? 'text-primary' :
                                    identity.enrollment === 'INCOMPLETE' ? 'text-[#AA843B]/80' : 'text-[#AA843B]/80'
                                 }`}>
                                    {identity.enrollment}
                                 </span>
                              </div>
                              <div className="w-[19%]">
                                 {identity.enrollment === 'INCOMPLETE' ? (
                                    <span className="text-[11px] font-mono text-status-tracking/70 tracking-widest uppercase">Pending</span>
                                 ) : (
                                    <span className="text-[13px] text-primary">{groups.find(g => g.id === identity.groupId)?.name}</span>
                                 )}
                              </div>
                              <div className="w-[16%] text-[12px] font-mono text-secondary text-right">
                                 {getLastActivity(identity.name) === '--' ? '—' : getLastActivity(identity.name)}
                              </div>
                           </div>
                        ))
                      )}
                   </div>
                   <div data-mobile-identity-list className="sm:hidden flex flex-col gap-3 p-4 pb-12">
                      {filteredIdentities.length === 0 ? (
                         <div className="px-4 py-12 text-center text-secondary text-[13px]">
                            {activeTab === 'queue' ? '录入队列为空。' : '没有找到记录。'}
                         </div>
                      ) : (
                         filteredIdentities.map((identity) => (
                            <button
                              key={identity.id}
                              type="button"
                              data-mobile-identity-card
                              onClick={() => setSelectedIdentity(identity)}
                              className={`w-full rounded-sm border p-4 text-left transition-colors ${selectedIdentity?.id === identity.id ? 'border-brand bg-[#F0F2EF]' : 'border-divider bg-surface-primary hover:bg-surface-secondary/50'}`}
                            >
                               <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                     <div className="flex items-center gap-2">
                                        <div className={`w-1.5 h-1.5 flex-shrink-0 rounded-full ${getEffectiveStatus(identity) === 'ACTIVE' ? 'bg-[#2F806E]' : 'bg-[#B65B5B]'}`}></div>
                                        <span className={`text-[10px] font-mono font-medium tracking-widest uppercase ${getEffectiveStatus(identity) === 'ACTIVE' ? 'text-primary' : 'text-secondary'}`}>
                                           {getEffectiveStatus(identity)}
                                        </span>
                                     </div>
                                     <div className="mt-2 flex min-w-0 items-baseline gap-2">
                                        <span className="truncate text-[15px] font-medium text-primary">{identity.name}</span>
                                        <span className="flex-shrink-0 text-[11px] font-mono text-secondary">{identity.id}</span>
                                     </div>
                                  </div>
                                  <span className={`flex-shrink-0 text-[10px] font-mono uppercase tracking-wider ${identity.enrollment === 'READY' ? 'text-primary' : 'text-[#AA843B]/80'}`}>
                                     {identity.enrollment}
                                  </span>
                               </div>
                               <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-divider pt-3 text-[12px]">
                                  <div className="min-w-0">
                                     <div className="text-[10px] font-mono uppercase tracking-wider text-secondary/70">部门</div>
                                     <div className="mt-1 truncate text-secondary">{identity.department || '—'}</div>
                                  </div>
                                  <div className="min-w-0">
                                     <div className="text-[10px] font-mono uppercase tracking-wider text-secondary/70">门禁范围</div>
                                     <div className="mt-1 break-words text-primary">{identity.enrollment === 'INCOMPLETE' ? '待采集' : (groups.find(g => g.id === identity.groupId)?.name || '—')}</div>
                                  </div>
                                  <div className="min-w-0">
                                     <div className="text-[10px] font-mono uppercase tracking-wider text-secondary/70">最后活跃</div>
                                     <div className="mt-1 font-mono text-secondary">{getLastActivity(identity.name) === '--' ? '—' : getLastActivity(identity.name)}</div>
                                  </div>
                               </div>
                            </button>
                         ))
                      )}
                   </div>
                </>
            )}

            {/* --- 视图 B: 权限组列表 --- */}
            {activeTab === 'groups' && (
               <>
                  <div className="grid grid-cols-12 gap-4 px-6 lg:px-8 py-3 border-b border-divider text-[12px] font-sans font-medium text-secondary tracking-wide uppercase bg-surface-primary sticky top-0 z-10">
                     <div className="col-span-2">组ID</div>
                     <div className="col-span-2">名称</div>
                     <div className="col-span-2">安全级别</div>
                     <div className="col-span-4">描述</div>
                     <div className="col-span-2 text-right">已关联人员数</div>
                  </div>
                  <div className="flex flex-col">
                     {groups.map(group => {
                        const memberCount = identities.filter(id => group.id === id.groupId).length;
                        return (
                           <div key={group.id} className="grid grid-cols-12 gap-4 px-6 lg:px-8 h-[56px] items-center border-b border-divider hover:bg-surface-secondary/50 transition-colors group cursor-pointer" onClick={() => setSelectedGroup(group)}>
                              <div className="col-span-2 text-[12px] font-mono text-secondary">{group.id}</div>
                              <div className="col-span-2 text-[14px] font-medium text-primary">{group.name}</div>
                              <div className="col-span-2">
                                 <span className={`inline-block px-2 py-0.5 border rounded-sm text-[10px] font-mono uppercase tracking-wider ${
                                    group.level === 'HIGH' ? 'text-status-denied bg-status-denied/10 border-status-denied/20' :
                                    group.level === 'MEDIUM' ? 'text-status-tracking bg-status-tracking/10 border-status-tracking/20' :
                                    'text-brand bg-brand/10 border-brand/20'
                                 }`}>{group.level}</span>
                              </div>
                              <div className="col-span-4 text-[13px] text-secondary truncate">{group.desc}</div>
                              <div className="col-span-2 text-right text-[13px] font-mono text-primary">{memberCount}</div>
                           </div>
                        );
                     })}
                  </div>
               </>
            )}
         </div>
      </div>

      {/* 4. 右侧悬浮抽屉 (Side Drawer) */}
      {selectedIdentity && activeTab !== 'groups' && (
         <>
             <div className="absolute inset-0 bg-black/5 z-40 animate-[fadeIn_0.2s_ease-out]" onClick={() => setSelectedIdentity(null)}></div>
             <div className="absolute top-0 right-0 w-full sm:w-[420px] h-full bg-surface-primary border-l border-divider shadow-2xl z-50 animate-slide-in-right flex flex-col">

               {/* Header */}
               <div className="h-[76px] px-8 border-b border-divider flex items-center justify-between bg-surface-secondary flex-shrink-0">
                  <div>
                     <div className="text-[18px] font-medium text-primary leading-none mb-1">{selectedIdentity.name}</div>
                     <div className="text-[11px] font-mono text-secondary">{selectedIdentity.id}</div>
                  </div>
                  <button onClick={() => setSelectedIdentity(null)} className="p-2 text-secondary hover:text-primary transition-colors rounded-sm hover:bg-divider/50">
                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                  </button>
               </div>

               {/* Content */}
               <div className="flex-1 overflow-y-auto p-8 space-y-8">

                  {/* IDENTITY */}
                  <section>
                     <h3 className="text-[12px] font-sans font-medium text-secondary uppercase mb-4">身份信息 (Identity)</h3>
                     <div className="space-y-3 text-[13px]">
                         <div className="flex justify-between border-b border-divider pb-2">
                            <span className="text-secondary">归属部门</span>
                            <select
                               value={selectedIdentity.department}
                               onChange={(e) => {
                                  const department = e.target.value;
                                  saveIdentity({ ...selectedIdentity, department })
                                    .then(setSelectedIdentity)
                                    .catch(error => alert(error?.message || '更新部门失败。'));
                               }}
                               className="max-w-[190px] bg-transparent text-right font-medium text-primary border-none focus:outline-none cursor-pointer"
                            >
                               {!departmentOptions.includes(selectedIdentity.department) && <option value={selectedIdentity.department}>{selectedIdentity.department}</option>}
 {departments.map((department) => <option key={department} value={department}>{department}</option>)}
                            </select>
                         </div>
                        <div className="flex justify-between border-b border-divider pb-2">
                           <span className="text-secondary">权限状态</span>
                           <span className={`font-medium ${getEffectiveStatus(selectedIdentity) === 'ACTIVE' ? 'text-primary' : (selectedIdentity.enrollment === 'INCOMPLETE' ? 'text-status-tracking' : 'text-status-denied')}`}>
                              {getEffectiveStatus(selectedIdentity) === 'ACTIVE' ? '正常 (Active)' : (selectedIdentity.enrollment === 'INCOMPLETE' ? '未激活 (Not Active)' : '已冻结 (Suspended)')}
                           </span>
                        </div>
                        <div className="flex justify-between border-b border-divider pb-2">
                           <span className="text-secondary">创建时间</span>
                           <span className="text-primary">{selectedIdentity.createdTime}</span>
                        </div>
                     </div>
                  </section>

                  {/* GAIT ENROLLMENT */}
                  <section>
                     <h3 className="text-[12px] font-sans font-medium text-secondary uppercase mb-4">步态特征 (Gait Enrollment)</h3>
                     <div className="space-y-3 text-[13px]">
                        <div className="flex justify-between border-b border-divider pb-2">
                           <span className="text-secondary">Baseline Capture</span>
                           <span className={`font-mono font-bold ${selectedIdentity.enrollment === 'READY' ? 'text-[#2F806E]' : 'text-[#AA843B]/80'}`}>
                              {selectedIdentity.enrollment === 'READY' ? 'READY' : 'INCOMPLETE'}
                           </span>
                        </div>
                        <div className="flex justify-between border-b border-divider pb-2">
                           <span className="text-secondary">Multi-state</span>
                           <span className="font-mono text-primary">{selectedIdentity.enrollment === 'READY' ? 'Research assisted' : '—'}</span>
                        </div>
                        <div className="flex justify-between border-b border-divider pb-2">
                           <span className="text-secondary">Last capture</span>
                           <span className="font-mono text-primary">{selectedIdentity.gaitLastCapturedAt ? String(selectedIdentity.gaitLastCapturedAt).slice(0, 10) : '—'}</span>
                        </div>
                     </div>
                  </section>

                  {/* ACCESS */}
                  <section>
                     <h3 className="text-[12px] font-sans font-medium text-secondary uppercase mb-4">门禁授权 (Access)</h3>
                     <div className="p-4 bg-surface-secondary border border-divider rounded-sm">
                        <div className="font-medium text-[13px] text-primary mb-2">
                           {selectedIdentity.enrollment === 'INCOMPLETE' ? (
                              <span className="font-mono text-status-tracking/80 tracking-widest uppercase">PENDING ACTIVATION</span>
                           ) : (
                              <div className="relative">
                                 <select
                                    value={selectedIdentity.groupId}
                                    onChange={(e) => {
                                       const newScope = e.target.value;
                                       const updated = { ...selectedIdentity, groupId: newScope };
                                       saveIdentity({ ...selectedIdentity, groupId: newScope })
                                         .then(setSelectedIdentity)
                                         .catch(error => alert(error?.message || '更新门禁范围失败。'));
                                    }}
                                    className="w-full h-9 px-3 bg-surface-primary border border-divider rounded-sm text-[13px] focus:outline-none focus:border-brand appearance-none hover:border-brand transition-colors cursor-pointer"
                                 >
                                    {groups.map(g => (
                                       <option key={g.id} value={g.id}>{g.name}</option>
                                    ))}
                                 </select>
                                 <svg className="w-4 h-4 text-secondary absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 9l-7 7-7-7"></path></svg>
                              </div>
                           )}
                        </div>
                        <div className="text-[11px] text-secondary">
                           {getEffectiveStatus(selectedIdentity) === 'SUSPENDED'
                              ? '该身份的门禁权限已被系统或管理员冻结。'
                              : (selectedIdentity.enrollment === 'INCOMPLETE'
                                 ? '缺乏有效的步态特征基线，门禁权限暂未生效。'
                                 : '正在应用所选权限组的标准门禁通行策略。')}
                        </div>
                     </div>
                  </section>

                  {/* ACTIVITY */}
                  <section>
                     <h3 className="text-[12px] font-sans font-medium text-secondary uppercase mb-4">活动记录 (Activity)</h3>
                     <div className="text-[12px] text-secondary italic">
                        {getLastActivity(selectedIdentity.name) !== '--' ? `最后活跃于今日 ${getLastActivity(selectedIdentity.name)}。` : '暂无近期活动记录。'}
                     </div>
                  </section>

               </div>

               <div className="p-6 border-t border-divider bg-surface-secondary flex-shrink-0 space-y-3">
                  <button onClick={startReenroll} className="w-full h-9 bg-surface-primary border border-divider text-primary rounded-sm text-[13px] font-medium hover:border-brand transition-colors">
                     补充采集特征
                  </button>
                  <div className="flex space-x-3">
                     <button onClick={() => {
                        const newName = prompt('修改姓名:', selectedIdentity.name);
                        if (newName) {
                           saveIdentity({ ...selectedIdentity, name: newName })
                             .then(setSelectedIdentity)
                             .catch(error => alert(error?.message || '更新姓名失败。'));
                        }
                     }} className="flex-1 h-9 border border-divider bg-surface-primary text-secondary rounded-sm text-[13px] font-medium hover:text-primary transition-colors">
                        编辑资料
                     </button>
                     <button
                        onClick={toggleSuspend}
                        className={`flex-1 h-9 border border-divider text-secondary rounded-sm text-[13px] font-medium transition-colors ${getEffectiveStatus(selectedIdentity) === 'SUSPENDED' ? 'bg-surface-primary hover:text-status-auth' : 'bg-surface-primary hover:text-status-tracking'}`}
                     >
                        {getEffectiveStatus(selectedIdentity) === 'SUSPENDED' ? '解冻权限' : '冻结权限'}
                     </button>
                  </div>
                  <button
                     onClick={() => {
                        if (window.confirm(`确定要永久删除 ${selectedIdentity.name} 的所有记录吗？此操作无法撤销。`)) {
                           removeIdentity(selectedIdentity.id)
                             .then(() => setSelectedIdentity(null))
                             .catch(error => alert(error?.message || '删除人员记录失败。'));
                        }
                     }}
                     className="w-full h-9 border border-status-denied/30 text-status-denied bg-status-denied/5 hover:bg-status-denied/10 hover:border-status-denied/50 rounded-sm text-[13px] font-medium transition-colors mt-2"
                  >
                     删除人员记录
                  </button>
               </div>
            </div>
         </>
      )}

      {/* 4.5 权限组 Drawer */}
      {selectedGroup && (
         <>
            <div className="absolute inset-0 bg-black/5 z-40 animate-[fadeIn_0.2s_ease-out]" onClick={() => setSelectedGroup(null)}></div>
             <div className="absolute top-0 right-0 h-full w-full sm:w-[400px] bg-surface-primary border-l border-divider shadow-2xl animate-slide-in-right z-50 flex flex-col">

               <div className="p-6 border-b border-divider flex justify-between items-start bg-surface-secondary shrink-0">
                  <div>
                     <div className="text-[11px] font-mono text-brand mb-1 tracking-widest uppercase">GROUP RECORD</div>
                     <h2 className="text-[20px] font-medium text-primary tracking-tight mb-1">{selectedGroup.name}</h2>
                     <div className="text-[12px] font-mono text-secondary">{selectedGroup.id}</div>
                  </div>
                  <button onClick={() => setSelectedGroup(null)} className="p-2 text-secondary hover:text-primary transition-colors rounded-sm hover:bg-divider/50">
                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                  </button>
               </div>

               <div className="flex-1 overflow-y-auto p-6 space-y-8">
                  <section>
                     <h3 className="text-[12px] font-sans font-medium text-secondary uppercase mb-4">基本属性 (Properties)</h3>
                     <div className="space-y-3 text-[13px]">
                        <div className="flex justify-between border-b border-divider pb-2">
                           <span className="text-secondary">门禁范围</span>
                           <span className="font-medium text-primary">{selectedGroup.zones.join(", ")}</span>
                        </div>
                        <div className="flex justify-between border-b border-divider pb-2">
                           <span className="text-secondary">安全等级</span>
                           <span className={`font-mono uppercase tracking-wider ${selectedGroup.level === 'HIGH' ? 'text-status-denied' : selectedGroup.level === 'MEDIUM' ? 'text-status-tracking' : 'text-primary'}`}>{selectedGroup.level}</span>
                        </div>
                        <div className="flex flex-col border-b border-divider pb-2">
                           <span className="text-secondary mb-2">描述说明</span>
                           <span className="text-primary leading-relaxed">{selectedGroup.desc}</span>
                        </div>
                     </div>
                  </section>

                  <section>
                     <h3 className="text-[12px] font-sans font-medium text-secondary uppercase mb-4 flex items-center justify-between">
                        <span>关联人员 (Members)</span>
                        <span className="font-mono bg-surface-secondary px-2 py-0.5 rounded-sm">{identities.filter(id => id.groupId === selectedGroup.id).length}</span>
                     </h3>
                     <div className="space-y-2">
                        {identities.filter(id => id.groupId === selectedGroup.id).map(member => (
                           <div key={member.id} className="flex justify-between items-center p-3 bg-surface-secondary border border-divider rounded-sm">
                              <div className="flex flex-col">
                                 <span className="text-[13px] font-medium text-primary">{member.name}</span>
                                 <span className="text-[11px] font-mono text-secondary mt-0.5">{member.id}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                 <div className={`w-1.5 h-1.5 rounded-full ${member.status === 'ACTIVE' ? 'bg-[#2F806E]' : 'bg-[#B65B5B]'}`}></div>
                                 <span className="text-[11px] font-mono text-secondary">{member.department}</span>
                              </div>
                           </div>
                        ))}
                        {identities.filter(id => id.groupId === selectedGroup.id).length === 0 && (
                           <div className="text-[12px] text-secondary italic py-4 text-center bg-surface-secondary border border-divider rounded-sm">
                              该权限组当前未绑定任何人员。
                           </div>
                        )}
                     </div>
                  </section>
               </div>

               <div className="p-6 border-t border-divider bg-surface-secondary flex-shrink-0 space-y-3">

                  <button
                     onClick={() => {
                        if (window.confirm(`确定要永久删除 ${selectedGroup.name} 吗？\n警告：组内关联人员将失去对应的门禁通行权限，请谨慎操作。`)) {
                           if (groups.length <= 1) {
                              alert('至少保留一个权限组。');
                              return;
                           }
                           handleNotImplemented('删除权限组');
                        }
                     }}
                     className="w-full h-9 border border-status-denied/30 text-status-denied bg-status-denied/5 hover:bg-status-denied/10 hover:border-status-denied/50 rounded-sm text-[13px] font-medium transition-colors"
                  >
                     删除权限组
                  </button>
               </div>
            </div>
         </>
      )}

      {/* 5. 录入向导 */}
      {isEnrolling && (
         <>
             <div className="absolute inset-0 bg-black/5 z-40 animate-[fadeIn_0.2s_ease-out]" onClick={captureBusy ? undefined : closeEnrollment}></div>
            <div className="absolute top-0 right-0 w-full sm:w-[500px] h-full bg-surface-primary border-l border-divider shadow-2xl z-50 animate-slide-in-right flex flex-col">

               <div className="h-[76px] px-6 border-b border-divider flex items-center justify-between bg-surface-secondary flex-shrink-0">
                  <div>
                     <div className="text-[18px] font-medium text-primary leading-none mb-1">
                        {wizardMode === 'reenroll' ? '补充采集特征' : '录入新人员'}
                     </div>
                     <div className="text-[11px] font-mono text-secondary">Step {enrollStep} of 4</div>
                  </div>
                   <button onClick={closeEnrollment} disabled={captureBusy} aria-label={captureBusy ? '采集结束后关闭' : '关闭录入向导'} className="p-2 text-secondary hover:text-primary transition-colors rounded-sm hover:bg-divider/50 disabled:opacity-40 disabled:cursor-not-allowed">
                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                  </button>
               </div>

               <div className="flex-1 overflow-y-auto p-6 flex flex-col">
                  <div className="flex items-center space-x-2 mb-8">
                     {[1, 2, 3, 4].map(step => (
                        <div key={step} className={`h-1 flex-1 rounded-full ${enrollStep >= step ? 'bg-brand' : 'bg-divider'}`}></div>
                     ))}
                  </div>

                  {enrollStep === 1 && (
                     <div className="animate-page-fade space-y-6">
                        <h2 className="text-[16px] font-sans font-medium text-primary tracking-tight mb-2">01. 基础信息</h2>
                        <div className="space-y-4">
                           <div>
                              <label className="block text-[11px] font-mono text-secondary mb-1">姓名 (Name)</label>
                              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full h-9 px-3 bg-surface-secondary border border-divider rounded-sm text-[13px] focus:outline-none focus:border-brand" disabled={wizardMode === 'reenroll'} placeholder="输入人员姓名" />
                           </div>
                           <div>
                              <label className="block text-[11px] font-mono text-secondary mb-1">部门 (Department)</label>
                              <div className="relative">
                                  <select value={departmentOptions.includes(newDept) ? newDept : ''} onChange={(e) => setNewDept(e.target.value)} className="w-full h-9 px-3 bg-surface-secondary border border-divider rounded-sm text-[13px] focus:outline-none focus:border-brand appearance-none" disabled={wizardMode === 'reenroll'}>
                                     <option value="" disabled>请选择部门</option>
 {departments.map((department) => <option key={department} value={department}>{department}</option>)}
                                  </select>
                                  <svg className="w-4 h-4 text-secondary absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 9l-7 7-7-7"></path></svg>
                               </div>
                               <input
                                  type="text"
                                  value={newDept}
                                  onChange={(e) => setNewDept(e.target.value)}
                                  className="w-full h-9 mt-2 px-3 bg-surface-secondary border border-divider rounded-sm text-[13px] focus:outline-none focus:border-brand"
                                  disabled={wizardMode === 'reenroll'}
                                  placeholder="或手动输入新部门"
                               />
                               <button type="button" onClick={() => { setIsAddingDepartment(true); setDepartmentError(''); }} className="mt-2 text-[11px] text-secondary hover:text-primary underline">
                                  新增部门
                               </button>
                               {isAddingDepartment && (
                                  <div className="mt-2 p-3 bg-surface-primary border border-divider rounded-sm space-y-2">
                                     <input type="text" value={departmentDraft} onChange={(e) => setDepartmentDraft(e.target.value)} className="w-full h-8 px-2 bg-surface-secondary border border-divider rounded-sm text-[12px] focus:outline-none focus:border-brand" placeholder="部门名称" autoFocus />
                                     {departmentError && <div className="text-[11px] text-status-denied">{departmentError}</div>}
                                     <div className="flex gap-2">
                                        <button type="button" onClick={handleCreateDepartment} className="h-8 px-3 bg-brand-dark text-white rounded-sm text-[11px]">保存部门</button>
                                        <button type="button" onClick={() => { setIsAddingDepartment(false); setDepartmentDraft(''); setDepartmentError(''); }} className="h-8 px-3 border border-divider text-secondary rounded-sm text-[11px]">取消</button>
                                     </div>
                                  </div>
                               )}
                            </div>
                        </div>
                     </div>
                  )}

                  {enrollStep === 2 && (
                     <div className="animate-page-fade flex flex-col h-full">
                         <h2 className="text-[16px] font-sans font-medium text-primary tracking-tight mb-2">02. 数据采集</h2>
                         <p className="text-[13px] text-secondary mb-6">请指引人员在雷达传感器前行走，以完成步态基线提取。</p>
                         <div className="text-[11px] font-mono text-secondary mb-3">
                            当前已通过质量验证：{activeCaptureCatalogPerson?.validCaptureCount ?? activeCaptureIdentity?.validCaptureCount ?? activeCaptureIdentity?.captures ?? 0} 组
                            <span className="ml-2 text-secondary">本次编号：{activeCaptureCatalogPerson?.nextCaptureId || activeCaptureIdentity?.nextCaptureId || '由服务端生成'}</span>
                         </div>

                        <div className="flex-1 bg-surface-secondary border border-divider rounded-sm p-6 flex flex-col items-center justify-center relative overflow-hidden">
                           {captureState === 'idle' && (
                              <div className="text-center w-full">
                                  <button type="button" onClick={handleCaptureStart} className="h-9 px-6 bg-brand-dark text-white rounded-sm text-[13px] font-medium hover:opacity-90 transition-opacity mb-4">
                                     开始雷达采集
                                  </button>
                                  {captureStartError && <div role="alert" className="text-[11px] text-status-denied mb-3">{captureStartError}</div>}
                                  <div className="block">
                                     <button type="button" onClick={() => { setCaptureState('skipped'); setEnrollStep(3); }} className="text-[11px] text-secondary hover:text-primary underline">暂不采集，直接跳过</button>
                                  </div>
                               </div>
                            )}

                            {captureState === 'starting' && (
                               <div role="status" aria-live="polite" className="text-center">
                                  <div className="text-[14px] font-medium text-primary mb-2">正在建立采集会话…</div>
                                  <div className="text-[11px] text-secondary">正在等待本次采集编号，请勿重复点击。</div>
                               </div>
                            )}

                           {captureState === 'in_progress' && (
                              <div className="w-full max-w-xs space-y-4">
                                 <div className="flex justify-between text-[11px] font-mono text-secondary">
                                     <span>{capturePhaseLabel(captureStatus?.phase || captureStatus?.state)}（{captureProgressState.elapsed.toFixed(1)} / {captureProgressState.target.toFixed(1)} 秒）</span>
                                     <span className="text-status-tracking animate-pulse">{String(captureStatus?.source_mode || captureStatus?.source || 'SOURCE_UNCONFIRMED').toUpperCase()}</span>
                                 </div>
                                 <div className="h-1.5 w-full bg-divider rounded-full overflow-hidden">
                                     <div className="h-full bg-status-tracking animate-pulse" style={{ width: `${captureProgressState.percent}%` }}></div>
                                 </div>
                                 <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[10px] font-mono text-secondary">
                                    <span>数据包 {captureStatus?.packets_received ?? captureStatus?.result?.source_stats?.packets_received ?? captureStatus?.result?.telemetry?.packets_received ?? '—'}</span>
                                    <span>载荷 {captureStatus?.payload_bytes ?? captureStatus?.result?.payload_bytes ?? captureStatus?.result?.telemetry?.payload_bytes ?? '—'} B</span>
                                    <span>队列拒绝 {captureStatus?.result?.recorder_stats?.queue_rejections ?? captureStatus?.result?.telemetry?.queue_rejections ?? '—'}</span>
                                    <span>采集 ID {captureStatus?.capture_id || captureStatus?.result?.capture_id || '—'}</span>
                                  </div>
                                  {captureStatusNotice && <div role="status" className="text-[11px] text-status-tracking">{captureStatusNotice}</div>}
                                  <div className="text-[11px] text-secondary">现场动作：浏览器按钮已确认；取消将安全停止本组，不计入有效采集。</div>
                                  <button type="button" onClick={cancelCapture} className="w-full h-8 border border-divider text-secondary rounded-sm text-[11px] hover:text-primary">
                                     中断本组采集
                                  </button>
                               </div>
                            )}

                            {captureState === 'stopping' && (
                               <div role="status" aria-live="polite" className="text-center">
                                  <div className="text-[14px] font-medium text-primary mb-2">正在安全停止采集…</div>
                                  <div className="text-[11px] text-secondary">正在等待接收与写入任务退出，完成前不能开始下一组。</div>
                               </div>
                            )}

                           {captureState === 'done' && (
                              <div className="text-center">
                                 <div className="w-12 h-12 bg-status-auth/20 text-status-auth rounded-full flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                 </div>
                                 <h3 className="text-[14px] font-bold text-primary mb-1">采集完成</h3>
                                 <div className="text-[11px] text-status-auth mb-2">PASS · 已新增 1 组有效采集</div>
                                 <div className="px-3 py-1.5 bg-surface-primary border border-divider rounded-sm text-[10px] font-mono text-status-auth inline-block">
                                    采集 ID: {captureResult?.capture_id || captureStatus?.capture_id || '—'}
                                 </div>
                                 <div className="mt-4 flex justify-center gap-2">
                                     <button type="button" onClick={async () => { await refresh(); setCaptureState('idle'); setCaptureResult(null); setCaptureStatus(null); setCaptureExpectedId(''); setCaptureStartError(''); setCaptureStatusNotice(''); }} className="h-8 px-3 border border-divider text-secondary rounded-sm text-[11px]">继续采集下一组</button>
                                    <button type="button" onClick={() => setEnrollStep(3)} className="h-8 px-3 bg-brand-dark text-white rounded-sm text-[11px]">结束并保存</button>
                                 </div>
                              </div>
                           )}

                           {captureState === 'rejected' && (
                              <div className="text-center w-full">
                                 <div className="w-12 h-12 bg-status-denied/10 text-status-denied rounded-full flex items-center justify-center mx-auto mb-4">
                                    <span className="text-xl">!</span>
                                 </div>
                                 <h3 className="text-[14px] font-bold text-status-denied mb-1">采集未通过</h3>
                                 <div className="text-[11px] text-status-denied mb-2">{captureError.message}</div>
                                 <div className="text-[10px] font-mono text-secondary mb-1">错误码 {captureError.code} · 阶段 {captureError.phase} · 本次不计有效组数</div>
                                 <div className="text-[10px] font-mono text-secondary mb-2">队列拒绝 {captureError.telemetry?.queue_rejections ?? '—'} · 数据包 {captureError.telemetry?.packets_received ?? '—'} · 载荷 {captureError.telemetry?.payload_bytes ?? '—'} B · 采集 ID {captureError.captureId || '—'}</div>
                                 <div className="text-[10px] font-mono text-secondary mb-4">writer_alive {String(captureError.telemetry?.writer_alive ?? '—')} · writer_joined {String(captureError.telemetry?.writer_joined ?? '—')} · 队列容量 {captureError.telemetry?.queue_maxsize ?? '—'}</div>
                                 {captureError.preflight?.checks?.filter((check) => String(check?.status || '').toUpperCase() === 'BLOCKED').map((check) => (
                                   <div key={check.name} className="text-[10px] font-mono text-status-denied mb-1">预检阻断：{check.name} · {check.message}</div>
                                 ))}
                                 <div className="flex justify-center gap-2">
                                     <button type="button" onClick={() => { setCaptureState('idle'); setCaptureResult(null); setCaptureStatus(null); setCaptureExpectedId(''); setCaptureStartError(''); setCaptureStatusNotice(''); captureStopSentRef.current = false; }} className="h-8 px-4 border border-divider text-secondary rounded-sm text-[11px]">使用新编号重试</button>
                                    <button type="button" onClick={() => setEnrollStep(3)} className="h-8 px-4 border border-divider text-secondary rounded-sm text-[11px]">保存未完成档案</button>
                                 </div>
                              </div>
                           )}
                        </div>
                     </div>
                  )}

                  {enrollStep === 3 && (
                     <div className="animate-page-fade space-y-6">
                        <h2 className="text-[16px] font-sans font-medium text-primary tracking-tight mb-2">03. 校验与核查</h2>
                         {captureState !== 'done' ? (
                            <div className="bg-surface-secondary border border-divider rounded-sm p-6 text-center text-[13px] text-secondary">
                               未获取生物特征数据。当前状态将被标记为 INCOMPLETE。
                            </div>
                        ) : (
                           <div className="bg-surface-secondary border border-divider rounded-sm p-4 space-y-3 text-[13px]">
                              <div className="flex justify-between border-b border-divider pb-2">
                                 <span className="text-secondary">覆盖率</span>
                                 <span className="font-mono text-status-auth">{captureResult?.coverage_percent == null ? '—' : `${captureResult.coverage_percent}%`}</span>
                              </div>
                              <div className="flex justify-between border-b border-divider pb-2">
                                 <span className="text-secondary">可用特征段</span>
                                 <span className="font-mono text-primary">{captureResult?.valid_segments == null ? '—' : captureResult.valid_segments}</span>
                              </div>
                              <div className="flex justify-between border-b border-divider pb-2">
                                 <span className="text-secondary">特征库状态</span>
                                 <span className="font-mono text-status-auth font-bold">READY</span>
                              </div>
                           </div>
                        )}
                     </div>
                  )}

                  {enrollStep === 4 && (
                     <div className="animate-page-fade space-y-6">
                        <h2 className="text-[16px] font-sans font-medium text-primary tracking-tight mb-2">04. 权限分配</h2>
                         {captureState !== 'done' && (
                           <div className="p-4 bg-status-tracking/5 border border-status-tracking/20 text-status-tracking text-[13px] rounded-sm leading-relaxed">
                              ⚠️ 缺乏步态生物特征。<br/>
                              身份档案已保存，但在补充特征前，门禁权限将保持 <strong>NOT ACTIVE</strong>。
                           </div>
                        )}
                           <div className="space-y-4">
                              <div>
                                 <label className="block text-[11px] font-mono text-secondary mb-1">主通行区 (Access Scope)</label>
                                 <div className="relative">
                                    <select value={newScope} onChange={(e) => setNewScope(e.target.value)} className="w-full h-9 px-3 bg-surface-secondary border border-divider rounded-sm text-[13px] focus:outline-none focus:border-brand appearance-none">
                                       <option value="" disabled>请选择权限组</option>
{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                    </select>
                                    <svg className="w-4 h-4 text-secondary absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 9l-7 7-7-7"></path></svg>
                                 </div>
                              </div>
                              <div>
                                 <label className="block text-[11px] font-mono text-secondary mb-1">门禁时效 (Validity Period)</label>
                                 <div className="relative">
                                    <select value={newExpiration} onChange={(e) => setNewExpiration(e.target.value)} className="w-full h-9 px-3 bg-surface-secondary border border-divider rounded-sm text-[13px] focus:outline-none focus:border-brand appearance-none">
                                       <option value="永久 (Permanent)">永久 (Permanent)</option>
                                       <option value="24小时 (Temporary)">24小时 (Temporary)</option>
                                       <option value="7天 (Visitor)">7天 (Visitor)</option>
                                       <option value="30天 (Contractor)">30天 (Contractor)</option>
                                    </select>
                                    <svg className="w-4 h-4 text-secondary absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 9l-7 7-7-7"></path></svg>
                                 </div>
                              </div>
                           </div>
                     </div>
                  )}

               </div>

               <div className="p-6 border-t border-divider bg-surface-secondary flex-shrink-0 flex justify-between">
                  <button
                     onClick={() => setEnrollStep(Math.max(1, enrollStep - 1))}
                      disabled={enrollStep === (wizardMode === 'reenroll' ? 2 : 1) || captureBusy}
                     className="h-9 px-4 border border-divider bg-surface-primary text-secondary rounded-sm text-[13px] font-medium hover:text-primary disabled:opacity-50 transition-colors"
                  >
                     上一步
                  </button>
                  <button
                     onClick={async () => {
                         if (enrollStep === 2 && captureState !== 'done' && captureState !== 'skipped' && captureState !== 'rejected') return;
                        if (enrollStep === 1 && wizardMode === 'new') {
                            if (!newName.trim() || !newDept.trim()) {
                               alert('请填写姓名和部门。');
                               return;
                            }
                           try {
                              const created = await saveIdentity({
                                 name: newName.trim(),
                                 department: newDept,
                                 groupId: newScope,
                                 status: 'ACTIVE',
                                 accessPolicy: 'review'
                              });
                              setPendingIdentity(created);
                              setCaptureTargetId(created.id);
                              setEnrollStep(2);
                           } catch (error) {
                              alert(error?.message || '人员档案创建失败。');
                           }
                        } else if (enrollStep === 4) handleEnrollFinish();
                        else setEnrollStep(enrollStep + 1);
                     }}
                      disabled={enrollStep === 2 && captureState !== 'done' && captureState !== 'skipped' && captureState !== 'rejected'}
                     className="h-9 px-6 bg-brand-dark text-white rounded-sm text-[13px] font-medium hover:opacity-90 disabled:opacity-50 disabled:bg-secondary transition-colors"
                  >
                     {enrollStep === 4 ? '下发权限' : '下一步'}
                  </button>
               </div>
            </div>
         </>
      )}
    </div>
  );
};

export default IdentitiesPage;
