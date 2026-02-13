import React, { useState } from 'react';

type GuideTopic = 'MEAT' | 'BATTERY' | 'LIQUIDS';

const VisualRegulationGuide: React.FC = () => {
    const [activeTopic, setActiveTopic] = useState<GuideTopic>('MEAT');

    const guides = {
        MEAT: [
            {
                icon: 'fa-drumstick-bite',
                name: '生鮮肉類',
                status: 'BANNED',
                desc: '包含冷凍肉、生肉。絕對禁止攜帶入境。',
            },
            {
                icon: 'fa-hotdog',
                name: '加工肉品',
                status: 'BANNED',
                desc: '肉乾、香腸、火腿、臘肉、肉鬆。真空包裝也不行！',
            },
            {
                icon: 'fa-bowl-food',
                name: '含肉泡麵',
                status: 'BANNED',
                desc: '若調味包內含有「固體肉塊」禁止。純肉粉通常可通關。',
            },
            {
                icon: 'fa-fish',
                name: '海鮮/魚類',
                status: 'ALLOWED',
                desc: '經乾燥、醃漬、調製等加工處理之水產品通常可攜帶。',
            },
            {
                icon: 'fa-cookie',
                name: '糕餅點心',
                status: 'ALLOWED',
                desc: '鳳梨酥、蛋黃酥(蛋黃需全熟)。含肉鬆/肉塊之糕餅則禁止。',
            },
        ],
        BATTERY: [
            {
                icon: 'fa-car-battery',
                name: '行動電源',
                status: 'CARRY_ON',
                desc: '必須手提！嚴禁託運。單顆限 160Wh 以下。',
            },
            {
                icon: 'fa-camera',
                name: '備用鋰電池',
                status: 'CARRY_ON',
                desc: '相機/空拍機/Gopro電池。必須絕緣保護並手提。',
            },
            {
                icon: 'fa-laptop',
                name: '筆電/平板',
                status: 'CARRY_ON',
                desc: '內建鋰電池不可拆卸之電子產品，建議手提。',
            },
            {
                icon: 'fa-fan',
                name: '鉛酸電池',
                status: 'BANNED',
                desc: '傳統電風扇、電蚊拍常使用鉛酸電池，禁止上機。',
            },
        ],
        LIQUIDS: [
            {
                icon: 'fa-bottle-water',
                name: '飲料/水',
                status: 'BANNED',
                desc: '過安檢前須喝完或倒掉。安檢後購買的可帶上機。',
            },
            {
                icon: 'fa-spray-can',
                name: '噴霧 (<100ml)',
                status: 'CARRY_ON',
                desc: '需裝入 1L 透明夾鏈袋。每人限帶一袋。',
            },
            {
                icon: 'fa-wine-bottle',
                name: '酒類/大罐保養品',
                status: 'CHECKED',
                desc: '超過 100ml 必須託運。酒精濃度 70% 以上禁止攜帶。',
            },
            {
                icon: 'fa-pump-soap',
                name: '乾洗手 (含酒精)',
                status: 'CONDITIONAL',
                desc: '比照液體規定。若為醫療需求可向安檢人員申報。',
            },
        ],
    };

    const statusConfig = {
        ALLOWED: { color: 'bg-emerald-100 text-emerald-800', icon: 'fa-circle-check', text: '可攜帶' },
        BANNED: { color: 'bg-red-100 text-red-800', icon: 'fa-circle-xmark', text: '禁止' },
        CARRY_ON: { color: 'bg-blue-100 text-blue-800', icon: 'fa-suitcase', text: '限手提' },
        CHECKED: { color: 'bg-orange-100 text-orange-800', icon: 'fa-suitcase-rolling', text: '限託運' },
        CONDITIONAL: { color: 'bg-amber-100 text-amber-800', icon: 'fa-circle-exclamation', text: '有條件' },
    };

    return (
        <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-slate-100">
            <div className="flex border-b border-slate-100">
                <button
                    onClick={() => setActiveTopic('MEAT')}
                    className={`flex-1 py-4 text-sm font-bold transition-colors ${activeTopic === 'MEAT' ? 'bg-red-50 text-red-600 border-b-2 border-red-500' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                    <i className="fa-solid fa-drumstick-bite mr-2"></i>
                    食品/肉類
                </button>
                <button
                    onClick={() => setActiveTopic('BATTERY')}
                    className={`flex-1 py-4 text-sm font-bold transition-colors ${activeTopic === 'BATTERY' ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-500' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                    <i className="fa-solid fa-battery-full mr-2"></i>
                    電池/電器
                </button>
                <button
                    onClick={() => setActiveTopic('LIQUIDS')}
                    className={`flex-1 py-4 text-sm font-bold transition-colors ${activeTopic === 'LIQUIDS' ? 'bg-cyan-50 text-cyan-600 border-b-2 border-cyan-500' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                    <i className="fa-solid fa-bottle-water mr-2"></i>
                    液體規範
                </button>
            </div>

            <div className="p-4 grid gap-3">
                {guides[activeTopic].map((item, idx) => {
                    const status = statusConfig[item.status as keyof typeof statusConfig];
                    return (
                        <div key={idx} className="flex items-start gap-4 p-3 rounded-lg border border-slate-50 hover:bg-slate-50 transition">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shadow-sm ${item.status === 'BANNED' ? 'bg-red-100 text-red-500' : 'bg-white text-slate-600'
                                }`}>
                                <i className={`fa-solid ${item.icon}`}></i>
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="font-bold text-slate-800">{item.name}</span>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${status.color}`}>
                                        <i className={`fa-solid ${status.icon}`}></i>
                                        {status.text}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 leading-relaxed">
                                    {item.desc}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="bg-slate-50 p-3 text-[10px] text-slate-400 text-center border-t border-slate-100">
                <i className="fa-solid fa-circle-info mr-1"></i>
                規定可能隨時變動，請以搭乘之航空公司與當地海關最新公告為準
            </div>
        </div>
    );
};

export default VisualRegulationGuide;
