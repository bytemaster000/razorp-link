import { neon } from '@neondatabase/serverless';

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const parts = url.pathname.split('/');
  
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) {
    return new Response(JSON.stringify({ error: "DATABASE_URL environment variable is missing." }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const sql = neon(databaseUrl);
  
  // Extract id from parts: ["", "api", "transactions", "pay_..."]
  const id = parts.length > 3 ? parts[3] : null;

  try {
    // Initialize DB table if not exists
    await sql`
      CREATE TABLE IF NOT EXISTS transactions (
        id VARCHAR(50) PRIMARY KEY,
        mode VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        mobile VARCHAR(20),
        upi_id VARCHAR(255),
        amount NUMERIC(15, 2) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `;

    if (request.method === 'POST') {
      const txn = await request.json();
      
      await sql`
        INSERT INTO transactions (id, mode, name, mobile, upi_id, amount, created_at)
        VALUES (
          ${txn.id},
          ${txn.mode},
          ${txn.name},
          ${txn.mobile || null},
          ${txn.upiId || null},
          ${txn.amount},
          ${new Date(txn.createdAt)}
        )
      `;
      
      return new Response(JSON.stringify({ success: true, transaction: txn }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else if (request.method === 'GET') {
      if (!id) {
        return new Response(JSON.stringify({ error: "Missing transaction ID." }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const rows = await sql`
        SELECT id, mode, name, mobile, upi_id, amount, created_at 
        FROM transactions 
        WHERE id = ${id}
      `;

      if (rows.length > 0) {
        const row = rows[0];
        return new Response(JSON.stringify({
          id: row.id,
          mode: row.mode,
          name: row.name,
          mobile: row.mobile || '',
          upiId: row.upi_id || '',
          amount: parseFloat(row.amount),
          createdAt: row.created_at
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } else {
        return new Response(JSON.stringify({ error: "Transaction not found." }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response(JSON.stringify({ error: "Method not allowed." }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error("Database error in Cloudflare Pages Function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
