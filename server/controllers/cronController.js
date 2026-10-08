const db = require('../config/db');
const cron = require('node-cron');
const dataController = require('./dataController');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const mailService = require('../services/mailService');

// Global job references to prevent "not defined" errors
// 🔥 ENSURE ALL REFERENCES ARE DECLARED TOP
let syncJob = null;
let backupJob = null;
let bgdmAlertJob = null;
let projectAuditJob = null;
let ptdReminderJob = null; // 🔥 Reference for Reminder
let pendingLoaJob = null;  // 🔥 Reference for Pending Audit
let asblAuditJob = null;
let missingCEReminderJob = null; // 🔥 Reference for Missing CE Reminder

let autoSyncTimeout = null; 
let isSyncing = false;
let syncRequestedWhileRunning = false; // 🔥 Naya flag queue handle karne ke liye

// ==========================================
// 🛡️ PM2 INSTANCE GUARD
// Only run cron on the first instance to prevent duplicate mails
// ==========================================
const isPrimaryInstance = () => {
    // PM2 sets NODE_APP_INSTANCE. If not using PM2, it will be undefined (return true)
    const instance = process.env.NODE_APP_INSTANCE;
    return instance === undefined || instance === '0';
};

// ==========================================
// 📦 DATABASE BACKUP ENGINE (PostgreSQL)
// ==========================================
const runDatabaseBackup = async () => {
    console.log("📦 [BACKUP]: Database backup shuru ho raha hai...");

    try {
        // 1. Pehle DB mein status 'running' set karein
        await db.query("UPDATE cron_config SET last_run_status = 'running' WHERE job_name = 'db_backup'");

        const backupDir = path.join(__dirname, '../../database/backup');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        const date = new Date();
        const day = String(date.getDate()).padStart(2, '0');
        const month = date.toLocaleString('en-US', { month: 'short' });
        const year = date.getFullYear();
        const fileName = `Backup_ServiceCost_${day}-${month}-${year}.backup`;
        const filePath = path.join(backupDir, fileName);

        const host = process.env.DB_HOST || 'localhost';
        const port = process.env.DB_PORT || 5432;
        const user = process.env.DB_USER || 'postgres';
        const password = process.env.DB_PASSWORD || 'postgres';
        const dbName = process.env.DB_NAME || 'service_cost';

        const cmd = `pg_dump -h ${host} -p ${port} -U ${user} -F c -d ${dbName} -f "${filePath}"`;

        // 2. Command execute karein
        exec(cmd, { env: { ...process.env, PGPASSWORD: password } }, async (error, stdout, stderr) => {
            if (error) {
                console.error(`❌ [BACKUP ERROR]:`, error.message);
                // Database mein error status update karein
                await db.query(
                    "UPDATE cron_config SET last_run_status = 'error', last_run_message = ? WHERE job_name = 'db_backup'", 
                    [error.message.substring(0, 200)]
                ).catch(console.error);
                return;
            }

            console.log(`✅ [BACKUP SUCCESS]: File saved at: ${filePath}`);
            
            // 🔥 MAIN FIX: Database mein success status aur time update karein
            await db.query(`
                UPDATE cron_config 
                SET last_run_at = NOW(), 
                    last_run_status = 'success', 
                    last_run_message = ?, 
                    run_count = run_count + 1 
                WHERE job_name = 'db_backup'
            `, [`Backup created: ${fileName}`]).catch(console.error);
        });

    } catch (err) {
        console.error("❌ [BACKUP CRASH]:", err.message);
        await db.query("UPDATE cron_config SET last_run_status = 'error' WHERE job_name = 'db_backup'").catch(() => {});
    }
};


