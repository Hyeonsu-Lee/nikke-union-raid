// pages/api/members.js
import { supabase } from '../../lib/supabase'

export default async function handler(req, res) {
    const { method } = req;
    
    switch (method) {
        case 'POST': {
            const { seasonId, name, unionId } = req.body;
            
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
                    .from('members')
                    .insert([{ season_id: seasonId, name }]);
                
                if (error) throw error;
                
                const { data: updated } = await supabase
                    .from('members')
                    .select('*')
                    .eq('season_id', seasonId)
                    .is('deleted_at', null);  // 삭제되지 않은 것만
                
                res.status(200).json({ success: true });
            } catch (error) {
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
                // 삭제할 멤버가 해당 union에 속하는지 검증
                const { data: member } = await supabase
                    .from('members')
                    .select('season_id')
                    .eq('id', req.query.id)
                    .single();
                
                if (member) {
                    const { data: season } = await supabase
                        .from('seasons')
                        .select('union_id')
                        .eq('id', member.season_id)
                        .single();
                    
                    if (!season || season.union_id !== unionId) {
                        return res.status(403).json({ error: 'Unauthorized access' });
                    }
                }else{
                    return res.status(404).json({ error: 'Member not found' });
                }
                
                // Soft Delete로 변경 - deleted_at 필드 업데이트
                const { error } = await supabase
                    .from('members')
                    .update({ 
                        deleted_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()  // updated_at도 갱신
                    })
                    .eq('id', req.query.id);
                
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