const transporter = require("../config/mailer");

// Tool configuration

const TOOL_NAME = "NI INDIA Financial Cost Tracker";

const TOOL_LINK = "http://10.68.32.105:3001/";

//---- Send Access Request Mailer to Admins (Neha, Mohsin) ----
const sendAccessRequestMail = async (request) => {

    const mailOptions = {

        from: '"NI INDIA Financial Cost Tracker" <care.ni_india@nokia.com>',

        to: ["neha.sain.ext@nokia.com"],

        bcc: "care.ni_india@nokia.com",

        replyTo: request.email,

        subject: `New Access Request: NI INDIA Financial Cost Tracker - ${request.customer}`,

        html: `

        <div style="font-family: Calibri, Arial, sans-serif; max-width:700px; margin:auto; border:1px solid #dcdcdc; border-radius:8px; overflow:hidden;">

            <div style="background:#124191; color:#ffffff; padding:16px 24px;">

                <h2 style="margin:0;">NI INDIA Financial Cost Tracker</h2>

                <p style="margin:6px 0 0;">New Access Request</p>

            </div>

            <div style="padding:24px; color:#333333;">

                <p>Dear Team,</p>

                <p>A new access request is raised for <strong>NI INDIA Financial Cost Tracker</strong>.</p>

                <table style="width:100%; border-collapse:collapse; margin-top:20px;">

                    <tr>

                        <td style="padding:10px; border:1px solid #ddd; background:#f5f5f5; width:35%;"><strong>Customer Account Name</strong></td>

                        <td style="padding:10px; border:1px solid #ddd;">${request.customer}</td>

                    </tr>

                    <tr>

                        <td style="padding:10px; border:1px solid #ddd; background:#f5f5f5;"><strong>Business Unit</strong></td>

                        <td style="padding:10px; border:1px solid #ddd;">${request.bu}</td>

                    </tr>

                    <tr>

                        <td style="padding:10px; border:1px solid #ddd; background:#f5f5f5;"><strong>Project Name</strong></td>

                        <td style="padding:10px; border:1px solid #ddd;">${request.loa}</td>

                    </tr>

                    <tr>

                        <td style="padding:10px; border:1px solid #ddd; background:#f5f5f5;"><strong>Requested By</strong></td>

                        <td style="padding:10px; border:1px solid #ddd;">${request.email}</td>

                    </tr>

                </table>

                <div style="margin-top:30px; text-align:center;">

                    <p style="font-size:15px; color:#666;">Click the Link below to review the request:</p>

                    <a href="${TOOL_LINK}" style="background:#124191; color:#ffffff; padding:12px 25px; text-decoration:none; font-weight:bold; border-radius:5px; display:inline-block;">

                        Go to ${TOOL_NAME}

                    </a>

                </div>

                <p style="margin-top:25px;">Best Regards,<br><strong>NI INDIA PMO Team</strong></p>

            </div>

            <div style="background:#f8f8f8; padding:12px 24px; font-size:12px; color:#666; text-align:center;">

                NOTE: This is an automatically generated email. Please do not reply directly to this message.

            </div>

        </div>`

    };

    return transporter.sendMail(mailOptions);

};


// send approval mail to user after admin approves the request
const sendApprovalMail = async (request) => {

    const mailOptions = {

        from: '"NI INDIA Financial Cost Tracker" <care.ni_india@nokia.com>',

        to: request.email,

        cc: ["neha.sain.ext@nokia.com"],
        bcc: "care.ni_india@nokia.com",

        subject: `Access Approved - NI INDIA Financial Cost Tracker`,

        html: `

        <div style="font-family: Calibri, Arial, sans-serif; max-width:700px; margin:auto; border:1px solid #dcdcdc; border-radius:8px; overflow:hidden;">

            <div style="background:#124191; color:#ffffff; padding:16px 24px;">

                <h2 style="margin:0;">Access Granted!</h2>

            </div>

            <div style="padding:24px; color:#333333;">

                <p>Dear User,</p>

                <p>Your access request for the <strong>NI INDIA Financial Cost Tracker</strong> has been <strong>Approved</strong>.</p>

                <p>Click the link below to access:</p>

               

                <div style="margin:25px 0; text-align:center;">

                    <a href="${TOOL_LINK}" style="background:#124191; color:#ffffff; padding:14px 30px; text-decoration:none; font-weight:bold; border-radius:5px; display:inline-block; font-size:16px;">

                        Login to ${TOOL_NAME}

                    </a>

                </div>

                <table style="width:100%; border-collapse:collapse; margin-top:20px;">

                    <tr>

                        <td style="padding:10px; border:1px solid #ddd; background:#f5f5f5; width:35%;"><strong>Customer Name</strong></td>

                        <td style="padding:10px; border:1px solid #ddd;">${request.requested_customers}</td>

                    </tr>

                    <tr>

                        <td style="padding:10px; border:1px solid #ddd; background:#f5f5f5;"><strong>Business Unit</strong></td>

                        <td style="padding:10px; border:1px solid #ddd;">${request.bu}</td>

                    </tr>

                </table>

                <p style="margin-top:25px;">Best Regards,<br><strong>NI INDIA PMO Team</strong></p>

            </div>

        </div>`

    };

    return transporter.sendMail(mailOptions);

};


