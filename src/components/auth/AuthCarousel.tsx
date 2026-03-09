import { useState, useEffect } from 'react';
import { Search, FolderOpen, Shield } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const icons = [Search, FolderOpen, Shield];

export default function AuthCarousel() {
  const [current, setCurrent] = useState(0);
  const { t } = useLanguage();

  const slides = [
    {
      icon: icons[0],
      title: t('auth.carousel.ocrTitle'),
      description: t('auth.carousel.ocrDesc'),
    },
    {
      icon: icons[1],
      title: t('auth.carousel.archiveTitle'),
      description: t('auth.carousel.archiveDesc'),
    },
    {
      icon: icons[2],
      title: t('auth.carousel.auditTitle'),
      description: t('auth.carousel.auditDesc'),
    },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const slide = slides[current];
  const Icon = slide.icon;

  return (
    <div className="hidden lg:flex flex-col items-center justify-center h-full bg-primary text-primary-foreground p-12 relative overflow-hidden">
      {/* Decorative circles */}
      <div className="absolute top-[-80px] right-[-80px] w-64 h-64 rounded-full bg-white/10" />
      <div className="absolute bottom-[-60px] left-[-60px] w-48 h-48 rounded-full bg-white/5" />
      <div className="absolute top-1/3 left-10 w-24 h-24 rounded-full bg-white/5" />

      <div className="relative z-10 max-w-md text-center space-y-8">
        <div key={current} className="mx-auto w-20 h-20 rounded-2xl bg-white/15 flex items-center justify-center animate-fade-in">
          <Icon className="h-10 w-10" />
        </div>

        <div key={`text-${current}`} className="space-y-4 animate-fade-in">
          <h2 className="text-3xl font-serif font-bold">{slide.title}</h2>
          <p className="text-lg text-primary-foreground/80 leading-relaxed">{slide.description}</p>
        </div>

        <div className="flex items-center justify-center gap-3 pt-4">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-2.5 rounded-full transition-all duration-500 ${
                i === current ? 'w-8 bg-white' : 'w-2.5 bg-white/40 hover:bg-white/60'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
