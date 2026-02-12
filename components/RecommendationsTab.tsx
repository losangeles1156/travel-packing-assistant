import React, { useEffect, useMemo, useRef, useState } from 'react';
import { RECOMMENDATION_ITEMS } from '../constants';
import { trackEvent } from '../services/analyticsService';

const RecommendationsTab: React.FC = () => {
  const [tripDetails, setTripDetails] = useState<{ destination: string; duration: number; startDate?: string } | null>(null);
  const impressionKeyRef = useRef('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem('tpa_trip_details');
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as { destination?: string; duration?: number; startDate?: string };
      if (!parsed.destination || !parsed.duration) return;
      setTripDetails({ destination: parsed.destination, duration: parsed.duration, startDate: parsed.startDate });
    } catch {
      return;
    }
  }, []);

  const regionLabelMap: Record<string, string> = {
    japan: '日本',
    korea: '韓國',
  };

  const subregionLabelMap: Record<string, string> = {
    japan_north: '日本北部',
    japan_south: '日本南部',
    korea_north: '韓國北部',
    korea_south: '韓國南部',
  };

  const seasonLabelMap: Record<string, string> = {
    spring: '春季',
    summer: '夏季',
    autumn: '秋季',
    winter: '冬季',
  };

  const climateLabelMap: Record<string, string> = {
    tropical: '熱帶',
    rainy: '雨季',
    cold: '寒冷',
    hot: '炎熱',
  };

  const recommendations = useMemo(() => {
    const destination = tripDetails?.destination?.toLowerCase() ?? '';
    const duration = tripDetails?.duration ?? 0;
    const startDate = tripDetails?.startDate ?? '';
    const month = startDate ? new Date(startDate).getMonth() + 1 : 0;
    const season = month ? (month === 12 || month <= 2 ? 'winter' : month <= 5 ? 'spring' : month <= 8 ? 'summer' : 'autumn') : null;

    const regionKeywords: Record<string, string[]> = {
      japan: [
        '日本', '東京', '大阪', '京都', '奈良', '神戶', '名古屋', '福岡', '札幌', '北海道', '沖繩', '沖縄',
        '那霸', '廣島', '仙台', '金澤', '箱根', '富士山', '長崎', '熊本', '鹿兒島', '高松',
        'japan', 'tokyo', 'osaka', 'kyoto', 'nara', 'kobe', 'nagoya', 'fukuoka', 'sapporo', 'hokkaido',
        'okinawa', 'naha', 'hiroshima', 'sendai', 'kanazawa', 'hakone', 'fujisan', 'nagasaki', 'kumamoto',
        'kagoshima', 'takamatsu',
      ],
      korea: [
        '韓國', '首爾', '釜山', '濟州', '仁川', '大邱', '光州', '水原', '江原', '江陵', '春川', '全州',
        'korea', 'seoul', 'busan', 'jeju', 'incheon', 'daegu', 'gwangju', 'suwon', 'gangwon', 'gangneung',
        'chuncheon', 'jeonju',
      ],
    };

    const subregionKeywords: Record<string, string[]> = {
      japan_north: ['北海道', '札幌', '旭川', '函館', '富良野', '東北', '青森', '岩手', '秋田', '仙台', 'hokkaido', 'sapporo', 'asahikawa', 'hakodate', 'furano', 'tohoku', 'aomori', 'iwate', 'akita', 'sendai'],
      japan_south: ['沖繩', '沖縄', '那霸', '石垣', '宮古', '福岡', '熊本', '長崎', '鹿兒島', '奄美', 'okinawa', 'naha', 'ishigaki', 'miyako', 'fukuoka', 'kumamoto', 'nagasaki', 'kagoshima', 'amami'],
      korea_north: ['首爾', '仁川', '水原', '江原', '江陵', '春川', '평창', 'gangwon', 'gangneung', 'chuncheon', 'seoul', 'incheon', 'suwon'],
      korea_south: ['釜山', '濟州', '大邱', '光州', '全州', 'busan', 'jeju', 'daegu', 'gwangju', 'jeonju'],
    };

    const climateKeywords: Record<string, string[]> = {
      tropical: ['沖繩', '沖縄', '石垣', '宮古', '濟州', 'jeju', 'okinawa'],
      rainy: ['梅雨', '雨季', '長梅雨', '장마', 'rainy'],
      cold: ['北海道', '札幌', '旭川', '函館', '富良野', '青森', '秋田', '東北', '江原', '平昌', '江陵', '춘천', 'gangwon', 'sapporo', 'hokkaido'],
      hot: ['沖繩', '沖縄', '石垣', '宮古', '濟州', 'jeju', 'okinawa'],
    };

    const regionTagsRaw = destination
      ? Object.entries(regionKeywords)
          .filter(([, keywords]) => keywords.some(keyword => destination.includes(keyword.toLowerCase())))
          .map(([tag]) => tag)
      : [];

    const climateTags = destination
      ? Object.entries(climateKeywords)
          .filter(([, keywords]) => keywords.some(keyword => destination.includes(keyword.toLowerCase())))
          .map(([tag]) => tag)
      : [];

    const subregionTagsRaw = destination
      ? Object.entries(subregionKeywords)
          .filter(([, keywords]) => keywords.some(keyword => destination.includes(keyword.toLowerCase())))
          .map(([tag]) => tag)
      : [];

    const subregionPriority = ['japan_north', 'japan_south', 'korea_north', 'korea_south'] as const;
    const regionPriority = ['japan', 'korea'] as const;

    const primarySubregion = subregionPriority.find(tag => subregionTagsRaw.includes(tag)) ?? null;
    const primaryRegion = primarySubregion
      ? (primarySubregion.startsWith('japan') ? 'japan' : 'korea')
      : (regionPriority.find(tag => regionTagsRaw.includes(tag)) ?? null);

    const regionTags: string[] = primaryRegion ? [primaryRegion] : [];
    const subregionTags: string[] = primarySubregion ? [primarySubregion] : [];

    return RECOMMENDATION_ITEMS.map(item => {
      let score = item.baseScore;
      const reasons: string[] = [];

      if (destination && item.keywords && item.keywords.length > 0) {
        const matches = item.keywords.filter(keyword => destination.includes(keyword.toLowerCase()));
        if (matches.length > 0) {
          score += matches.length * 15;
          reasons.push(`目的地相關：${matches.slice(0, 2).join('、')}`);
        }
      }

      if (season && item.seasonTags && item.seasonTags.includes(season)) {
        score += 12;
        reasons.push(`季節：${seasonLabelMap[season]}`);
      }

      if (item.regionTags && regionTags.length > 0) {
        const matches = item.regionTags.filter(tag => regionTags.includes(tag));
        if (matches.length > 0) {
          score += matches.length * 12;
          reasons.push(`地區：${matches.slice(0, 2).map(tag => regionLabelMap[tag] ?? tag).join('、')}`);
        }
      }

      if (item.climateTags && climateTags.length > 0) {
        const matches = item.climateTags.filter(tag => climateTags.includes(tag));
        if (matches.length > 0) {
          score += matches.length * 12;
          reasons.push(`氣候：${matches.slice(0, 2).map(tag => climateLabelMap[tag] ?? tag).join('、')}`);
        }
      }

      if (season) {
        const northTags = ['japan_north', 'korea_north'];
        const southTags = ['japan_south', 'korea_south'];
        const isNorth = subregionTagsRaw.some(tag => northTags.includes(tag));
        const isSouth = subregionTagsRaw.some(tag => southTags.includes(tag));

        if (isNorth && season === 'winter' && item.climateTags?.includes('cold')) {
          score += 18;
          reasons.push('北部冬季加權');
        }

        if (isSouth && season === 'summer' && (item.climateTags?.includes('tropical') || item.climateTags?.includes('hot'))) {
          score += 18;
          reasons.push('南部夏季加權');
        }
      }

      if (item.minDays && duration >= item.minDays) {
        score += 10;
        reasons.push(`天數 ${duration} 天`);
      }

      if (item.maxDays && duration > 0 && duration <= item.maxDays) {
        score += 6;
        reasons.push(`天數 ${duration} 天`);
      }

      return { ...item, score, reasons, season, regionTags, climateTags, subregionTags, startDate };
    })
      .sort((a, b) => b.score - a.score);
  }, [tripDetails]);

  useEffect(() => {
    if (!tripDetails) return;
    const payload = {
      destination: tripDetails.destination,
      duration: tripDetails.duration,
      startDate: tripDetails.startDate ?? null,
      season: recommendations[0]?.season ?? null,
      regions: recommendations[0]?.regionTags ?? [],
      climates: recommendations[0]?.climateTags ?? [],
      subregions: recommendations[0]?.subregionTags ?? [],
      items: recommendations.slice(0, 5).map(item => ({ id: item.id, score: item.score })),
    };
    const key = JSON.stringify(payload);
    if (key === impressionKeyRef.current) return;
    impressionKeyRef.current = key;
    trackEvent('recommendation_impression', payload);
  }, [recommendations, tripDetails]);

  return (
    <div className="max-w-2xl mx-auto pb-24 text-center">
        <div className="py-12">
            <h2 className="text-3xl font-bold text-slate-800 mb-4">好物推薦</h2>
            <p className="text-slate-500 mb-10 max-w-md mx-auto">
                依旅程天數、季節、氣候與目的地關鍵字排序，提供最適合的出國服務與用品。
            </p>
            
            <div className="grid gap-6">
                {recommendations.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => trackEvent('recommendation_click', { title: item.title, score: item.score })}
                      className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center gap-6 hover:shadow-md transition cursor-pointer"
                    >
                        <div className={`w-14 h-14 rounded-2xl ${item.color} text-white flex items-center justify-center text-2xl shadow-lg shadow-blue-100`}>
                            <i className={`fa-solid ${item.icon}`}></i>
                        </div>
                        <div className="text-left">
                            <h3 className="text-lg font-bold text-slate-800">{item.title}</h3>
                            <p className="text-slate-500">{item.desc}</p>
                            {item.reasons.length > 0 && (
                              <div className="text-xs text-slate-400 mt-2">{item.reasons.join('・')}</div>
                            )}
                        </div>
                        <div className="ml-auto text-slate-300">
                            <i className="fa-solid fa-chevron-right"></i>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </div>
  );
};

export default RecommendationsTab;