//send decline mail to user after admin declines the request
const sendDeclineMail = async (request) => {

    const mailOptions = {

        from: '"NI INDIA Financial Cost Tracker" <care.ni_india@nokia.com>',

        to: request.email,

        cc: ["neha.sain.ext@nokia.com"],
        bcc: "care.ni_india@nokia.com",

        subject: `Access Request Update - NI INDIA Financial Cost Tracker`,

        html: `

        <div style="font-family: Calibri, Arial, sans-serif; max-width:700px; margin:auto; border:1px solid #dcdcdc; border-radius:8px; overflow:hidden;">

            <div style="background:#666666; color:#ffffff; padding:16px 24px;">

                <h2 style="margin:0;">Request Declined</h2>

            </div>

            <div style="padding:24px; color:#333333;">

                <p>Dear User,</p>

                <p>We regret to inform you that your access request for the following entity has been <strong>Declined</strong>.</p>

                <table style="width:100%; border-collapse:collapse; margin:20px 0;">
                    <tr>
                        <td style="padding:10px; border:1px solid #ddd; background:#f5f5f5; width:35%;"><strong>Customer Account</strong></td>

                        <td style="padding:10px; border:1px solid #ddd;">${request.requested_customers}</td>
                    </tr>
                </table>

                <p>If you believe this is an error, please visit the portal to re-apply or contact the administrators.</p>

                <p style="margin-top:20px;">
                    Portal Link: <a href="${TOOL_LINK}" style="color:#124191; font-weight:bold;">${TOOL_NAME}</a>
                </p>

                <p style="margin-top:25px;">Best Regards,<br><strong>NI INDIA PMO Team</strong></p>

            </div>

        </div>`

    };

    return transporter.sendMail(mailOptions);

};


//send OTP mail to user for password reset
const sendOTPMail = async (email, otp) => {
    const mailOptions = {
        from: '"NI INDIA Financial Cost Tracker" <care.ni_india@nokia.com>',
        to: email,
        bcc: "care.ni_india@nokia.com",
        subject: `Password Reset OTP - NI INDIA Financial Cost Tracker`,
        html: `
        <div style="font-family: Calibri, Arial, sans-serif; max-width:600px; margin:auto; border:1px solid #eee; border-radius:10px; padding:20px;">
            <h2 style="color: #124191;">Password Reset Request</h2>
            <p>Dear User,</p>
            <p>You requested to reset your password. Use the following OTP to proceed. This OTP is valid for 10 minutes only.</p>
            <div style="background: #f4f4f4; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #124191; border-radius: 8px;">
                ${otp}
            </div>
            <p style="margin-top: 20px;">If you did not request this, please ignore this email or contact admin.</p>
            <div style="margin-top:30px; text-align:center;">

                    <p style="font-size:15px; color:#666;">Click the Link below to review the request:</p>

                    <a href="${TOOL_LINK}" style="background:#124191; color:#ffffff; padding:12px 25px; text-decoration:none; font-weight:bold; border-radius:5px; display:inline-block;">

                        Go to ${TOOL_NAME}

                    </a>

                </div>
            <p>Regards,<br><strong>NI INDIA PMO Team</strong></p>
        </div>`
    };
    return transporter.sendMail(mailOptions);
};


