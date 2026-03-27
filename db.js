const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'u102065690_apna_bazar',
    password: process.env.DB_PASSWORD || 'ApnaBazar@123',
    database: process.env.DB_NAME || 'u102065690_apna_bazar',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = {
    // Wrapper to translate PostgreSQL syntax to MySQL for existing codebase
    query: async (text, params) => {
        let isReturning = false;

        // Remove RETURNING * if it exists
        if (/RETURNING\s+\*/i.test(text)) {
            isReturning = true;
            text = text.replace(/RETURNING\s+\*/i, '').trim();
        }

        // Replace PostgreSQL positional arguments ($1, $2, etc.) with MySQL parameters (?)
        const mysqlText = text.replace(/\$\d+/g, '?');

        try {
            const [results, fields] = await pool.query(mysqlText, params);

            // Handle INSERT RETURNING *
            if (isReturning && results && results.insertId) {
                const tableMatch = mysqlText.match(/INSERT\s+INTO\s+([a-zA-Z0-9_]+)/i);
                if (tableMatch) {
                    const tableName = tableMatch[1];
                    const [rows] = await pool.query(`SELECT * FROM ${tableName} WHERE id = ?`, [results.insertId]);
                    return { rows, rowCount: rows.length };
                }
            }

            // For SELECT queries returning rows
            if (Array.isArray(results)) {
                return { rows: results, rowCount: results.length };
            }

            // For normal INSERT/UPDATE/DELETE queries
            return {
                rows: [],
                rowCount: results.affectedRows,
                insertId: results.insertId
            };
        } catch (err) {
            console.error('MySQL Query Error:', err.message, '\nQuery:', mysqlText, '\nParams:', params);
            throw err;
        }
    }
};
