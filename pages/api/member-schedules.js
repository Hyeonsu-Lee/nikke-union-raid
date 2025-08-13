// pages/api/member-schedules.js
import { supabase } from '../../lib/supabase'

export default async function handler(req, res) {
    const { method } = req;
    
    switch (method) {
        case 'GET':
            const { seasonId } = req.query;
            
            try {
                const { data, error } = await supabase
                    .from('member_schedules')
                    .select('*')
                    .eq('season_id', seasonId)
                    .is('deleted_at', null);
                
                if (error) throw error;
                
                res.status(200).json(data || []);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
            break;
            
        case 'POST':
        case 'PUT':
            const { memberId, seasonId: season_id, timeSlots } = req.body;
            
            try {
                // upsert: 있으면 UPDATE, 없으면 INSERT
                const { error } = await supabase
                    .from('member_schedules')
                    .upsert({
                        member_id: memberId,
                        season_id: season_id,
                        time_slots: timeSlots,
                        updated_at: new Date().toISOString()
                    }, {
                        onConflict: 'member_id,season_id'
                    });
                
                if (error) throw error;
                
                res.status(200).json({ success: true });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
            break;
            
        case 'DELETE':
            const { id } = req.query;
            
            try {
                // Soft Delete
                const { error } = await supabase
                    .from('member_schedules')
                    .update({ 
                        deleted_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
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