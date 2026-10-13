const db = require('../config/db');
const bcrypt = require('bcrypt');
const mailService = require("../services/mailService");

// 1. Get Dropdown Data for the Request Form
// 1. Get Dropdown Data with Cascading/Synced Filters
exports.getDropdownData = async (req, res) => {
    try {
        const { customers, bus, loas } = req.query;

        // Helper function to handle multi-select strings from frontend
        const getArray = (val) => (val && val !== 'null') ? val.split('|||').map(v => v.trim()) : [];

        const selCust = getArray(customers);
        const selBus = getArray(bus);
        const selLoas = getArray(loas);

        // Common table name
        const TABLE = 'wbs_loa_id_mapping1';

        // 1. Fetch CUSTOMER options (Filtered by selected BU and LOA)
        let custCond = ["1=1"];
        let custParams = [];
        if (selBus.length > 0) { custCond.push('bu IN (?)'); custParams.push(selBus); }
        if (selLoas.length > 0) { custCond.push('loa_name IN (?)'); custParams.push(selLoas); }
        
        const [customerRows] = await db.query(
            `SELECT DISTINCT customer FROM ${TABLE} WHERE ${custCond.join(' AND ')} AND customer IS NOT NULL ORDER BY customer`,
            custParams
        );

        // 2. Fetch BU options (Filtered by selected Customer and LOA)
        let buCond = ["1=1"];
        let buParams = [];
        if (selCust.length > 0) { buCond.push('customer IN (?)'); buParams.push(selCust); }
        if (selLoas.length > 0) { buCond.push('loa_name IN (?)'); buParams.push(selLoas); }

        const [buRows] = await db.query(
            `SELECT DISTINCT bu FROM ${TABLE} WHERE ${buCond.join(' AND ')} AND bu IS NOT NULL ORDER BY bu`,
            buParams
        );

        // 3. Fetch LOA options (Filtered by selected Customer and BU)
        let loaCond = ["1=1"];
        let loaParams = [];
        if (selCust.length > 0) { loaCond.push('customer IN (?)'); loaParams.push(selCust); }
        if (selBus.length > 0) { loaCond.push('bu IN (?)'); loaParams.push(selBus); }

        const [loaRows] = await db.query(
            `SELECT DISTINCT loa_name FROM ${TABLE} WHERE ${loaCond.join(' AND ')} AND loa_name IS NOT NULL ORDER BY loa_name`,
            loaParams
        );

        res.status(200).json({
            customers: customerRows.map(r => r.customer),
            bus: buRows.map(r => r.bu),
            loas: loaRows.map(r => r.loa_name)
        });
    } catch (err) { 
        console.error("Dropdown Sync Error:", err.message);
        res.status(500).json({ error: err.message }); 
    }
};

