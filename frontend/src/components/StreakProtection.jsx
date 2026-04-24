import React from 'react';
import { useI18n } from '../contexts/I18nContext';
import { Flame, Trophy, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const StreakProtection = ({ current, best }) => {
  const { t } = useI18n();

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <Flame className="w-5 h-5 text-orange-500" />
          {t('profile.streak_title')}
        </h3>
        <Link 
          to="/rewards" 
          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5"
        >
          {t('profile.view_all_rewards')}
          <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-orange-50/50 dark:bg-orange-900/10 rounded-xl p-4 border border-orange-100/50 dark:border-orange-900/20">
          <p className="text-[10px] font-bold text-orange-600/70 dark:text-orange-400/70 uppercase tracking-widest mb-1">
            {t('profile.streak_current')}
          </p>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-orange-600 dark:text-orange-400 leading-none">
              {current}
            </span>
            <span className="text-xs font-bold text-orange-600/70 dark:text-orange-400/70">
              {t('profile.streak_days')}
            </span>
          </div>
        </div>

        <div className="bg-indigo-50/50 dark:bg-indigo-900/10 rounded-xl p-4 border border-indigo-100/50 dark:border-indigo-900/20">
          <p className="text-[10px] font-bold text-indigo-600/70 dark:text-indigo-400/70 uppercase tracking-widest mb-1">
            {t('profile.streak_best')}
          </p>
          <div className="flex items-baseline gap-1 text-indigo-600 dark:text-indigo-400">
            <Trophy className="w-4 h-4 mb-0.5" />
            <span className="text-2xl font-black leading-none">
              {best}
            </span>
            <span className="text-xs font-bold opacity-70">
              {t('profile.streak_days')}
            </span>
          </div>
        </div>
      </div>
      
      {current === 0 && best > 0 && (
        <p className="mt-4 text-[11px] text-slate-500 dark:text-slate-400 italic">
          {t('profile.streak_protection_hint')}
        </p>
      )}
    </div>
  );
};

export default StreakProtection;
