import React, { useEffect } from 'react';
import Hero from '../components/Hero';
import ProblemSection from '../components/ProblemSection';
import TechnologySection from '../components/TechnologySection';
import ApplicationSection from '../components/ApplicationSection';
import Footer from '../components/Footer';

const LandingPage = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="w-full flex flex-col items-center overflow-x-hidden animate-page-fade">
      <Hero />
      <ProblemSection />
      <TechnologySection />
      <ApplicationSection />
      <Footer />
    </div>
  );
};

export default LandingPage;
