// pages/api/raid-battles.js
import { supabase } from '../../lib/supabase'

export default async function handler(req, res) {
    const { method } = req;
    
    switch (method) {
        case 'POST':
            const { seasonId, memberName, level, bossId, deckComposition, damage } = req.body;
            
            try {
                const koreaTime = new Date(new Date().getTime() + (9 * 60 * 60 * 1000));
                const { error } = await supabase
                    .from('raid_battles')
                    .insert([{
                        season_id: seasonId,
                        member_name: memberName,
                        level,
                        boss_id: bossId,
                        deck_composition: deckComposition,
                        damage,
                        timestamp: koreaTime.toISOString(),  // raid_battles 전용 필드
                        created_at: koreaTime.toISOString(),
                        updated_at: koreaTime.toISOString()
                    }]);
                
                if (error) throw error;
                
                res.status(200).json({ success: true });
            } catch (error) {
                console.error('Raid battle insert error:', error);
                res.status(500).json({ error: error.message });
            }
            break;
            
        case 'DELETE':
            try {
                const koreaTime = new Date(new Date().getTime() + (9 * 60 * 60 * 1000));
                // Soft Delete - deleted_at 업데이트
                // ★ 변경: Hard Delete - 실제로 레코드 삭제
                const { error } = await supabase
                    .from('raid_battles')
                    .delete()
                    .eq('id', req.query.id);
                
                if (error) throw error;
                
                res.status(200).json({ success: true });
            } catch (error) {
                console.error('Raid battle delete error:', error);
                res.status(500).json({ error: error.message });
            }
            break;
            
        default:
            res.status(405).json({ error: 'Method not allowed' });
    }
}