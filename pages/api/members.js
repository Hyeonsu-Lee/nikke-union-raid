// pages/api/members.js
import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
    const { method } = req;
    
    switch (method) {
        case 'POST':
            const { seasonId, name } = req.body;
            
            try {
                await sql`
                    INSERT INTO members (season_id, name)
                    VALUES (${seasonId}, ${name})
                `;
                
                const updated = await sql`
                    SELECT * FROM members WHERE season_id = ${seasonId}
                `;
                
                res.status(200).json(updated.rows);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
            break;
            
        case 'DELETE':
            try {
                await sql`DELETE FROM members WHERE id = ${req.query.id}`;
                res.status(200).json({ success: true });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
            break;
            
        default:
            res.status(405).json({ error: 'Method not allowed' });
    }
}