import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { HiOutlinePlus, HiOutlineTrash, HiOutlineTable, HiOutlineClipboard, HiOutlineDocumentDownload, HiOutlineUpload } from "react-icons/hi";

const AddProject = ({ user }) => {
    const [mode, setMode] = useState('new'); 
    const [inputMethod, setInputMethod] = useState('paste'); 
    const [pasteData, setPasteData] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [loading, setLoading] = useState(false);

    // 🔥 NEW: States for Dropdown Options
    const [buOptions, setBuOptions] = useState(['IP', 'Optics', 'FN']);
    const [customerOptions, setCustomerOptions] = useState([]);

    // 🔥 NEW: States for LOA Dropdowns
    const [loaIdOptions, setLoaIdOptions] = useState([]);
    const [loaNameOptions, setLoaNameOptions] = useState([]);

    const initialRow = { bd: '', customer: '', loa_id: '', loa_name: '', wbs_type: '', wbs: '', wbs_desc: '' };
    const [gridData, setGridData] = useState([{ ...initialRow }]);

    // 🔥 NEW: Fetch existing BUs and Customers from DB on mount
    useEffect(() => {
    const fetchDropdownData = async () => {
        try {
            // 🔥 IMPORTANT: Join by '|||' to match your updated RLS logic
            const customersStr = user?.allowedCustomers ? user.allowedCustomers.join('|||') : '';
            
            const params = new URLSearchParams({
                type: user?.type || 'user',
                allowedCustomers: customersStr
            });

            // Calling the new dedicated endpoint
            const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/data/add-project-options?${params.toString()}`);
            
            if (res.data.bus) setBuOptions(res.data.bus);
            if (res.data.customers) setCustomerOptions(res.data.customers); // 🔥 Corrected key
            // 🔥 NEW: Setting LOA options
                if (res.data.loaIds) setLoaIdOptions(res.data.loaIds);
                if (res.data.loaNames) setLoaNameOptions(res.data.loaNames);
        } catch (err) {
            console.error("Error fetching dropdown options:", err);
        }
    };
    if (user) fetchDropdownData();
}, [user]);

    const handleDownloadTemplate = () => {
        window.location.href = `${process.env.REACT_APP_API_URL}/api/data/download-project-template`;
    };

    const handleFileSelect = (e) => {
        setSelectedFile(e.target.files[0]);
    };

    const addRow = () => setGridData([...gridData, { ...initialRow }]);
    const deleteRow = (index) => {
        const updated = gridData.filter((_, i) => i !== index);
        setGridData(updated.length ? updated : [{ ...initialRow }]);
    };
    const handleGridChange = (index, field, value) => {
        const updated = [...gridData];
        updated[index][field] = value;
        setGridData(updated);
    };

    const handleProcess = async () => {
    // 🔥 STEP 1: Pehle validation check karo Loading dikhane se PEHLE
    try {
        if (inputMethod === 'paste' && !pasteData.trim()) {
            return Swal.fire({ icon: 'info', title: 'Information', text: 'Please paste data first!' });
        } 
        
        if (inputMethod === 'file' && !selectedFile) {
            return Swal.fire({ icon: 'info', title: 'Information', text: 'Please select a file first!' });
        }

        if (inputMethod === 'grid') {
            const rows = gridData.map(r => [r.bd, r.customer, r.loa_id, r.loa_name, r.wbs_type, r.wbs, r.wbs_desc]);
            const filteredRows = rows.filter(row => row.some(cell => cell && String(cell).trim() !== ''));
            if (filteredRows.length === 0) {
                return Swal.fire({ icon: 'info', title: 'Information', text: 'Input the data first!' });
            }
        }

        // 🔥 STEP 2: Agar validation sahi hai, tab Loading dikhao
        setLoading(true);
        Swal.fire({
            title: mode === 'new' ? 'Saving Data...' : 'Updating Project...',
            html: 'Please wait while data is being synchronized.',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        // 🔥 STEP 3: API Calls
        if (inputMethod === 'paste') {
            const res = await axios.post(`${process.env.REACT_APP_API_URL}/api/data/process-project-paste`, { rawText: pasteData, mode, email: user?.email });
            handleSuccess(res.data.message);
        } 
        else if (inputMethod === 'file') {
            const formData = new FormData();
            formData.append('file', selectedFile);
            formData.append('mode', mode);
            formData.append('email', user?.email);
            const res = await axios.post(`${process.env.REACT_APP_API_URL}/api/data/upload-project-file`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            handleSuccess(res.data.message);
        } 
        else if (inputMethod === 'grid') {
            const headers = ['BUSINESS DIVISION (BD)', 'CT NAME (REPORTED CUST)', 'OPPORTUNITY CODE', 'PROJECT DESCRIPTION', 'WBS TYPE', 'WBS', 'WBS DESCRIPTION'];
            const rows = gridData.map(r => [r.bd, r.customer, r.loa_id, r.loa_name, r.wbs_type, r.wbs, r.wbs_desc]);
            const filteredRows = rows.filter(row => row.some(cell => cell && String(cell).trim() !== ''));
            
            const res = await axios.post(`${process.env.REACT_APP_API_URL}/api/data/process-project-paste`, { 
                rawText: [headers, ...filteredRows].map(r => r.join('\t')).join('\n'), 
                mode,
                email: user?.email
            });
            handleSuccess(res.data.message);
        }

    } catch (err) {
        // 🔥 STEP 4: Sirf actual Server/Network errors ke liye hi "Error" dikhao
        Swal.fire({ 
            icon: 'error', 
            title: 'Action Failed', 
            text: err.response?.data?.error || err.message 
        });
    } finally {
        setLoading(false);
    }
};

    const handleSuccess = (msg) => {
        Swal.fire({ icon: 'success', title: 'data Updated Success', text: msg });
        setPasteData('');
        setSelectedFile(null);
        setGridData([{ ...initialRow }]);
    };

    return (
        <div className="p-8 max-w-7xl mx-auto relative">
            <div className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100">
                
                {/* TABS */}
                <div className="flex border-b border-slate-100 bg-slate-50/50">
                    <button onClick={() => setMode('new')} className={`flex-1 py-5 font-black transition-all ${mode === 'new' ? 'border-b-4 border-blue-600 text-blue-600 bg-white' : 'text-slate-400'}`}>🆕 Add New Project</button>
                    <button onClick={() => setMode('existing')} className={`flex-1 py-5 font-black transition-all ${mode === 'existing' ? 'border-b-4 border-blue-600 text-blue-600 bg-white' : 'text-slate-400'}`}>🔄 Add WBS in Existing LOA</button>
                </div>

                {/* HEADER */}
                <div className="p-8 border-b border-slate-50 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-black text-slate-600">{mode === 'new' ? "New Project Entry" : "Append WBS to Existing"}</h2>
                        <p className="text-orange-400 text-sm font-medium">Choose your preferred input method below. Download the template to upload the data</p>
                    </div>
                    <button onClick={handleDownloadTemplate} className="bg-blue-600 text-white px-6 py-2.5 rounded-2xl font-bold shadow-lg flex items-center gap-2 hover:scale-105 transition-all"><HiOutlineDocumentDownload /> Export Template</button>
                </div>

                {/* INPUT METHOD SELECTOR */}
                <div className="px-8 pt-6 flex gap-8 justify-center border-b pb-6">
                    {[
                        { id: 'paste', label: 'Paste Data', icon: <HiOutlineClipboard /> },
                        { id: 'file', label: 'Upload File', icon: <HiOutlineUpload /> },
                        { id: 'grid', label: 'Interactive Form', icon: <HiOutlineTable /> }
                    ].map(item => (
                        <label key={item.id} className={`flex items-center gap-2 cursor-pointer p-3 rounded-xl transition-all ${inputMethod === item.id ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200' : 'text-slate-500 hover:bg-slate-50'}`}>
                            <input type="radio" name="method" value={item.id} checked={inputMethod === item.id} onChange={() => setInputMethod(item.id)} className="hidden" />
                            {item.icon} <span className="font-bold text-sm">{item.label}</span>
                        </label>
                    ))}
                </div>

                <div className="p-8">
                    {inputMethod === 'paste' && (
                        <textarea className="w-full h-80 p-6 rounded-[2rem] border border-slate-200 bg-slate-50 font-mono text-sm outline-none focus:border-blue-500 transition-all resize-none" placeholder="Paste tab-separated data here..." value={pasteData} onChange={(e) => setPasteData(e.target.value)} />
                    )}

                    {inputMethod === 'file' && (
                        <div className="border-2 border-dashed border-slate-200 rounded-[2rem] p-10 h-80 flex flex-col items-center justify-center gap-3 relative bg-slate-50/50">
                            <input type="file" accept=".xlsx,.xls" onChange={handleFileSelect} className="absolute inset-0 opacity-0 cursor-pointer" />
                            <HiOutlineUpload className="text-4xl text-slate-400" />
                            <span className="font-bold text-blue-600">{selectedFile ? selectedFile.name : "Click or Drag template file here"}</span>
                        </div>
                    )}

                    {inputMethod === 'grid' && (
                        <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[13px]">
                                    <tr>
                                        <th className="p-3 w-32 text-center">BU</th>
                                        <th className="p-3 w-48">Customer</th>
                                        <th className="p-3 w-40">LOA ID</th>
                                        <th className="p-3 w-56">Project Name</th>
                                        <th className="p-3 w-32">WBS Type</th>
                                        <th className="p-3 w-40">WBS Element</th>
                                        <th className="p-3">WBS Description</th>
                                        <th className="p-3 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {gridData.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                                            {/* 🔥 BU Dropdown */}
                                            <td className="p-1">
                                                <select className="w-full p-2 bg-transparent outline-none cursor-pointer font-semibold text-slate-700" value={row.bd} onChange={(e) => handleGridChange(idx, 'bd', e.target.value)}>
                                                    <option value="">Select BU</option>
                                                    {buOptions.map(bu => <option key={bu} value={bu}>{bu}</option>)}
                                                </select>
                                            </td>
                                            {/* 🔥 Customer Dropdown */}
                                            <td className="p-1">
                                                <select 
                                                    className="w-full p-2 bg-transparent outline-none cursor-pointer font-semibold text-slate-700 border-b border-transparent focus:border-blue-400" 
                                                    value={row.customer} 
                                                    onChange={(e) => handleGridChange(idx, 'customer', e.target.value)}
                                                >
                                                    <option value="">Select Customer</option>
                                                    {customerOptions.map(cust => (
                                                        <option key={cust} value={cust}>{cust}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            {/* 🔥 LOA ID: Conditional Dropdown */}
                    <td className="p-1">
                        {mode === 'existing' ? (
                            <select 
                                className="w-full p-2 bg-transparent outline-none cursor-pointer font-bold text-blue-600 border-b border-transparent focus:border-blue-400"
                                value={row.loa_id}
                                onChange={(e) => handleGridChange(idx, 'loa_id', e.target.value)}
                            >
                                <option value="">Select ID</option>
                                {loaIdOptions.map(id => <option key={id} value={id}>{id}</option>)}
                            </select>
                        ) : (
                            <input className="w-full p-2 bg-transparent outline-none focus:bg-white font-bold text-blue-600 border-b border-transparent focus:border-blue-400" value={row.loa_id} onChange={(e) => handleGridChange(idx, 'loa_id', e.target.value)} placeholder="24.IN.XXXX" />
                        )}
                    </td>

                    {/* 🔥 LOA NAME: Conditional Dropdown */}
                    <td className="p-1">
                        {mode === 'existing' ? (
                            <select 
                                className="w-full p-2 bg-transparent outline-none cursor-pointer text-slate-700 border-b border-transparent focus:border-blue-400"
                                value={row.loa_name}
                                onChange={(e) => handleGridChange(idx, 'loa_name', e.target.value)}
                            >
                                <option value="">Select Project</option>
                                {loaNameOptions.map(name => <option key={name} value={name}>{name}</option>)}
                            </select>
                        ) : (
                            <input className="w-full p-2 bg-transparent outline-none focus:bg-white" value={row.loa_name} onChange={(e) => handleGridChange(idx, 'loa_name', e.target.value)} placeholder="Project XYZ" />
                        )}
                    </td>
                                            <td className="p-1">
                                                <select className="w-full p-2 bg-transparent outline-none cursor-pointer" value={row.wbs_type} onChange={(e) => handleGridChange(idx, 'wbs_type', e.target.value)}>
                                                    <option value="">Select</option>
                                                    <option value="Project">Project</option>
                                                    <option value="AMC">AMC</option>
                                                    <option value="Warranty/Other">Warranty/Other</option>
                                                </select>
                                            </td>
                                            <td className="p-1"><input className="w-full p-2 bg-transparent outline-none focus:bg-white font-mono" value={row.wbs} onChange={(e) => handleGridChange(idx, 'wbs', e.target.value)} placeholder="INL000..." /></td>
                                            <td className="p-1"><input className="w-full p-2 bg-transparent outline-none focus:bg-white" value={row.wbs_desc} onChange={(e) => handleGridChange(idx, 'wbs_desc', e.target.value)} /></td>
                                            <td className="p-1 text-center"><button onClick={() => deleteRow(idx)} className="text-red-400 hover:text-red-600 p-2"><HiOutlineTrash /></button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <button onClick={addRow} className="w-full py-3 bg-slate-50 text-blue-600 font-bold flex items-center justify-center gap-2 hover:bg-blue-50 transition-all border-t border-slate-200"><HiOutlinePlus /> Add Row</button>
                        </div>
                    )}
                </div>

                <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex justify-center gap-6">
                    <button onClick={handleProcess} disabled={loading} className={`px-12 py-4 rounded-2xl font-bold text-sm text-white shadow-xl transition-all hover:scale-105 active:scale-95 disabled:opacity-50 ${mode === 'new' ? 'bg-blue-600 shadow-blue-100' : 'bg-indigo-600 shadow-indigo-100'}`}>
                        {mode === 'new' ? "Save New Project" : "Add WBS in Existing LOA"}
                    </button>
                    <button onClick={() => { setPasteData(''); setSelectedFile(null); setGridData([{ ...initialRow }]); }} className="px-8 py-4 rounded-2xl font-bold text-sm bg-slate-200 text-slate-600 hover:bg-slate-100 transition-all">Clear</button>
                </div>
            </div>
        </div>
    );
};

export default AddProject;