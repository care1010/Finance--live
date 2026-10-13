import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import * as XLSX from "xlsx";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList, ComposedChart, Line } from 'recharts';
import FilterBar from '../components/FilterBar';
import { 
    HiOutlineFilter, 
    HiChevronRight,
    HiOutlineUpload,
    HiChevronDown,
    HiSearch
} from "react-icons/hi";

// ─────────────────────────────────────────────────────────────
// 🔥 SMART PARAMETER BUILDER: Maps Frontend state to Backend keys
// ─────────────────────────────────────────────────────────────
const buildMappedParams = (filters, extra = {}) => {
    const params = new URLSearchParams();
    
    // Map UI Keys to the Keys expected by the Backend ApplyDashboardFilters
    const keyMap = {
        bu: 'bu',
        customer: 'customer',
        loa_id: 'loa_id',
        loa_name: 'loa_name',
        wbs_type: 'wbs_type',
        wbs: 'wbs',
        wbs_description: 'wbs_description',
        active_inactive: 'active_inactive',
        period: 'period',
        category_type: 'category_type'
    };

    Object.keys(filters).forEach(uiKey => {
        const backendKey = keyMap[uiKey] || uiKey;
        const val = filters[uiKey];
        
        if (Array.isArray(val)) {
            const cleaned = [...new Set(val)].filter(v => v && v !== 'All');
            if (cleaned.length > 0) {
                // params.append(backendKey, cleaned.join('|||'));
                params.append(backendKey, cleaned.join(','));
            }
        } else if (val && val !== 'All') {
            params.append(backendKey, val);
        }
    });

    Object.keys(extra).forEach(k => {
        if (extra[k] !== undefined && extra[k] !== null && extra[k] !== '') {
            params.set(k, extra[k]); // Set overwrites any existing key to prevent duplicates
        }
    });
    
    return params;
};

