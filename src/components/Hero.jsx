import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const Hero = () => {
  const navigate = useNavigate();

  return (
    <section className="w-full relative min-h-[90vh] lg:min-h-[720px] flex flex-col justify-start bg-background overflow-hidden">

      {/* Full Bleed Background Image */}
      <div className="absolute inset-0 w-full h-full z-0">
        <img
          src="/hospital_corridor_2.png"
          alt="Controlled Hospital Environment"
          className="w-full h-full object-cover object-bottom grayscale-[15%]"
        />
        {/* Gradient Fade (Left) */}
        <div className="absolute inset-0 bg-gradient-to-r from-background from-35% via-background/90 via-50% to-transparent"></div>
        {/* Mobile gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent md:hidden"></div>

        {/* NEW: Gradient Fade for Right Rail Legibility */}
        <div className="absolute inset-y-0 right-0 w-[40%] bg-gradient-to-l from-white/70 via-white/20 to-transparent hidden lg:block z-0 pointer-events-none"></div>
      </div>

      {/* Technical Annotations Rail (Right side, desktop only) */}
      <div className="absolute top-[18%] right-[1%] xl:right-[2%] hidden lg:flex flex-col space-y-7 z-20 w-[300px]">

        <div className="flex flex-col w-full border-b border-black/10 pb-5 relative hover:z-30 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-[1.06] hover:-translate-x-2 bg-transparent hover:bg-white/60 hover:px-4 hover:-ml-4 rounded-[4px]">
          <span className="text-[12px] font-mono text-brand mb-1.5 font-bold tracking-widest">01 / SENSE</span>
          <span className="text-[13px] font-mono text-slate-900 font-bold tracking-widest uppercase">CONTINUOUS SENSING</span>
          <span className="text-[14px] text-slate-700 font-medium mt-1">毫米波连续感知</span>
        </div>

        <div className="flex flex-col w-full border-b border-black/10 pb-5 relative hover:z-30 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-[1.06] hover:-translate-x-2 bg-transparent hover:bg-white/60 hover:px-4 hover:-ml-4 rounded-[4px]">
          <span className="text-[12px] font-mono text-brand mb-1.5 font-bold tracking-widest">02 / REPRESENT</span>
          <span className="text-[13px] font-mono text-slate-900 font-bold tracking-widest uppercase">MICRO-DOPPLER</span>
          <span className="text-[14px] text-slate-700 font-medium mt-1">在线时频表征</span>
        </div>

        <div className="flex flex-col w-full border-b border-black/10 pb-5 relative hover:z-30 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-[1.06] hover:-translate-x-2 bg-transparent hover:bg-white/60 hover:px-4 hover:-ml-4 rounded-[4px]">
          <span className="text-[12px] font-mono text-brand mb-1.5 font-bold tracking-widest">03 / GENERALIZE</span>
          <span className="text-[13px] font-mono text-slate-900 font-bold tracking-widest uppercase">MULTI-STATE GAIT</span>
          <span className="text-[14px] text-slate-700 font-medium mt-1 whitespace-nowrap">多状态步态泛化 (ONGOING RESEARCH)</span>
        </div>

        <div className="flex flex-col w-full border-b border-black/10 pb-5 relative hover:z-30 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-[1.06] hover:-translate-x-2 bg-transparent hover:bg-white/60 hover:px-4 hover:-ml-4 rounded-[4px]">
          <span className="text-[12px] font-mono text-brand mb-1.5 font-bold tracking-widest">04 / DECIDE</span>
          <span className="text-[13px] font-mono text-slate-900 font-bold tracking-widest uppercase">OPEN-SET DECISION</span>
          <span className="text-[14px] text-slate-700 font-medium mt-1">已知识别 / 未知拒识</span>
        </div>

      </div>

      {/* Text Container */}
      <div className="w-full max-w-page mx-auto px-6 lg:px-8 relative z-10 pt-[32px] md:pt-[48px] pb-16 pointer-events-none">
        <div className="w-full max-w-[720px] flex flex-col pointer-events-auto">

          <div className="mb-6 flex flex-col mt-4 md:mt-8">
            <span className="text-[17px] md:text-[20px] font-medium text-primary mb-2 md:whitespace-nowrap">
              非光学感知 · 实时流式识别 · 未知身份拒识 · 多状态泛化
            </span>
            <span className="text-[11px] md:text-[12px] font-mono tracking-widest text-secondary uppercase md:whitespace-nowrap">
              NON-OPTICAL / REAL-TIME / OPEN-SET / MULTI-STATE
            </span>
          </div>

          <h1 className="text-[44px] md:text-[56px] lg:text-[62px] font-[500] text-primary tracking-[-0.02em] leading-[1.05] mb-6">
            基于毫米波雷达的<br/>
            实时开放集步态识别系统
          </h1>

          <p className="text-[16px] md:text-[17px] text-secondary leading-[1.7] max-w-[580px] mb-10">
            系统连续采集人体行走产生的毫米波回波，在线生成微多普勒时频表征，并在自然通行过程中完成身份识别与未知身份拒识。无需采集可见光人脸图像，也无需接触指纹设备或主动出示实体凭证。
          </p>

          <button
            onClick={() => navigate('/live')}
            className="h-[56px] md:h-[60px] w-fit px-[28px] md:px-[32px] bg-[#2F806E] hover:bg-[#1F6758] text-white text-[16px] font-[600] rounded-[2px] transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-[1.06] hover:shadow-[0_8px_30px_rgb(39,111,96,0.3)] active:scale-[0.96] flex items-center justify-center gap-[14px]"
          >
            进入实时系统 <ArrowRight size={18} />
          </button>

        </div>
      </div>
    </section>
  );
};

export default Hero;