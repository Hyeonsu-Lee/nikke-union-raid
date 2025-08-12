// pages/api/raid-battles.js
import { supabase } from '../../lib/supabase'

export default async function handler(req, res) {
    const { method } = req;
    
    switch (method) {
        case 'POST':
            const { seasonId, memberName, level, bossId, deckComposition, damage } = req.body;
            
            try {
                const { error } = await supabase
                    .from('raid_battles')
                    .insert([{
                        season_id: seasonId,
                        member_name: memberName,
                        level,
                        boss_id: bossId,
                        deck_composition: deckComposition,
                        damage
                    }]);
                
                if (error) throw error;
                
                res.status(200).json({ success: true });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
            break;
            
        case 'DELETE':
            try {
                // Soft Delete - deleted_at 업데이트
                const { error } = await supabase
                    .from('raid_battles')
                    .update({ 
                        deleted_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', req.query.id);
                
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