// ─────────────────────────────────────────────────────────────
// Inline WBS Type Dropdown
// ─────────────────────────────────────────────────────────────
const WbsTypeInlineDropdown = ({ options = [], selected = [], onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        const handleOutside = (e) => { if (containerRef.current && !containerRef.current.contains(e.target)) setIsOpen(false); };
        document.addEventListener('mousedown', handleOutside);
        return () => document.removeEventListener('mousedown', handleOutside);
    }, []);

    const toggleOption = (val) => {
        if (selected.includes(val)) onChange('wbs_type', selected.filter(v => v !== val));
        else onChange('wbs_type', [...selected, val]);
    };

    const displayText = selected.length > 0 ? selected.join(', ') : 'Select WBS Type';

    return (
        <div ref={containerRef} className="relative inline-block ml-3" style={{ minWidth: '200px' }}>
            <button onClick={() => setIsOpen(prev => !prev)} className="flex items-center gap-2 px-4 py-1.5 bg-white border-2 border-orange-400 rounded-lg text-sm font-bold text-orange-700 shadow-sm hover:bg-orange-50 transition-all">
                <span className="truncate max-w-[150px]">{displayText}</span>
                <HiChevronDown className={`flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-[200] min-w-[200px] py-2 overflow-hidden">
                    {options.length === 0 ? <div className="px-4 py-2 text-sm text-slate-400">No options available</div> : options.map(opt => (
                        <div key={opt} onClick={() => toggleOption(opt)} className={`flex items-center gap-2 px-4 py-2 text-sm cursor-pointer hover:bg-slate-50 transition-colors ${selected.includes(opt) ? 'text-blue-600 font-bold bg-blue-50' : 'text-slate-700'}`}>
                            <span className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${selected.includes(opt) ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>
                                {selected.includes(opt) && <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 12 12"><path d="M10 3L5 8.5 2 5.5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                            </span>
                            {opt}
                        </div>
                    ))}
                    {selected.length > 0 && <div className="border-t border-slate-100 mt-1 pt-1"><button onClick={() => { onChange('wbs_type', []); setIsOpen(false); }} className="w-full text-left px-4 py-2 text-xs text-red-500 font-bold hover:bg-red-50 transition-colors">Clear Selection</button></div>}
                </div>
            )}
        </div>
    );
};

const Dashboard = ({ user, filters, onFilterChange, onResetFilters }) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [buData, setBuData] = useState([]);
    const [loaData, setLoaData] = useState([]);
    const [filterOptions, setFilterOptions] = useState({});
    const [showAllLoa, setShowAllLoa] = useState(false);
    const [loading, setLoading] = useState(false);
    const [tableData, setTableData] = useState([]);
    const [tableView, setTableView] = useState('bu');
    const allowedCustomers = [...new Set(user?.allowedCustomers || [])];

    const [trendData, setTrendData] = useState([]);
    const [trendLoas, setTrendLoas] = useState([]);
    
    // Trend Graph Local Selection State
    const [localTrendLoa, setLocalTrendLoa] = useState('');
    const [isTrendDropdownOpen, setIsTrendDropdownOpen] = useState(false);
    const [trendSearchTerm, setTrendSearchTerm] = useState('');
    const trendDropdownRef = useRef(null);

    const formatNum = (val) => Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // ─── SYNC LOCAL TREND LOA WITH GLOBAL FILTERS ───
    // useEffect(() => {
    //     if (filters.loa_name && filters.loa_name.length === 1) {
    //         setLocalTrendLoa(filters.loa_name[0]);
    //     } else if (filters.loa_name && filters.loa_name.length > 1) {
    //         setLocalTrendLoa('');
    //     }
    // }, [filters.loa_name]);

    // ─── SYNC LOCAL TREND LOA WITH GLOBAL FILTERS (FIXED) ───
        useEffect(() => {
            // 1. Agar sidebar mein exactly 1 LOA select hua hai, toh usey local dropdown mein sync karo
            if (filters.loa_name && filters.loa_name.length === 1) {
                setLocalTrendLoa(filters.loa_name[0]);
            } 
            // 2. 🔥 FIXED: Agar sidebar empty hai (deselect/reset) ya multiple values hain, toh local state reset kar do
            else {
                setLocalTrendLoa('');
            }
        }, [filters.loa_name]);

    // Close dropdown on outside click
    useEffect(() => {
        const handleOutside = (e) => { if (trendDropdownRef.current && !trendDropdownRef.current.contains(e.target)) setIsTrendDropdownOpen(false); };
        document.addEventListener('mousedown', handleOutside);
        return () => document.removeEventListener('mousedown', handleOutside);
    }, []);

    // ─── FETCH FILTER OPTIONS ───
    useEffect(() => {
        const controller = new AbortController();
        const timer = setTimeout(async () => {
            try {
                const params = buildMappedParams(filters, { type: user?.type, allowedCustomers: allowedCustomers.join('|||') });
                const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/data/dashboard-filters?${params.toString()}`, { signal: controller.signal });
                setFilterOptions({
                    bu: res.data.bus || [], customer: res.data.customers || [], loa_name: res.data.loa_names || [],
                    loa_id: res.data.loa_ids || [], period: res.data.periods || [], wbs_type: res.data.wbs_types || [],
                    wbs: res.data.wbs || [], wbs_description: res.data.wbs_descriptions || [],
                    category_type: res.data.category_types || ['All', 'Local Materials'], active_inactive: ['Active', 'Inactive']
                });
            } catch (err) { if (!axios.isCancel(err)) console.error('Filter options error:', err.message); }
        }, 500);
        return () => { clearTimeout(timer); controller.abort(); };
    }, [JSON.stringify(filters), user]); 

    // ─── FETCH TREND LOAs ───
    useEffect(() => {
        axios.get(`${process.env.REACT_APP_API_URL}/api/data/trend-loas`).then((res) => {
            setTrendLoas(res.data.map(r => r.loa_name));
        }).catch(console.error);
    }, []);

    // ─── FETCH TREND DATA ───
    useEffect(() => {
        const fetchTrendData = async () => {
            try {
                // 🔥 THE SYNC MAGIC: localTrendLoa OVERRIDES the global loa_name just for this graph!
                const params = buildMappedParams(filters, { 
                    loa_name: localTrendLoa || '', // Using loa_names directly forces the backend to read it
                    type: user?.type,
                    // allowedCustomers: allowedCustomers.join('|||')
                    allowedCustomers: allowedCustomers.join(',') // Join by comma
                });

                const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/data/non-committed-trend?${params.toString()}`);
                setTrendData(res.data);
            } catch (err) { console.error("Trend data fetch error:", err); }
        };
        fetchTrendData();
    }, [localTrendLoa, filters]); 

    // ─── FETCH MAIN DASHBOARD DATA ───
    useEffect(() => {
        const controller = new AbortController();
        const timer = setTimeout(async () => {
            try {
                setLoading(true);
                const commonParams = buildMappedParams(filters, { showAll: showAllLoa, type: user?.type, allowedCustomers: allowedCustomers.join('|||') });
                const signal = controller.signal;

                const [buRes, loaRes] = await Promise.all([
                    axios.get(`${process.env.REACT_APP_API_URL}/api/data/analytics-bu?${commonParams.toString()}`, { signal }),
                    axios.get(`${process.env.REACT_APP_API_URL}/api/data/analytics-loa?${commonParams.toString()}`, { signal })
                ]);
                setBuData(buRes.data); 
                setLoaData(loaRes.data);

                let endpoint = 'final-dashboard-table';
                if (tableView === 'loa') endpoint = 'cost-view-table';
                else if (tableView === 'customer') endpoint = 'customer-view-table';
                else if (tableView === 'bu-customer') endpoint = 'bu-customer-view-table';
                else if (tableView === 'customer-bu') endpoint = 'customer-bu-view-table';
                else if (tableView === 'negative-loa') endpoint = 'negative-loa-table';
                else if (tableView === 'overspent-loa') endpoint = 'overspent-loa-table'; // 🔥 NAYA ENDPOINT
                else if (tableView === 'customer-bu-loa') endpoint = 'customer-bu-loa-view-table';
                else if (tableView === 'percent-view') endpoint = 'percent-view-table'; // 🔥 Naya mapping

                const tableRes = await axios.get(`${process.env.REACT_APP_API_URL}/api/data/${endpoint}?${commonParams.toString()}`, { signal });
                setTableData(tableRes.data);
            } catch (err) { if (!axios.isCancel(err)) console.error('Data fetch error:', err.message); } 
            finally { if (!controller.signal.aborted) setLoading(false); }
        }, 500);
        return () => { clearTimeout(timer); controller.abort(); };
    }, [JSON.stringify(filters), showAllLoa, tableView, user]); 

    const exportToExcel = () => {
        const dataToExport = tableData.map(row => { const { asbl_loa, ...rest } = row; return rest; });
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Dashboard Table");
        XLSX.writeFile(workbook, "final_dashboard_table.xlsx");
    };

    const columnsToShow = 
        tableView === 'bu' ? ['bu', 'asbl', 'ptd', 'open_commitment', 'non_committed', 'eac', 'eac_vs_asbl'] :
        tableView === 'bu-customer' ? ['bu', 'customer', 'asbl', 'ptd', 'open_commitment', 'non_committed', 'eac', 'eac_vs_asbl'] :
        tableView === 'loa' ? ['bu', 'customer', 'loa_id', 'loa_name', 'asbl', 'ptd', 'open_commitment', 'non_committed', 'eac', 'eac_vs_asbl'] :
        tableView === 'customer-bu' ? ['customer', 'bu', 'asbl', 'ptd', 'open_commitment', 'non_committed', 'eac', 'eac_vs_asbl'] :
        tableView === 'negative-loa' ? ['bu', 'customer', 'loa_id', 'loa_name', 'asbl', 'ptd', 'open_commitment', 'non_committed', 'eac', 'eac_vs_asbl'] :
        tableView === 'overspent-loa' ? ['bu', 'customer', 'loa_id', 'loa_name', 'asbl', 'ptd', 'open_commitment', 'non_committed', 'eac', 'eac_vs_asbl'] :
        tableView === 'customer-bu-loa' ? ['customer', 'bu', 'loa_name', 'asbl', 'ptd', 'open_commitment', 'non_committed', 'eac', 'eac_vs_asbl'] :
        tableView === 'percent-view' ? ['bu', 'customer', 'loa_id', 'loa_name', 'asbl', 'ptd', 'open_commitment', 'non_committed', 'eac', 'eac_vs_asbl', 'eac_vs_asbl_perc', 'ptd_util_perc'] :
            ['customer', 'asbl', 'ptd', 'open_commitment', 'non_committed', 'eac', 'eac_vs_asbl'];

    // 2. Table Cell Formatting logic
    const renderValue = (col, val) => {
    // 1. Handling Percentages (Database returns numeric 85.50)
        if (['ptd_perc', 'eac_perc'].includes(col)) {
            return val !== null && val !== undefined ? `${parseFloat(val).toFixed(1)}%` : '0.0%';
        }
        
        // 2. Handling Numbers
        if (['asbl', 'ptd', 'open_commitment', 'non_committed', 'eac', 'eac_vs_asbl'].includes(col)) {
            return val !== null && val !== undefined ? formatNum(val) : '0.00';
        }
        
        // 3. Handling Text
        return val || '-';
    };

    const predefinedOrder = ['IP', 'Optics', 'FN'];
    const sortedBuData = [...buData].sort((a, b) => {
        const indexA = predefinedOrder.indexOf(a.bu);
        const indexB = predefinedOrder.indexOf(b.bu);
        return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB);
    });

    const displayLoaData = showAllLoa ? loaData : loaData.slice(0, 10);
    const wbsTypeSelected = filters.wbs_type && filters.wbs_type.length > 0 && !filters.wbs_type.includes('All') && filters.wbs_type.some(v => !v.toLowerCase().includes('warranty/other'));

    // TREND BARS VISIBILITY LOGIC
    const wbsTypesList = filters.wbs_type || [];
    const showAllWbsBars = wbsTypesList.length === 0 || wbsTypesList.includes('All');
    const showProject = showAllWbsBars || wbsTypesList.some(v => String(v).toLowerCase().includes('project'));
    const showAmc = showAllWbsBars || wbsTypesList.some(v => String(v).toLowerCase().includes('amc'));
    const showWarranty = showAllWbsBars || wbsTypesList.some(v => String(v).toLowerCase().includes('warranty'));

    const latestMonthData = trendData.length > 0 ? trendData[trendData.length - 1] : null;
    let latestTotalValue = 0;
    if (latestMonthData) {
        if (showProject) latestTotalValue += Number(latestMonthData.nc_project || 0);
        if (showAmc) latestTotalValue += Number(latestMonthData.nc_amc || 0);
        if (showWarranty) latestTotalValue += Number(latestMonthData.nc_warranty || 0);
    }

    const filteredTrendOptions = trendLoas.filter(item => item.toLowerCase().includes(trendSearchTerm.toLowerCase()));

    return (
        <div className="p-4 md:p-6 bg-[#fcfcfd] min-h-screen relative overflow-hidden font-sans">
            <div className={`transition-all duration-300 ${isSidebarOpen ? 'mr-[380px]' : 'mr-[40px]'}`}>

                {/* ─── WBS TYPE BANNER ─── */}
                <div className={`mb-6 p-4 rounded-3xl text-sm flex flex-wrap items-center gap-3 shadow-sm border transition-colors duration-300 ${wbsTypeSelected ? 'border-green-200 bg-green-50/80 text-green-800' : 'border-orange-200 bg-orange-50/80 text-orange-800'}`}>
                    <span className="text-xl flex-shrink-0">{wbsTypeSelected ? '✅' : '⚠️'}</span>
                    <div className="flex flex-wrap items-center gap-2 flex-1">
                        {!wbsTypeSelected && <span className="font-extrabold uppercase tracking-wide">Please select a specific WBS Type to unlock ASBL &amp; Non Committed values.</span>}
                        {wbsTypeSelected && <span className="font-bold uppercase tracking-wide">WBS Type selected: <strong>{filters.wbs_type.join(', ')}</strong></span>}
                        <WbsTypeInlineDropdown options={filterOptions?.wbs_type || []} selected={filters.wbs_type || []} onChange={onFilterChange} />
                    </div>
                </div>

                {/* ─── Quick views TABLE ─── */}
                <div className="bg-white rounded-[1.5rem] p-6 shadow-lg border border-slate-100 mb-8">
                    <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-6">
                        <h2 className="text-2xl font-black font-semibold text-slate-800 uppercase">Summary (K€)</h2>
                        <div className="flex flex-wrap items-center gap-2 xl:gap-3 ml-auto">
                            <p className="text-xs font-medium text-slate-800 uppercase tracking-wider mr-2">Quick Views:</p>

                                {/* 🔥 Naya Filtered Button Logic */}
                                {(() => {
                                    // 1. Pehle basic buttons ka array banao jo sabko dikhenge
                                    const buttons = [
                                        { key: 'bu', label: 'BU Only' }, 
                                        { key: 'bu-customer', label: 'BU + Customer' }, 
                                        { key: 'loa', label: 'BU + Cust + LOA' },
                                        { key: 'customer', label: 'Customer Only' }, 
                                        { key: 'customer-bu', label: 'Customer + BU' }, 
                                        { key: 'customer-bu-loa', label: 'Customer + BU + LOA' }, 
                                        { key: 'negative-loa', label: '-ve LOA' }
                                    ];

                                    // 2. Agar user Admin ya Super Admin hai, toh hi 'Percent View' add karo
                                    if (user?.type === 'admin' || user?.type === 'super_admin') {
                                        buttons.push({ key: 'percent-view', label: 'Percent View' });
                                    }

                                    // 3. Ab in buttons ko render karo
                                    return buttons.map(({ key, label }) => (
                                        <button
                                            key={key}
                                            onClick={() => setTableView(key)}
                                            className={`border border-slate-300 border-t-4 px-5 py-2 rounded-lg shadow-sm hover:shadow-md transition-all text-sm font-semibold 
                                                ${tableView === key 
                                                    ? 'border-t-[#124191] bg-[#2563EB] text-white' 
                                                    : 'border-t-slate-800 bg-white text-slate-800 hover:bg-slate-50'}`}
                                        >
                                            {label}
                                        </button>
                                    ));
                                })()}
                            <button onClick={exportToExcel} className="border border-slate-300 border-t-4 border-t-blue-500 bg-white px-5 py-2 shadow-sm hover:shadow-md transition-all flex items-center gap-2 rounded-lg">
                                <HiOutlineUpload className="text-blue-600" /> <span className="text-sm font-semibold text-blue-700">Export</span>
                            </button>
                        </div>
                    </div>
                    <div className="overflow-auto max-h-[400px] border border-slate-200 rounded-xl custom-scrollbar">
                        <table className="min-w-full text-sm border-collapse">
                            <thead className="bg-[#004593] sticky top-0 z-10 shadow-sm">
                                <tr>{columnsToShow.map((col) => <th key={col} className="border border-[#003a7a] px-4 py-3 text-center font-black text-white text-[11px] uppercase tracking-wider">{col.replaceAll('_', ' ')}</th>)}</tr>
                            </thead>
                            <tbody>
                                {tableData && tableData.length > 0 ? tableData.map((row, index) => (
                                    <tr key={index} className="hover:bg-slate-50 transition-colors">
                                        {columnsToShow.map((col) => (
                                            <td key={col} className="border border-slate-200 px-4 py-3 text-slate-700 font-medium text-center">
                                                {['asbl','asbl_loa','ptd','open_commitment','non_committed','eac','eac_vs_asbl'].includes(col) 
                                                    ? (row[col] !== null && row[col] !== undefined ? formatNum(row[col]) : "") 
                                                    : ['ptd_util_perc', 'eac_vs_asbl_perc'].includes(col)
                                                        ? <span className="font-bold text-blue-700">{row[col]}%</span> // 🔥 Showing percentage
                                                        : row[col]
                                                }
                                            </td>
                                        ))}
                                    </tr>
                                )) : <tr><td colSpan={columnsToShow.length} className="border border-slate-200 text-center py-8 text-slate-400 font-bold uppercase">No Data Found</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* ─── BU KPI SECTION ─── */}
                <div className="bg-white rounded-[1.5rem] shadow-lg p-6 mb-8 border border-slate-100">
                    <h2 className="text-2xl font-black font-semibold text-slate-800 uppercase tracking-tight mb-6">Business Unit (K€)</h2>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                        {sortedBuData.map((item) => {
                            const ptdPerc = item.asbl > 0 ? ((item.ptd / item.asbl) * 100).toFixed(1) : "0.0";
                            const eacPerc = item.asbl > 0 ? ((item.eac / item.asbl) * 100).toFixed(1) : "0.0";
                            const cardColor = wbsTypeSelected ? 'font-semibold bg-blue-100 border-blue-500 text-black' : 'bg-slate-50 border-slate-200 text-slate-400';

                            return (
                                <div key={item.bu} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex items-center gap-4">
                                    <div className="flex-shrink-0 bg-[#124191] text-white px-3 py-4 rounded-xl flex flex-col items-center justify-center min-w-[70px] min-h-[72px] shadow-inner">
                                        <span className="text-sm font-black tracking-tight">{item.bu}</span>
                                    </div>
                                    <div className="flex-1 grid grid-cols-2 gap-3">
                                        <div className={`p-3 rounded-xl border ${cardColor} text-center flex flex-col justify-center transition-colors`}>
                                            <p className="text-[12px] font-bold uppercase mb-1 opacity-80">PTD Util %</p>
                                            <p className="text-[24px] font-semibold text-lg font-black">{ptdPerc}%</p>
                                        </div>
                                        <div className={`p-3 rounded-xl border ${cardColor} text-center flex flex-col justify-center transition-colors`}>
                                            <p className="text-[12px] font-bold uppercase mb-1 opacity-80">EAC vs ASBL</p>
                                            <p className="text-[24px] font-semibold text-lg font-black">{eacPerc}%</p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="w-full h-[450px] mt-8">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={sortedBuData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }} barGap={10} barCategoryGap="25%">
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f901" />
                                <XAxis dataKey="bu" axisLine={false} tickLine={false} tick={{ fill: '#1e293b', fontSize: 13, fontWeight: 900 }} dy={10}/>
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b800', fontSize: 11 }} />
                                <Tooltip cursor={{ fill: '#f8fafc' }} itemSorter={(item) => ({ ASBL: 1, PTD: 2, EAC: 3 }[item.name] || 999)} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }} formatter={(value, name) => [formatNum(value), String(name).toUpperCase()]} />
                                <Legend verticalAlign="top" align="right" content={() => <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '18px', marginBottom: '10px' }}>{[{ label: 'ASBL', color: '#2563eb' }, { label: 'PTD', color: '#10b981' }, { label: 'EAC', color: '#f59e0b' }].map((item) => <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: 10, height: 10, borderRadius: '50%', background: item.color }} /><span style={{ color: '#475569', fontWeight: 800, fontSize: 12 }}>{item.label}</span></div>)}</div>} />
                                <Bar dataKey="asbl" name="ASBL" fill="#2563eb" radius={[6, 6, 0, 0]} barSize={100}><LabelList dataKey="asbl" position="top" formatter={(v) => formatNum(v)} style={{ fontSize: '16px', fontWeight: '600', fill: '#1e293b' }} offset={10}/></Bar>
                                <Bar dataKey="ptd" name="PTD" fill="#10b981" radius={[6, 6, 0, 0]} barSize={100}><LabelList dataKey="ptd" position="top" formatter={(v) => formatNum(v)} style={{ fontSize: '16px', fontWeight: '600', fill: '#1e293b' }} offset={10}/></Bar>
                                <Bar dataKey="eac" name="EAC" fill="#f59e0b" radius={[6, 6, 0, 0]} barSize={100}><LabelList dataKey="eac" position="top" formatter={(v) => formatNum(v)} style={{ fontSize: '16px', fontWeight: '600', fill: '#1e293b' }} offset={10}/></Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* ─── LOA GRAPH SECTION ─── */}
                <div className="bg-white rounded-[1.5rem] shadow-lg p-6 mb-8 relative border border-slate-100">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-2xl font-black font-semibold text-slate-800 uppercase tracking-tight">LOA Analytics (K€)</h2>
                            <p className="text-slate-400 text-sm mt-1 font-semibold">ASBL • PTD • EAC Comparison</p>
                        </div>
                        <button onClick={() => setShowAllLoa(!showAllLoa)} className="px-5 py-2.5 rounded-xl bg-[#124191] text-white text-[13px] font-bold shadow-md hover:bg-blue-800 transition-all">
                            {showAllLoa ? 'SHOW TOP 10 ONLY' : 'SHOW ALL LOAs'}
                        </button>
                    </div>
                    <div className="w-full max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                        <ResponsiveContainer width="100%" height={showAllLoa ? Math.max(displayLoaData.length * 60, 400) : 500}>
                            <BarChart data={displayLoaData} layout="vertical" barSize={15} margin={{ top: 10, right: 40, left: 80, bottom: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9"/>
                                <XAxis type="number" axisLine={false} tickLine={false} tick={{fill: '#94a3b801'}}/>
                                <YAxis dataKey="loa_name" type="category" width={250} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#475569', fontWeight: 700 }} />
                                <Tooltip itemSorter={(item) => ({ ASBL: 1, PTD: 2, EAC: 3 }[item.name] || 999)} formatter={(value, name) => [formatNum(value), String(name).toUpperCase()]} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }} />
                                <Legend verticalAlign="top" align="right" content={() => <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '18px', marginBottom: '10px' }}>{[{ label: 'ASBL', color: '#2563eb' }, { label: 'PTD', color: '#10b981' }, { label: 'EAC', color: '#f59e0b' }].map((item) => <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: 10, height: 10, borderRadius: '50%', background: item.color }} /><span style={{ color: '#475569', fontWeight: 800, fontSize: 11 }}>{item.label}</span></div>)}</div>} />
                                <Bar dataKey="asbl" name="ASBL" fill="#2563eb" radius={[0, 4, 4, 0]}><LabelList dataKey="asbl" position="right" formatter={(v) => formatNum(v)} style={{ fontSize: '10px', fontWeight: 'bold', fill: '#1e293b' }} /></Bar>
                                <Bar dataKey="ptd" name="PTD" fill="#10b981" radius={[0, 4, 4, 0]}><LabelList dataKey="ptd" position="right" formatter={(v) => formatNum(v)} style={{ fontSize: '10px', fontWeight: 'bold', fill: '#1e293b' }} /></Bar>
                                <Bar dataKey="eac" name="EAC" fill="#f59e0b" radius={[0, 4, 4, 0]}><LabelList dataKey="eac" position="right" formatter={(v) => formatNum(v)} style={{ fontSize: '10px', fontWeight: 'bold', fill: '#1e293b' }} /></Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* ─── 5. TREND GRAPH ─── */}
                <div className="bg-white rounded-[1.5rem] shadow-lg p-6 relative border border-slate-100">
                    <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6">
                        <div>
                            <h2 className="text-2xl font-black font-semibold text-slate-800 uppercase tracking-tight">Non Committed Trend</h2>
                            <p className="text-slate-400 text-sm mt-1 font-semibold">Rolling 6 Months Analysis</p>
                        </div>
                        
                        {/* 🔥 UPDATED: Searchable Dropdown with Text and Subtext */}
                        <div className="flex flex-col items-end w-full md:w-auto">
                            <div className="flex items-center gap-3 w-full md:w-auto">
                                <span className="text-[13px] font-black text-slate-700 uppercase tracking-widest hidden sm:block">
                                    LOA Name:
                                </span>
                                
                                <div className="relative w-full md:w-80" ref={trendDropdownRef}>
                                    <div onClick={() => setIsTrendDropdownOpen(!isTrendDropdownOpen)} className="w-full border-2 border-slate-200 bg-slate-50 text-slate-700 font-bold rounded-xl px-4 py-2.5 flex justify-between items-center cursor-pointer hover:border-blue-400 transition-all shadow-sm">
                                        <span className="truncate">{localTrendLoa ? localTrendLoa.toUpperCase() : 'ALL LOAs'}</span>
                                        <HiChevronDown className={`transition-transform duration-200 ${isTrendDropdownOpen ? 'rotate-180' : ''}`} />
                                    </div>

                                    {isTrendDropdownOpen && (
                                        <div className="absolute z-[100] w-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                                            <div className="p-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                                                <HiSearch className="text-slate-400" />
                                                <input type="text" autoFocus placeholder="Search LOA Name..." value={trendSearchTerm} onChange={(e) => setTrendSearchTerm(e.target.value)} className="w-full bg-transparent text-sm outline-none font-medium" />
                                            </div>
                                            <div className="max-h-60 overflow-y-auto custom-scrollbar">
                                                <div onClick={() => { setLocalTrendLoa(''); setIsTrendDropdownOpen(false); setTrendSearchTerm(''); }} className="px-4 py-3 text-sm font-black text-blue-600 hover:bg-blue-50 cursor-pointer border-b border-slate-50">
                                                    ALL LOAs
                                                </div>
                                                {filteredTrendOptions.length > 0 ? filteredTrendOptions.map((item, idx) => (
                                                    <div key={idx} onClick={() => { setLocalTrendLoa(item); setIsTrendDropdownOpen(false); setTrendSearchTerm(''); }} className="px-4 py-3 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-600 cursor-pointer transition-colors border-b border-slate-50 last:border-0">
                                                        {item.toUpperCase()}
                                                    </div>
                                                )) : <div className="p-4 text-xs text-slate-400 text-center italic">No LOAs found</div>}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            {/* 🔥 Sub-text under the dropdown */}
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 md:mr-1">
                                This filter applies to this graph only.
                            </p>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4 mb-8 max-w-xl">
                        <div className="bg-green-50 border border-green-100 rounded-2xl p-5 shadow-sm">
                            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                Total Updated LOAs
                            </div>
                            <div className="text-2xl font-black text-green-700 mt-1">
                                {trendLoas.length}
                            </div>
                        </div>
                        <div className="bg-purple-50 border border-purple-100 rounded-2xl p-5 shadow-sm">
                            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Available Months</div>
                            <div className="text-2xl font-black text-purple-700 mt-1">{trendData.length}</div>
                        </div>
                    </div>

                    <div className="w-full h-[450px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={trendData} margin={{ top: 25, right: 30, left: 20, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="month_year" axisLine={false} tickLine={false} tick={{ fill: '#1e293b', fontSize: 13, fontWeight: 800 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }} formatter={(value, name) => [formatNum(value), String(name).toUpperCase()]} />
                                <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px' }} formatter={(value) => <span style={{ color: '#475569', fontWeight: '800', textTransform: 'uppercase', fontSize: '12px' }}>{value}</span>} />
                                {showProject && <Bar dataKey="nc_project" name="Project" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={60}><LabelList dataKey="nc_project" position="top" formatter={(v) => v > 0.01 ? formatNum(v) : ''} style={{ fontSize: '11px', fontWeight: '800', fill: '#1e293b' }} offset={8} /></Bar>}
                                {showAmc && <Bar dataKey="nc_amc" name="AMC" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={60}><LabelList dataKey="nc_amc" position="top" formatter={(v) => v > 0.01 ? formatNum(v) : ''} style={{ fontSize: '11px', fontWeight: '800', fill: '#1e293b' }} offset={8} /></Bar>}
                                {showWarranty && <Bar dataKey="nc_warranty" name="Warranty/Other" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={60}><LabelList dataKey="nc_warranty" position="top" formatter={(v) => v > 0.01 ? formatNum(v) : ''} style={{ fontSize: '11px', fontWeight: '800', fill: '#1e293b' }} offset={8} /></Bar>}
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* 🔵 FIXED POWER BI SIDEBAR */}
            <div className={`fixed right-0 top-0 h-screen bg-white border-l border-slate-200 transition-all duration-300 z-[2001] shadow-2xl flex flex-col ${isSidebarOpen ? 'w-[350px]' : 'w-[40px]'}`}>
                {!isSidebarOpen && (
                    <div onClick={() => setIsSidebarOpen(true)} className="h-full w-full flex flex-col items-center pt-8 cursor-pointer hover:bg-slate-50 transition-colors">
                        <HiOutlineFilter className="text-xl mb-4 text-blue-600" />
                        <span className="font-black text-[13px] tracking-[0.2em] text-slate-700 uppercase" style={{ writingMode: 'vertical-lr', textOrientation: 'mixed' }}>Filters</span>
                    </div>
                )}
                {isSidebarOpen && (
                    <>
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                            <span className="font-black text-lg text-slate-800 tracking-tight uppercase">Filters Pane</span>
                            <div className="flex gap-3 items-center">
                                <button onClick={onResetFilters} className="text-[11px] font-black uppercase text-red-500 hover:underline">Reset All</button>
                                <button onClick={() => setIsSidebarOpen(false)} className="text-slate-400 hover:text-slate-600"><HiChevronRight className="text-2xl" /></button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar bg-white">
                            <FilterBar filters={filters} options={filterOptions} onFilterChange={onFilterChange} onReset={onResetFilters} />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default Dashboard;