// pages/api/data.js
import { supabase } from '../../lib/supabase'

export default async function handler(req, res) {
    const { lastSync } = req.query;
    
    if (!lastSync) {
        // 첫 로드 - 전체 데이터
        const [/* 기존 코드 */] = await Promise.all([...]);
        return res.status(200).json({ /* 전체 데이터 */ });
    }
    
    // 변경분만 조회
    const [
        { data: newMembers },
        { data: deletedMembers },
        { data: newRaidBattles },
        // ...
    ] = await Promise.all([
        supabase.from('members').select('*').gt('created_at', lastSync),
        supabase.from('members').select('id').gt('deleted_at', lastSync).eq('is_deleted', true),
        supabase.from('raid_battles').select('*').gt('created_at', lastSync),
        // ...
    ]);
    
    res.status(200).json({
        changes: {
            members: { added: newMembers, deleted: deletedMembers },
            raidBattles: { added: newRaidBattles },
            // ...
        },
        timestamp: new Date().toISOString()
    });
}