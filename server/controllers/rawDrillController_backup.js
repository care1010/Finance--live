const db = require('../config/db');
const ExcelJS = require('exceljs');

const getValArray = (val, reqQuery = null, keyName = null) => {
    let targetVal = val;
    if (reqQuery && keyName && targetVal === undefined) {
        targetVal = reqQuery[`${keyName}[]`] || reqQuery[`${keyName}%5B%5D`];
    }

    if (targetVal === undefined || targetVal === null || targetVal === '' || targetVal === 'null' || (Array.isArray(targetVal) && targetVal.length === 0)) {
        return null;
    }
    let arr = Array.isArray(targetVal) ? targetVal : targetVal.toString().split(',').map(v => v.trim()).filter(Boolean);
    arr = arr.filter(v => v.toLowerCase() !== 'all'); 
    return arr.length > 0 ? arr : null;
};

// ==============================
// COMMON RLS FUNCTION
// ==============================
const applyRLS = (type, allowedCustomers, conditions, params) => {
    if (type === 'super_admin') return;

    if (allowedCustomers && typeof allowedCustomers === 'string') {
        const customersArray = allowedCustomers.split(',').map(c => c.trim().toLowerCase()).filter(Boolean);
        if (customersArray.length > 0) {
            // Because customer might not be strictly available in Raw tables, we filter by subquery mapping
            conditions.push(`
                loa_id IN (
                    SELECT DISTINCT loa_id FROM wbs_loa_id_mapping1 
                    WHERE TRIM(LOWER(customer)) IN (?)
                )
            `);
            params.push(customersArray);
            return;
        }
    }
    conditions.push(`1=0`);
};

// ==============================
// SMART RAW DATA FILTER BUILDER
// ==============================
const buildRawFilters = (reqQuery, conditions, params) => {
    // ── Columns directly available in transformed tables ──
    const directMap = {
        'loa_id':   'loa_id',
        'wbs_type': 'wbs_type',
        'period':   'period',
    };

    Object.keys(directMap).forEach(key => {
        const vals = getValArray(reqQuery[key], reqQuery, key);
        if (!vals || vals.length === 0) return;
        const lowerVals = vals.map(v => String(v).trim().toLowerCase());
        conditions.push(`TRIM(LOWER(${directMap[key]})) IN (?)`);
        params.push(lowerVals);
    });

    // ── Special Sub-query Mappings for BU, Customer, LOA Name ──
    const mappingFilters = [];
    const mappingParams  = [];

    const custArr = getValArray(reqQuery.customer, reqQuery, 'customer');
    if (custArr && custArr.length > 0) {
        mappingFilters.push(`TRIM(LOWER(customer)) IN (?)`);
        mappingParams.push(custArr.map(v => v.trim().toLowerCase()));
    }

    const buArr = getValArray(reqQuery.bu, reqQuery, 'bu');
    if (buArr && buArr.length > 0) {
        mappingFilters.push(`TRIM(LOWER(bu)) IN (?)`);
        mappingParams.push(buArr.map(v => v.trim().toLowerCase()));
    }

    const loaNameArr = getValArray(reqQuery.loa_name, reqQuery, 'loa_name');
    if (loaNameArr && loaNameArr.length > 0) {
        mappingFilters.push(`TRIM(LOWER(loa_name)) IN (?)`);
        mappingParams.push(loaNameArr.map(v => v.trim().toLowerCase()));
    }

    if (mappingFilters.length > 0) {
        conditions.push(`
            loa_id IN (
                SELECT DISTINCT loa_id 
                FROM wbs_loa_id_mapping1 
                WHERE ${mappingFilters.join(' AND ')}
            )
        `);
        params.push(...mappingParams);
    }
    
    // ── Direct filters for wbs element and description ──
    const wbsArr = getValArray(reqQuery.wbs, reqQuery, 'wbs');
    if (wbsArr && wbsArr.length > 0) {
        conditions.push(`TRIM(LOWER(sap_wbs)) IN (?)`);
        params.push(wbsArr.map(v => v.trim().toLowerCase()));
    }

    const descArr = getValArray(reqQuery.wbs_description, reqQuery, 'wbs_description');
    if (descArr && descArr.length > 0) {
        conditions.push(`TRIM(LOWER(wbs_description)) IN (?)`);
        params.push(descArr.map(v => v.trim().toLowerCase()));
    }

    // ── 🔴 CRITICAL FIX: EXCLUDE NTC and REVENUE globally (For both Table & KPI) ──
    // Yeh apply karte hi tumhari KPI aur Data line items exact Dashboard maths pe aayengi!
    conditions.push(`(categories IS NULL OR TRIM(LOWER(categories)) NOT IN ('revenue', 'not to considered', 'ntc'))`);
    
    // Local Materials Category Exclusion Logic
    const catTypeVal = reqQuery.category_type || reqQuery['category_type[]'];
    let catArr = Array.isArray(catTypeVal) ? catTypeVal : (catTypeVal ? String(catTypeVal).split(",") : []);
    catArr = catArr.map(v => v.trim().toLowerCase()).filter(Boolean);

    const hasAll = catArr.includes("all");
    const hasLM = catArr.includes("local materials");

    if (hasAll && hasLM) { /* do nothing, show all */ }
    else if (hasLM && !hasAll) { conditions.push("TRIM(LOWER(categories)) = 'local materials'"); }
    else { conditions.push("TRIM(LOWER(categories)) <> 'local materials'"); }
};

