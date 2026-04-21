import React from 'react';
import { useI18n } from '../contexts/I18nContext';
import { Footprints, AlertTriangle, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const ShoeRecommendation = ({ recommendedShoe }) => {
  const { t } = useI18n();

  if (!recommendedShoe) return null;

  const maxDist = recommendedShoe.maxDistanceKm || 800;
  const isWarning = recommendedShoe.currentDistanceKm > (maxDist * 0.9);
  const isCritical = recommendedShoe.currentDistanceKm >= maxDist;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
            <Footprints className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h3 className="font-semibold text-slate-900 dark:text-white">
            {t('profile.shoe_recommendation_title')}
          </h3>
        </div>
        <Link 
          to="/shoes" 
          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5"
        >
          {t('profile.dashboard_view_gear')}
          <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="flex gap-4">
        {recommendedShoe.photoUrl ? (
          <img 
            src={recommendedShoe.photoUrl} 
            alt={recommendedShoe.model}
            className="w-20 h-20 object-cover rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-inner"
          />
        ) : (
          <div className="w-20 h-20 bg-slate-100 dark:bg-slate-900 rounded-xl flex items-center justify-center border border-slate-100 dark:border-slate-800">
            <Footprints className="w-8 h-8 text-slate-300 dark:text-slate-600" />
          </div>
        )}

        <div className="flex-1">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                {recommendedShoe.brand}
              </p>
              <h4 className="font-bold text-slate-900 dark:text-white leading-tight mt-0.5">
                {recommendedShoe.nickname || recommendedShoe.model}
              </h4>
              {recommendedShoe.nickname && (
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {recommendedShoe.model}
                </p>
              )}
            </div>
            {(isWarning || isCritical) && (
              <div className={`p-1 rounded-full ${isCritical ? 'bg-rose-50 dark:bg-rose-900/20' : 'bg-amber-50 dark:bg-amber-900/20'}`}>
                <AlertTriangle className={`w-4 h-4 ${isCritical ? 'text-rose-500' : 'text-amber-500'}`} />
              </div>
            )}
          </div>

          <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-2 font-medium bg-indigo-50/50 dark:bg-indigo-900/10 px-2 py-1 rounded-md inline-block">
            {t('profile.shoe_recommendation_reason', { reason: recommendedShoe.recommendationReason })}
          </p>

          <div className="mt-3">
            <div className="flex justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 px-0.5">
              <span>{Math.round(recommendedShoe.currentDistanceKm)} km</span>
              <span>{maxDist} km</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden shadow-inner p-[1px]">
              <div 
                className={`h-full rounded-full transition-all duration-700 ease-out ${
                  isCritical ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]' : 
                  isWarning ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]' : 
                  'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.4)]'
                }`}
                style={{ width: `${Math.min(100, (recommendedShoe.currentDistanceKm / maxDist) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShoeRecommendation;
