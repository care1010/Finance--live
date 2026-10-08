import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { HiOutlinePlus, HiX, HiDownload, HiCloudUpload, HiSearch, HiChevronDown } from "react-icons/hi";

const PtdAutomation = () => {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);

    // Searchable Dropdown States
    const [options, setOptions] = useState({ categories: [], types: [] });
    const [searchTerm, setSearchTerm] = useState('');
    const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
    const dropdownRef = useRef(null);

    // 1. Initial State define karein (Component ke andar)
    const initialFormState = {
        category: '',
        cost_element_group_name: '',
        cost_element: '',
        cost_element_name: '',
        cost_element_desc: '',
        cost_revenue: '',
        categories: ''
    };

    // add other states in components
    const [mappingForm, setMappingForm] = useState(initialFormState);

    // 2. 🔥 Naya function Modal handle karne ke liye
    const closeMappingModal = () => {
        setMappingForm(initialFormState); // Saare fields blank
        setSearchTerm('');               // Dropdown search saaf
        setShowCategoryDropdown(false);   // Dropdown band
        setShowModal(false);              // Modal band
    };

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowCategoryDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        if (showModal) fetchOptions();
    }, [showModal]);

    const fetchOptions = async () => {
        try {
            const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/data/mapping-options`);
            setOptions(res.data);
        } catch (err) { console.error("Error fetching options", err); }
    };

    // Filter categories based on search input
    const filteredCategories = options.categories.filter(cat => 
        cat.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleUpload = async () => {
        if (!file) return Swal.fire({ icon: 'warning', title: 'No File', text: 'Select file first' });
        const formData = new FormData();
        formData.append('file', file);
        setLoading(true);
        Swal.fire({ title: 'Processing...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        try {
            const res = await axios.post(`${process.env.REACT_APP_API_URL}/api/data/ptd-automation`, formData);
            Swal.fire({ icon: 'success', title: 'Success', text: res.data.message });
            setFile(null);
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Failed', text: err.response?.data?.error || 'Error' });
        } finally { setLoading(false); }
    };

    // 3. Update Submit handler (Success block ke andar)
    const handleMappingSubmit = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            const res = await axios.post(`${process.env.REACT_APP_API_URL}/api/data/add-cost-mapping`, mappingForm);
            
            await Swal.fire({
                icon: 'success',
                title: 'Success',
                text: res.data.message,
                confirmButtonColor: '#16a34a'
            });

            // 🔥 Reset form and close
            closeMappingModal(); 

        } catch (err) {
            if (err.response && err.response.status === 409) {
                await Swal.fire({
                    icon: 'info',
                    title: 'Mapping Already Exists',
                    text: err.response.data.message,
                    confirmButtonColor: '#3b82f6'
                });
                // Note: Error ke case mein hum form clear nahi kar rahe taaki user correction kar sake
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Action Failed',
                    text: 'Something went wrong while saving. Please try again.',
                    confirmButtonColor: '#dc2626'
                });
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-5xl mx-auto mt-10">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                
                    <h2 className="text-2xl font-black text-slate-800">
                        ⚙️ Upload PTD Data
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">Upload cost files and manage master mappings.</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-5 py-2.5 bg-white border-2 border-emerald-500 text-emerald-600 rounded-xl font-bold text-sm transition-all hover:bg-emerald-50 active:scale-95 shadow-sm">
                        <HiOutlinePlus /> Add Cost Element
                    </button>
                    <button onClick={() => window.location.href = `${process.env.REACT_APP_API_URL}/api/data/download-ptd-template`} className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white bg-blue-600 shadow-lg transition-all hover:bg-blue-700">
                        📥 Export PTD Template
                    </button>
                </div>
            </div>
            <p className="text-slate-600 text-base mt-2 mb-7">NOTE: If any error occurred while uploading the PTD data, please refer to the template provided to avoid mismatch of column headers. </p>

            {/* Upload Section */}
            <div className="bg-white rounded-3xl shadow-xl p-8 border border-slate-100">
                <div className="border-2 border-dashed border-slate-200 rounded-3xl p-10 text-center hover:border-blue-400 bg-slate-50">
                    <input type="file" onChange={(e) => setFile(e.target.files[0])} className="hidden" id="ptd-file" />
                    <label htmlFor="ptd-file" className="cursor-pointer">
                        <div className="text-5xl mb-4">📁</div>
                        <p className="text-slate-600 font-bold">{file ? file.name : "Click to select Monthly Excel File"}</p>
                        <p className="text-slate-400 text-xs mt-2">Supports .xlsx (Sheets: CJI5, CJ74)</p>
                    </label>
                </div>
                <button onClick={handleUpload} disabled={loading} className="mt-8 w-[200px] mx-auto block py-4 rounded-2xl font-bold text-white shadow-lg bg-blue-600 hover:bg-blue-700 active:scale-95">
                    {loading ? "Processing..." : "Upload Data"}
                </button>
            </div>

            {/* Searchable Modal */}
            {showModal && (
                <div className="fixed inset-0 z-40 flex items-center justify-center px-4">
            {/* Backdrop ka z-index handle karein */}
                <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowModal(false)}></div>
                
                    <div className="bg-white w-full max-w-3xl rounded-[2rem] shadow-2xl relative z-50 animate-in zoom-in duration-200 overflow-visible">
                        <div className="bg-slate-50 px-8 py-5 border-b border-slate-100 flex justify-between items-center rounded-t-[2rem]">
                            <h3 className="text-lg font-black text-slate-800 uppercase">New Cost Element Mapping</h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-red-500"><HiX size={24} /></button>
                        </div>

                        <form onSubmit={handleMappingSubmit} className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-visible">
                            
                            {/* Cost Element */}
                            <div>
                                <label className="block text-[12px] font-black text-slate-600 uppercase mb-1 ml-1">Cost Element*</label>
                                <input required type="text" placeholder="e.g. 61900010" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 font-bold" value={mappingForm.cost_element} onChange={(e) => setMappingForm({...mappingForm, cost_element: e.target.value})} />
                            </div>

                            {/* 🔥 SEARCHABLE REPORTING CATEGORY */}
                            <div className="relative" ref={dropdownRef}>
                                <label className="block text-[12px] font-black text-slate-600 uppercase mb-1 ml-1">Category*</label>
                                <div 
                                    onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center cursor-pointer font-bold text-slate-700 hover:border-blue-400"
                                >
                                    <span className="truncate">{mappingForm.categories || "Select Category"}</span>
                                    <HiChevronDown className={`transition-transform ${showCategoryDropdown ? 'rotate-180' : ''}`} />
                                </div>

                                {showCategoryDropdown && (
                                    <div className="absolute top-full left-0 w-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[6000] overflow-hidden p-2">
                                        <div className="relative mb-2">
                                            <HiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input 
                                                autoFocus
                                                type="text" 
                                                placeholder="Search category..." 
                                                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:bg-white"
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                            />
                                        </div>
                                        <div className="max-h-48 overflow-y-auto custom-scrollbar">
                                            {filteredCategories.length > 0 ? filteredCategories.map(opt => (
                                                <div 
                                                    key={opt} 
                                                    onClick={() => {
                                                        setMappingForm({...mappingForm, categories: opt});
                                                        setShowCategoryDropdown(false);
                                                        setSearchTerm('');
                                                    }}
                                                    className="px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-blue-50 hover:text-blue-600 cursor-pointer rounded-lg"
                                                >
                                                    {opt}
                                                </div>
                                            )) : <div className="p-4 text-xs text-slate-400 italic">No category found</div>}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Revenue/Cost Type */}
                            <div>
                                <label className="block text-[12px] font-black text-slate-600 uppercase mb-1 ml-1">Revenue/Cost/NTC Type*</label>
                                <select required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 font-bold" value={mappingForm.cost_revenue} onChange={(e) => setMappingForm({...mappingForm, cost_revenue: e.target.value})}>
                                    <option value="">Select Type</option>
                                    {options.types.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                            </div>

                            {/* Remaining Fields */}
                            <div>
                                <label className="block text-[12px] font-black text-slate-600 uppercase mb-1 ml-1">Internal Category</label>
                                <input type="text" placeholder="e.g. Project+Care" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none" value={mappingForm.category} onChange={(e) => setMappingForm({...mappingForm, category: e.target.value})} />
                            </div>

                            <div>
                                <label className="block text-[12px] font-black text-slate-600 uppercase mb-1 ml-1">Cost Element Group Name</label>
                                <input type="text" placeholder="Group Name" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none" value={mappingForm.cost_element_group_name} onChange={(e) => setMappingForm({...mappingForm, cost_element_group_name: e.target.value})} />
                            </div>

                            <div>
                                <label className="block text-[12px] font-black text-slate-600 uppercase mb-1 ml-1">Cost Element Name</label>
                                <input type="text" placeholder="Short Name" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none" value={mappingForm.cost_element_name} onChange={(e) => setMappingForm({...mappingForm, cost_element_name: e.target.value})} />
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-[12px] font-black text-slate-600 uppercase mb-1 ml-1">Cost Element Description</label>
                                <textarea rows="2" placeholder="Describe this cost element..." className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none" value={mappingForm.cost_element_desc} onChange={(e) => setMappingForm({...mappingForm, cost_element_desc: e.target.value})} />
                            </div>

                            <div className="md:col-span-2 pt-4">
                                <button type="submit" className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-wider hover:bg-emerald-700 shadow-lg active:scale-95 transition-all">
                                    Save
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PtdAutomation;