import React from 'react';

type Permission = 'ALLOWED' | 'BANNED' | 'CONDITIONAL';

interface ItemRule {
    name: string;
    icon: string;
    carryOn: Permission;
    checked: Permission;
    note?: string;
}

const CommonItemsTable: React.FC = () => {
    const rules: ItemRule[] = [
        {
            name: '行動電源/鋰電池',
            icon: 'fa-battery-full',
            carryOn: 'ALLOWED',
            checked: 'BANNED',
            note: '嚴禁託運，限手提',
        },
        {
            name: '打火機 (非防風)',
            icon: 'fa-fire',
            carryOn: 'ALLOWED',
            checked: 'BANNED',
            note: '每人限隨身帶 1 個',
        },
        {
            name: '刀剪類 (含指甲刀)',
            icon: 'fa-scissors',
            carryOn: 'BANNED',
            checked: 'ALLOWED',
            note: '任何利刃須託運',
        },
        {
            name: '液體 (>100ml)',
            icon: 'fa-bottle-water',
            carryOn: 'BANNED',
            checked: 'ALLOWED',
            note: '含水/飲料/乳液/噴霧',
        },
        {
            name: '相機腳架/自拍棒',
            icon: 'fa-camera',
            carryOn: 'CONDITIONAL',
            checked: 'ALLOWED',
            note: '管徑>1cm或收合>60cm須託運',
        },
        {
            name: '雨傘',
            icon: 'fa-umbrella',
            carryOn: 'ALLOWED',
            checked: 'ALLOWED',
            note: '建議託運',
        },
        {
            name: '酒精/乾洗手',
            icon: 'fa-pump-soap',
            carryOn: 'CONDITIONAL',
            checked: 'ALLOWED',
            note: '手提限100ml內',
        },
    ];

    const renderIcon = (status: Permission) => {
        switch (status) {
            case 'ALLOWED':
                return <i className="fa-solid fa-circle-check text-emerald-500 text-lg"></i>;
            case 'BANNED':
                return <i className="fa-solid fa-circle-xmark text-red-500 text-lg"></i>;
            case 'CONDITIONAL':
                return <i className="fa-solid fa-circle-exclamation text-amber-500 text-lg"></i>;
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="bg-slate-50 p-4 border-b border-slate-100 flex items-center gap-2">
                <i className="fa-solid fa-table-list text-slate-500"></i>
                <h3 className="font-bold text-slate-700">常見物品攜帶對照表</h3>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-50/50 border-b border-slate-100">
                        <tr>
                            <th className="px-4 py-3 font-bold">物品名稱</th>
                            <th className="px-4 py-3 text-center font-bold text-blue-600"><i className="fa-solid fa-suitcase mr-1"></i>隨身</th>
                            <th className="px-4 py-3 text-center font-bold text-orange-600"><i className="fa-solid fa-suitcase-rolling mr-1"></i>託運</th>
                            <th className="px-4 py-3 font-bold">備註</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rules.map((item, idx) => (
                            <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                <td className="px-4 py-3 font-medium text-slate-800 flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-xs">
                                        <i className={`fa-solid ${item.icon}`}></i>
                                    </div>
                                    {item.name}
                                </td>
                                <td className="px-4 py-3 text-center bg-blue-50/30">
                                    {renderIcon(item.carryOn)}
                                </td>
                                <td className="px-4 py-3 text-center bg-orange-50/30">
                                    {renderIcon(item.checked)}
                                </td>
                                <td className="px-4 py-3 text-xs text-slate-500">
                                    {item.note}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="p-3 bg-slate-50/50 text-[10px] text-slate-400 text-center border-t border-slate-100">
                <span className="mr-3"><i className="fa-solid fa-circle-check text-emerald-500 mr-1"></i>可攜帶</span>
                <span className="mr-3"><i className="fa-solid fa-circle-xmark text-red-500 mr-1"></i>禁止</span>
                <span><i className="fa-solid fa-circle-exclamation text-amber-500 mr-1"></i>有條件限制</span>
            </div>
        </div>
    );
};

export default CommonItemsTable;