// ------------------------------------
//      Mailers for Cost Overrun:
// ------------------------------------
// PTD Util % > 80%
// EAC vs ASBL > 100%
const sendCustomerUtilizationAlert = async (recipients, customerName, alertsList) => {
    // Generate Table Rows dynamically
    const tableRows = alertsList.map(item => `
        <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 12px; font-weight: bold; color: #333;">${item.bu}</td>
            <td style="padding: 12px; color: #124191; font-weight: bold;">${item.wbs_type}</td>
            <td style="padding: 12px; text-align: center; color: ${parseFloat(item.ptd_perc) > 80 ? '#d32f2f' : '#ddd'}; font-weight: bold;">
                ${Number(item.ptd_perc).toFixed(1)}%
            </td>
            <td style="padding: 12px; text-align: center; color: ${parseFloat(item.eac_perc) > 100 ? '#d32f2f' : '#ddd'}; font-weight: bold;">
                ${Number(item.eac_perc).toFixed(1)}%
            </td>
        </tr>
    `).join('');

    const mailOptions = {
        from: '"NI INDIA Cost Tracker Alert" <care.ni_india@nokia.com>',
        to: recipients,
        cc: ["neha.sain.ext@nokia.com"],
        bcc: "care.ni_india@nokia.com",
        subject: `⚠️ Action Required: PTD UTIL % || EAC vs ASBL % - ${customerName}`,
        html: `
        <div style="font-family: Calibri, Arial, sans-serif; max-width:750px; margin:auto; border:1px solid #ddd; border-radius:12px; overflow:hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
            <div style="background:#005AFF; color:#ffffff; padding:25px;">
                <h2 style="margin:0; font-size: 22px;">NI INDIA Financial Cost Tracker: Customer Cost Overrun</h2>
                <p style="margin:5px 0 0; opacity: 0.9;">Consolidated data for assigned account.</p>
            </div>
            
            <div style="padding:30px; color:#333333;">
                <p style="font-size: 16px;">Dear Team,</p>
                <p>below projects need your attention is either PTD reached 80% of ASBL or EAC is more than ASBL.<br>
                Please check and update along with cost optimization plan.</p>
               
                <table style="width:100%; margin:25px 0; border-collapse:collapse; border: 1px solid #e0e0e0;">
                    <thead style="background:#f4f7fa;">
                        <tr>
                            <th style="padding:12px; text-align:left; font-size:12px; text-transform:uppercase; color:#666;">Business Unit</th>
                            <th style="padding:12px; text-align:left; font-size:12px; text-transform:uppercase; color:#666;">WBS Category</th>
                            <th style="padding:12px; text-align:center; font-size:12px; text-transform:uppercase; color:#666;">PTD Util %</th>
                            <th style="padding:12px; text-align:center; font-size:12px; text-transform:uppercase; color:#666;">EAC vs ASBL %</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
 
                <div style="background:#fff9f0; border-left:4px solid #ff9800; padding:15px; margin-bottom:25px; font-size: 14px;">
                    <strong>Action Required:</strong> Please coordinate with the Project Managers (PMs) to review the 'Non-Committed' cost entries for the red-marked items above.
                </div>
               
                <div style="text-align:center; margin:35px 0;">
                    <a href="${TOOL_LINK}" style="background:#124191; color:#ffffff; padding:14px 40px; text-decoration:none; font-weight:bold; border-radius:8px; display:inline-block; font-size:16px;">
                        Login to Tool
                    </a>
                </div>
 
                <p style="margin-top:30px; border-top:1px solid #eee; padding-top:20px; font-size: 14px;">
                    Best Regards,<br>
                    <strong>NI INDIA Financial Control Team</strong>
                </p>
            </div>
            <div style="background:#f9f9f9; padding:15px; text-align:center; font-size:11px; color:#999; border-top: 1px solid #eee;">
                Role: Business Group Delivery Manager (BGDM) Summary | Auto-generated Report
            </div>
        </div>`
    };
    return transporter.sendMail(mailOptions);
};
 
// FTC update mailer for PTD update notification to all stakeholders (BGDM, PM, Admin)
const sendPTDUpdateAlert = async (recipientEmails, periodCode) => {
    const now = new Date();
    const monthName = now.toLocaleString('en-US', { month: 'long' }); // e.g., "September"
    const deadlineDate = `15th ${monthName}`; // e.g., "15th September"

    const mailOptions = {
        from: '"NI INDIA Financial Cost Tracker" <care.ni_india@nokia.com>',
        to: recipientEmails,
        cc: ["neha.sain.ext@nokia.com"], // As per your latest code
        bcc: "care.ni_india@nokia.com",
        subject: `NOTIFICATION: To update Non-Committed Cost ${periodCode} - NI INDIA Financial Cost Tracker`,
        html: `
        <div style="font-family: Calibri, Arial, sans-serif; font-size: 15px; color: #333; line-height: 1.6;">
            <p>Dear Team,</p>
            <p>PTD for <strong>${periodCode}</strong> has been updated in NI INDIA Financial Cost Tracker.
               Please check and provide forecast (Non Committed) to complete cost by <strong>next 3 days</strong>.
            </p>
            <div style="text-align:center; margin:35px 0;">
                <a href="${TOOL_LINK}" style="background:#124191; color:#ffffff; padding:14px 40px; text-decoration:none; font-weight:bold; border-radius:8px; display:inline-block; font-size:16px;">
                    Login to Tool
                </a>
            </div>
            <p>Best Regards,<br><strong>NI INDIA PMO Team</strong></p>
        </div>`
    };
    return transporter.sendMail(mailOptions);
};


