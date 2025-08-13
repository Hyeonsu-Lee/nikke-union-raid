// pages/api/member-schedules.js
import { supabase } from '../../lib/supabase'

export default async function handler(req, res) {
    const { method } = req;
    
    switch (method) {
        case 'GET': {
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
        }
            
        case 'POST':
        case 'PUT': {
            const { memberId, seasonId: season_id, timeSlots, unionId } = req.body;
            
            if (!unionId) {
                return res.status(400).json({ error: 'Union ID is required' });
            }
            
            try {
                // season이 해당 union에 속하는지 검증
                const { data: season } = await supabase
                    .from('seasons')
                    .select('union_id')
                    .eq('id', season_id)
                    .single();
                
                if (!season || season.union_id !== unionId) {
                    return res.status(403).json({ error: 'Unauthorized access' });
                }
                
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
        }
            
        case 'DELETE': {
            const { id } = req.query;
            const { unionId } = req.body;
            
            if (!unionId) {
                return res.status(400).json({ error: 'Union ID is required' });
            }
            
            try {
                // 삭제할 스케줄이 해당 union에 속하는지 검증
                const { data: schedule } = await supabase
                    .from('member_schedules')
                    .select('season_id')
                    .eq('id', id)
                    .single();
                
                if (schedule) {
                    const { data: season } = await supabase
                        .from('seasons')
                        .select('union_id')
                        .eq('id', schedule.season_id)
                        .single();
                    
                    if (!season || season.union_id !== unionId) {
                        return res.status(403).json({ error: 'Unauthorized access' });
                    }
                }else{
                    return res.status(404).json({ error: 'Schedule not found' });
                }
                
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
        }
            
        default:
            res.status(405).json({ error: 'Method not allowed' });
    }
}