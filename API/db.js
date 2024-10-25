require('dotenv').config(); 
const { Pool } = require('pg');

console.log("Connecting to database with URL:", process.env.DATABASE_URL);

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false 
    }
});


const connectDB = async () => {
    try {
        await pool.connect();
        console.log('Database connected successfully');
    } catch (err) {
        console.error('Database connection error:', err);
        process.exit(1); 
    }
};

const createTables = async () => {
    const queryText = `
        CREATE TABLE IF NOT EXISTS tickets (
            id UUID PRIMARY KEY,
            vatin VARCHAR(255) NOT NULL,
            first_name VARCHAR(255) NOT NULL,
            last_name VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `;

    try {
        await pool.query(queryText);
        console.log('Tables created successfully');
    } catch (err) {
        console.error('Error creating tables:', err);
    }
};

module.exports = {
    connectDB,
    createTables,
    pool
};
