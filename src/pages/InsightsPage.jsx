import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { FACILITY_ZONES, TIME_BUCKETS } from '../data/productionCatalog';
import TrainingReadinessPanel from '../features/training/TrainingReadinessPanel';

const HOURS = TIME_BUCKETS;
const ZONES = FACILITY_ZONES;
const bucketIndex = (time) => {
  const hour = Number.parseInt(String(time || '00:00').split(':')[0], 10);
  return Math.max(0, Math.min(HOURS.length - 1, Math.floor(hour / 2)));
};
const upper = (value) => String(value || '').toUpperCase();

const InsightsPage = () => {
  const { events, captureCatalog, dataError } = useStore();
  const navigate = useNavigate();
  const [selectedZone, setSelectedZone] = useState('全部区域');
  const [selectedSensor, setSelectedSensor] = useState('全部雷达');
  const [selectedEvent, setSelectedEvent] = useState('全部事件');

  // Interaction States
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);
  const [selectedEventRecord, setSelectedEventRecord] = useState(null);

  // Hover States (for tooltips)
  const [hoveredTimeCol, setHoveredTimeCol] = useState(null);
  const [hoveredHeatmap, setHoveredHeatmap] = useState(null);
  const [hoveredException, setHoveredException] = useState(null);

  // Filter events based on dropdowns and cross-filters
  const filteredEvents = events.filter(ev => {
    if (selectedZone !== '全部区域' && ev.zone !== selectedZone) return false;
    if (selectedSensor !== '全部雷达' && (ev.sensorId || ev.sensor) !== selectedSensor) return false;
    if (selectedEvent === '识别未通过' && (ev.accessResult || ev.result) !== 'DENIED') return false;
    if (selectedEvent === 'Unknown Identity' && ev.identityDecision !== 'UNKNOWN') return false;

    // Apply the selected time bucket using the same two-hour catalog as the chart.
    if (selectedTimeSlot) {
       if (bucketIndex(ev.time) !== bucketIndex(selectedTimeSlot)) return false;
    }

    return true;
  });

  const isFiltered = selectedZone !== '全部区域' || selectedSensor !== '全部雷达' || selectedEvent !== '全部事件' || selectedTimeSlot !== null;

  // Derive Matrix dynamically from filtered events
  const derivedMatrix = ZONES.map(zone => {
     const data = HOURS.map(h => ({ auth: 0, denied: 0, unknown: 0 }));
     return { zone, data };
  });

  let summaryAuth = 0;
  let summaryDenied = 0;
  let summaryUnknown = 0;

  filteredEvents.forEach(ev => {
     const bucketIdx = bucketIndex(ev.time);

     const zoneRow = derivedMatrix.find(r => r.zone === ev.zone);
     if (zoneRow) {
        if ((ev.accessResult || ev.result) === 'AUTHORIZED') {
           zoneRow.data[bucketIdx].auth++;
        } else {
           zoneRow.data[bucketIdx].denied++;
           if (ev.identityDecision === 'UNKNOWN') {
              zoneRow.data[bucketIdx].unknown++;
           }
        }
     }
  });

  // Calculate strict summary from filteredEvents
  filteredEvents.forEach(ev => {
     if ((ev.accessResult || ev.result) === 'AUTHORIZED') {
        summaryAuth++;
     } else {
        summaryDenied++;
        if (ev.identityDecision === 'UNKNOWN') {
           summaryUnknown++;
        }
     }
  });

  const summaryTotal = filteredEvents.length;

  // Timeline SVG Generation
  const timeBuckets = Array(HOURS.length).fill(0);
  filteredEvents.forEach(ev => {
     timeBuckets[bucketIndex(ev.time)]++;
  });

  const generateSVGPath = (dataPoints) => {
      const max = Math.max(...dataPoints, 10);
      const points = dataPoints.map((val, i) => {
          const x = (i / (dataPoints.length - 1)) * 1000;
          const y = 95 - ((val / max) * 80);
          return {x, y, val: val};
      });
      let path = `M${points[0].x},${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
          const prev = points[i-1];
          const curr = points[i];
          const cpX = (prev.x + curr.x) / 2;
          path += ` C${cpX},${prev.y} ${cpX},${curr.y} ${curr.x},${curr.y}`;
      }
      return { path, max, points };
  }

  const { path: activePath, max, points: chartPoints } = generateSVGPath(timeBuckets);
  const areaPath = `${activePath} L1000,100 L0,100 Z`;
  const maxY = max;
  const yLabels = [maxY, Math.floor(maxY * 0.66), Math.floor(maxY * 0.33), 0];

  const xLabels = HOURS;

  const lastDenied = filteredEvents.find(ev => (ev.accessResult || ev.result) === 'DENIED');
  const lastUnknown = filteredEvents.find(ev => ev.identityDecision === 'UNKNOWN');
  const deniedX = lastDenied ? (bucketIndex(lastDenied.time) / (HOURS.length - 1)) * 1000 : 0;
  const unknownX = lastUnknown ? (bucketIndex(lastUnknown.time) / (HOURS.length - 1)) * 1000 : 0;

  // Dynamic headers
  let busiestZoneStr = '全部区域';
  let busiestVol = 0;
  derivedMatrix.forEach(row => {
     let vol = 0;
     row.data.forEach(cell => { vol += cell.auth + cell.denied; });
     if (vol > busiestVol) {
         busiestVol = vol;
         busiestZoneStr = row.zone;
     }
  });

  let mostExcZoneStr = '全部区域';
  let mostExcVol = 0;
  derivedMatrix.forEach(row => {
     let vol = 0;
     row.data.forEach(cell => { vol += cell.denied; }); // denied includes unknown
     if (vol > mostExcVol) {
         mostExcVol = vol;
         mostExcZoneStr = row.zone;
     }
  });
  const captureRecords = Array.isArray(captureCatalog?.records) ? captureCatalog.records : [];
  const capturePeople = Array.isArray(captureCatalog?.people) ? captureCatalog.people : [];
  const validCaptureCount = captureRecords.filter(record => upper(record.state) === 'COMPLETED' && upper(record.quality_status) === 'PASS').length;
  const failedCaptureCount = captureRecords.filter(record => upper(record.state) === 'FAILED' || upper(record.quality_status) === 'FAIL').length;
  const trainingEligibleCount = capturePeople.reduce((total, person) => total + (Number(person.trainingEligibleCaptureCount) || 0), 0);
  const enrolledPeopleCount = capturePeople.filter(person => (Number(person.validCaptureCount) || 0) > 0).length;

  return (
    <div className="w-full h-full bg-background flex flex-col overflow-y-auto animate-page-fade relative">

      {/* 1. Header & Global Context */}
      <div className="px-6 lg:px-8 pt-6 pb-3 bg-surface-primary border-b border-divider sticky top-0 z-50 flex-shrink-0">
        <div className="flex justify-between items-start mb-5">
          <div>
            <div className="text-[10px] font-mono text-brand mb-1.5 tracking-widest uppercase">Analytics</div>
            <h1 className="text-[24px] font-sans font-medium text-primary tracking-tight leading-none mb-2">数据统计</h1>
            <p className="text-[13px] text-secondary max-w-xl">汇总识别趋势、区域活跃度与异常判定，支持系统运行回溯与事件排查。</p>
          </div>
          <div className="text-[10px] font-mono text-secondary/70 uppercase tracking-wide">
             DATA SOURCE / SERVER AUDIT + CAPTURE CATALOG
          </div>
        </div>

        {/* Global Filters */}
        <div className="flex items-center space-x-6">

          <div className="flex items-center space-x-6">
             <div className="relative group">
                <select
                  value={selectedZone}
                  onChange={e => setSelectedZone(e.target.value)}
                  className="appearance-none bg-transparent text-[12px] font-medium text-primary hover:text-brand transition-colors pr-4 focus:outline-none cursor-pointer z-10 relative"
                >
                   <option>全部区域</option>
                   <option>P3 核心区</option>
                   <option>洁净区 A</option>
                   <option>防疫科</option>
                   <option>检验科</option>
                   <option>大厅入口</option>
                </select>
                <svg className="w-3 h-3 opacity-50 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none group-hover:text-brand transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
             </div>

             <div className="relative group">
                <select
                  value={selectedSensor}
                  onChange={e => setSelectedSensor(e.target.value)}
                  className="appearance-none bg-transparent text-[12px] font-medium text-primary hover:text-brand transition-colors pr-4 focus:outline-none cursor-pointer z-10 relative"
                >
                   <option>全部雷达</option>
                   <option>RD-01</option>
                   <option>RD-02</option>
                   <option>RD-03</option>
                   <option>RD-04</option>
                   <option>RD-05</option>
                </select>
                <svg className="w-3 h-3 opacity-50 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none group-hover:text-brand transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
             </div>

             <div className="relative group">
                <select
                  value={selectedEvent}
                  onChange={e => setSelectedEvent(e.target.value)}
                  className="appearance-none bg-transparent text-[12px] font-medium text-primary hover:text-brand transition-colors pr-4 focus:outline-none cursor-pointer z-10 relative"
                >
                   <option>全部事件</option>
                   <option>识别未通过</option>
                   <option>Unknown Identity</option>
                </select>
                <svg className="w-3 h-3 opacity-50 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none group-hover:text-brand transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
             </div>
          </div>
        </div>

        {/* Active Cross-Filters Feedback */}
        {isFiltered && (
           <div className="mt-3 pt-3 border-t border-divider flex items-center justify-between text-[11px] font-mono animate-slide-in-right opacity-80">
              <div className="flex items-center gap-2">
                 <span className="text-brand font-bold uppercase tracking-widest">FILTERED /</span>
                 <span className="text-primary">{selectedZone !== '全部区域' ? selectedZone : ''}</span>
                 {selectedZone !== '全部区域' && (selectedSensor !== '全部雷达' || selectedEvent !== '全部事件' || selectedTimeSlot) && <span className="text-divider">·</span>}
                 <span className="text-primary">{selectedSensor !== '全部雷达' ? selectedSensor : ''}</span>
                 {selectedSensor !== '全部雷达' && (selectedEvent !== '全部事件' || selectedTimeSlot) && <span className="text-divider">·</span>}
                 <span className="text-primary">{selectedEvent !== '全部事件' ? selectedEvent.toUpperCase() : ''}</span>
                 {selectedEvent !== '全部事件' && selectedTimeSlot && <span className="text-divider">·</span>}
                 <span className="text-primary">{selectedTimeSlot ? `${selectedTimeSlot}` : ''}</span>
              </div>
              <button
                 onClick={() => { setSelectedZone('全部区域'); setSelectedSensor('全部雷达'); setSelectedEvent('全部事件'); setSelectedTimeSlot(null); }}
                 className="text-secondary hover:text-brand transition-colors uppercase tracking-widest"
              >
                 CLEAR ALL ✕
              </button>
           </div>
        )}
      </div>

       {/* Main Content Body */}
       <div className="px-4 sm:px-6 lg:px-8 py-8 space-y-12 w-full min-w-0 flex-1">
         {/* 01 - Summary */}
         <section>
            <div className="text-[12px] font-mono font-medium text-secondary mb-6 flex items-center">
               <span>01 / 运行概览</span>
            </div>

             <div className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 transition-all duration-300 border-t border-b border-divider">
                <div className="min-w-0 py-4 px-3 sm:px-6 border-r border-b sm:border-b-0 border-divider flex flex-col justify-center">
                   <div className="text-[34px] font-mono text-primary leading-none mb-2">{summaryTotal.toLocaleString()}</div>
                   <div className="break-words text-[11px] font-mono text-secondary uppercase tracking-widest">RECOGNITIONS</div>
                </div>
                <div className="min-w-0 py-4 px-3 sm:px-6 border-b sm:border-b-0 lg:border-r border-divider flex flex-col justify-center">
                   <div className="text-[34px] font-mono text-primary leading-none mb-2">{summaryAuth.toLocaleString()}</div>
                   <div className="break-words text-[11px] font-mono text-secondary uppercase tracking-widest">识别通过</div>
                </div>
                <div
                   className={`min-w-0 py-4 px-3 sm:px-6 border-r border-b sm:border-b-0 border-divider flex flex-col justify-center transition-all cursor-pointer group ${selectedEvent === '识别未通过' ? 'bg-status-denied/5' : 'hover:bg-black/[0.02]'}`}
                   onClick={() => setSelectedEvent(selectedEvent === '识别未通过' ? '全部事件' : '识别未通过')}
                >
                  <div className="text-[34px] font-mono text-[#B65B5B] leading-none mb-2 group-hover:opacity-80 transition-opacity">{summaryDenied.toLocaleString()}</div>
                  <div className="break-words text-[11px] font-mono text-secondary uppercase tracking-widest flex items-center justify-between gap-2">
                      <span>识别未通过</span>
                      <span className={`text-[#B65B5B] transition-opacity ${selectedEvent === '识别未通过' ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'}`}>FILTER →</span>
                   </div>
                </div>
                <div
                   className={`min-w-0 py-4 px-3 sm:px-6 border-b sm:border-b-0 lg:border-r border-divider flex flex-col justify-center transition-all cursor-pointer group ${selectedEvent === 'Unknown Identity' ? 'bg-status-tracking/10' : 'hover:bg-black/[0.02]'}`}
                   onClick={() => setSelectedEvent(selectedEvent === 'Unknown Identity' ? '全部事件' : 'Unknown Identity')}
                >
                  <div className="text-[34px] font-mono text-[#AA843B] leading-none mb-2 group-hover:opacity-80 transition-opacity">{summaryUnknown.toLocaleString()}</div>
                  <div className="break-words text-[11px] font-mono text-secondary uppercase tracking-widest flex items-center justify-between gap-2">
                     <span>UNKNOWN IDENTITIES</span>
                     <span className={`text-[#AA843B] transition-opacity ${selectedEvent === 'Unknown Identity' ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'}`}>FILTER →</span>
                  </div>
                </div>
                  <div className="min-w-0 py-4 px-3 sm:px-6 border-r border-b sm:border-b-0 border-divider flex flex-col justify-center">
                     <div className="text-[18px] font-sans font-medium text-primary leading-none mb-3 mt-1.5">{busiestZoneStr}</div>
                     <div className="break-words text-[11px] font-mono text-secondary uppercase tracking-widest">BUSIEST ZONE</div>
                  </div>
                <div className="min-w-0 py-4 px-3 sm:px-6 flex flex-col justify-center">
                   <div className="text-[18px] font-sans font-medium text-primary leading-none mb-3 mt-1.5">{mostExcZoneStr}</div>
                   <div className="break-words text-[11px] font-mono text-secondary uppercase tracking-widest">MOST EXCEPTIONS</div>
                </div>
            </div>
            <div className="mt-4 grid w-full grid-cols-2 lg:grid-cols-4 border-b border-divider">
               <div className="min-w-0 py-4 px-3 sm:px-6 border-r border-t border-divider">
                  <div className="text-[28px] font-mono text-primary leading-none mb-2">{captureRecords.length.toLocaleString()}</div>
                  <div className="break-words text-[11px] font-mono text-secondary uppercase tracking-widest">采集记录</div>
               </div>
               <div className="min-w-0 py-4 px-3 sm:px-6 border-r border-t border-divider">
                  <div className="text-[28px] font-mono text-[#2F806E] leading-none mb-2">{validCaptureCount.toLocaleString()}</div>
                  <div className="break-words text-[11px] font-mono text-secondary uppercase tracking-widest">PASS 有效采集</div>
               </div>
               <div className="min-w-0 py-4 px-3 sm:px-6 border-r border-t border-divider">
                  <div className="text-[28px] font-mono text-[#B65B5B] leading-none mb-2">{failedCaptureCount.toLocaleString()}</div>
                  <div className="break-words text-[11px] font-mono text-secondary uppercase tracking-widest">FAIL 失败采集</div>
               </div>
               <div className="min-w-0 py-4 px-3 sm:px-6 border-t border-divider">
                  <div className="text-[28px] font-mono text-primary leading-none mb-2">{trainingEligibleCount.toLocaleString()} / {enrolledPeopleCount}</div>
                  <div className="break-words text-[11px] font-mono text-secondary uppercase tracking-widest">训练证据 / 已采人员</div>
               </div>
            </div>
            {dataError && <div role="alert" className="mt-3 text-[11px] text-status-denied">{dataError}</div>}
         </section>

         {/* 02 - Activity Timeline */}
         <section>
            <div className="text-[12px] font-mono font-medium text-secondary mb-6 flex items-center">
               <span>02 / 识别活动与异常时序</span>
            </div>

            <div className="w-full py-4 relative">
               <div className="text-[13px] text-secondary mb-6">查看选定时间范围内的识别流量，并定位未通过与未知身份事件。</div>

               <div className="w-full h-[240px] flex">
                  <div className="w-[30px] flex flex-col justify-between pb-6 text-[9px] font-mono text-secondary/70 text-right pr-2">
                     <span>{yLabels[0]}</span>
                     <span>{yLabels[1]}</span>
                     <span>{yLabels[2]}</span>
                     <span>{yLabels[3]}</span>
                  </div>

                  <div className="flex-1 flex flex-col relative transition-opacity duration-300">
                     <div className="absolute inset-0 pb-6 flex flex-col justify-between z-0 pointer-events-none">
                        <div className="w-full border-b border-divider/40 h-0"></div>
                        <div className="w-full border-b border-divider/40 h-0"></div>
                        <div className="w-full border-b border-divider/40 h-0"></div>
                        <div className="w-full border-b border-divider h-0"></div>
                     </div>

                     <div className="flex-1 relative z-10 w-full h-[100%]">
                        <svg className="absolute inset-0 w-full h-full overflow-visible transition-all duration-500" preserveAspectRatio="none" viewBox="0 0 1000 100">
                           <defs>
                              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                                 <stop offset="0%" stopColor="#2F806E" stopOpacity="0.03" />
                                 <stop offset="100%" stopColor="#2F806E" stopOpacity="0" />
                              </linearGradient>
                           </defs>
                           <path d={areaPath} fill="url(#areaGradient)" className="transition-all duration-500" />
                           <path d={activePath} fill="none" stroke="#111311" strokeWidth="2" className="transition-all duration-500" />

                           {(lastDenied && (selectedEvent === '全部事件' || selectedEvent === '识别未通过')) && (
                                 <g className="cursor-pointer group z-30 relative" onClick={() => lastDenied && setSelectedTimeSlot(TIME_BUCKETS[bucketIndex(lastDenied.time)])}>
                                 <line x1={deniedX} y1="0" x2={deniedX} y2="100" stroke="#B65B5B" strokeWidth="1" strokeDasharray="2,2" className="opacity-40 group-hover:opacity-100 transition-opacity" />
 <polygon points={`${deniedX},8 ${deniedX+4},2 ${deniedX-4},2`} fill="#B65B5B" />
 <text x={deniedX+5} y="10" fill="#B65B5B" fontSize="11" fontFamily="IBM Plex Mono" className="opacity-0 group-hover:opacity-100 transition-opacity">
    未通过 / {lastDenied?.time}
 </text>
                              </g>
                           )}

                           {(lastUnknown && (selectedEvent === '全部事件' || selectedEvent === 'Unknown Identity')) && (
                                 <g className="cursor-pointer group" onClick={() => lastUnknown && setSelectedTimeSlot(TIME_BUCKETS[bucketIndex(lastUnknown.time)])}>
                                 <line x1={unknownX} y1="0" x2={unknownX} y2="100" stroke="#AA843B" strokeWidth="1" strokeDasharray="2,2" className="opacity-40 group-hover:opacity-100 transition-opacity" />
 <polygon points={`${unknownX},8 ${unknownX+4},2 ${unknownX-4},2`} fill="#AA843B" />
 <text x={unknownX+5} y="10" fill="#AA843B" fontSize="11" fontFamily="IBM Plex Mono" className="opacity-0 group-hover:opacity-100 transition-opacity">
    UNKNOWN / {lastUnknown?.time}
 </text>
                              </g>
                           )}
                        </svg>

                        {/* Interactive Crosshair Grid Overlay */}
                        <div className="absolute inset-0 flex z-20">
                           {xLabels.map((time, idx) => {
                              const slotLabel = `${time} - ${xLabels[idx + 1] || '24:00'}`;
                              return (
                                 <div
                                    key={idx}
                                    className="flex-1 relative group cursor-pointer"
                                    onMouseEnter={() => setHoveredTimeCol(idx)}
                                    onMouseLeave={() => setHoveredTimeCol(null)}
                                    onClick={() => setSelectedTimeSlot(selectedTimeSlot === time ? null : time)}
                                 >
                                    <div className={`absolute top-0 bottom-0 left-1/2 w-px -translate-x-1/2 bg-brand transition-opacity ${hoveredTimeCol === idx ? 'opacity-40' : 'opacity-0'}`}></div>

                                    {/* Tooltip */}
                                    {hoveredTimeCol === idx && (
                                       <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-white border border-divider px-3 py-2 text-[11px] font-mono whitespace-nowrap z-30 pointer-events-none shadow-sm flex flex-col gap-1.5">
                                          <div className="text-secondary mb-1 border-b border-divider pb-1.5 font-sans">{slotLabel}</div>
                                          <div className="flex justify-between gap-6">
                                              <span className="text-primary">该时段总量</span>
                                              <span className="text-primary font-bold">{chartPoints[idx]?.val || 0}</span>
                                          </div>
                                       </div>
                                    )}
                                 </div>
                              );
                           })}
                        </div>
                     </div>

                     <div className="h-[24px] mt-2 flex justify-between items-end text-[10px] font-mono text-secondary relative z-10 w-full">
                        {xLabels.map((lbl, idx) => (
                           <span key={idx}>{lbl}</span>
                        ))}
                     </div>
                  </div>
               </div>
            </div>
         </section>

         {/* 03 - Zone & Exception Analysis */}
         <section>
            <div className="text-[12px] font-mono font-medium text-secondary mb-6 flex items-center">
               <span>03 / 区域与异常分析</span>
            </div>

            <div className="flex flex-col lg:flex-row gap-12 py-4">
               {/* Left: Zone Activity Matrix */}
               <div className="flex-[2] overflow-x-auto">
                  <div className="text-[13px] font-sans font-medium text-primary mb-1">区域活跃分布</div>
                  <div className="text-[11px] text-secondary mb-6">各区域在不同时间段内的识别活动强度。</div>

                  <div className="min-w-[400px] flex flex-col">
                     <div className="flex mb-2">
                        <div className="w-[90px] shrink-0"></div>
                        <div className="flex-1 flex gap-1">
                           {HOURS.map((h, i) => (
                              <div key={i} className="flex-1 text-center text-[10px] font-mono text-secondary">{h.split(':')[0]}</div>
                           ))}
                        </div>
                     </div>

                     {derivedMatrix.map((row, i) => {
                        const isZoneActive = selectedZone === '全部区域' || selectedZone === row.zone;
                        // Determine if we should dim this row when another is selected
                        const displayOpacity = isZoneActive ? 'opacity-100' : 'opacity-[0.35]';
                        return (
                           <div className={`flex items-center mb-1 group transition-opacity duration-300 ${displayOpacity}`} key={i}>
                              <div className="w-[90px] shrink-0 text-[12px] text-primary truncate pr-4">{row.zone}</div>
                              <div className="flex-1 flex gap-1 relative">
                                 {row.data.map((cellData, j) => {
                                    const total = cellData.auth + cellData.denied;
                                    const opacity = total === 0 ? 'bg-black/5' :
                                                   total < 20 ? 'bg-brand/20' :
                                                   total < 35 ? 'bg-brand/40' :
                                                   total < 50 ? 'bg-brand/60' :
                                                   total < 60 ? 'bg-brand/80' : 'bg-brand';

                                    const cellTime = HOURS[j];
                                    const isSelected = selectedZone === row.zone && selectedTimeSlot === cellTime;
                                    const tooltipPositionClass = j >= 6 ? 'right-0' : 'left-1/2 -translate-x-1/2';
                                    const verticalPositionClass = i === 0 ? 'top-full mt-2' : 'bottom-full mb-2';

                                    return (
                                       <div
                                          key={j}
                                          className="flex-1 relative group/cell cursor-pointer"
                                          onMouseEnter={() => setHoveredHeatmap(`${i}-${j}`)}
                                          onMouseLeave={() => setHoveredHeatmap(null)}
                                          onClick={() => {
                                             setSelectedZone(isSelected ? '全部区域' : row.zone);
                                             setSelectedTimeSlot(isSelected ? null : cellTime);
                                          }}
                                       >
                                          <div className={`w-full h-6 rounded-[1px] ${opacity} border transition-colors ${isSelected ? 'border-brand' : 'border-black/5 hover:border-brand-dark'}`}></div>

                                          {/* Custom Tooltip */}
                                          {hoveredHeatmap === `${i}-${j}` && (
                                             <div className={`absolute ${verticalPositionClass} ${tooltipPositionClass} bg-white border border-divider px-3 py-2 text-[11px] font-mono whitespace-nowrap z-30 pointer-events-none shadow-sm flex flex-col gap-1.5 w-[140px]`}>
                                                <div className="text-secondary mb-1 border-b border-divider pb-1.5 font-sans">
                                                   {row.zone} <br/>
                                                   <span className="font-mono text-[10px] mt-0.5 inline-block">{cellTime} - {j < HOURS.length - 1 ? HOURS[j+1] : '24:00'}</span>
                                                </div>
                                                <div className="flex justify-between gap-4"><span className="text-primary">识别次数</span><span className="text-primary font-bold">{total}</span></div>
                                                <div className="flex justify-between gap-4"><span className="text-[#2F806E]">已授权</span><span className="text-[#2F806E] font-bold">{cellData.auth}</span></div>
                                                <div className="flex justify-between gap-4 border-t border-divider/40 mt-1 pt-1.5"><span className="text-[#B65B5B]">拒绝</span><span className="text-[#B65B5B] font-bold">{cellData.denied}</span></div>
                                                <div className="flex justify-between gap-4"><span className="text-[#AA843B]">未知</span><span className="text-[#AA843B] font-bold">{cellData.unknown}</span></div>
                                             </div>
                                          )}
                                       </div>
                                    )
                                 })}
                              </div>
                           </div>
                        );
                     })}
                  </div>
               </div>

               {/* Right: Exceptions by Zone */}
               <div className="flex-[1]">
                  <div className="text-[13px] font-sans font-medium text-primary mb-1">异常事件分布</div>
                   <div className="text-[11px] text-secondary mb-6">按区域统计识别未通过与未知身份事件。</div>

                  <div className="flex flex-col space-y-5 relative">
                     {derivedMatrix.map(row => {
                           let denied = 0;
                           let unknown = 0;
                           row.data.forEach((cell, idx) => {
                              if (selectedTimeSlot && HOURS[idx] !== selectedTimeSlot) return;
                              denied += cell.denied;
                              unknown += cell.unknown;
                           });
                           return {
                              zone: row.zone,
                              denied,
                              unknown,
                              val: denied
                           };
                        })
                        .filter(item => item.val > 0)
                        .sort((a, b) => b.val - a.val)
                        .map((item, i, arr) => {
                           const maxVal = arr[0]?.val || 1;
                           item.pct = (item.val / maxVal) * 100;
                           item.color = i === 0 ? 'bg-primary' : i === 1 ? 'bg-primary/70' : i === 2 ? 'bg-primary/50' : 'bg-primary/30';

                           const isSelected = selectedZone === item.zone;
                           const displayOpacity = (selectedZone === '全部区域' || isSelected) ? 'opacity-100' : 'opacity-[0.35]';

                           return (
                           <div
                              key={i}
                              className={`group cursor-pointer transition-opacity duration-300 relative ${displayOpacity}`}
                              onMouseEnter={() => setHoveredException(i)}
                              onMouseLeave={() => setHoveredException(null)}
                              onClick={() => setSelectedZone(isSelected ? '全部区域' : item.zone)}
                           >
                              <div className="flex justify-between text-[12px] mb-1.5">
                                 <span className={`text-primary transition-colors ${isSelected ? 'text-brand font-medium' : ''}`}>{item.zone}</span>
                                 <span className={`font-mono transition-colors ${isSelected ? 'text-brand font-medium' : 'text-secondary'}`}>{item.val}</span>
                              </div>
                              <div className={`h-1.5 w-full rounded-sm overflow-hidden border transition-colors ${isSelected ? 'bg-brand/10 border-brand/30' : 'bg-surface-secondary border-transparent'}`}>
                                 <div className={`h-full rounded-sm transition-all group-hover:brightness-90 ${isSelected ? 'bg-brand' : item.color}`} style={{ width: `${item.pct}%` }}></div>
                              </div>

                              {/* Tooltip */}
                              {hoveredException === i && (
                                 <div className="absolute right-0 bottom-full mb-2 bg-white border border-divider px-3 py-2 text-[11px] font-mono whitespace-nowrap z-30 pointer-events-none shadow-sm flex flex-col gap-1.5 w-[140px]">
                                    <div className="text-secondary mb-1 border-b border-divider pb-1.5 font-sans">{item.zone}</div>
                                    <div className="flex justify-between gap-4"><span className="text-[#B65B5B]">拒绝</span><span className="text-[#B65B5B] font-bold">{item.denied}</span></div>
                                    <div className="flex justify-between gap-4"><span className="text-[#AA843B]">未知</span><span className="text-[#AA843B] font-bold">{item.unknown}</span></div>
                                    <div className="flex justify-between gap-4 border-t border-divider/40 mt-1 pt-1.5"><span className="text-primary">总计</span><span className="text-primary font-bold">{item.val}</span></div>
                                 </div>
                              )}
                           </div>
                        );
                     })}
                       <div className="pt-2">
                          <div className="text-[10px] font-mono text-secondary uppercase">MOST EXCEPTIONS / {mostExcZoneStr} · {mostExcVol}</div>
                       </div>
                  </div>
               </div>
            </div>
         </section>

         {/* 04 - Event Ledger */}
         <section className="pb-16">
            <div className="text-[12px] font-mono font-medium text-secondary mb-2 flex items-center">
               <span>04 / 事件记录</span>
            </div>
             <div className="text-[11px] text-secondary mb-6">按时间回溯身份判定、区域、雷达与识别结果。</div>

            <div className="w-full transition-all duration-300 border-t border-divider mt-4">
               <div className="flex px-2 lg:px-4 py-3 border-b border-divider text-[11px] font-mono text-secondary tracking-widest uppercase">
                  <div className="w-[12%]">TIME</div>
                  <div className="w-[22%]">IDENTITY</div>
                  <div className="w-[24%]">ZONE</div>
                  <div className="w-[16%]">SENSOR</div>
                  <div className="w-[26%] text-right">RESULT</div>
               </div>

               <div className="flex flex-col">
                  {filteredEvents.length === 0 ? (
                     <div className="px-6 py-12 text-center text-[13px] text-secondary">
                        没有符合该筛选条件的事件记录。
                     </div>
                  ) : (
                     filteredEvents.map((ev) => {
                        const displayResult = ev.accessResult || ev.result;
                        const isSelectedRow = selectedEventRecord?.id === ev.id;
                        return (
                           <div
                              key={ev.id}
                              onClick={() => setSelectedEventRecord(ev)}
                              className={`flex px-2 lg:px-4 h-[44px] items-center border-b border-divider cursor-pointer transition-colors ${isSelectedRow ? 'bg-black/[0.04]' : 'hover:bg-black/[0.025]'}`}
                           >
                              <div className="w-[12%] text-[12px] font-mono text-primary">{ev.time}</div>
                              <div className={`w-[22%] text-[13px] font-medium ${ev.identityDecision === 'UNKNOWN' ? 'text-[#B46A1A]' : 'text-primary'}`}>{ev.identityDecision === 'UNKNOWN' ? 'Unknown' : ev.identity}</div>
                              <div className="w-[24%] text-[13px] text-secondary">{ev.zone}</div>
                              <div className="w-[16%] text-[12px] font-mono text-secondary">{ev.sensorId || ev.sensor}</div>
                               <div className="w-[26%] text-right flex justify-end">
                                  <span className={`text-[11px] font-mono tracking-widest uppercase ${
                                     displayResult === 'AUTHORIZED' ? 'text-[#2F806E]' : 'text-[#B65B5B]'
                                  }`}>
                                     {displayResult === 'AUTHORIZED' ? '识别通过' : '识别未通过'}
                                  </span>
                              </div>
                           </div>
                        );
                     })
                  )}
               </div>
            </div>
         </section>
         <TrainingReadinessPanel />
      </div>

      {/* Event Detail Drawer */}
      {selectedEventRecord && (
         <>
            <div className="absolute inset-0 bg-black/5 z-40 animate-[fadeIn_0.2s_ease-out]" onClick={() => setSelectedEventRecord(null)}></div>
            <div className="absolute top-0 right-0 h-full w-[400px] bg-surface-primary border-l border-divider shadow-2xl animate-slide-in-right z-50 flex flex-col">

               <div className="p-6 border-b border-divider flex justify-between items-start bg-surface-secondary shrink-0">
                  <div>
                     <div className="text-[11px] font-mono text-brand mb-1 tracking-widest uppercase">EVENT DETAIL</div>
                     <h2 className="text-[20px] font-mono font-medium text-primary tracking-tight mb-1">{selectedEventRecord.time}</h2>
                     <div className="text-[12px] font-mono text-secondary uppercase tracking-widest">26 AUG 2026</div>
                  </div>
                  <button onClick={() => setSelectedEventRecord(null)} className="p-2 text-secondary hover:text-primary transition-colors rounded-sm hover:bg-divider/50">
                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                  </button>
               </div>

               <div className="flex-1 overflow-y-auto p-6 space-y-8">
                  <section>
                     <div className="space-y-4 text-[13px]">
                        <div className="flex flex-col border-b border-divider pb-3">
                           <span className="text-[11px] font-mono text-secondary uppercase tracking-widest mb-1">{selectedEventRecord.identityDecision === 'UNKNOWN' ? 'UNKNOWN IDENTITY' : selectedEventRecord.identity}</span>
                           <span className={`font-mono font-bold tracking-widest uppercase text-[16px] ${(selectedEventRecord.accessResult || selectedEventRecord.result) === 'AUTHORIZED' ? 'text-[#2F806E]' : 'text-[#B65B5B]'}`}>
                               {(selectedEventRecord.accessResult || selectedEventRecord.result) === 'AUTHORIZED' ? '识别通过' : '识别未通过'}
                           </span>
                        </div>
                        <div className="flex flex-col border-b border-divider pb-3">
                           <span className="text-[11px] font-mono text-secondary uppercase tracking-widest mb-1">ZONE</span>
                           <span className="text-primary font-medium">{selectedEventRecord.zone}</span>
                        </div>
                        <div className="flex flex-col border-b border-divider pb-3">
                           <span className="text-[11px] font-mono text-secondary uppercase tracking-widest mb-1">SENSOR</span>
                           <span className="text-primary font-mono">{selectedEventRecord.sensorId || selectedEventRecord.sensor}</span>
                        </div>
                        <div className="flex flex-col border-b border-divider pb-3">
                           <span className="text-[11px] font-mono text-secondary uppercase tracking-widest mb-1">DECISION</span>
                           <span className="text-primary font-mono">OPEN-SET</span>
                        </div>
                     </div>
                  </section>
               </div>

               {/* Contextual Action Link to Identities Page */}
               {selectedEventRecord.identityDecision !== 'UNKNOWN' && (
                  <div className="p-6 border-t border-divider bg-surface-secondary flex-shrink-0 space-y-3">
                     <button
                        onClick={() => navigate('/identities', { state: { identityId: selectedEventRecord.identity } })}
                        className="w-full h-9 bg-brand border border-brand text-white rounded-sm text-[13px] font-medium hover:bg-brand-dark transition-colors flex items-center justify-center gap-2"
                     >
                        查看人员详情 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                     </button>
                  </div>
               )}
            </div>
         </>
      )}
    </div>
  );
};

export default InsightsPage;
