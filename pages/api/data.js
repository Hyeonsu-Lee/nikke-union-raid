// pages/api/data.js
import { supabase } from '../../lib/supabase'

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { lastSync, unionId, seasonId } = req.query;
    
    try {
        // 시즌 목록 조회 (unionId 필요)
        if (!seasonId) {
            if (!unionId) {
                return res.status(400).json({ error: 'Union ID is required for seasons' });
            }
            
            // 시즌 목록만 반환
            const { data: seasons, error } = await supabase
                .from('seasons')
                .select('*')
                .eq('union_id', unionId)
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            
            return res.status(200).json({
                seasons: seasons || [],
                timestamp: new Date().toISOString()
            });
        }
        
        // 특정 시즌의 데이터 조회 (seasonId만 사용)
        if (!lastSync) {
            // 첫 로드 - 전체 데이터
            const [
                { data: bosses, error: bossesError },
                { data: members, error: membersError },
                { data: memberSchedules, error: schedulesError },
                { data: mockBattles, error: mockError },
                { data: raidBattles, error: raidError }
            ] = await Promise.all([
                // seasonId로만 조회 (JOIN 없음!)
                supabase.from('bosses')
                    .select('*')
                    .eq('season_id', seasonId)
                    .order('id', { ascending: true }),
                
                supabase.from('members')
                    .select('*')
                    .eq('season_id', seasonId)
                    .order('id', { ascending: true }),
                
                supabase.from('member_schedules')
                    .select('*')
                    .eq('season_id', seasonId)
                    .order('id', { ascending: true }),
                
                supabase.from('mock_battles')
                    .select('*')
                    .eq('season_id', seasonId)
                    .order('id', { ascending: false }),
                
                supabase.from('raid_battles')
                    .select('*')
                    .eq('season_id', seasonId)
                    .order('timestamp', { ascending: false })
            ]);
            
            if (bossesError || membersError || schedulesError || mockError || raidError) {
                console.error('Database query errors:', {
                    bossesError, membersError, schedulesError, mockError, raidError
                });
                throw new Error('Database query failed');
            }
            
            return res.status(200).json({
                bosses: bosses || [],
                members: members || [],
                memberSchedules: memberSchedules || [],
                mockBattles: mockBattles || [],
                raidBattles: raidBattles || [],
                timestamp: new Date().toISOString()
            });
            
        } else {
            // 변경분만 조회
            const [
                { data: updatedBosses },
                { data: updatedMembers },
                { data: updatedSchedules },
                { data: updatedMockBattles },
                { data: updatedRaidBattles }
            ] = await Promise.all([
                // updated 조회 (seasonId로만)
                supabase.from('bosses')
                    .select('*')
                    .eq('season_id', seasonId)
                    .gt('updated_at', lastSync)
                    .order('id', { ascending: true }),
                
                supabase.from('members')
                    .select('*')
                    .eq('season_id', seasonId)
                    .gt('updated_at', lastSync)
                    .order('id', { ascending: true }),
                
                supabase.from('member_schedules')
                    .select('*')
                    .eq('season_id', seasonId)
                    .gt('updated_at', lastSync)
                    .order('id', { ascending: true }),
                
                supabase.from('mock_battles')
                    .select('*')
                    .eq('season_id', seasonId)
                    .gt('updated_at', lastSync)
                    .order('id', { ascending: false }),
                
                supabase.from('raid_battles')
                    .select('*')
                    .eq('season_id', seasonId)
                    .gt('updated_at', lastSync)
                    .order('id', { ascending: false }),
            ]);
            
            return res.status(200).json({
                changes: {
                    bosses: { updated: updatedBosses || [] },
                    members: { 
                        updated: updatedMembers || [], 
                        deleted: []
                    },
                    memberSchedules: {
                        updated: updatedSchedules || [],
                        deleted: []
                    },
                    mockBattles: { 
                        updated: updatedMockBattles || [], 
                        deleted: []
                    },
                    raidBattles: { 
                        updated: updatedRaidBattles || [], 
                        deleted: []
                    }
                },
                timestamp: new Date().toISOString()
            });
        }
    } catch (error) {
        console.error('Database error:', error);
        res.status(500).json({ error: 'Database error: ' + error.message });
    }
}