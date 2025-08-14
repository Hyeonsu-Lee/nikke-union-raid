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
                
                res.status(200).json(updated || []);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
            break;
            
        case 'DELETE':
            try {
                // ★ 변경: Hard Delete - 실제로 레코드 삭제
                const { error } = await supabase
                    .from('members')
                    .delete()
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