// ==========================================
// 🔄 DATA SYNC ENGINE
// ==========================================
const runSync = async (triggeredBy = 'cron') => {
    if (isSyncing) {
        console.log(`⏳ [SYNC]: One Sync task already in progress. Queueing next task for latest data...`);
        syncRequestedWhileRunning = true;
        return;
    }

    isSyncing = true;

    // Trigger symbols logic
    const icon = triggeredBy.includes('auto') ? '⚡' : triggeredBy.includes('manual') ? '👤' : '⏰';
    const source = triggeredBy.replace('auto_trigger_', '').replace('_', ' ').toUpperCase();

    console.log(`\n${icon}  [DATABASE REFRESH]: Shuru ho raha hai... (Source: ${source})`);

    try {
        // DB status update (Optional but good for UI)
        await db.query("UPDATE cron_config SET last_run_at = NOW(), last_run_status = 'running' WHERE job_name = 'full_sync'").catch(() => {});
        
        await dataController.runFullSyncCore();
        console.log(`✅ [SUCCESS]: Dashboard is refreshed!`);
        
        await db.query("UPDATE cron_config SET last_run_status = 'success', last_run_message = 'Sync completed', run_count = run_count + 1 WHERE job_name = 'full_sync'").catch(() => {});
        console.log("----------------------------------------------");
        console.log('✅ CRON/TRIGGER: Sync completed successfully!');
        console.log("----------------------------------------------");
    } catch (error) {
        await db.query("UPDATE cron_config SET last_run_status = 'error', last_run_message = ? WHERE job_name = 'full_sync'", [error.message.substring(0, 200)]).catch(() => {});
        console.error(`❌ [ERROR]: Refresh failed:`, error.message);

    } finally {
        isSyncing = false;
        
        // CHECK QUEUE: Agar sync chalne ke dauraan koi naya request aaya tha
        if (syncRequestedWhileRunning) {
            console.log(`🔄 [QUEUE]: Got some new data, starting second refresh...`);

            syncRequestedWhileRunning = false;
            setTimeout(() => runSync('queued_request'), 5000); // 5s delay before next batch
        }
    }
};

// Internal calls ke liye aur external exports ke liye dono support:
exports.runSync = runSync;


// 🔥 NAYA: Alerts Runner
const runMonthlyAlerts = async () => {
    if (!isPrimaryInstance()) return;
    console.log("🚀 CRON: Starting Monthly BGDM Alerts...");
    try {
        await db.query("UPDATE cron_config SET last_run_at = NOW(), last_run_status = 'running' WHERE job_name = 'bgdm_alerts'");
        const mailsSent = await dataController.runBGDMAlertsCore();
        await db.query("UPDATE cron_config SET last_run_status = 'success', last_run_message = ?, run_count = run_count + 1 WHERE job_name = 'bgdm_alerts'", 
        [`Sent ${mailsSent} consolidated alerts`]);
        console.log(`✅ CRON Alerts: Sent ${mailsSent} mails.`);
    } catch (error) {
        console.error('❌ CRON Alerts Error:', error.message);
        await db.query("UPDATE cron_config SET last_run_status = 'error', last_run_message = ? WHERE job_name = 'bgdm_alerts'", [error.message.substring(0, 250)]);
    }
};

