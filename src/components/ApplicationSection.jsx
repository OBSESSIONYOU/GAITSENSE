import React, { useState } from 'react';

const scenarios = [
  {
    id: '01',
    shortTitle: '医院检验科',
    title: '医院检验科与防疫科',
    en: 'HOSPITAL LABORATORIES',
    subtitle: '防护装备长期佩戴',
    img: '/scenarios/01.png',
    desc: '口罩、手套与面罩是工作流程的一部分，使人脸和接触式认证受到限制。步态识别可以在不增加额外摘脱动作的情况下完成身份判断。'
  },
  {
    id: '02',
    shortTitle: '生物安全',
    title: 'P3 / P4 生物安全实验室',
    en: 'BIOSAFETY FACILITIES',
    subtitle: '减少受控区域内的额外交互',
    img: '/scenarios/02.png',
    desc: '核心区与缓冲区强调严格隔离和低接触操作。非接触身份感知可以减少人员与认证设备、实体凭证之间不必要的交互。'
  },
  {
    id: '03',
    shortTitle: '洁净车间',
    title: '医药与芯片洁净车间',
    en: 'INDUSTRIAL CLEANROOMS',
    subtitle: '减少对洁净流程的干扰',
    img: '/scenarios/03.png',
    desc: '高洁净度生产环境要求人员动作和接触尽可能克制。以自然行走完成身份感知，可减少停留、触碰和额外认证动作。'
  },
  {
    id: '04',
    shortTitle: '高隐私区域',
    title: '高隐私受控区域',
    en: 'HIGH-PRIVACY ZONES',
    subtitle: '不依赖可见光人脸图像',
    img: '/scenarios/04.png',
    desc: '毫米波雷达利用人体运动回波进行身份判断，不依赖可见光人脸图像，适用于对光学监控较为敏感的受控空间。'
  }
];

const ApplicationSection = () => {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <section className="w-full bg-[#FFFFFF] flex flex-col relative border-t border-divider pt-16 md:pt-24 pb-20 md:pb-32">

      {/* Heading */}
      <div className="w-full max-w-page px-6 lg:px-8 mx-auto mb-8 md:mb-12 z-10">
        <span className="text-[11px] uppercase tracking-[0.15em] font-medium text-secondary block mb-4 md:mb-6">
          APPLICATION SCENARIOS
        </span>
        <h2 className="text-[28px] md:text-[36px] xl:text-[42px] leading-[1.3] font-medium text-primary tracking-[-0.01em]">
          越是受限的环境，越需要确认身份
        </h2>
      </div>

      {/* Accordion Gallery */}
      <div className="w-full max-w-page px-6 lg:px-8 mx-auto h-[600px] md:h-[480px] flex flex-col md:flex-row gap-2 md:gap-3 z-10">
        {scenarios.map((item, index) => {
          const isActive = activeIndex === index;

          return (
            <div
              key={item.id}

              onClick={() => setActiveIndex(index)}
              className={`group relative overflow-hidden transition-all duration-[500ms] ease-[cubic-bezier(0.25,1,0.5,1)] rounded-[4px] bg-[#111] ${
                isActive
                  ? 'flex-[4] md:flex-[5] cursor-default'
                  : 'flex-[1] md:flex-[1.2] cursor-pointer hover:brightness-110'
              }`}
            >
              {/* Background Image */}
              <img
                src={item.img}
                alt={item.title}
                className={`absolute inset-0 w-full h-full object-cover transition-all duration-[500ms] ease-[cubic-bezier(0.25,1,0.5,1)] ${
                  isActive
                    ? 'grayscale-0 brightness-100 opacity-100'
                    : 'grayscale-[30%] brightness-[65%] saturate-[70%] opacity-100'
                }`}
              />

              {/* Gradient Overlay */}
              <div className={`absolute bottom-0 left-0 w-full transition-all duration-[500ms] ease-[cubic-bezier(0.25,1,0.5,1)] ${
                isActive
                  ? 'h-[60%] bg-gradient-to-t from-black/90 via-black/40 to-transparent'
                  : 'h-full bg-black/20'
              }`}></div>

              {/* Inactive Content (Short Title) */}
              <div className={`absolute bottom-0 left-0 p-4 md:p-6 flex flex-col transition-opacity duration-300 ${
                isActive ? 'opacity-0 pointer-events-none' : 'opacity-100 delay-200'
              }`}>
                <span className="text-[13px] md:text-[14px] font-mono text-[#2F806E] font-bold mb-1">{item.id}</span>
                <span className="text-[14px] md:text-[15px] font-medium text-white whitespace-nowrap">{item.shortTitle}</span>
              </div>

              {/* Active Content (Full Details) */}
              <div className={`absolute bottom-0 left-0 w-full p-6 md:p-8 flex flex-col transition-opacity duration-300 ${
                isActive ? 'opacity-100 delay-200' : 'opacity-0 pointer-events-none'
              }`}>
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-[16px] md:text-[20px] font-mono text-[#2F806E] font-bold">{item.id}</span>
                  <span className="text-[18px] md:text-[22px] font-medium text-white whitespace-nowrap">{item.title}</span>
                </div>
                <span className="text-[11px] md:text-[12px] font-mono text-white/60 uppercase tracking-widest mb-4 block">
                  {item.en}
                </span>

                <span className="text-[14px] md:text-[15px] font-medium text-white/90 mb-2">
                  {item.subtitle}
                </span>

                <p className="text-[13px] md:text-[14px] text-white/70 leading-[1.6] max-w-[480px]">
                  {item.desc}
                </p>
              </div>

            </div>
          );
        })}
      </div>

    </section>
  );
};

export default ApplicationSection;
