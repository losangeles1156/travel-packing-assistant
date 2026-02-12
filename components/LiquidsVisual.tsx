import React from 'react';

const LiquidsVisual: React.FC = () => {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden relative">
            <div className="bg-gradient-to-r from-cyan-500 to-blue-500 p-4 text-white flex items-center gap-3">
                <i className="fa-solid fa-bottle-droplet text-2xl"></i>
                <div>
                    <h3 className="font-bold text-lg">液體隨身攜帶限制</h3>
                    <p className="text-xs opacity-90">3-1-1 規定：100ml、1公升透明袋、每人1袋</p>
                </div>
            </div>

            <div className="p-6 md:flex items-center justify-center gap-8 text-center md:text-left">
                {/* Bottle Visual */}
                <div className="flex flex-col items-center">
                    <div className="relative w-16 h-28 border-2 border-slate-300 rounded-lg bg-slate-50 flex flex-col justify-end overflow-hidden mb-2">
                        <div className="w-full h-2/3 bg-cyan-100 border-t border-cyan-200"></div>
                        <div className="absolute top-2 left-1/2 -translate-x-1/2 text-[10px] font-bold text-slate-400">MAX</div>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 text-sm font-bold text-slate-600">100ml</div>
                    </div>
                    <div className="text-xs font-bold text-slate-600">單瓶限制</div>
                    <div className="text-[10px] text-slate-400">總容量不得超過 100ml</div>
                </div>

                <div className="text-2xl text-slate-300 my-4 md:my-0"><i className="fa-solid fa-plus"></i></div>

                {/* Bag Visual */}
                <div className="flex flex-col items-center">
                    <div className="relative w-32 h-32 border-2 border-dashed border-blue-300 rounded-xl bg-blue-50/50 flex flex-wrap content-end justify-center gap-1 p-2 mb-2">
                        {/* Mini bottles inside */}
                        <div className="w-6 h-10 border border-slate-300 bg-white rounded-sm"></div>
                        <div className="w-6 h-10 border border-slate-300 bg-white rounded-sm"></div>
                        <div className="w-6 h-10 border border-slate-300 bg-white rounded-sm"></div>
                        <div className="w-6 h-10 border border-slate-300 bg-white rounded-sm"></div>

                        <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-blue-100 px-2 rounded-full text-[10px] text-blue-600 font-bold border border-blue-200">
                            20 x 20 cm
                        </div>
                    </div>
                    <div className="text-xs font-bold text-slate-600">透明夾鏈袋</div>
                    <div className="text-[10px] text-slate-400">總容量 1 公升，每人限帶 1 袋</div>
                </div>
            </div>

            <div className="bg-amber-50 p-3 text-xs text-amber-700 font-medium flex gap-2 items-start border-t border-amber-100">
                <i className="fa-solid fa-triangle-exclamation mt-0.5"></i>
                <div>
                    <p>注意：容器本身容量若超過 100ml，即便內容物剩下一點點，也**禁止**隨身攜帶，必須託運。</p>
                </div>
            </div>
        </div>
    );
};

export default LiquidsVisual;
