import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import boatImage from '../assets/boat.jpg';
import AccessRequestsTable from './AccessRequestsTable';
import Swal from 'sweetalert2';
import { HiOutlineEye, HiOutlineEyeOff, HiOutlineRefresh, HiCheck } from 'react-icons/hi';
 
// 🔥 FIX 1: Component moved OUTSIDE parent to prevent re-mounting and state loss!
const SearchableSelect = ({ label, name, value, options, required = false, placeholder, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const wrapperRef = useRef(null);
 
    // Outside click to close
    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
                setSearchTerm('');
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);
 
    const toggleOption = (opt, e) => {
        e.stopPropagation();
        e.preventDefault();
        const currentSelected = [...value];
        const index = currentSelected.indexOf(opt);
        if (index > -1) currentSelected.splice(index, 1);
        else currentSelected.push(opt);
       
        onChange(name, currentSelected);
    };
 
    const handleSelectAll = (e) => { e.stopPropagation(); onChange(name, [...options]); };
    const handleDeselectAll = (e) => { e.stopPropagation(); onChange(name, []); };
 
    const filteredOptions = options.filter(option =>
        String(option || "").toLowerCase().includes(searchTerm.toLowerCase())
    );
 
    return (
        <div className="relative" ref={wrapperRef}>
            <label className="text-[13px] font-bold text-slate-900 uppercase tracking-wider ml-1">
                {label} {required && '*'}
            </label>
           
            {/* Trigger Box */}
            <div
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full mt-1.5 p-3.5 rounded-xl border ${isOpen ? 'border-blue-600 ring-2 ring-blue-500/10' : 'border-slate-200'} bg-slate-50/50 text-sm flex justify-between items-center cursor-pointer transition-all min-h-[50px] shadow-sm`}
            >
                <div className="flex flex-wrap gap-1 flex-1 truncate">
                    {value.length > 0 ? (
                        <span className="text-blue-700 font-bold">
                            {value.length === options.length ? "✅ All Selected" : `🔹 ${value.length} items selected`}
                        </span>
                    ) : (
                        <span className="text-slate-400">{placeholder}</span>
                    )}
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            </div>
 
            {isOpen && (
                <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                   
                    {/* Search & Action Buttons */}
                    <div className="p-3 border-b border-slate-100 bg-slate-50 space-y-3">
                        <input
                            type="text"
                            autoFocus
                            placeholder="Type to search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full p-2 text-sm bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                       
                        <div className="flex items-center gap-4 px-1">
                            <button type="button" onClick={handleSelectAll} className="text-[10px] font-black text-emerald-600 uppercase hover:text-emerald-700 transition-colors">
                                ✓ Select All
                            </button>
                            <div className="h-3 w-[1px] bg-slate-300"></div>
                            <button type="button" onClick={handleDeselectAll} className="text-[10px] font-black text-red-500 uppercase hover:text-red-600 transition-colors">
                                ✕ Deselect All
                            </button>
                        </div>
                    </div>
 
                    {/* Checkbox List */}
                    <div className="max-h-60 overflow-y-auto custom-scrollbar">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((opt, idx) => {
                                const isSelected = value.includes(opt);
                                return (
                                    <div
                                        key={idx}
                                        onClick={(e) => toggleOption(opt, e)}
                                        className={`px-4 py-2.5 text-sm flex items-center gap-3 cursor-pointer transition-colors border-b border-slate-50 last:border-0 hover:bg-slate-50
                                            ${isSelected ? "bg-blue-50/50" : "text-slate-700"}`}
                                    >
                                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all
                                            ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-300 bg-white'}`}>
                                            {isSelected && <HiCheck className="text-white" size={12} />}
                                        </div>
                                        <span className={isSelected ? "font-bold text-blue-800" : ""}>
                                            {opt}
                                        </span>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="p-4 text-sm text-slate-400 text-center">No results found</div>
                        )}
                    </div>
 
                    {/* Bottom Close Button */}
                    <div className="bg-slate-50 p-2 text-center border-t border-slate-100">
                        <button type="button" onClick={() => { setIsOpen(false); setSearchTerm(''); }} className="text-[10px] font-bold text-slate-500 uppercase hover:text-slate-800">
                            Done Selecting
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
 
 
const RequestAccess = ({ onBack }) => {
    const [formData, setFormData] = useState({
        customers: [],
        bus: [],
        projects: [],
        email: '',
        password: '',
        role: ''
    });
 
    const [dropdowns, setDropdowns] = useState({ customers: [], bus: [], loas: [] });
    const [loading, setLoading] = useState(false);
    const [viewRequests, setViewRequests] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
 
    // 🔥 FIX 2: Debounced API Fetch (Prevents multiple calls while user is selecting)
    useEffect(() => {
        const fetchDropdowns = async () => {
            try {
                const params = new URLSearchParams({
                    customers: formData.customers.join('|||'),
                    bus: formData.bus.join('|||'),
                    loas: formData.projects.join('|||')
                });
                const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/data/access/dropdowns?${params.toString()}`);
                setDropdowns(res.data);
            } catch (err) { console.error("Failed to sync dropdowns", err); }
        };
 
        const timer = setTimeout(() => {
            fetchDropdowns();
        }, 500); // Wait 500ms before calling API
 
        return () => clearTimeout(timer);
    }, [formData.customers, formData.bus, formData.projects]);
 
    const handleFormChange = (name, val) => {
        setFormData(prev => ({ ...prev, [name]: val }));
    };
 
    const handleGeneratePassword = () => {
        const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
        let generatedPassword = "";
        for (let i = 0; i < 12; i++) {
            generatedPassword += charset.charAt(Math.floor(Math.random() * charset.length));
        }
        setFormData({ ...formData, password: generatedPassword });
        setShowPassword(true);
        Swal.fire({ title: 'Password Generated', icon: 'info', timer: 1500, showConfirmButton: false, toast: true, position: 'top-end' });
    };
 
    const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.customers.length === 0) {
        return Swal.fire(
            'Error',
            'Please select at least one Customer Account.',
            'warning'
        );
    }

    if (formData.password.length < 8) {
        return Swal.fire(
            'Weak Password',
            'Minimum 8 characters required.',
            'warning'
        );
    }

    setLoading(true);

    try {

        const response = await axios.post(
            `${process.env.REACT_APP_API_URL}/api/data/access/request`,
            {
                customer: formData.customers.join('|||'),
                bu: formData.bus.join('|||'),
                loa: formData.projects.join('|||'),
                email: formData.email,
                password: formData.password,
                role: formData.role // 🔥 Naya field sent to backend
            }
        );

        // =====================================================
        // IMPORTANT:
        // Backend HTTP 200 return kar raha hai even for duplicate.
        // Isliye response.data.success manually check karna hai.
        // =====================================================

        const data = response.data;

        // CASE 1: USER ALREADY HAS ACCESS
        if (data.alreadyAccess && data.alreadyAccess.length > 0) {
            Swal.fire({
                title: 'Access Already Granted',
                text: data.message,
                icon: 'info',
                confirmButtonText: 'OK'
            });
            return;
        }

        // CASE 2: REQUEST ALREADY EXISTS (Check length > 0)
        if (data.alreadyRequested && data.alreadyRequested.length > 0 && !data.success) {
            Swal.fire({
                title: 'Request Already Registered',
                text: data.message,
                icon: 'info',
                confirmButtonText: 'OK'
            });
            return;
        }

        // CASE 3: NEW REQUEST SUCCESSFULLY CREATED
        if (data.success) {
            Swal.fire({
                title: 'Request Submitted',
                text: data.message,
                icon: 'success',
                confirmButtonText: 'OK'
            }).then(() => {
                onBack();
            });
            return;
        }


        // =====================================================
        // FALLBACK
        // =====================================================

        Swal.fire({
            title: 'Information',
            text: data.message || 'Request could not be submitted.',
            icon: 'info',
            confirmButtonText: 'OK'
        });

    } catch (err) {

        const errorMsg =
            err.response?.data?.error ||
            err.response?.data?.message ||
            "Failed to submit request.";

        Swal.fire(
            'Error',
            errorMsg,
            'error'
        );

    } finally {

        setLoading(false);
    }
};
 
    if (viewRequests) return <AccessRequestsTable onBack={() => setViewRequests(false)} />;
 
    return (
        <div className="min-h-screen w-full flex items-center justify-end font-['Calibri',_sans-serif] overflow-hidden"
            style={{ backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.1), rgba(0,0,0,0.5)), url(${boatImage})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}>
 
            <div className="w-full sm:w-[85%] md:w-[50%] lg:w-[40%] xl:w-[35%] h-screen bg-white/95 backdrop-blur-md shadow-[-10px_0_30px_rgba(0,0,0,0.2)] flex flex-col justify-center px-8 md:px-16 relative">
 
                <button onClick={onBack} className="absolute top-8 left-8 flex items-center text-slate-700 hover:text-blue-600 transition-all font-bold text-sm group">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 group-hover:-translate-x-1 transition-transform">
                        <path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                    Back to Login
                </button>
 
                <div className="max-w-md w-full mx-auto pt-10">
                    <h1 className="text-4xl font-black text-slate-800 tracking-tight mb-2">Request Access</h1>
                    <p className="text-slate-600 text-[16px] mb-8">Select fields you need access for.</p>
 
                    <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
                        <SearchableSelect
                            label="Customer Account(s)"
                            name="customers"
                            value={formData.customers}
                            options={dropdowns.customers}
                            required
                            placeholder="Select one or more..."
                            onChange={handleFormChange}
                        />
 
                        <div className="grid grid-cols-2 gap-4">
                            <SearchableSelect
                                label="BU"
                                name="bus"
                                value={formData.bus}
                                options={dropdowns.bus}
                                placeholder="Select BU(s)..."
                                onChange={handleFormChange}
                            />
                            <SearchableSelect
                                label="Project / LOA"
                                name="projects"
                                value={formData.projects}
                                options={dropdowns.loas}
                                placeholder="Select Project(s)..."
                                onChange={handleFormChange}
                            />
                        </div>

                        {/* Customer, BU, Project dropdowns ke baad aur Email ke pehle ye add karein */}
                        <div>
                            <label className="text-[13px] font-bold text-slate-900 uppercase tracking-wider ml-1">Requested Role *</label>
                            <select
                                required
                                value={formData.role}
                                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                className="w-full mt-1.5 p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold text-slate-700"
                            >
                                <option value="">-- Select Your Role --</option>
                                <option value="BGDM">BGDM</option>
                                <option value="PM/CaPM">PM/CaPM</option>
                                <option value="User">User</option>
                                <option value="Admin">Admin</option>
                            </select>
                        </div>
 
                        <div>
                            <label className="text-[13px] font-bold text-slate-900 uppercase tracking-wider ml-1">Work Email Address *</label>
                            <input
                                type="email"
                                required
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                autoComplete="new-password"
                                className="w-full mt-1.5 p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                placeholder="name@nokia.com"
                            />
                        </div>
 
                        <div className="relative">
                            <label className="text-[13px] font-bold text-slate-900 uppercase tracking-wider ml-1">Choose Password *</label>
                            <div className="relative flex items-center mt-1.5">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    required
                                    value={formData.password}
                                    onChange={e => setFormData({...formData, password: e.target.value})}
                                    autoComplete="new-password"
                                    placeholder="Min 8 characters"
                                    className="w-full p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm pr-20 outline-none focus:ring-2 focus:ring-blue-500/20"
                                />
                                <div className="absolute right-2 flex items-center gap-1">
                                    <button type="button" onClick={handleGeneratePassword} title="Generate" className="p-2 text-slate-400 hover:text-emerald-600 transition-colors">
                                        <HiOutlineRefresh size={18} />
                                    </button>
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="p-2 text-slate-400 hover:text-blue-600 transition-colors">
                                        {showPassword ? <HiOutlineEyeOff size={18} /> : <HiOutlineEye size={18} />}
                                    </button>
                                </div>
                            </div>
                            <p className="text-[15px] text-slate-600 mt-1 ml-1 font-medium italic">Passwords must be at least 8 characters.</p>
                        </div>
 
                        <button type="submit" disabled={loading} className="w-full py-4 bg-slate-900 hover:bg-black text-white rounded-xl font-bold shadow-xl mt-4 transition-all active:scale-95 disabled:opacity-50">
                            {loading ? "Processing..." : "Submit Access Request →"}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};
 
export default RequestAccess;