// 🔥 NAYA: Monthly Project Audit Runner
const runMonthlyProjectAudit = async () => {
    console.log("🚀 CRON: Starting Monthly Project WBS Audit...");
    try {
        await db.query("UPDATE cron_config SET last_run_at = NOW(), last_run_status = 'running' WHERE job_name = 'monthly_project_audit'");

        const now = new Date();
        now.setMonth(now.getMonth() - 1);
        const reportMonth = now.toLocaleString('en-US', { month: 'short', year: 'numeric' });

        // SQL: Fetch only necessary data + ASBL Check for New Projects
        const [logRows] = await db.query(`
            SELECT 
                p.bu, p.customer, p.loa_id, p.loa_name, p.single_wbs, p.wbs_type,
                CASE 
                    WHEN p.action_mode = 'New Project' THEN
                        CASE 
                            WHEN EXISTS (
                                SELECT 1 FROM asbl_activity_logs a 
                                WHERE a.loa_id = p.loa_id 
                                AND a.created_at >= date_trunc('month', current_date - interval '1 month')
                                AND a.created_at < date_trunc('month', current_date)
                            ) THEN 'Updated'
                            ELSE 'Not Updated'
                        END
                    ELSE 'N/A' -- Check applied only for new projects
                END as asbl_status
            FROM project_activity_logs p
            WHERE p.created_at >= date_trunc('month', current_date - interval '1 month')
              AND p.created_at < date_trunc('month', current_date)
            ORDER BY p.created_at ASC
        `);

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Audit Log');
        
        // 🔥 STRICT 7 COLUMNS AS PER YOUR REQUIREMENT
        sheet.columns = [
            { header: 'BU', key: 'bu', width: 10 },
            { header: 'CT name', key: 'customer', width: 25 },
            { header: 'Opportunity Code', key: 'loa_id', width: 15 },
            { header: 'Project Description', key: 'loa_name', width: 40 },
            { header: 'WBS', key: 'wbs', width: 60 },
            { header: 'WBS type', key: 'wbs_type', width: 15 },
            { header: 'ASBL Updated or not (For new project)', key: 'asbl_status', width: 40 }
        ];

        // Data add karna
        logRows.forEach(log => {
            sheet.addRow({ 
                bu: log.bu || '-',
                customer: log.customer || '-',
                loa_id: log.loa_id, 
                loa_name: log.loa_name, 
                wbs: log.single_wbs,
                wbs_type: log.wbs_type || '-',
                asbl_status: log.asbl_status
            });
        });

        // Professional Header Styling (Nokia Blue Theme)
        sheet.getRow(1).eachCell((cell) => {
            cell.font = { bold: true, color: { argb: 'FFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '124191' } };
            cell.alignment = { horizontal: 'center' };
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const [admins] = await db.query("SELECT email FROM users WHERE type IN ('admin', 'super_admin') AND is_active = '1'");
        const adminEmails = admins.map(a => a.email);

        if (adminEmails.length > 0) {
            await mailService.sendMonthlyProjectAuditMail(adminEmails, buffer, reportMonth);
            await db.query("UPDATE cron_config SET last_run_status = 'success', last_run_message = 'Audit report delivered with 7 columns', run_count = run_count + 1 WHERE job_name = 'monthly_project_audit'");
            console.log(`✅ Audit mail delivered for ${reportMonth}`);
        }
    } catch (error) {
        console.error('❌ Audit Error:', error.message);
        await db.query("UPDATE cron_config SET last_run_status = 'error', last_run_message = ? WHERE job_name = 'monthly_project_audit'", [error.message.substring(0, 250)]);
    }
};


// 1. Naya FTC REminder date checker Function define karein
const runDailyReminderCheck = async () => {
    console.log("🚀 [CRON]: Checking PTD Reminders for All Active Users...");
    try {
        // 1. Check if any reminders are due today
        const [due] = await db.query(
            `SELECT * FROM pending_ptd_reminders WHERE status = 'pending' AND scheduled_at <= NOW()`
        );

        if (due.length === 0) {
            console.log("ℹ️ [CRON]: No pending reminders due at this time.");
            return;
        }

        // 2. 🔥 FETCH ALL ACTIVE USERS (Admin + Super Admin + Regular Users)
        // Hum strictly wahi emails lenge jo 'is_active' hain
        const [userRows] = await db.query(`
            SELECT DISTINCT email 
            FROM users 
            WHERE is_active = '1' 
            AND type IN ('admin', 'super_admin', 'user')
        `);
        
        const allRecipientEmails = userRows.map(u => u.email).filter(Boolean);

        if (allRecipientEmails.length === 0) {
            console.log("⚠️ [CRON]: No active users found in database. Skipping reminder.");
            return;
        }

        console.log(`📊 [CRON]: Sending reminder to ${allRecipientEmails.length} total users.`);

        for (const rem of due) {
            // 3. Trigger reminder alert for all stakeholders
            await mailService.sendPTDReminderAlert(allRecipientEmails, rem.period_code);
            
            // 4. Update status so it doesn't send again
            await db.query(`UPDATE pending_ptd_reminders SET status = 'sent' WHERE id = ?`, [rem.id]);
            console.log(`✅ [SUCCESS]: Reminder sent for ${rem.period_code}`);
        }

    } catch (error) {
        console.error("❌ [CRON ERROR]: Daily Reminder Job failed:", error.message);
    }
};


const runPendingLoaAudit = async () => {
    console.log("🚀 CRON: Starting Monthly Pending LOA Audit...");
    try {
        await db.query("UPDATE cron_config SET last_run_at = NOW(), last_run_status = 'running' WHERE job_name = 'pending_loa_audit'");

        const now = new Date();
        const monthYear = now.toLocaleString('en-US', { month: 'short', year: 'numeric' }).replace(' ', '-');
        
        // 🔥 Internal Call: No req/res needed
        const pendingData = await dataController.getPendingLoas();

        if (pendingData.length === 0) {
            return await db.query("UPDATE cron_config SET last_run_status = 'success', last_run_message = 'No pending LOAs today' WHERE job_name = 'pending_loa_audit'");
        }

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Pending Projects');
        sheet.columns = [
            { header: 'BU', key: 'bu', width: 10 },
            { header: 'Customer', key: 'customer', width: 25 },
            { header: 'LOA ID', key: 'loa_id', width: 15 },
            { header: 'Project Name', key: 'loa_name', width: 40 }
        ];
        pendingData.forEach(row => sheet.addRow(row));
        sheet.getRow(1).font = { bold: true };

        const buffer = await workbook.xlsx.writeBuffer();
        
        const [admins] = await db.query("SELECT email FROM users WHERE type IN ('admin', 'super_admin') AND is_active = '1'");
        const adminEmails = admins.map(a => a.email);

        await mailService.sendPendingLoaAuditMail(adminEmails, buffer, monthYear);
        
        await db.query("UPDATE cron_config SET last_run_status = 'success', last_run_message = 'Mail sent successfully', run_count = run_count + 1 WHERE job_name = 'pending_loa_audit'");
        console.log("✅ CRON: Pending Audit mail delivered.");
    } catch (err) {
        console.error("❌ CRON Error:", err.message);
        await db.query("UPDATE cron_config SET last_run_status = 'error', last_run_message = ? WHERE job_name = 'pending_loa_audit'", [err.message.substring(0, 200)]);
    }
};


// ==========================================
// ⏰ INITIALIZATION (With Primary Check)
// ==========================================
exports.initCron = async () => {
    // 🛑 STOP: Agar ye primary instance nahi hai, toh scheduler mat chalao
    if (!isPrimaryInstance()) {
        console.log(`⏭️  Instance ${process.env.NODE_APP_INSTANCE}: Skipping Cron initialization.`);
        return;
    }

    try {
        console.log("\n==========================================");
        console.log("🚀 Financial COST TRACKER: SCHEDULER STARTED");
        console.log("==========================================");

        // 1. Stop all existing to prevent "Zombie" jobs
        if (syncJob) syncJob.stop();
        if (backupJob) backupJob.stop();
        if (bgdmAlertJob) bgdmAlertJob.stop();
        if (projectAuditJob) projectAuditJob.stop();
        if (ptdReminderJob) ptdReminderJob.stop();
        if (pendingLoaJob) pendingLoaJob.stop();

        // 2. Fetch fresh config
        const [configs] = await db.query("SELECT * FROM cron_config");

        configs.forEach(conf => {
            if (!conf.is_enabled) return;

            console.log(`⏰ Setting up [${conf.job_name}]: ${conf.cron_expression}`);

            if (conf.job_name === 'full_sync') {
                syncJob = cron.schedule(conf.cron_expression, () => runSync('scheduled'));
            } 
            else if (conf.job_name === 'db_backup') {
                backupJob = cron.schedule(conf.cron_expression, () => runDatabaseBackup());
            } 
            else if (conf.job_name === 'bgdm_alerts') {
                bgdmAlertJob = cron.schedule(conf.cron_expression, () => runMonthlyAlerts());
            } 
            else if (conf.job_name === 'monthly_project_audit') {
                projectAuditJob = cron.schedule(conf.cron_expression, () => runMonthlyProjectAudit());
            } 
            else if (conf.job_name === 'ptd_reminder_check') {
                ptdReminderJob = cron.schedule(conf.cron_expression, () => runDailyReminderCheck());
            } 
            else if (conf.job_name === 'pending_loa_audit') {
                pendingLoaJob = cron.schedule(conf.cron_expression, () => runPendingLoaAudit());
            }
            else if (conf.job_name === 'asbl_audit' || conf.job_name === 'missing_asbl_audit') {
                // 🔥 FIX: sendMissingAsblAlert() ki jagah runMonthlyAsblAudit() likhein
                cron.schedule(conf.cron_expression, () => runMonthlyAsblAudit()); 
            }
            else if (conf.job_name === 'missing_ce_reminder') {
                missingCEReminderJob = cron.schedule(conf.cron_expression, () => runMissingCEReminderJob());
            }
        });
    } catch (err) {
        console.error("❌ Cron Init Error:", err.message);
    }
};

// ==========================================
// 🎛️ API ENDPOINTS
// ==========================================
exports.getCronConfig = async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM cron_config ORDER BY id ASC");
        res.json(rows); // 🔥 Return poori list
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getSyncStatus = (req, res) => {
    res.json({ isRunning: isSyncing, cronActive: currentCronJob !== null });
};

exports.updateCronConfig = async (req, res) => {
    try {
        const { job_name, cron_expression, is_enabled } = req.body;
        if (!job_name) return res.status(400).json({ error: "Job name is required" });

        const updates = [];
        const params = [];

        if (cron_expression !== undefined) {
            if (cron_expression !== 'custom' && !cron.validate(cron_expression)) {
                return res.status(400).json({ error: 'Invalid format' });
            }
            updates.push(`cron_expression = ?`);
            params.push(cron_expression);
        }
        if (is_enabled !== undefined) {
            updates.push(`is_enabled = ?`);
            params.push(is_enabled);
        }

        if (updates.length > 0) {
            params.push(job_name); 
            await db.query(`UPDATE cron_config SET ${updates.join(', ')}, updated_at = NOW() WHERE job_name = ?`, params);
            await exports.initCron(); // 🔥 Jobs ko reload karo naye time ke saath
        }

        const [rows] = await db.query("SELECT * FROM cron_config WHERE job_name = ?", [job_name]);
        res.json({ message: `${job_name} updated!`, config: rows[0] });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.triggerManualSync = async (req, res) => {
    const { job_name } = req.body;
    console.log(`👤 [MANUAL]: Triggering job [${job_name}]`); // Debug log
    try {
        if (job_name === 'full_sync') {
            runSync('manual_admin');
        } else if (job_name === 'db_backup') {
            runDatabaseBackup();
        } 
        // 🔥 Handle both names just in case
        else if (job_name === 'asbl_audit' || job_name === 'missing_asbl_audit') {
            runMonthlyAsblAudit(); 
        }
        else if (job_name === 'monthly_project_audit') {
            runMonthlyProjectAudit();
        }
        // 🔥 NAYA CASE ADDED: Reminder trigger ke liye
        else if (job_name === 'missing_ce_reminder') {
            runMissingCEReminderJob(); 
        }
        
        res.json({ message: `Job [${job_name}] triggered in background.` });
    } catch (err) { 
        console.error("Manual Trigger Error:", err.message);
        res.status(500).json({ message: "Failed to trigger: " + err.message }); 
    }
};


// 🔥 NEW: Missing CE Audit Mailer Function
const runMissingCEAuditMailer = async () => {
    console.log("\n📧 [MAILER]: Missing Cost Element check shuru...");
    try {
        const [rows] = await db.query("SELECT wbs_element, raw_cost_element, source_table FROM missing_cost_elements_audit");
        
        if (rows.length === 0) {
            console.log("✅ [MAILER]: Saari mapping sahi hai. Mail skip kar rahe hain.");
            return;
        }

        // Create Excel Attachment
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Missing Elements');
        sheet.columns = [
            { header: 'Cost Element', key: 'raw_cost_element', width: 45 },
            { header: 'Source Table', key: 'source_table', width: 15 }
        ];
        rows.forEach(r => sheet.addRow(r));
        const buffer = await workbook.xlsx.writeBuffer();

        // Get Super Admin Emails
        const [admins] = await db.query("SELECT email FROM users WHERE type = 'admin' AND is_active = '1'");
        const adminEmails = admins.map(a => a.email);

        if (adminEmails.length > 0) {
            await mailService.sendMissingCEMail(adminEmails, buffer);
            console.log(`✅ [MAILER]: Missing CE mail sent to: ${adminEmails.join(', ')}`);
        }
    } catch (err) {
        console.error("❌ [MAILER ERROR]:", err.message);
    }
};

// 🔥 NAYA: 5-Day Reminder for Missing CE
const runMissingCEReminderJob = async () => {
    console.log("⏰ [CRON]: Checking for 5-day old missing CE records...");
    try {
        const [rows] = await db.query(`SELECT wbs_element, raw_cost_element, source_table FROM missing_cost_elements_audit WHERE detected_at::date = (CURRENT_DATE - INTERVAL '5 days')::date`);
        if (rows.length === 0) return;

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Reminder');
        sheet.columns = [{ header: 'WBS Element', key: 'wbs_element', width: 40 }, { header: 'Raw Cost Element', key: 'raw_cost_element', width: 25 }, { header: 'Source', key: 'source_table', width: 15 }];
        rows.forEach(r => sheet.addRow(r));
        const buffer = await workbook.xlsx.writeBuffer();

        const [admins] = await db.query("SELECT email FROM users WHERE type = 'super_admin' AND is_active = '1'");
        if (admins.length > 0) await mailService.sendMissingCEReminderMail(admins.map(a => a.email), buffer);
    } catch (err) { console.error("❌ Reminder Job Error:", err.message); }
};

// 🔥 NAYA: Logic to fetch projects with 0 ASBL and send mail
const runMonthlyAsblAudit = async () => {
    console.log("🚀 [CRON]: Starting Consolidated User-based ASBL Audit...");
    try {
        // 1. Get ALL missing ASBL data (Strict Trim & Lower)
        const wbsTypes = [
            { label: 'AMC', filter: 'AMC', asblCol: 'asbl_amc', ncCol: 'non_committed_editable_amc' },
            { label: 'Project', filter: 'Project', asblCol: 'asbl_project', ncCol: 'non_committed_editable_project' },
            { label: 'Warranty', filter: 'Warranty/Other', asblCol: 'asbl_warranty', ncCol: 'non_committed_editable_warranty' }
        ];

        let allMissingData = [];

        for (const type of wbsTypes) {
            const query = `
                SELECT bu, TRIM(customer) as customer, loa_id, loa_name, ? as type_label,
                    ROUND(SUM(cat_asbl), 2) as asbl, ROUND(SUM(cat_ptd), 2) as ptd,
                    ROUND(SUM(cat_oc), 2) as oc, ROUND(SUM(cat_nc), 2) as nc,
                    ROUND(SUM(cat_ptd + cat_oc + cat_nc), 2) as eac,
                    ROUND(SUM(cat_asbl) - SUM(cat_ptd + cat_oc + cat_nc), 2) as variance
                FROM (
                    SELECT t.bu, t.customer, t.loa_id, t.loa_name, t."Merged_wbs_categories",
                        MAX(COALESCE(static.asbl_val, 0)) as cat_asbl,
                        SUM(t.ptd) as cat_ptd, SUM(t."open_commitment_KEUR") as cat_oc,
                        MAX(COALESCE(static.nc_val, 0)) as cat_nc
                    FROM final_dashboard_table t
                    LEFT JOIN (
                        SELECT "Merged_wbs_categories", MAX(${type.asblCol}) as asbl_val, MAX(${type.ncCol}) as nc_val
                        FROM final_dashboard_table GROUP BY 1
                    ) as static ON t."Merged_wbs_categories" = static."Merged_wbs_categories"
                    WHERE t.active_inactive = 'Active' AND t.cost_revenue = 'Cost'
                      AND t.categories NOT IN ('Not to considered')
                      AND TRIM(LOWER(t.wbs_type)) = TRIM(LOWER(?))
                    GROUP BY 1, 2, 3, 4, 5
                ) as rollup
                GROUP BY 1, 2, 3, 4
                HAVING SUM(cat_asbl) = 0 OR SUM(cat_asbl) IS NULL
            `;
            const [rows] = await db.query(query, [type.label, type.filter]);
            allMissingData.push(...rows);
        }

        if (allMissingData.length === 0) return console.log("✅ [CRON]: No missing data found.");

        // 2. Get Users and their mapped Customers (Apply TRIM & LOWER here too)
        const [userMappings] = await db.query(`
            SELECT DISTINCT LOWER(TRIM(u.email)) as email, LOWER(TRIM(a.customer)) as customer 
            FROM users u
            JOIN access a ON TRIM(LOWER(u.email)) = TRIM(LOWER(a.email))
            WHERE u.is_active = '1'
            AND u.type NOT IN ('admin', 'super_admin')
        `);

        // 3. Map Workload
        const userWorkload = {};
        userMappings.forEach(m => {
            if (!userWorkload[m.email]) userWorkload[m.email] = new Set();
            userWorkload[m.email].add(m.customer);
        });

        // 4. Send Mails
        for (const email of Object.keys(userWorkload)) {
            const allowedCustomers = userWorkload[email]; // This is a Set of lower-case trimmed customers
            
            // 🔥 CRITICAL FIX: Filter data matching strictly with user's customers
            const userData = allMissingData.filter(d => 
                allowedCustomers.has(String(d.customer || '').trim().toLowerCase())
            );

            if (userData.length === 0) continue;

            const attachmentsList = [];
            const createBuffer = async (label, filename) => {
                const specificRows = userData.filter(d => d.type_label === label);
                if (specificRows.length > 0) {
                    const workbook = new ExcelJS.Workbook();
                    const sheet = workbook.addWorksheet('Missing Data');
                    sheet.columns = [
                        { header: 'BU', key: 'bu', width: 10 }, { header: 'Customer', key: 'customer', width: 25 },
                        { header: 'LOA ID', key: 'loa_id', width: 15 }, { header: 'LOA Name', key: 'loa_name', width: 40 },
                        { header: 'ASBL', key: 'asbl', width: 12 }, { header: 'PTD', key: 'ptd', width: 12 },
                        { header: 'Open Commitment', key: 'oc', width: 18 }, { header: 'Non Committed', key: 'nc', width: 15 },
                        { header: 'EAC', key: 'eac', width: 12 }, { header: 'EAC VS ASBL', key: 'variance', width: 15 }
                    ];
                    specificRows.forEach(r => sheet.addRow(r));
                    sheet.getRow(1).eachCell(c => {
                        c.font = { bold: true, color: { argb: 'FFFFFF' } };
                        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '124191' } };
                    });
                    attachmentsList.push({ filename: `${filename}.xlsx`, content: await workbook.xlsx.writeBuffer() });
                }
            };

            await createBuffer('AMC', 'Missing_ASBL_AMC');
            await createBuffer('Project', 'Missing_ASBL_Project');
            await createBuffer('Warranty', 'Missing_ASBL_Warranty');

            if (attachmentsList.length > 0) {
                await mailService.sendMissingAsblAlert([email], attachmentsList);
                console.log(`📧 SUCCESS: Mail sent to ${email} with ${userData.length} total rows.`);
            }
        }
    } catch (err) {
        console.error("❌ [CRON ERROR]:", err.message);
    }
};


exports.triggerAutoSync = (source) => {
    if (autoSyncTimeout) clearTimeout(autoSyncTimeout);
    
    const action = source.replace('_', ' ').toUpperCase();
    console.log(`\n⚡ [USER ACTION]: ${action} detect hua. Data update karne ke liye 15s wait kar rahe hain...`);
    
    autoSyncTimeout = setTimeout(() => {
        runSync(`auto_trigger_${source}`); // FIXED

        // 🔥 NEW: Agar PTD upload hua hai toh 5 minute (300,000 ms) baad mail trigger karo
        if (source === 'ptd_uploaded') {
            console.log("⏱️ [SCHEDULED]: Missing CE Audit Mail 5 minute mein bheja jayega...");
            setTimeout(runMissingCEAuditMailer, 300000); 
        }
    }, 15000); 
};

// EXPORTING BACKUP FUNCTION SO YOU CAN TEST IT IF NEEDED
exports.testDatabaseBackup = (req, res) => {
    runDatabaseBackup();
    res.json({ message: "Backup process triggered in background. Check console logs." });
};