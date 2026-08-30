import React from 'react';

const Footer = () => {
  return (
    <footer className="w-full bg-[#0A0B0A] text-white pt-16 pb-8 flex flex-col items-center">

      {/* Cinematic Logo Section (Moved from ApplicationSection) */}
      <div className="w-full max-w-page px-6 lg:px-8 mb-16 flex flex-col items-center justify-center">
        <div className="h-[1px] w-12 bg-white/20 mb-8"></div>
        <h3 className="text-[32px] md:text-[42px] font-medium tracking-[0.2em] mb-4 uppercase">
          <span className="text-brand">GAIT</span><span className="text-white">SENSE</span>
        </h3>
        <p className="text-[12px] md:text-[14px] font-mono tracking-[0.3em] uppercase bg-gradient-to-r from-brand to-[#4FD1C5] text-transparent bg-clip-text font-bold">
          Identity in Motion
        </p>
      </div>

      {/* Decorative Corporate Links Grid */}
      <div className="w-full max-w-page px-6 lg:px-8 grid grid-cols-1 md:grid-cols-12 gap-12 md:gap-8 mb-12">

        {/* Left Column: Brand/Legal Placeholder */}
        <div className="col-span-1 md:col-span-4 flex flex-col">
          <div className="text-[18px] font-medium tracking-[0.1em] mb-6 flex items-center">
            <span className="text-brand">GAIT</span><span className="text-white">SENSE</span>
          </div>
          <p className="text-[14px] text-gray-400 leading-relaxed max-w-[280px]">
            面向高防护与高安全环境，基于毫米波雷达与微多普勒特征，实现实时、非接触的开放集步态身份识别。
          </p>
        </div>

        {/* Right Columns: Links */}
        <div className="col-span-1 md:col-span-8 grid grid-cols-2 md:grid-cols-4 gap-8">

          <div className="flex flex-col space-y-4">
            <span className="text-[11px] font-mono uppercase tracking-[0.15em] text-gray-500 mb-2">SYSTEM</span>
            <span className="text-[13px] text-gray-300 hover:text-white transition-colors cursor-pointer">系统概览</span>
            <span className="text-[13px] text-gray-300 hover:text-white transition-colors cursor-pointer">实时感知</span>
            <span className="text-[13px] text-gray-300 hover:text-white transition-colors cursor-pointer">人员管理</span>
            <span className="text-[13px] text-gray-300 hover:text-white transition-colors cursor-pointer">数据统计</span>
          </div>

          <div className="flex flex-col space-y-4">
            <span className="text-[11px] font-mono uppercase tracking-[0.15em] text-gray-500 mb-2">TECHNOLOGY</span>
            <span className="text-[13px] text-gray-300 hover:text-white transition-colors cursor-pointer">毫米波雷达</span>
            <span className="text-[13px] text-gray-300 hover:text-white transition-colors cursor-pointer">微多普勒</span>
            <span className="text-[13px] text-gray-300 hover:text-white transition-colors cursor-pointer">开放集识别</span>
            <span className="text-[13px] text-gray-300 hover:text-white transition-colors cursor-pointer">实验结果</span>
          </div>

          <div className="flex flex-col space-y-4">
            <span className="text-[11px] font-mono uppercase tracking-[0.15em] text-gray-500 mb-2">PROJECT</span>
            <span className="text-[13px] text-gray-300 hover:text-white transition-colors cursor-pointer">项目介绍</span>
            <span className="text-[13px] text-gray-300 hover:text-white transition-colors cursor-pointer">系统架构</span>
            <span className="text-[13px] text-gray-300 hover:text-white transition-colors cursor-pointer">团队成员</span>
            <span className="text-[13px] text-gray-300 hover:text-white transition-colors cursor-pointer">技术文档</span>
          </div>

          <div className="flex flex-col space-y-4">
            <span className="text-[11px] font-mono uppercase tracking-[0.15em] text-gray-500 mb-2">CONTACT</span>
            <span className="text-[13px] text-gray-300">项目负责人: <span className="font-mono">428315424@qq.com</span></span>
            <span className="text-[13px] text-gray-300">技术支持: <span className="font-mono">https://github.com/OBSESSIONYOU/GAITSENSE</span></span>
          </div>

        </div>
      </div>

      {/* Bottom Bar: Copyright & Legal */}
      <div className="w-full max-w-page px-6 lg:px-8 flex justify-center md:justify-start items-center pt-8 border-t border-white/10">
        <div className="text-[11px] font-mono text-gray-500 uppercase tracking-widest">
          © 2026 GAITSENSE · MILLIMETER-WAVE GAIT RECOGNITION
        </div>
      </div>

    </footer>
  );
};

export default Footer;
