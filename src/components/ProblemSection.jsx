import React from 'react';

const ProblemSection = () => {
  return (
    <section className="w-full bg-[#F4F4F1] flex justify-center border-t border-divider">
      <div className="w-full max-w-page flex flex-col lg:flex-row items-stretch">

        {/* Left side: Context Image */}
        <div className="w-full lg:w-[40%] flex items-center justify-center px-6 lg:pl-10 lg:pr-8 py-10 lg:py-14">
          <div className="relative w-full h-full min-h-[400px] max-w-[440px] overflow-hidden rounded-[2px] grayscale-[40%] opacity-85 shadow-sm">
            <img
              src="/Phase 3.png"
              alt="Controlled Access Environment"
              className="absolute inset-0 w-full h-full object-cover object-[left_center]"
            />
            <div className="absolute inset-0 bg-primary/5 mix-blend-multiply"></div>
          </div>
        </div>

        {/* Right side: The Argument Narrative */}
        <div className="w-full lg:w-[60%] flex flex-col justify-center px-6 lg:pl-4 lg:pr-10 py-10 lg:py-10">

          <span className="text-[12px] uppercase tracking-[0.15em] font-medium text-secondary block mb-2">
            THE AUTHENTICATION GAP
          </span>

          <h2 className="text-[32px] md:text-[38px] leading-[1.3] font-medium text-primary tracking-[-0.01em] mb-3">
            口罩不能随意摘，手套不能随意脱，<br className="hidden md:block" />
            <span className="text-[#2F806E]">但身份确认不能少</span>
          </h2>

          <p className="text-[14px] md:text-[15px] leading-[1.7] text-secondary mb-3">
            在医院检验科、生物安全实验室等高防护区域，口罩、手套和防护装备是工作规范的一部分，人员不适合为了身份认证频繁摘脱。
          </p>

          {/* Editorial Argument List (No Icons) */}
          <div className="flex flex-col w-full">

            {/* FACE */}
            <div className="flex flex-col py-3 border-t border-black/10">
              <span className="text-[11px] font-mono tracking-widest text-brand uppercase mb-1">FACE</span>
              <span className="text-[16px] font-medium text-primary mb-1.5">面部关键区域被遮挡</span>
              <p className="text-[14px] text-secondary leading-[1.6]">
                口罩、面罩与护目镜会遮挡关键面部特征，使依赖可见光面部信息的识别方式受到限制。
              </p>
            </div>

            {/* FINGERPRINT */}
            <div className="flex flex-col py-3 border-t border-black/10">
              <span className="text-[11px] font-mono tracking-widest text-brand uppercase mb-1">FINGERPRINT</span>
              <span className="text-[16px] font-medium text-primary mb-1.5">手套不能为了认证反复摘</span>
              <p className="text-[14px] text-secondary leading-[1.6]">
                手套本身就是防护流程的一部分。为了指纹认证反复摘脱手套，不仅增加额外操作，也增加了不必要的接触。
              </p>
            </div>

            {/* ACCESS CARD */}
            <div className="flex flex-col py-3 border-t border-b border-black/10">
              <span className="text-[11px] font-mono tracking-widest text-brand uppercase mb-1">ACCESS CARD</span>
              <span className="text-[16px] font-medium text-primary mb-1.5">门禁卡只能验卡，不能验人</span>
              <p className="text-[14px] text-secondary leading-[1.6]">
                刷卡只能确认“这张凭证有权限”，无法直接确认持卡人与授权身份一致，仍存在借用、遗失或代刷风险。
              </p>
            </div>

          </div>

          {/* Big Conclusion */}
          <div className="mt-5 mb-3">
            <h3 className="text-[22px] md:text-[26px] font-medium text-primary leading-[1.5] tracking-tight">
              高安全区域真正要确认的，<br />
              不只是“有没有权限”，而是“<span className="text-[#2F806E] font-semibold">来的人是不是本人</span>”。
            </h3>
          </div>

          {/* Light Transition */}
          <div className="flex items-start gap-4 text-brand mt-1">
             <div className="w-[30px] h-[1px] bg-brand/40 mt-[11px] shrink-0"></div>
             <p className="text-[14px] md:text-[15px] font-medium tracking-wide leading-[1.6] opacity-90">
               所以，我们换一种思路：不让人停下来配合机器，而是在自然行走中完成身份判别。
             </p>
          </div>

        </div>
      </div>
    </section>
  );
};

export default ProblemSection;
