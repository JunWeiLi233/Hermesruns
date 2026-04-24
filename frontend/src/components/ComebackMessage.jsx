import React from 'react';
import { useI18n } from '../contexts/I18nContext';
import { Sparkles, X } from 'lucide-react';

const ComebackMessage = ({ daysOff, onDismiss }) => {
  const { t } = useI18n();

  if (!daysOff || daysOff < 3) return null;

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-6 text-white shadow-lg shadow-indigo-200 dark:shadow-none mb-6">
      {/* Decorative background sparkles */}
      <div className="absolute top-0 right-0 -mr-4 -mt-4 opacity-20">
        <Sparkles className="w-24 h-24" />
      </div>
      
      <button 
        onClick={onDismiss}
        className="absolute top-4 right-4 p-1 hover:bg-white/10 rounded-full transition-colors"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 bg-white/20 rounded-lg">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="text-xs font-bold uppercase tracking-widest text-indigo-100">
            {t('profile.comeback_eyebrow')}
          </span>
        </div>
        
        <h3 className="text-xl font-black mb-2 leading-tight">
          {t('profile.comeback_title', { days: daysOff })}
        </h3>
        
        <p className="text-sm text-indigo-50 leading-relaxed max-w-md">
          {t('profile.comeback_body')}
        </p>
        
        <div className="mt-5 flex gap-3">
          <div className="px-4 py-2 bg-white text-indigo-600 rounded-xl text-xs font-bold shadow-sm cursor-default">
            {t('profile.comeback_tip_1')}
          </div>
          <div className="px-4 py-2 bg-white/10 text-white border border-white/20 rounded-xl text-xs font-bold cursor-default">
            {t('profile.comeback_tip_2')}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComebackMessage;
