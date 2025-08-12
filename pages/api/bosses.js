// pages/api/bosses.js
import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
    const { method } = req;
    
    switch (method) {
        case 'POST':
            const { seasonId, bosses: bossData } = req.body;
            
            try {
                // 기존 보스 삭제
                await sql`DELETE FROM bosses WHERE season_id = ${seasonId}`;
                
                // 새 보스 데이터 삽입
                for (const boss of bossData) {
                    await sql`
                        INSERT INTO bosses (season_id, name, attribute, level, hp, mechanic)
                        VALUES (${seasonId}, ${boss.name}, ${boss.attribute}, 
                                ${boss.level}, ${boss.hp}, ${boss.mechanic})
                    `;
                }
                
                const updated = await sql`
                    SELECT * FROM bosses WHERE season_id = ${seasonId}
                `;
                
                res.status(200).json(updated.rows);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
            break;
            
        case 'PUT':
            const { id, hp, mechanic } = req.body;
            
            try {
                await sql`
                    UPDATE bosses 
                    SET hp = ${hp}, mechanic = ${mechanic}
                    WHERE id = ${id}
                `;
                
                res.status(200).json({ success: true });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
            break;
            
        default:
            res.status(405).json({ error: 'Method not allowed' });
    }
}