import React, { useState, useEffect } from 'react';

const BatteryCalculator: React.FC = () => {
    const [mah, setMah] = useState<number | string>('');
    const [voltage, setVoltage] = useState<number | string>(3.7); // Default Li-ion voltage
    const [wh, setWh] = useState<number>(0);
    const [status, setStatus] = useState<'safe' | 'warning' | 'danger'>('safe');

    useEffect(() => {
        const m = Number(mah) || 0;
        const v = Number(voltage) || 0;
        const calculatedWh = (m * v) / 1000;
        setWh(Number(calculatedWh.toFixed(1)));

        if (calculatedWh <= 100) {
            setStatus('safe');
        } else if (calculatedWh <= 160) {
            setStatus('warning');
        } else {
            setStatus('danger');
        }
    }, [mah, voltage]);

    const getStatusDisplay = () => {
        switch (status) {
            case 'safe':
                return {
                    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                    icon: 'fa-check-circle',
                    text: '可手提上機',
                    desc: '無需申報，每人通常限帶 20 顆以下 (依航司規定)。'
                };
            case 'warning':
                return {
                    color: 'bg-amber-50 text-amber-700 border-amber-200',
                    icon: 'fa-exclamation-circle',
                    text: '需航空公司批准',
                    desc: '必須事先向航空公司申報並獲同意。每人限帶 2 顆。'
                };
            case 'danger':
                return {
                    color: 'bg-red-50 text-red-700 border-red-200',
                    icon: 'fa-ban',
                    text: '禁止攜帶',
                    desc: '超過 160Wh 禁止手提與或是託運 (輪椅輔具除外)。'
                };
        }
    };

    const statusInfo = getStatusDisplay();

    return (
        <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                    <i className="fa-solid fa-calculator"></i>
                </div>
                <div>
                    <h3 className="font-bold text-slate-800">鋰電池/行動電源額定能量計算</h3>
                    <p className="text-xs text-slate-500">輸入 mAh 自動換算瓦時 (Wh)</p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">容量 (mAh)</label>
                    <input
                        type="number"
                        value={mah}
                        onChange={(e) => setMah(e.target.value)}
                        placeholder="例如: 10000"
                        className="w-full p-2 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">電壓 (V)</label>
                    <input
                        type="number"
                        value={voltage}
                        onChange={(e) => setVoltage(e.target.value)}
                        placeholder="預設 3.7"
                        className="w-full p-2 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
                    />
                </div>
            </div>

            {Number(mah) > 0 && (
                <div className={`rounded-lg p-4 border ${statusInfo.color} transition-all`}>
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-2xl font-bold">{wh} <span className="text-sm font-normal opacity-80">Wh</span></span>
                        <div className="flex items-center gap-2 font-bold text-sm">
                            <i className={`fa-solid ${statusInfo.icon}`}></i>
                            {statusInfo.text}
                        </div>
                    </div>
                    <p className="text-xs opacity-90 leading-relaxed">
                        {statusInfo.desc}
                    </p>
                </div>
            )}

            {!Number(mah) && (
                <div className="text-center text-xs text-slate-400 py-4 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                    請輸入電池標籤上的 mAh 數值
                </div>
            )}
        </div>
    );
};

export default BatteryCalculator;