// ==============================
// GET RAW DATA & KPI SUM
// ==============================
exports.getRawData = async (req, res) => {
    try {
        const { tableType, start, length, draw, type, allowedCustomers } = req.query;
        const tableName = tableType === 'cj74' ? 't_cj74_transformed' : 't_cji5_transformed';
        
        let conditions = ["1=1"];
        let params = [];

        // Additional base cleanups for CJ74
        // if (tableType === 'cj74') {
        //     conditions.push("ABS(COALESCE(ptd_val, 0)) > 0.01");
        // }

        applyRLS(type, allowedCustomers, conditions, params);
        buildRawFilters(req.query, conditions, params);

        const whereClause = `WHERE ${conditions.join(' AND ')}`;
        
        const dataSql = `SELECT * FROM ${tableName} ${whereClause} ORDER BY year DESC, per DESC LIMIT ? OFFSET ?`;
        const countSql = `SELECT COUNT(*) as total FROM ${tableName} ${whereClause}`;
        
        // 🔥 Calculate SUM dynamically based on active tab AND the exact filtered dataset
        const sumField = tableType === 'cj74' ? 'ptd_val' : 'oc_val';
        const sumSql = `SELECT ROUND(CAST(SUM(${sumField}) AS NUMERIC), 2) as total_value FROM ${tableName} ${whereClause}`;

        const [rows] = await db.query(dataSql, [...params, parseInt(length) || 50, parseInt(start) || 0]);
        const [total] = await db.query(countSql, params);
        const [sumResult] = await db.query(sumSql, params);

        res.status(200).json({
            draw: parseInt(draw),
            recordsTotal: total[0].total,
            recordsFiltered: total[0].total,
            totalValue: sumResult[0].total_value || 0, // This fuels the UI KPI card!
            data: rows
        });
    } catch (error) { 
        console.error("Raw Data Fetch Error:", error);
        res.status(500).json({ error: error.message }); 
    }
};

