// pages/api/seasons.js
import { supabase } from '../../lib/supabase'

export default async function handler(req, res) {
    const { method } = req;
    
    switch (method) {
        case 'POST': {
            const { name, date, copyFromSeason, unionId } = req.body;
            console.log('Received:', { name, date, copyFromSeason, unionId });
            console.log('unionId type:', typeof unionId);
            if (!unionId) {
                return res.status(400).json({ error: 'Union ID is required' });
            }
            
            try {
                // 새 시즌 생성 (union_id 추가)
                const { data: newSeason, error: seasonError } = await supabase
                    .from('seasons')
                    .insert([{ 
                        union_id: unionId,
                        name, 
                        date, 
                        is_active: false 
                    }])
                    .select()
                    .single();

                if (seasonError){
                    console.error('Season insert error:', seasonError);
                    throw seasonError;
                }
                
                // 이전 시즌에서 멤버 복사
                if (copyFromSeason) {
                    // 복사할 시즌이 같은 union의 시즌인지 확인
                    const { data: sourceSeason } = await supabase
                        .from('seasons')
                        .select('union_id')
                        .eq('id', copyFromSeason)
                        .single();
                    
                    if (sourceSeason && sourceSeason.union_id === unionId) {
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
                }
                
                res.status(200).json({ success: true, id: newSeason.id });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
            break;
        }
            
        case 'PUT': {
            const { id, isActive, unionId } = req.body;
            
            if (!unionId) {
                return res.status(400).json({ error: 'Union ID is required' });
            }
            
            try {
                // 활성화할 시즌이 해당 union의 시즌인지 확인
                const { data: targetSeason } = await supabase
                    .from('seasons')
                    .select('union_id')
                    .eq('id', id)
                    .single();
                
                if (!targetSeason || targetSeason.union_id !== unionId) {
                    return res.status(403).json({ error: 'Unauthorized access' });
                }
                
                if (isActive) {
                    // 같은 union의 모든 시즌 비활성화
                    await supabase
                        .from('seasons')
                        .update({ is_active: false })
                        .eq('union_id', unionId);
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
        }
            
        case 'DELETE': {
            const { unionId } = req.body;
            
            if (!unionId) {
                return res.status(400).json({ error: 'Union ID is required' });
            }
            
            try {
                // 삭제할 시즌이 해당 union의 시즌인지 확인
                const { data: targetSeason } = await supabase
                    .from('seasons')
                    .select('union_id')
                    .eq('id', req.query.id)
                    .single();
                
                if (!targetSeason || targetSeason.union_id !== unionId) {
                    return res.status(403).json({ error: 'Unauthorized access' });
                }
                
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
        }
            
        default:
            res.status(405).json({ error: 'Method not allowed' });
    }
}