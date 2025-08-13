// pages/api/raid-battles.js
import { supabase } from '../../lib/supabase'

export default async function handler(req, res) {
    const { method } = req;
    
    switch (method) {
        case 'POST': {
            const { seasonId, memberName, level, bossId, deckComposition, damage, unionId } = req.body;
            
            if (!unionId) {
                return res.status(400).json({ error: 'Union ID is required' });
            }
            
            try {
                // season이 해당 union에 속하는지 검증
                const { data: season } = await supabase
                    .from('seasons')
                    .select('union_id')
                    .eq('id', seasonId)
                    .single();
                
                if (!season || season.union_id !== unionId) {
                    return res.status(403).json({ error: 'Unauthorized access' });
                }
                
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
        }
            
        case 'DELETE': {
            const { unionId } = req.body;
            
            if (!unionId) {
                return res.status(400).json({ error: 'Union ID is required' });
            }
            
            try {
                // 삭제할 전투가 해당 union에 속하는지 검증
                const { data: battle } = await supabase
                    .from('raid_battles')
                    .select('season_id')
                    .eq('id', req.query.id)
                    .single();
                
                if (battle) {
                    const { data: season } = await supabase
                        .from('seasons')
                        .select('union_id')
                        .eq('id', battle.season_id)
                        .single();
                    
                    if (!season || season.union_id !== unionId) {
                        return res.status(403).json({ error: 'Unauthorized access' });
                    }
                }else{
                    return res.status(404).json({ error: 'Raid battle not found' });
                }
                
                const koreaTime = new Date(new Date().getTime() + (9 * 60 * 60 * 1000));
                // Soft Delete - deleted_at 업데이트
                const { error } = await supabase
                    .from('raid_battles')
                    .update({ 
                        deleted_at: koreaTime.toISOString(),
                        updated_at: koreaTime.toISOString()
                    })
                    .eq('id', req.query.id);
                
                if (error) throw error;
                
                res.status(200).json({ success: true });
            } catch (error) {
                console.error('Raid battle delete error:', error);
                res.status(500).json({ error: error.message });
            }
            break;
        }
            
        default:
            res.status(405).json({ error: 'Method not allowed' });
    }
}