// FTC Reminder mailer for PTD update notification to all stakeholders (BGDM, PM, Admin)
const sendPTDReminderAlert = async (recipientEmails, periodCode) => {
    const now = new Date();
    const monthName = now.toLocaleString('en-US', { month: 'long' });
    const deadlineDate = `15th ${monthName}`;

    const mailOptions = {
        from: '"NI INDIA Financial Cost Tracker" <care.ni_india@nokia.com>',
        // 🔥 TO: Ab ye dynamic filtered list receive karega
        to: recipientEmails, 
        cc: ["neha.sain.ext@nokia.com"], // Testing ke liye rakha hai
        bcc: "care.ni_india@nokia.com",
        subject: `⚠️ REMINDER: To update Non-Committed Cost ${periodCode} - NI INDIA Financial Cost Tracker`,
        html: `
        <div style="font-family: Calibri, Arial, sans-serif; font-size: 15px; color: #333; line-height: 1.6;">
            <p>Dear Team,</p>
            <p>This is a reminder that the PTD for <strong>${periodCode}</strong> was updated 5 days ago.</p>
            <p>Please ensure you provide the forecast to complete cost by the <strong>End of Day</strong>.</p>
            <div style="text-align:center; margin:35px 0;">
                    <a href="${TOOL_LINK}" style="background:#124191; color:#ffffff; padding:14px 40px; text-decoration:none; font-weight:bold; border-radius:8px; display:inline-block; font-size:16px;">
                        Login to Tool
                    </a>
            </div>
            <p>Best Regards,<br><strong>NI INDIA PMO Team</strong></p>
        </div>`
    };
    return transporter.sendMail(mailOptions);
};

// 🔥 Last Month Added WBS List
const sendMonthlyProjectAuditMail = async (adminEmails, excelBuffer, monthName) => {
    const mailOptions = {
        from: '"NI INDIA Financial Cost Tracker" <care.ni_india@nokia.com>',
        // to: adminEmails, // List of all admins
        // 🔥 TESTING OVERRIDE: Sending only to Neha
        to: ["neha.sain.ext@nokia.com"], 
        bcc: "care.ni_india@nokia.com",
        subject: `Last Month Added WBS List: New WBS Elements Added - ${monthName}`,
        html: `
        <div style="font-family: Calibri, Arial, sans-serif; font-size: 15px; color: #333;">
            <p>Dear Admin,</p>
            <p>Please find attached the <strong>Last Month Added WBS List</strong> for <strong>${monthName}</strong>.</p>
            <p>This report contains details of all <strong>New Projects</strong> and <strong>Additional WBS Elements</strong> added to the NI INDIA Financial Cost Tracker during the last month.</p>
            <br/>

            <div style="text-align:center; margin:35px 0;">
                    <a href="${TOOL_LINK}" style="background:#124191; color:#ffffff; padding:14px 40px; text-decoration:none; font-weight:bold; border-radius:8px; display:inline-block; font-size:16px;">
                        Login to Tool
                    </a>
            </div>
            <br/>
            <p>Best Regards,<br><strong>NI INDIA PMO Team</strong></p>
            <div style="margin-top: 30px; font-size: 12px; color: #777; border-top: 1px solid #eee; padding-top: 10px;">
                Note: This is an automated system-generated report.
            </div>
        </div>`,
        attachments: [
            {
                filename: `Project_WBS_Added_${monthName.replace(' ', '_')}.xlsx`,
                content: excelBuffer,
                contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            }
        ]
    };

    return transporter.sendMail(mailOptions);
};

