// pages/api/mock-battles.js
import { supabase } from '../../lib/supabase'

export default async function handler(req, res) {
    const { method } = req;
    
    switch (method) {
        case 'POST': {
            const { seasonId, memberName, bossId, deckComposition, damage, unionId } = req.body;
            
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
                
                const { error } = await supabase
                    .from('mock_battles')
                    .insert([{
                        season_id: seasonId,
                        member_name: memberName,
                        boss_id: bossId,
                        deck_composition: deckComposition,
                        damage,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }]);
                
                if (error) throw error;
                
                res.status(200).json({ success: true });
            } catch (error) {
                console.error('Mock battle insert error:', error);
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
                    .from('mock_battles')
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
                    return res.status(404).json({ error: 'Mock battle not found' });
                }
                
                // Soft Delete - deleted_at 업데이트
                const { error } = await supabase
                    .from('mock_battles')
                    .update({ 
                        deleted_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', req.query.id);
                
                if (error) throw error;
                
                res.status(200).json({ success: true });
            } catch (error) {
                console.error('Mock battle delete error:', error);
                res.status(500).json({ error: error.message });
            }
            break;
        }
            
        default:
            res.status(405).json({ error: 'Method not allowed' });
    }
}