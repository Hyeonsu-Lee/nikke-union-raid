// pages/api/seasons.js
import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
    const { method } = req;
    
    switch (method) {
        case 'POST':
            const { name, date, copyFromSeason } = req.body;
            
            try {
                // 새 시즌 생성
                const result = await sql`
                    INSERT INTO seasons (name, date, is_active)
                    VALUES (${name}, ${date}, false)
                    RETURNING id
                `;
                
                const newSeasonId = result.rows[0].id;
                
                // 이전 시즌에서 멤버 복사
                if (copyFromSeason) {
                    const members = await sql`
                        SELECT name FROM members WHERE season_id = ${copyFromSeason}
                    `;
                    
                    for (const member of members.rows) {
                        await sql`
                            INSERT INTO members (season_id, name)
                            VALUES (${newSeasonId}, ${member.name})
                        `;
                    }
                }
                
                res.status(200).json({ success: true, id: newSeasonId });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
            break;
            
        case 'PUT':
            const { id, isActive } = req.body;
            
            try {
                if (isActive) {
                    // 모든 시즌 비활성화
                    await sql`UPDATE seasons SET is_active = false`;
                }
                
                // 선택한 시즌 활성화
                await sql`
                    UPDATE seasons SET is_active = ${isActive}
                    WHERE id = ${id}
                `;
                
                res.status(200).json({ success: true });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
            break;
            
        case 'DELETE':
            try {
                await sql`DELETE FROM seasons WHERE id = ${req.query.id}`;
                res.status(200).json({ success: true });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
            break;
            
        default:
            res.status(405).json({ error: 'Method not allowed' });
    }
}
