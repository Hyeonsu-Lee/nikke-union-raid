// pages/api/mock-battles.js
import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
    const { method } = req;
    
    switch (method) {
        case 'POST':
            const { seasonId, memberName, bossId, deckComposition, damage } = req.body;
            
            try {
                await sql`
                    INSERT INTO mock_battles (season_id, member_name, boss_id, deck_composition, damage)
                    VALUES (${seasonId}, ${memberName}, ${bossId}, ${deckComposition}, ${damage})
                `;
                
                res.status(200).json({ success: true });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
            break;
            
        case 'DELETE':
            try {
                await sql`DELETE FROM mock_battles WHERE id = ${req.query.id}`;
                res.status(200).json({ success: true });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
            break;
            
        default:
            res.status(405).json({ error: 'Method not allowed' });
    }
}