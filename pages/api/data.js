// pages/api/data.js
import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        const [seasons, bosses, members, mockBattles, raidBattles] = await Promise.all([
            sql`SELECT * FROM seasons ORDER BY created_at DESC`,
            sql`SELECT * FROM bosses`,
            sql`SELECT * FROM members`,
            sql`SELECT * FROM mock_battles`,
            sql`SELECT * FROM raid_battles ORDER BY timestamp DESC`
        ]);
        
        res.status(200).json({
            seasons: seasons.rows,
            bosses: bosses.rows,
            members: members.rows,
            mockBattles: mockBattles.rows,
            raidBattles: raidBattles.rows
        });
    } catch (error) {
        console.error('Database error:', error);
        res.status(500).json({ error: 'Database error' });
    }
}