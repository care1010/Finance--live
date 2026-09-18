import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';


const CJ74_COLS = [
    { data: 'sap_wbs', title: 'WBS' }, { data: 'year', title: 'Year' }, { data: 'per', title: 'Per' },
    { data: 'cost_element', title: 'Cost Element' }, { data: 'cost_element_name', title: 'Cost Element Name' },
    { data: 'ptd_val', title: 'PTD VAL (K€)', className: 'text-right' }, { data: 'period', title: 'Period' },
    { data: 'cocd', title: 'CoCd' }, { data: 'proj_def', title: 'Project Def' }, { data: 'profit_ctr', title: 'Profit Ctr' },
    { data: 'tcurr', title: 'T Curr' }, { data: 'cost_element_descr', title: 'COST ELEMENT DESCR' },
    { data: 'refdocno', title: 'Ref Doc No' }, { data: 'document_no', title: 'Document No' },
    { data: 'doc_date', title: 'Doc Date' }, { data: 'postg_date', title: 'Postg Date' },
    { data: 'offst_acct', title: 'Offset Acct' }, { data: 'material', title: 'Material' },
    { data: 'material_description', title: 'Material Description' }, { data: 'created_on', title: 'Created On' },
    { data: 'user_name', title: 'User Name' }, { data: 'pur_doc', title: 'Pur Doc' },
    { data: 'purchase_order_text', title: 'Purchase Order Text' }, { data: 'loa_id', title: 'LOA ID' }
];

const CJI5_COLS = [
    { data: 'project_def', title: 'PROJ DEF' }, { data: 'sap_wbs', title: 'WBS' },
    { data: 'oc_val', title: 'OC VAL (K€)', className: 'text-right' }, { data: 'refdocno', title: 'REFDOCNO' },
    { data: 'item', title: 'ITEM' }, { data: 'co_object_name', title: 'CO_OBJECT_NAME' },
    { data: 'supplier', title: 'SUPPLIER' }, { data: 'name', title: 'NAME' },
    { data: 'exch_rate', title: 'EXCH_RATE' }, { data: 'year', title: 'YEAR' },
    { data: 'per', title: 'PER' }, { data: 'period', title: 'Period' }, { data: 'cost_element', title: 'COST_ELEMENT' },
    { data: 'cost_element_descr', title: 'COST_ELEMENT_DESCR' }, { data: 'matl_group', title: 'MATL GROUP' },
    { data: 'material', title: 'MATERIAL' }, { data: 'description', title: 'DESCRIPTION' },
    { data: 'user_name', title: 'USER_NAME' }, { data: 'docc', title: 'DOCC' },
    { data: 'quantity', title: 'QUANTITY' }, { data: 'qty_plan', title: 'QTY_PLAN' },
    { data: 'debit_date', title: 'DEBIT_DATE' }, { data: 'doc_date', title: 'DOC_DATE' },
    { data: 'cocode', title: 'COCODE' }, { data: 'report_currency', title: 'REPORT_CURRENCY' },
    { data: 'tcurr', title: 'TCURR' }, { data: 'value_tcurr', title: 'VALUE TCUR' },
    { data: 'obj_curr', title: 'OBJ CURR' }, { data: 'value_in_obj_crcy', title: 'VALUE IN OBJ CRCY' },
    { data: 'loa_id', title: 'LOA ID' }
];


