// pages/api/seasons.js
import { supabase } from '../../lib/supabase'

export default async function handler(req, res) {
    const { method } = req;
    
    switch (method) {
        case 'POST':
            const { name, date, copyFromSeason } = req.body;
            
            try {
                // 새 시즌 생성
                const { data: newSeason, error: seasonError } = await supabase
                    .from('seasons')
                    .insert([{ name, date, is_active: false }])
                    .select()
                    .single();
                
                if (seasonError) throw seasonError;
                
                // 이전 시즌에서 멤버 복사
                if (copyFromSeason) {
                    const { data: sourceMembers } = await supabase
                        .from('members')
                        .select('name')
                        .eq('season_id', copyFromSeason);
                    
                    if (sourceMembers && sourceMembers.length > 0) {
                        const newMembers = sourceMembers.map(member => ({
                            season_id: newSeason.id,
                            name: member.name
                        }));
                        
                        await supabase.from('members').insert(newMembers);
                    }
                }
                
                res.status(200).json({ success: true, id: newSeason.id });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
            break;
            
        case 'PUT':
            const { id, isActive } = req.body;
            
            try {
                if (isActive) {
                    // 모든 시즌 비활성화
                    await supabase
                        .from('seasons')
                        .update({ is_active: false })
                        .neq('id', 0); // 모든 행 업데이트
                }
                
                // 선택한 시즌 활성화
                const { error } = await supabase
                    .from('seasons')
                    .update({ is_active: isActive })
                    .eq('id', id);
                
                if (error) throw error;
                
                res.status(200).json({ success: true });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
            break;
            
        case 'DELETE':
            try {
                const { error } = await supabase
                    .from('seasons')
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