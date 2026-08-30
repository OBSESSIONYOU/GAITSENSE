import React from 'react';

const TechnologySection = () => {
  const assetBase = import.meta.env.BASE_URL;

  return (
    <section className="w-full bg-[#EFF1EE] flex flex-col items-center py-8 md:py-10 border-t border-divider">

      {/* A: Header */}
      <div className="w-full max-w-page px-6 lg:px-8 mx-auto flex flex-col md:flex-row justify-between items-start md:items-end mb-4 md:mb-6 gap-4">
        <div className="flex flex-col">
          <span className="text-[11px] uppercase tracking-[0.15em] font-medium text-secondary mb-2">
            HOW IT WORKS
          </span>
          <h2 className="text-[28px] md:text-[34px] xl:text-[38px] font-medium text-primary leading-[1.2] tracking-[-0.01em]">
            从连续<span className="text-[#2F806E] font-semibold">行走</span>中，提取可识别的<span className="text-[#2F806E] font-semibold">身份特征</span>
          </h2>
        </div>
        <div className="shrink-0 pb-1">
          <p className="text-[13px] md:text-[14px] leading-[1.6] text-secondary text-left md:text-right md:border-r-[2px] border-brand/40 md:pr-4 md:whitespace-nowrap">
            从连续感知到开放集判定，整条处理链在线运行
          </p>
        </div>
      </div>

      {/* B: Main Visual (Extremely Height-Capped for 1 Viewport) */}
      <div className="w-full max-w-page px-6 lg:px-8 mx-auto relative z-10 mb-6 md:mb-8">
        <div className="w-full relative overflow-hidden bg-[#E8EAE7]">
          <img
            src={`${assetBase}Phase 4.png`}
            alt="System Engineering Context"
            className="w-full h-[260px] md:h-[320px] lg:h-[340px] object-cover object-[center_60%]"
          />

          {/* Minimal Engineering Annotations */}
          <div className="absolute top-[12%] left-[11.5%] -translate-x-1/2 flex flex-col items-center z-20">
            <div className="bg-[#FAFAF8]/90 backdrop-blur-sm px-2.5 py-1.5 rounded-[3px] flex flex-col items-center">
              <div className="flex items-center gap-1.5 text-[10px] font-mono tracking-widest text-black">
                <span className="text-[#2F806E] font-bold">01</span><span className="text-black/30">/</span><span className="font-bold">SENSE</span>
              </div>
              <span className="text-[12px] font-medium text-black/80 mt-0.5 tracking-wide">毫米波连续感知</span>
            </div>
            <div className="w-[1px] h-[30px] bg-black/20"></div>
          </div>

          <div className="absolute top-[35%] left-[26%] -translate-x-1/2 flex flex-col items-center z-20">
            <div className="bg-[#FAFAF8]/90 backdrop-blur-sm px-2.5 py-1.5 rounded-[3px] flex flex-col items-center">
              <div className="flex items-center gap-1.5 text-[10px] font-mono tracking-widest text-black">
                <span className="text-[#2F806E] font-bold">02</span><span className="text-black/30">/</span><span className="font-bold">REPRESENT</span>
              </div>
              <span className="text-[12px] font-medium text-black/80 mt-0.5 tracking-wide">在线时频表征</span>
            </div>
            <div className="w-[1px] h-[30px] bg-black/20"></div>
          </div>

          <div className="absolute top-[20%] left-[54.5%] -translate-x-1/2 flex flex-col items-center z-20">
            <div className="bg-[#FAFAF8]/90 backdrop-blur-sm px-2.5 py-1.5 rounded-[3px] flex flex-col items-center">
              <div className="flex items-center gap-1.5 text-[10px] font-mono tracking-widest text-black">
                <span className="text-[#2F806E] font-bold">03</span><span className="text-black/30">/</span><span className="font-bold">RECOGNIZE</span>
              </div>
              <span className="text-[12px] font-medium text-black/80 mt-0.5 tracking-wide">多状态步态识别</span>
            </div>
            <div className="w-[1px] h-[40px] bg-black/20"></div>
          </div>

          <div className="absolute top-[48%] left-[88%] -translate-x-1/2 flex flex-col items-center z-20">
            <div className="bg-[#FAFAF8]/90 backdrop-blur-sm px-2.5 py-1.5 rounded-[3px] flex flex-col items-center text-center">
              <div className="flex items-center gap-1.5 text-[10px] font-mono tracking-widest text-black">
                <span className="text-[#2F806E] font-bold">04</span><span className="text-black/30">/</span><span className="font-bold">DECIDE</span>
              </div>
              <span className="text-[12px] font-medium text-black/80 mt-0.5 tracking-wide">已知识别 / 未知身份拒识</span>
            </div>
            <div className="w-[1px] h-[30px] bg-black/20"></div>
          </div>

          {/* Silhouette State Labels (Raw text, no pill shapes) */}
          <div className="absolute bottom-[8%] left-[11.5%] -translate-x-1/2 z-20">
            <span className="text-[10px] md:text-[11px] font-mono font-medium text-black/60 tracking-widest uppercase">BACKPACK</span>
          </div>
          <div className="absolute bottom-[8%] left-[26%] -translate-x-1/2 z-20">
            <span className="text-[10px] md:text-[11px] font-mono font-medium text-black/60 tracking-widest uppercase">HANDBAG</span>
          </div>
          <div className="absolute bottom-[8%] left-[37.5%] -translate-x-1/2 z-20">
            <span className="text-[10px] md:text-[11px] font-mono font-medium text-black/60 tracking-widest uppercase">PHONE</span>
          </div>
          <div className="absolute bottom-[8%] left-[54.5%] -translate-x-1/2 z-20">
            <span className="text-[10px] md:text-[11px] font-mono font-medium text-black/60 tracking-widest uppercase">NORMAL</span>
          </div>
        </div>
      </div>

      {/* C: Technical Explanation (Unified 2x2 Grid) */}
      <div className="w-full max-w-page px-6 lg:px-8 mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 lg:gap-x-16 gap-y-4 md:gap-y-5">

          <div className="flex flex-col">
            <div className="text-[11px] font-mono text-primary mb-0.5 tracking-widest">
              <span className="text-[#2F806E] font-bold pr-1">01</span> / SENSE
            </div>
            <div className="text-[15px] font-bold text-primary mb-1">连续雷达采集</div>
            <p className="text-[13px] md:text-[14px] text-secondary leading-[1.5] xl:whitespace-nowrap">
              毫米波雷达持续接收人体行走回波，为在线处理提供连续运动信息。
            </p>
          </div>

          <div className="flex flex-col">
            <div className="text-[11px] font-mono text-primary mb-0.5 tracking-widest">
              <span className="text-[#2F806E] font-bold pr-1">02</span> / REPRESENT
            </div>
            <div className="text-[15px] font-bold text-primary mb-1">在线微多普勒表征</div>
            <p className="text-[13px] md:text-[14px] text-secondary leading-[1.5] xl:whitespace-nowrap">
              对连续回波进行时频处理，形成描述人体运动节律的微多普勒表征。
            </p>
          </div>

          <div className="flex flex-col">
            <div className="text-[11px] font-mono text-primary mb-0.5 tracking-widest">
              <span className="text-[#2F806E] font-bold pr-1">03</span> / RECOGNIZE
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-1">
              <div className="text-[15px] font-bold text-primary">多状态步态识别</div>
              <div className="flex items-center gap-1.5 text-[10px] font-mono">
                <span className="bg-black/5 text-primary/70 px-1.5 py-0.5 rounded-[2px]">基础步态采集</span>
                <span className="text-black/30">→</span>
                <span className="bg-[#2F806E]/10 text-[#2F806E] font-bold px-1.5 py-0.5 rounded-[2px]">多状态适应</span>
              </div>
            </div>
            <p className="text-[13px] md:text-[14px] text-secondary leading-[1.5] xl:whitespace-nowrap">
              基于预训练识别网络提取身份相关特征，并面向背包、提包、持物等状态变化进行跨状态步态适应研究。
            </p>
          </div>

          <div className="flex flex-col">
            <div className="text-[11px] font-mono text-primary mb-0.5 tracking-widest">
              <span className="text-[#2F806E] font-bold pr-1">04</span> / DECIDE
            </div>
            <div className="text-[15px] font-bold text-primary mb-1">未知身份拒识</div>
            <p className="text-[13px] md:text-[14px] text-secondary leading-[1.5] xl:whitespace-nowrap">
              在身份分类之外增加未知身份评分与阈值判定，对未注册人员输出 Unknown，而不是强制归入某个已知身份。
            </p>
          </div>

        </div>
      </div>

    </section>
  );
};

export default TechnologySection;