const DrillDownPage = () => {
    const location = useLocation();
    const navigate = useNavigate();
    
    // 🟢 READ PAYLOAD: Checks location.state or fallback to SessionStorage for New Tab!
    const payload = useMemo(() => {
        if (location.state && location.state.row) return location.state;
        const saved = sessionStorage.getItem('drilldown_payload');
        return saved ? JSON.parse(saved) : {};
    }, [location.state]);

    const { field, row, filters } = payload;
    
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(100);

    const fetchData = async () => {
        if (!row?.loa_id || !row?.categories) {
            setLoading(false);
            return;
        }

        const controller = new AbortController();
        setLoading(true);
        
        try {
            const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";
            const res = await axios.post(
                `${API_URL}/api/data/drilldown`,
                { field, row, filters },
                { signal: controller.signal }
            );
            setData(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            if (err.name !== "CanceledError") {
                console.error("Fetch Data Error:", err);
            }
        } finally {
            setLoading(false);
        }
        return () => controller.abort();
    };
    
    useEffect(() => {
        fetchData();
    }, [field, row, filters]);

    const filteredData = useMemo(() => {
        return data.filter(item =>
            Object.values(item).some(val =>
                String(val ?? "").toLowerCase().includes(searchTerm.toLowerCase())
            )
        );
    }, [data, searchTerm]);

    const calculateTotal = () => {
        return filteredData.reduce((sum, item) => {
            const val = field === "ptd"
                ? parseFloat(item.ptd_val || 0)
                : parseFloat(item.open_commitment || item.oc_val || 0);
            return sum + val;
        }, 0);
    };

    const handleExport = () => {
        const params = new URLSearchParams({
            field,
            loa_id: row?.loa_id,
            categories: row?.categories,
            filters: JSON.stringify(filters || {}) 
        });
        window.location.href = `${process.env.REACT_APP_API_URL}/api/data/export-drilldown?${params.toString()}`;
    };

    const indexOfLastRow = currentPage * rowsPerPage;
    const indexOfFirstRow = indexOfLastRow - rowsPerPage;
    const currentRows = filteredData.slice(indexOfFirstRow, indexOfLastRow);
    const totalPages = Math.ceil(filteredData.length / rowsPerPage);

    const isPTD = field === 'ptd';

    const columns = field === 'ptd' ? CJ74_COLS : CJI5_COLS;

    // Formatting Helpers
    const formatValue = (key, val) => {
        if (val === null || val === undefined) return '-';
        if (key.includes('date') || key === 'created_on' || key === 'postg_date') {
            try { return new Date(val).toLocaleDateString('en-GB'); } catch(e) { return val; }
        }
        if (key === 'ptd_val' || key === 'oc_val' || key.includes('value_')) {
            return Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
        return val.toString();
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] p-6 lg:p-8">
            
            {/* 🚀 TOP HEADER SECTION */}
            <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 mb-6 bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                
                {/* LEFT: Title + Details + Active Filters */}
                <div className="space-y-3">
                    <button 
                        onClick={() => window.close()} 
                        className="group flex items-center gap-1.5 text-slate-500 hover:text-blue-600 transition-colors w-fit"
                    >
                        <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                        </svg>
                        <span className="text-xs font-bold uppercase tracking-wider">Close Tab</span>
                    </button>
                    
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-inner ${isPTD ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                            {isPTD ? '📈' : '⏳'}
                        </div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
                            {isPTD ? 'PTD Details' : 'Commitment Details'}
                        </h1>
                    </div>

                    {/* Row Item Details */}
                    <div className="flex items-center flex-wrap gap-2 text-xs font-bold">
                        <span className="bg-slate-800 text-white px-3 py-1 rounded-md shadow-sm">
                            {row?.loa_id || 'N/A'}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-md border border-slate-200 truncate max-w-[250px]" title={row?.loa_name}>
                            {row?.loa_name || 'N/A'}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-md border border-blue-100">
                            {row?.categories || 'N/A'}
                        </span>
                    </div>

                    {/* 🔥 ALL APPLIED ACTIVE FILTERS DISPLAY */}
                    {filters && Object.keys(filters).some(k => Array.isArray(filters[k]) ? filters[k].length > 0 && !filters[k].includes('All') : filters[k] && filters[k] !== 'All') && (
                        <div className="flex items-center flex-wrap gap-2 pt-2 border-t border-slate-100">
                            <span className="text-[10px] font-black uppercase text-slate-400">Applied Filters:</span>
                            {Object.entries(filters).map(([k, v]) => {
                                const valArr = Array.isArray(v) ? v.filter(x => x !== 'All') : (v && v !== 'All' ? [v] : []);
                                if (valArr.length === 0) return null;
                                return (
                                    <span key={k} className="bg-indigo-50 text-indigo-800 text-[12px] font-bold px-3 py-1 rounded-full border border-indigo-100">
                                        <strong className="uppercase mr-1">{k.replace('_', ' ')}:</strong> {valArr.join(', ')}
                                    </span>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* RIGHT: Compact KPI Cards */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className={`flex flex-col justify-center px-5 py-3 rounded-2xl border-2 ${isPTD ? 'bg-emerald-50 border-emerald-100' : 'bg-blue-50 border-blue-100'} min-w-[160px]`}>
                        <span className={`text-[10px] font-black uppercase tracking-wider ${isPTD ? 'text-emerald-600' : 'text-blue-600'}`}>
                            Total Value (KEUR)
                        </span>
                        <span className={`text-2xl font-black tabular-nums ${isPTD ? 'text-emerald-700' : 'text-blue-700'}`}>
                            {calculateTotal().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    </div>

                    <div className="flex flex-col justify-center px-5 py-3 rounded-2xl bg-white border border-slate-200 shadow-sm min-w-[130px]">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                            Records Found
                        </span>
                        <span className="text-2xl font-black tabular-nums text-slate-800">
                            {filteredData.length.toLocaleString('en-IN')}
                        </span>
                    </div>
                </div>

            </div>

            {/* TABLE CONTROLS */}
            <div className="bg-white rounded-[1.5rem] shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-50/50">
                    <div className="flex items-center flex-wrap gap-4">
                        <div className="relative">
                            <input 
                                type="text" 
                                placeholder="Search in records..." 
                                className="pl-4 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all w-64 shadow-sm"
                                value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                            />
                        </div>
                        
                        <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-sm">
                            <span className="text-xs font-bold text-slate-500 uppercase">Show</span>
                            <select
                                value={rowsPerPage}
                                onChange={(e) => {
                                    setRowsPerPage(e.target.value === "ALL" ? (filteredData.length || data.length) : Number(e.target.value));
                                    setCurrentPage(1);
                                }}
                                className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer"
                            >
                                <option value="100">100</option>
                                <option value="200">200</option>
                                <option value="500">500</option>
                                <option value="ALL">ALL</option>
                            </select>
                        </div>
                    </div>
                    
                    <button 
                        onClick={handleExport} 
                        className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-black text-white px-5 py-2 rounded-xl font-bold text-xs uppercase tracking-wide transition-all shadow-md active:scale-95"
                    >
                        Export Excel
                    </button>
                </div>

                {/* DATA TABLE */}
                <div className="overflow-x-auto max-h-[60vh] custom-scrollbar">
                    <table className="w-full">
                        <thead className="sticky top-0 z-10">
                            <tr className="bg-slate-100 border-b border-slate-200 shadow-sm">
                                {/* 🔥 FIXED: Ab hum columns array se TITLE uthayenge na ki database se */}
                                {columns.map((col, index) => (
                                    <th 
                                        key={col.data} 
                                        className={`px-4 py-3 text-left text-[14px] font-black text-slate-600 uppercase tracking-wider whitespace-nowrap ${index === 0 ? 'pl-6' : ''}`}
                                    >
                                        {col.title}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="text-[14px] font-medium text-slate-700 bg-white">
                            {currentRows.length > 0 ? currentRows.map((item, index) => (
                                <tr key={index} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                    {/* 🔥 FIXED: Ab hum columns array ke sequence mein DATA fill karenge */}
                                    {columns.map((col, i) => {
                                        const val = item[col.data];
                                        const isTargetColumn = col.data === 'ptd_val' || col.data === 'oc_val';
                                        return (
                                            <td 
                                                key={i} 
                                                className={`px-4 py-3 whitespace-nowrap ${i === 0 ? 'pl-6' : ''} ${isTargetColumn ? 'bg-sky-50 font-black text-blue-700 border-x border-sky-100 text-right' : ''}`}
                                            >
                                                {formatValue(col.data, val)}
                                            </td>
                                        );
                                    })}
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={data.length > 0 ? Object.keys(data[0]).length : 1} className="p-16 text-center">
                                        {loading ? (
                                            <span className="text-slate-500 font-bold text-sm">Fetching detailed records...</span>
                                        ) : (
                                            <span className="text-slate-400 font-medium italic">No records found matching your search.</span>
                                        )}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default DrillDownPage;