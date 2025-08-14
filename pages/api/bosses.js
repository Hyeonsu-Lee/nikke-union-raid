// pages/api/bosses.js
import { supabase } from '../../lib/supabase'

export default async function handler(req, res) {
    const { method } = req;
    
    switch (method) {
        case 'POST':
            const { seasonId, bosses: bossData } = req.body;
            
            try {
                const bossesWithSeasonId = bossData.map(boss => ({
                    ...boss,
                    season_id: seasonId,
                    order: boss.order
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
                
                res.status(200).json(updated || []);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
            break;
            
        case 'PUT':
            const { id, hp, mechanic } = req.body;
            
            try {
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
            
        default:
            res.status(405).json({ error: 'Method not allowed' });
    }
}