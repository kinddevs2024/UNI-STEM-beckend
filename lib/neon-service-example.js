/**
 * Example usage of Neon Database Service
 * This file demonstrates how to use the Neon PostgreSQL database
 */

import connectNeonDB, { getNeonDB } from './neon-db.js';

/**
 * Example: Get data from Neon database
 * @returns {Promise<Array>} Data from database
 */
export async function getDataExample() {
  try {
    // Method 1: Using connectNeonDB directly
    const sql = await connectNeonDB();
    const data = await sql`SELECT * FROM your_table LIMIT 10`;
    return data;
  } catch (error) {
    console.error('Error getting data:', error);
    throw error;
  }
}

/**
 * Example: Insert data into Neon database
 * @param {Object} item - Item to insert
 * @returns {Promise<Array>} Inserted data
 */
export async function insertDataExample(item) {
  try {
    const sql = await connectNeonDB();
    const result = await sql`
      INSERT INTO your_table (name, value, created_at)
      VALUES (${item.name}, ${item.value}, NOW())
      RETURNING *
    `;
    return result;
  } catch (error) {
    console.error('Error inserting data:', error);
    throw error;
  }
}

/**
 * Example: Update data in Neon database
 * @param {string} id - ID of item to update
 * @param {Object} updates - Fields to update
 * @returns {Promise<Array>} Updated data
 */
export async function updateDataExample(id, updates) {
  try {
    const sql = await connectNeonDB();
    const result = await sql`
      UPDATE your_table
      SET name = ${updates.name}, value = ${updates.value}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;
    return result;
  } catch (error) {
    console.error('Error updating data:', error);
    throw error;
  }
}

/**
 * Example: Delete data from Neon database
 * @param {string} id - ID of item to delete
 * @returns {Promise<Array>} Deleted data
 */
export async function deleteDataExample(id) {
  try {
    const sql = await connectNeonDB();
    const result = await sql`
      DELETE FROM your_table
      WHERE id = ${id}
      RETURNING *
    `;
    return result;
  } catch (error) {
    console.error('Error deleting data:', error);
    throw error;
  }
}

/**
 * Example: Transaction usage
 * @returns {Promise<Array>} Data from transaction
 */
export async function transactionExample() {
  try {
    const sql = await connectNeonDB();
    // Neon supports transactions using sql.begin()
    const result = await sql.begin(async (sql) => {
      const [inserted] = await sql`
        INSERT INTO your_table (name, value) 
        VALUES ('test', 'value')
        RETURNING *
      `;
      
      const updated = await sql`
        UPDATE your_table 
        SET value = 'updated'
        WHERE id = ${inserted.id}
        RETURNING *
      `;
      
      return updated;
    });
    return result;
  } catch (error) {
    console.error('Error in transaction:', error);
    throw error;
  }
}

