import React, { useState, useEffect } from 'react';
import { Award, Users, Globe, CheckCircle, ArrowRight, Sparkles, BookOpen, Trophy } from 'lucide-react';
import { getCourses } from '../../api/courseApi';
import { getCompetitions } from '../../api/competitionApi';
import { getWebsiteSettings, getHeroImages } from '../../api/websiteSettingsApi';
import { resolveFileUrl } from '../../api/fileApi';
import { formatDate } from '../../utils/dateFormatter';
import { useWebsiteSettings } from '../../context/WebsiteSettingsContext';
import SafeImage from '../common/SafeImage';
import PageLoader from '../common/PageLoader';
import HeroCarousel from './HeroCarousel';
import CompetitionRegisterModal from './CompetitionRegisterModal';

export default function HomePage({ setActiveScreen, onOpenEnquire }) {
  const { settings: globalSettings } = useWebsiteSettings();
  const [courses, setCourses] = useState([]);
  const [featuredComp, setFeaturedComp] = useState(null);
  const [activeCompetitions, setActiveCompetitions] = useState([]);
  const [registeringComp, setRegisteringComp] = useState(null);
  const [siteSettings, setSiteSettings] = useState(null);
  const [heroImages, setHeroImages] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [infoModal, setInfoModal] = useState({ isOpen: false, title: '', message: '' });

  const getLifecycleInfo = (comp) => {
    const state = (comp?.lifecycleState || '').toUpperCase();
    if (state === 'UPCOMING') {
      return {
        state: 'UPCOMING',
        badgeText: 'Upcoming Competition',
        badgeClass: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
        badgeCardClass: 'bg-blue-50 text-blue-700 border border-blue-200',
        btnText: 'Upcoming Competition',
        btnClass: 'bg-slate-200 hover:bg-slate-300 text-slate-700 cursor-pointer font-bold shadow',
        onClick: () => {
          const openingTime = comp.regStartAt || comp.regStartDate;
          const msg = openingTime 
            ? `Registration has not opened yet. Please wait for our competition announcement. Registration opens on ${openingTime}.`
            : 'Registration has not opened yet. Please wait for our competition announcement.';
          setInfoModal({ isOpen: true, title: 'Upcoming Competition', message: msg });
        }
      };
    }
    if (state === 'FINISHED') {
      return {
        state: 'FINISHED',
        badgeText: 'Competition Finished',
        badgeClass: 'bg-slate-700/50 text-slate-300 border border-slate-600',
        badgeCardClass: 'bg-slate-100 text-slate-600 border border-slate-200',
        btnText: 'Competition Finished',
        btnClass: 'bg-slate-200 hover:bg-slate-300 text-slate-600 cursor-pointer font-bold shadow',
        onClick: () => {
          setInfoModal({
            isOpen: true,
            title: 'Competition Finished',
            message: 'The competition registration has ended. Thank you for your interest.'
          });
        }
      };
    }
    return {
      state: 'ACTIVE',
      badgeText: 'Active',
      badgeClass: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
      badgeCardClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
      btnText: 'Register Now',
      btnClass: 'bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer shadow',
      onClick: () => setRegisteringComp(comp)
    };
  };

  useEffect(() => {
    async function loadHomeData() {
      setLoadingData(true);
      try {
        const [sRes, cRes, compRes, heroRes] = await Promise.allSettled([
          getWebsiteSettings(),
          getCourses(),
          getCompetitions(),
          getHeroImages()
        ]);

        if (sRes.status === 'fulfilled' && sRes.value?.success && sRes.value?.data) {
          setSiteSettings(sRes.value.data);
        }

        if (cRes.status === 'fulfilled' && cRes.value?.success && Array.isArray(cRes.value?.data)) {
          // Filter ONLY Student courses for Public Landing Page
          const studentCourses = cRes.value.data.filter(c => (c.audience || 'student') === 'student');
          setCourses(studentCourses);
        }

        if (compRes.status === 'fulfilled' && compRes.value?.success && Array.isArray(compRes.value?.data)) {
          const comps = compRes.value.data;
          setActiveCompetitions(comps);
          if (comps.length > 0) {
            setFeaturedComp(comps[0]);
          } else {
            setFeaturedComp(null);
          }
        }

        if (heroRes.status === 'fulfilled' && heroRes.value?.success && Array.isArray(heroRes.value?.data)) {
          setHeroImages(heroRes.value.data);
        }
      } catch (err) {
        console.error('Failed to load homepage data:', err);
      } finally {
        setLoadingData(false);
      }
    }
    loadHomeData();
  }, []);

  const highlights = [
    { title: 'Expert Trainers', desc: 'Certified & passionate educators', icon: Users, color: 'bg-blue-50 text-blue-600' },
    { title: 'Interactive Learning', desc: 'Live small-group online classes', icon: CheckCircle, color: 'bg-emerald-50 text-emerald-600' },
    { title: 'Global Competitions', desc: 'National & international leagues', icon: Globe, color: 'bg-purple-50 text-purple-600' },
    { title: 'Certified Programs', desc: 'Govt. recognized skill certificates', icon: Award, color: 'bg-amber-50 text-amber-600' },
  ];

  const defaultThumbnailFallback = '/assets/course-placeholder.svg';

  const currentSettings = siteSettings || globalSettings;
  const landingContent = currentSettings?.landingPageContent || {
    heroBadge: 'Learn Today. Grow Tomorrow.',
    heroHeading: 'Skills for a Brighter Tomorrow',
    heroDescription: 'Build skills. Boost confidence. Unlock potential through world-class interactive live classes tailored for children aged 5 to 16.',
    heroPrimaryBtnText: 'Explore Courses',
    heroSecondaryBtnText: 'Join a Competition',
    featuresTitle: 'Featured Learning Programs',
    featuresSubtitle: 'Empowering children with lifelong cognitive abilities and practical skills.',
    spotlightTitle: 'National Championship & Competitions Spotlight',
    spotlightSubtitle: 'Participate in nationwide academic showdowns and win certificates and badges.'
  };

  const showCourses = true;

  return (
    <div id="home" className="bg-slate-50 min-h-screen scroll-mt-20">
      {/* HERO SECTION */}
      <HeroCarousel images={heroImages}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center space-x-2 bg-blue-600/30 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-blue-400/40 text-xs font-semibold text-blue-200">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>{landingContent.heroBadge}</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-tight text-white">
                {landingContent.heroHeading}
              </h1>

              <p className="text-slate-200 text-base max-w-xl leading-relaxed">
                {landingContent.heroDescription}
              </p>

              <div className="pt-2 flex flex-wrap items-center gap-4">
                <button
                  onClick={() => setActiveScreen('public-course')}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3.5 rounded-xl font-extrabold text-sm shadow-xl hover:shadow-blue-500/30 transition-all flex items-center space-x-2 group cursor-pointer"
                >
                  <span>{landingContent.heroPrimaryBtnText}</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>

                <button
                  onClick={() => setActiveScreen('public-competition')}
                  className="bg-white/10 hover:bg-white/20 text-white px-7 py-3.5 rounded-xl font-bold text-sm border border-white/30 backdrop-blur-md transition-all cursor-pointer"
                >
                  {landingContent.heroSecondaryBtnText}
                </button>
              </div>
            </div>

          </div>
        </div>
      </HeroCarousel>

      {/* HIGHLIGHT FEATURES GRID */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {highlights.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div 
                key={idx} 
                className="bg-white p-6 rounded-2xl shadow-lg hover:shadow-xl border border-slate-100 transition-all transform hover:-translate-y-1"
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${item.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="font-extrabold text-slate-900 text-base">{item.title}</h3>
                <p className="text-slate-500 text-xs mt-1 leading-relaxed">{item.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* COURSES SECTION - Dynamic Course Thumbnail Handling (Requirement #2 & #3) */}
      {showCourses && (
        <section id="courses" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 scroll-mt-20">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">{landingContent.featuresTitle}</h2>
            <p className="text-slate-500 text-sm mt-2">{landingContent.featuresSubtitle}</p>
          </div>

        {loadingData ? (
          <div className="py-12">
            <PageLoader text="Loading academy courses..." minHeight="min-h-[220px]" />
          </div>
        ) : courses.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center max-w-lg mx-auto shadow-sm">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">No courses available right now</h3>
            <p className="text-sm text-slate-500">We are currently updating our course catalog. Please check back soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {courses.slice(0, 6).map((course) => {
              const courseImg = resolveFileUrl(course.thumbnail || course.videoUrl) || defaultThumbnailFallback;

              return (
                <div key={course.id} className="bg-white rounded-2xl overflow-hidden border border-slate-200/80 shadow-md hover:shadow-xl transition-all group flex flex-col justify-between">
                  <div>
                    <div className="relative h-48 overflow-hidden bg-slate-100">
                      <SafeImage 
                        src={courseImg} 
                        alt={course.title} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        fallbackSrc={defaultThumbnailFallback}
                      />
                    </div>
                    <div className="p-6">
                      <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider">
                        <span className="text-blue-600">{course.duration || '3 Months'} • {course.mode || 'Online'}</span>
                        <span className="text-emerald-600 font-black">
                          {course.price != null && Number(course.price) > 0 ? `₹${Number(course.price).toLocaleString('en-IN')}` : 'Free'}
                        </span>
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 mt-1">{course.title}</h3>
                      <p className="text-slate-500 text-xs mt-2 line-clamp-2">{course.description}</p>
                    </div>
                  </div>
                  <div className="p-6 pt-0 flex items-center justify-between border-t border-slate-100 mt-4">
                    <span className="text-xs font-extrabold text-slate-700">★ {course.rating || '4.9'} ({course.enrolled || 50}+ Students)</span>
                    <button 
                      onClick={() => setActiveScreen('public-course')}
                      className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center space-x-1 cursor-pointer"
                    >
                      <span>View Details</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
      )}

      {/* NATIONAL COMPETITION SPOTLIGHT - Dynamic Sync */}
      {featuredComp && (() => {
        const compTitle = featuredComp.title || featuredComp.name || 'Competition';
        const compFee = Number(featuredComp.registrationFee || 0);
        const featuredCompBanner = featuredComp.bannerUrl || featuredComp.banner ? resolveFileUrl(featuredComp.bannerUrl || featuredComp.banner) : null;
        const featLife = getLifecycleInfo(featuredComp);

        return (
          <section id="competitions" className="bg-slate-900 text-white py-16 scroll-mt-20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              {(landingContent.spotlightTitle || landingContent.spotlightSubtitle) && (
                <div className="mb-6 space-y-1">
                  {landingContent.spotlightTitle && (
                    <span className="text-xs font-black uppercase tracking-wider text-blue-400 block">
                      {landingContent.spotlightTitle}
                    </span>
                  )}
                  {landingContent.spotlightSubtitle && (
                    <p className="text-sm text-slate-400 font-medium">
                      {landingContent.spotlightSubtitle}
                    </p>
                  )}
                </div>
              )}

              <div className="relative h-56 sm:h-72 w-full overflow-hidden rounded-2xl mb-8 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center border border-slate-800 shadow-md">
                {featuredCompBanner ? (
                  <SafeImage
                    src={featuredCompBanner}
                    alt={compTitle}
                    loading="lazy"
                    className="w-full h-full object-cover"
                    fallbackSrc=""
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900 text-slate-500">
                    <Trophy className="w-16 h-16 text-slate-600 mb-2" />
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{compTitle}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider ${featLife.badgeClass}`}>
                    {featLife.badgeText}
                  </span>
                  {featuredComp.category && (
                    <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider">
                      {featuredComp.category}
                    </span>
                  )}
                </div>

                <h2 className="text-3xl font-black">{compTitle}</h2>
                {featuredComp.description && (
                  <p className="text-slate-300 text-sm max-w-xl line-clamp-3">{featuredComp.description}</p>
                )}

                <div className="flex flex-wrap items-center gap-6 text-xs text-slate-300 pt-2">
                  {(featuredComp.regStartDate || featuredComp.regEndDate) && (
                    <div>
                      <strong className="text-blue-300 block text-sm sm:text-base font-bold">
                        {formatDate(featuredComp.regStartDate)}{featuredComp.regEndDate ? ` – ${formatDate(featuredComp.regEndDate)}` : ''}
                      </strong> 
                      Registration Dates
                    </div>
                  )}

                  {(featuredComp.startDate || featuredComp.endDate) && (
                    <div>
                      <strong className="text-white block text-sm sm:text-base font-bold">
                        {formatDate(featuredComp.startDate)}{featuredComp.endDate && featuredComp.endDate !== featuredComp.startDate ? ` – ${formatDate(featuredComp.endDate)}` : ''}
                      </strong> 
                      Competition Dates
                    </div>
                  )}

                  {(featuredComp.startTime || featuredComp.endTime) && (
                    <div>
                      <strong className="text-white block text-sm sm:text-base font-bold">
                        {featuredComp.startTime}{featuredComp.endTime ? ` - ${featuredComp.endTime}` : ''}
                      </strong> 
                      Timing
                    </div>
                  )}

                  <div>
                    <strong className="text-emerald-400 block text-sm sm:text-base font-black">
                      {compFee > 0 ? `₹${compFee.toLocaleString('en-IN')}` : 'FREE'}
                    </strong> 
                    Fee
                  </div>

                  {featuredComp.venue && (
                    <div>
                      <strong className="text-white block text-sm sm:text-base font-bold">
                        {featuredComp.venue}
                      </strong> 
                      Venue
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={featLife.onClick}
                  className={`font-black px-8 py-4 rounded-xl text-base shadow-lg transition-transform transform hover:scale-105 cursor-pointer flex items-center space-x-2 ${
                    featLife.state === 'ACTIVE'
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                      : 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                  }`}
                >
                  <Trophy className="w-5 h-5 text-slate-950" />
                  <span>{featLife.btnText}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveScreen('public-competition')}
                  className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold px-6 py-4 rounded-xl text-base shadow-md transition-transform transform hover:scale-105 cursor-pointer"
                >
                  Explore Details
                </button>
              </div>
              </div>
            </div>
          </section>
        );
      })()}

      {/* ALL ACTIVE COMPETITIONS LIST */}
      {activeCompetitions.length > 1 && (
        <section className="py-12 bg-slate-100 border-t border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-slate-900">All Active Championships & Competitions</h3>
                <p className="text-xs text-slate-500 font-semibold">Register directly for any ongoing academy championship</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeCompetitions.map(comp => {
                const bannerSrc = comp.bannerUrl || comp.banner ? resolveFileUrl(comp.bannerUrl || comp.banner) : null;
                const compName = comp.title || comp.name || 'Competition';

                return (
                  <div key={comp.id} className="bg-white rounded-2xl overflow-hidden border border-slate-200/80 shadow-md hover:shadow-xl transition-all group flex flex-col justify-between">
                    <div>
                      <div className="relative h-48 overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                        {bannerSrc ? (
                          <SafeImage
                            src={bannerSrc}
                            alt={compName}
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            fallbackSrc=""
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 via-slate-200 to-slate-300 text-slate-400">
                            <Trophy className="w-12 h-12 text-slate-400/80" />
                          </div>
                        )}
                      </div>
                      <div className="p-6 space-y-2">
                        {(() => {
                          const cardLife = getLifecycleInfo(comp);
                          return (
                            <>
                              <div className="flex items-center gap-2">
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${cardLife.badgeCardClass}`}>
                                  {cardLife.badgeText}
                                </span>
                                {comp.category && (
                                  <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase">
                                    {comp.category}
                                  </span>
                                )}
                              </div>
                              <h4 className="text-base font-black text-slate-900">{compName}</h4>
                              {comp.description && (
                                <p className="text-xs text-slate-500 line-clamp-2">{comp.description}</p>
                              )}
                              <div className="text-xs font-semibold text-slate-700 pt-1">
                                Fee: <strong className="text-emerald-700">{Number(comp.registrationFee || 0) > 0 ? `₹${Number(comp.registrationFee).toLocaleString('en-IN')}` : 'FREE'}</strong>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="p-6 pt-0">
                      {(() => {
                        const cardLife = getLifecycleInfo(comp);
                        return (
                          <button
                            type="button"
                            onClick={cardLife.onClick}
                            className={`w-full py-3 px-4 rounded-xl font-bold text-xs shadow transition cursor-pointer flex items-center justify-center space-x-1.5 ${cardLife.btnClass}`}
                          >
                            <Trophy className="w-4 h-4" />
                            <span>{cardLife.btnText}</span>
                          </button>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ABOUT SECTION (Database-backed from website settings) */}
      <section id="about" className="py-20 bg-slate-50 border-t border-slate-200 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <span className="text-xs font-black tracking-wider uppercase bg-blue-100 text-blue-700 px-3.5 py-1.5 rounded-full">
              About {currentSettings?.generalInfo?.academyName || 'Zoro Academy'}
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              {currentSettings?.aboutPageContent?.heading || 'About Zoro English Academy'}
            </h2>
            <p className="text-base text-slate-600 font-medium">
              {currentSettings?.aboutPageContent?.subtitle || 'Nurturing Young Minds Through Small Steps and Big Communication.'}
            </p>
          </div>

          <div className="bg-white p-8 sm:p-12 rounded-3xl border border-slate-200 shadow-sm space-y-8">
            <p className="text-slate-700 leading-relaxed text-base font-normal">
              {currentSettings?.aboutPageContent?.introParagraph || 'Zoro English Academy is dedicated to empowering students with exceptional communication, phonics, grammar, public speaking, and analytical skills. Our structured curriculum and passionate educators ensure every child steps forward with confidence.'}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-slate-100">
              <div className="p-6 rounded-2xl bg-blue-50/60 border border-blue-100 space-y-2">
                <span className="text-xs font-extrabold text-blue-800 uppercase tracking-wider">Our Mission</span>
                <p className="text-sm text-slate-700 font-medium">
                  {currentSettings?.aboutPageContent?.missionStatement || 'To make world-class skill development accessible, engaging, and transformative for every child.'}
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-emerald-50/60 border border-emerald-100 space-y-2">
                <span className="text-xs font-extrabold text-emerald-800 uppercase tracking-wider">Our Vision</span>
                <p className="text-sm text-slate-700 font-medium">
                  {currentSettings?.aboutPageContent?.visionStatement || 'Creating a global generation of articulate, confident, and empathetic leaders of tomorrow.'}
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-purple-50/60 border border-purple-100 space-y-2">
                <span className="text-xs font-extrabold text-purple-800 uppercase tracking-wider">Core Values</span>
                <p className="text-sm text-slate-700 font-medium">
                  {currentSettings?.aboutPageContent?.coreValues || 'Excellence, Continuous Growth, Integrity, Student-Centric Empathy'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CONTACT SECTION (Database-backed from website settings) */}
      <section id="contact" className="py-20 bg-white border-t border-slate-200 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <span className="text-xs font-black tracking-wider uppercase bg-emerald-100 text-emerald-800 px-3.5 py-1.5 rounded-full">
              Get in Touch
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              {siteSettings?.contactPageContent?.heading || 'Contact Us'}
            </h2>
            <p className="text-base text-slate-600 font-medium">
              {siteSettings?.contactPageContent?.subtitle || "We are here to support your child's learning journey. Get in touch with our team."}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
            <div className="bg-slate-50 p-8 rounded-3xl border border-slate-200 space-y-6">
              <h3 className="text-xl font-black text-slate-900">Academy Contact Information</h3>
              <div className="space-y-4 text-sm">
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Phone</span>
                  <a href={`tel:${(siteSettings?.contactPageContent?.contactPhone || siteSettings?.generalInfo?.contactPhone || '+919876543210').replace(/\s+/g, '')}`} className="font-extrabold text-blue-600 hover:underline">
                    {siteSettings?.contactPageContent?.contactPhone || siteSettings?.generalInfo?.contactPhone || '+91 98765 43210'}
                  </a>
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Email</span>
                  <a href={`mailto:${siteSettings?.contactPageContent?.contactEmail || siteSettings?.generalInfo?.contactEmail || 'contact@zoroacademy.com'}`} className="font-extrabold text-blue-600 hover:underline">
                    {siteSettings?.contactPageContent?.contactEmail || siteSettings?.generalInfo?.contactEmail || 'contact@zoroacademy.com'}
                  </a>
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Address</span>
                  <p className="font-semibold text-slate-800">
                    {siteSettings?.contactPageContent?.contactAddress || siteSettings?.generalInfo?.address || 'No. 12, Main Road, Skill Nagar, Chennai - 600001, Tamil Nadu, India'}
                  </p>
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Working Hours</span>
                  <p className="font-semibold text-slate-800">
                    {siteSettings?.contactPageContent?.businessHours || 'Monday – Saturday: 9:00 AM – 7:00 PM IST'}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-900 to-slate-900 text-white p-8 sm:p-10 rounded-3xl shadow-xl flex flex-col justify-between space-y-6">
              <div className="space-y-3">
                <span className="text-xs font-black tracking-wider uppercase text-blue-300">Admission Enquiries</span>
                <h3 className="text-2xl font-black text-white">Have questions about our programs?</h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Speak directly with our academic counselors to understand batch timings, fees, curriculum, and free demo sessions.
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenEnquire}
                className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black py-4 px-8 rounded-2xl shadow-lg transition text-center cursor-pointer"
              >
                Enquire Now
              </button>
            </div>
          </div>
        </div>
      </section>
      {registeringComp && (
        <CompetitionRegisterModal
          competition={registeringComp}
          isOpen={Boolean(registeringComp)}
          onClose={() => setRegisteringComp(null)}
          currentUser={null}
        />
      )}

      {/* LIFECYCLE INFO DIALOG / TOAST */}
      {infoModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl text-center space-y-4 border border-slate-200">
            <div className="w-14 h-14 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <Trophy className="w-7 h-7" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-xl font-black text-slate-900">{infoModal.title}</h3>
              <p className="text-xs font-medium text-slate-600 leading-relaxed">{infoModal.message}</p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setInfoModal({ isOpen: false, title: '', message: '' })}
                className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-md transition cursor-pointer"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
