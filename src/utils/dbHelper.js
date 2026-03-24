/**
 * Formats a date object to YYYYMMDD string
 * @param {Date} date 
 * @returns {string}
 */
function formatDateIso(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}${mm}${dd}`;
}

/**
 * Formats a date object to YYYYMMDDHHmmSS string
 * @param {Date} date 
 * @returns {string}
 */
function formatDateTimeIso(date) {
    const datePart = formatDateIso(date);
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return `${datePart}${hh}${min}${ss}`;
}

/**
 * Generates a primary key according to the project convention:
 * TABLE_USER_YYYYMMDD_HHmmSS_SEQ
 * @param {string} tablePrefix - 3 uppercase chars (e.g., "SFA")
 * @param {string} userPrefix - 3 uppercase chars (e.g., "TIF")
 * @param {Date} date - usage date
 * @param {number} sequence - integer (e.g., 1 -> "001")
 * @returns {string}
 */
function generateKey(tablePrefix, userPrefix, date, sequence = 1) {
    const ts = formatDateTimeIso(date); // YYYYMMDDHHmmSS
    // Add underscores for better readability as suggested "nice to have"
    // Format: SFA_TIF_20260211085013001 or split with underscores
    // User Example: SFA_TIF_20260211_085013_001
    // The timestamp part in user examle was split: 20260211_085013
    
    // Deconstruct timestamp for formatting:
    const d8 = ts.substring(0, 8);
    const t6 = ts.substring(8, 14);
    
    const seqStr = String(sequence).padStart(3, '0');
    
    return `${tablePrefix}_${userPrefix}_${d8}_${t6}_${seqStr}`;
}

module.exports = {
    formatDateIso,
    formatDateTimeIso,
    generateKey
};