// 🔥 NEW: Column Mapping to match UI (Exact match with RawDrill.jsx)
const EXPORT_COLUMNS = {
    cj74: [
    { key: 'sap_wbs', header: 'WBS' },
    { key: 'year', header: 'Year' },
    { key: 'per', header: 'Per' },
    { key: 'cost_element', header: 'Cost Element' },
    { key: 'cost_element_name', header: 'Cost Element Name' },
    { key: 'ptd_val', header: 'PTD VAL (K€)' },
    { key: 'period', header: 'Period' },
    { key: 'cocd', header: 'CoCd' },
    { key: 'proj_def', header: 'Project Def' },
    { key: 'profit_ctr', header: 'Profit Ctr' },
    { key: 'tcurr', header: 'T Curr' },
    { key: 'cost_element_descr', header: 'COST ELEMENT DESCR' },
    { key: 'refdocno', header: 'Ref Doc No' },
    { key: 'document_no', header: 'Document No' },
    { key: 'doc_date', header: 'Doc Date' },
    { key: 'postg_date', header: 'Postg Date' },
    { key: 'offst_acct', header: 'Offset Acct' },
    { key: 'material', header: 'Material' },
    { key: 'material_description', header: 'Material Description' },
    { key: 'created_on', header: 'Created On' },
    { key: 'user_name', header: 'User Name' },
    { key: 'pur_doc', header: 'Pur Doc' },
    { key: 'purchase_order_text', header: 'Purchase Order Text' },
    { key: 'loa_id', header: 'LOA ID' }
],
    cji5: [
    { key: 'project_def', header: 'PROJ DEF' },
    { key: 'sap_wbs', header: 'WBS' },
    { key: 'oc_val', header: 'OC VAL (K€)' },
    { key: 'period', header: 'Period' }, // 🔥 Naya added
    { key: 'refdocno', header: 'REFDOCNO' },
    { key: 'item', header: 'ITEM' },
    { key: 'co_object_name', header: 'CO_OBJECT_NAME' },
    { key: 'supplier', header: 'SUPPLIER' },
    { key: 'name', header: 'NAME' },
    { key: 'exch_rate', header: 'EXCH_RATE' },
    { key: 'year', header: 'YEAR' },
    { key: 'per', header: 'PER' },
    { key: 'cost_element', header: 'COST_ELEMENT' },
    { key: 'cost_element_descr', header: 'COST_ELEMENT_DESCR' },
    { key: 'matl_group', header: 'MATL GROUP' },
    { key: 'material', header: 'MATERIAL' },
    { key: 'description', header: 'DESCRIPTION' },
    { key: 'user_name', header: 'USER_NAME' },
    { key: 'docc', header: 'DOCC' },
    { key: 'quantity', header: 'QUANTITY' },
    { key: 'qty_plan', header: 'QTY_PLAN' },
    { key: 'debit_date', header: 'DEBIT_DATE' },
    { key: 'doc_date', header: 'DOC_DATE' },
    { key: 'cocode', header: 'COCODE' },
    { key: 'report_currency', header: 'REPORT_CURRENCY' },
    { key: 'tcurr', header: 'TCURR' },
    { key: 'value_tcur', header: 'VALUE_TCUR' },
    { key: 'obj_curr', header: 'OBJ_CURR' },
    { key: 'value_in_obj_crcy', header: 'VALUE_IN_OBJ_CRCY' },
    { key: 'loa_id', header: 'LOA ID' }
]
};

// ==============================
// EXPORT EXCEL RAW DATA
// ==============================
exports.exportRawData = async (req, res) => {
    try {
        const { tableType, type, allowedCustomers } = req.query;
        const tableName = tableType === 'cj74' ? 't_cj74_transformed' : 't_cji5_transformed';
        
        // Pick the correct column mapping
        const columnsToExport = EXPORT_COLUMNS[tableType] || [];
        if (columnsToExport.length === 0) throw new Error("Invalid Table Type for export");

        // 🔥 Dynamic SELECT query using only specific keys
        const selectFields = columnsToExport.map(c => `"${c.key}"`).join(', ');

        let conditions = ["1=1"];
        let params = [];

        // Apply same filters as UI
        applyRLS(type, allowedCustomers, conditions, params);
        buildRawFilters(req.query, conditions, params);

        const sql = `SELECT ${selectFields} FROM ${tableName} WHERE ${conditions.join(' AND ')} ORDER BY year DESC, per DESC`;
        
        const [rows] = await db.query(sql, params);
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Raw_Data_${tableType}_${new Date().toISOString().split('T')[0]}.xlsx`);
        
        const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res });
        const worksheet = workbook.addWorksheet('Raw Data');
        
        // 🔥 Set Excel Columns based on UI Titles
        worksheet.columns = columnsToExport.map(col => ({
            header: col.header,
            key: col.key,
            width: 20
        }));

        if (rows.length > 0) {
            rows.forEach(row => {
                // Ensure dates are formatted as strings for Excel clarity
                const cleanRow = { ...row };
                Object.keys(cleanRow).forEach(key => {
                    if (key.includes('date') || key === 'created_on') {
                        cleanRow[key] = cleanRow[key] ? new Date(cleanRow[key]).toLocaleDateString('en-GB') : '-';
                    }
                });
                worksheet.addRow(cleanRow).commit();
            });
        }
        await workbook.commit();
        
    } catch (error) { 
        console.error("Raw Export Error:", error);
        res.status(500).send("Export failed: " + error.message); 
    }
};