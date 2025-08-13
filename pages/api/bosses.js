// pages/api/bosses.js
import { supabase } from '../../lib/supabase'

export default async function handler(req, res) {
    const { method } = req;
    
    switch (method) {
        case 'POST': {
            const { seasonId, bosses: bossData, unionId } = req.body;
            
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
                
                const bossesWithSeasonId = bossData.map(boss => ({
                    ...boss,
                    season_id: seasonId
                }));
                
                // upsert: 있으면 UPDATE, 없으면 INSERT
                const { error } = await supabase
                    .from('bosses')
                    .upsert(bossesWithSeasonId, {
                        onConflict: 'season_id,attribute,level'
                    });
                
                if (error) throw error;
                
                const { data: updated } = await supabase
                    .from('bosses')
                    .select('*')
                    .eq('season_id', seasonId);
                
                res.status(200).json({ success: true });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
            break;
        }
            
        case 'PUT': {
            const { id, hp, mechanic, unionId } = req.body;
            
            if (!unionId) {
                return res.status(400).json({ error: 'Union ID is required' });
            }
            
            try {
                // 수정할 보스가 해당 union의 보스인지 검증
                const { data: boss } = await supabase
                    .from('bosses')
                    .select('season_id')
                    .eq('id', id)
                    .single();
                
                if (boss) {
                    const { data: season } = await supabase
                        .from('seasons')
                        .select('union_id')
                        .eq('id', boss.season_id)
                        .single();
                    
                    if (!season || season.union_id !== unionId) {
                        return res.status(403).json({ error: 'Unauthorized access' });
                    }
                }
                
                const { error } = await supabase
                    .from('bosses')
                    .update({ hp, mechanic })
                    .eq('id', id);
                
                if (error) throw error;
                
                res.status(200).json({ success: true });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
            break;
        }
            
        default:
            res.status(405).json({ error: 'Method not allowed' });
    }
}