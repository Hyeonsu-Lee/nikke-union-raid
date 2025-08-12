// pages/api/members.js
import { supabase } from '../../lib/supabase'

export default async function handler(req, res) {
    const { method } = req;
    
    switch (method) {
        case 'POST':
            const { seasonId, name } = req.body;
            
            try {
                const { error } = await supabase
                    .from('members')
                    .insert([{ season_id: seasonId, name }]);
                
                if (error) throw error;
                
                const { data: updated } = await supabase
                    .from('members')
                    .select('*')
                    .eq('season_id', seasonId)
                    .is('deleted_at', null);  // 삭제되지 않은 것만
                
                res.status(200).json(updated || []);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
            break;
            
        case 'DELETE':
            try {
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
            
        default:
            res.status(405).json({ error: 'Method not allowed' });
    }
}