// 🔥 Action Required: Pending Loa names List with no Non Commited inputs
const sendPendingLoaAuditMail = async (adminEmails, excelBuffer, monthYear) => {
    const mailOptions = {
        from: '"Financial Cost Tracker Audit" <care.ni_india@nokia.com>',
        // to: adminEmails, // Array of admins
        to: ["neha.sain.ext@nokia.com"],
        cc: ["neha.sain.ext@nokia.com"], // 🔥 Required CC
        bcc: "care.ni_india@nokia.com",
        subject: `⚠️ Action Required: Pending Loa names List with no Non Commited inputs - ${monthYear}`,
        html: `
        <div style="font-family: Calibri, Arial, sans-serif; font-size: 15px; color: #333;">
            <p>Dear Team,</p>
            <p>This is an automated report for <strong>${monthYear}</strong>.</p>
            <p>Attached is the list of <strong>Active Projects (LOAs)</strong> for which "Non-Committed" values have <strong>NOT</strong> been updated/saved yet for the current month.</p>
            <p>Please follow up with the respective stakeholders to ensure data completion.</p>
            <br/>

            <div style="text-align:center; margin:35px 0;">
                    <a href="${TOOL_LINK}" style="background:#124191; color:#ffffff; padding:14px 40px; text-decoration:none; font-weight:bold; border-radius:8px; display:inline-block; font-size:16px;">
                        Login to Tool
                    </a>
            </div>
            <br/>
            <p>Best Regards,<br><strong>NI INDIA PMO Team</strong></p>
        </div>`,
        attachments: [{
            filename: `Pending_LOA_Updates_${monthYear}.xlsx`,
            content: excelBuffer
        }]
    };
    return transporter.sendMail(mailOptions);
};

// first mail (after 5 minutes of ptd/OC upload) to all admins with missing cost elements
const sendMissingCEMail = async (adminEmails, excelBuffer) => {
    const mailOptions = {
        from: '"NI INDIA Cost Tracker" <care.ni_india@nokia.com>',
        to: adminEmails,
        cc: ["neha.sain.ext@nokia.com"],
        subject: "⚠️ Missing Cost Elements from PTD/OC",
        html: `
            <div style="font-family: Calibri, sans-serif; font-size: 15px; color: #333;">
                <p>Dear Team,</p>
                <p>Below projects need your attention as <strong>Cost Element Mapping</strong> is not available.</p>

                <br/>
                <p>Best Regards,<br/><strong>NI INDIA PMO Team</strong></p>
            </div>
        `,
        attachments: [{ filename: 'Missing_Cost_Elements_Report.xlsx', content: excelBuffer }]
    };
    return transporter.sendMail(mailOptions);
};

// 🔥 New: Reminder Mail (after 5 days of first mail)
const sendMissingCEReminderMail = async (adminEmails, excelBuffer) => {
    const mailOptions = {
        from: '"NI INDIA Cost Tracker" <care.ni_india@nokia.com>',
        to: adminEmails,
        cc: ["neha.sain.ext@nokia.com"],
        subject: "⚠️ REMINDER: Missing Cost Elements from PTD/OC",
        html: `
            <div style="font-family: Calibri, sans-serif; font-size: 15px; color: #333;">
                <p>Dear Team,</p>
                <p>Below projects need your attention as <strong>Cost Element Mapping</strong> is not available.</p>
                <p>Please take immediate action to update the cost mapping.</p>
                <br/>
                <p>Regards,<br/><strong>NI INDIA PMO Team</strong></p>
            </div>
        `,
        attachments: [{ filename: 'REMINDER_Missing_Cost_Elements.xlsx', content: excelBuffer }]
    };
    return transporter.sendMail(mailOptions);
};


// 🔥 NAYA: Missing ASBL Notification Mailer
const sendMissingAsblAlert = async (recipientEmails, attachmentsList) => {
    const mailOptions = {
        from: '"NI INDIA Cost Tracker" <care.ni_india@nokia.com>',
        to: recipientEmails,
        cc: ["neha.sain.ext@nokia.com"],
        subject: "⚠️ Missing ASBL data in Financial Cost Tracker",
        html: `
            <div style="font-family: Calibri, sans-serif; font-size: 15px; color: #333;">
                <p>Dear Team,</p>
                <p>Below projects need your attention as <strong>ASBL numbers</strong> are not updated yet.</p>
                <p>Kindly check and update the ASBL numbers in the next 3 days.</p>
                <br/>
                <p>Best Regards,<br/><strong>NI INDIA PMO Team</strong></p>
            </div>
        `,
        attachments: attachmentsList // 🔥 Dynamic list of files
    };
    return transporter.sendMail(mailOptions);
};


module.exports = {

    sendAccessRequestMail,

    sendApprovalMail,

    sendDeclineMail,

    sendOTPMail,

    sendCustomerUtilizationAlert,

    sendPTDUpdateAlert,

    sendMonthlyProjectAuditMail,

    sendPTDReminderAlert,

    sendPendingLoaAuditMail,

    sendMissingCEMail,

    sendMissingCEReminderMail,

    sendMissingAsblAlert

};