// 2. Submit Request (Improved with Duplicate Checks)
exports.submitRequest = async (req, res) => {
    // 🔥 FIX 1: Destructuring mein 'role' shamil karein
    const { email, password, customer, bu, loa, role } = req.body; 

    try {
        if (!email || !password || !customer || !role) { // Role check bhi add kiya
            return res.status(400).json({ success: false, error: "Required fields missing." });
        }

        const cleanEmail = email.trim().toLowerCase();
        const customerList = customer ? customer.split('|||').map(c => c.trim()).filter(Boolean) : [];
        const buString = bu ? bu.trim() : '';
        const loaString = loa ? loa.trim() : '';

        let newlyAdded = [];
        let alreadyRequested = [];
        let alreadyHaveAccess = [];

        for (const singleCust of customerList) {
            const cleanCust = singleCust.trim().toLowerCase();

            // 1. Check existing access
            const [accessExists] = await db.query(`SELECT id FROM "access" WHERE LOWER(TRIM(email)) = ? AND LOWER(TRIM(customer)) = ? LIMIT 1`, [cleanEmail, cleanCust]);
            if (accessExists.length > 0) { alreadyHaveAccess.push(singleCust); continue; }

            // 2. Check pending request
            const [existingRequest] = await db.query(
                `SELECT id FROM "access_requests" 
                 WHERE LOWER(TRIM(email)) = ? AND LOWER(TRIM(requested_customers)) = ? AND status IN ('Pending', 'Approved') LIMIT 1`,
                [cleanEmail, cleanCust]
            );
            if (existingRequest.length > 0) { alreadyRequested.push(singleCust); continue; }

            // 3. 🔥 FIX 2: Create New Request (Placeholder and Variable Sync)
            const hashedPassword = await bcrypt.hash(password, 10);
            await db.query(
                `INSERT INTO "access_requests" (email, password, requested_customers, bu, project_name, user_role, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [email.trim(), hashedPassword, singleCust, buString, loaString, role, 'Pending'] // 👈 'role' variable ab defined hai
            );
            newlyAdded.push(singleCust);
        }


        // Case: No new entries were added (Only duplicates)
        if (newlyAdded.length === 0) {
            if (alreadyHaveAccess.length > 0) {
                return res.status(200).json({
                    success: false,
                    alreadyAccess: alreadyHaveAccess,
                    message: `You already have access for: ${alreadyHaveAccess.join(', ')}.`
                });
            }
            if (alreadyRequested.length > 0) {
                return res.status(200).json({
                    success: false,
                    alreadyRequested: alreadyRequested,
                    message: `Your request for ${alreadyRequested.join(', ')} is already registered.`
                });
            }
        }

        // Success Case: Send mail only if new entries added
        if (newlyAdded.length > 0) {
            try {
                const [userInSystem] = await db.query(`SELECT id FROM "users" WHERE LOWER(TRIM(email)) = ? LIMIT 1`, [cleanEmail]);
                await mailService.sendAccessRequestMail({
                    email: email.trim(),
                    customer: newlyAdded.join(', '),
                    bu: buString,
                    loa: loaString,
                    isUpdate: userInSystem.length > 0
                });
            } catch (mailErr) {
                console.error("⚠️ Mail error:", mailErr.message);
            }
        }

        return res.status(200).json({
            success: true,
            message: "Access request submitted successfully.",
            alreadyRequested: alreadyRequested.length > 0 ? alreadyRequested : undefined
        });

    } catch (err) {
        console.error("❌ DB Final Error:", err.message);
        return res.status(500).json({ success: false, error: "Database error: " + err.message });
    }
};

// 3. SMTP Integrated Function (Sends real mail via mailService)
// exports.submitAccessRequest = async (req, res) => {
//     try {
//         await mailService.sendAccessRequestMail(req.body);
//         res.status(200).json({
//             success: true,
//             message: "Mail sent successfully."
//         });
//     } catch (err) {
//         console.error("Mail Error:", err);
//         res.status(500).json({
//             success: false,
//             message: err.message
//         });
//     }
// };

// 4. Get All Pending Requests for Admin Panel
exports.getPendingRequests = async (req, res) => {
    try {
        const [rows] = await db.query("SELECT id, email, requested_customers, bu, project_name, user_role, created_at FROM access_requests WHERE status = 'Pending' ORDER BY created_at DESC");
        res.status(200).json(rows);
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
};



// 5. 🔥 UPDATED: Approve Request (With Double Protection for access table)
exports.approveRequest = async (req, res) => {
    const { id } = req.body;
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Request details fetch karein
        const [reqRows] = await connection.query('SELECT * FROM "access_requests" WHERE "id" = ?', [id]);
        if (reqRows.length === 0) throw new Error("Request not found");
        
        const requestDetails = reqRows[0];
        const singleCustomer = requestDetails.requested_customers;

        // 2. User logic (Safe check)
        const [userExists] = await connection.query('SELECT "email" FROM "users" WHERE TRIM(LOWER("email")) = TRIM(LOWER(?))', [requestDetails.email]);
        if (userExists.length === 0) {
            await connection.query(
                'INSERT INTO "users" ("email", "password", "type", "user_role") VALUES (?, ?, ?, ?)', 
                [requestDetails.email, requestDetails.password, 'user', requestDetails.user_role]
            );
        } else {
            // Purana user: Sirf Role update karein
            await connection.query(
                'UPDATE "users" SET "user_role" = ? WHERE "email" = ?',
                [details.user_role, details.email]
            );
        }

        // 3. 🔥 ACCESS TABLE PROTECTION: Check if entry already exists
        const [accessExists] = await connection.query(
            'SELECT * FROM "access" WHERE TRIM(LOWER("email")) = TRIM(LOWER(?)) AND TRIM(LOWER("customer")) = TRIM(LOWER(?))',
            [requestDetails.email, singleCustomer]
        );

        if (accessExists.length === 0) {
            // entries nahi hai toh hi insert karein
            await connection.query('INSERT INTO "access" ("customer", "email") VALUES (?, ?)', [singleCustomer, requestDetails.email]);
        }

        // 4. Update request status
        await connection.query('UPDATE "access_requests" SET "status" = \'Approved\' WHERE "id" = ?', [id]);

        await connection.commit();

        // 5. Send Mail
        try {
            await mailService.sendApprovalMail(requestDetails);
        } catch (mailErr) {
            console.error("Mail trigger failed:", mailErr.message);
        }

        res.status(200).json({ message: `Access approved for ${singleCustomer}` });

    } catch (err) {
        if (connection) await connection.rollback();
        console.error("❌ Approval Error Details:", err.message);
        res.status(500).json({ error: err.message });
    } finally {
        connection.release();
    }
};

// 6. 🔥 UPDATED: Decline Request with Notification Mail
exports.declineRequest = async (req, res) => {
    const { id } = req.body;
    try {
        // Fetch details first to know the email and entity
        const [reqRows] = await db.query("SELECT * FROM access_requests WHERE id = ?", [id]);
        if (reqRows.length === 0) return res.status(404).json({ error: "Request not found" });

        const requestDetails = reqRows[0];

        // Update status in DB
        await db.query("UPDATE access_requests SET status = 'Declined' WHERE id = ?", [id]);

        // 🔥 Trigger Decline Mail
        try {
            await mailService.sendDeclineMail(requestDetails);
        } catch (mailErr) {
            console.error("Decline Mail failed, but DB updated:", mailErr);
        }

        res.status(200).json({ message: "Request Declined and user notified." });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
};