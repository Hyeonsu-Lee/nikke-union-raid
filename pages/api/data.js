// pages/api/data.js
import { supabase } from '../../lib/supabase'

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { lastSync, unionId } = req.query;
    
    // unionId 필수 체크
    if (!unionId) {
        return res.status(400).json({ error: 'Union ID is required' });
    }
    
    try {
        if (!lastSync) {
            // 첫 로드 - 전체 데이터
            const [
                { data: seasons, error: seasonsError },
                { data: bosses, error: bossesError },
                { data: members, error: membersError },
                { data: memberSchedules, error: schedulesError },
                { data: mockBattles, error: mockError },
                { data: raidBattles, error: raidError }
            ] = await Promise.all([
                // seasons에 union_id 조건 추가
                supabase.from('seasons')
                    .select('*')
                    .eq('union_id', unionId)
                    .order('created_at', { ascending: false }),
                
                // bosses는 season_id를 통해 간접 필터링
                supabase.from('bosses')
                    .select(`
                        *,
                        seasons!inner(union_id)
                    `)
                    .eq('seasons.union_id', unionId),
                
                // members도 season_id를 통해 간접 필터링
                supabase.from('members')
                    .select(`
                        *,
                        seasons!inner(union_id)
                    `)
                    .eq('seasons.union_id', unionId)
                    .is('deleted_at', null),
                
                // member_schedules도 season_id를 통해 간접 필터링
                supabase.from('member_schedules')
                    .select(`
                        *,
                        seasons!inner(union_id)
                    `)
                    .eq('seasons.union_id', unionId)
                    .is('deleted_at', null),
                
                // mock_battles도 season_id를 통해 간접 필터링
                supabase.from('mock_battles')
                    .select(`
                        *,
                        seasons!inner(union_id)
                    `)
                    .eq('seasons.union_id', unionId)
                    .is('deleted_at', null),
                
                // raid_battles도 season_id를 통해 간접 필터링
                supabase.from('raid_battles')
                    .select(`
                        *,
                        seasons!inner(union_id)
                    `)
                    .eq('seasons.union_id', unionId)
                    .is('deleted_at', null)
                    .order('timestamp', { ascending: false })
            ]);
            
            if (seasonsError || bossesError || membersError || schedulesError || mockError || raidError) {
                console.error('Database query errors:', {
                    seasonsError, bossesError, membersError, 
                    schedulesError, mockError, raidError
                });
                throw new Error('Database query failed');
            }
            
            // seasons 필드 제거 (join으로 인해 추가된 필드)
            const cleanData = (data, fieldsToRemove = ['seasons']) => {
                if (!data) return [];
                return data.map(item => {
                    const cleaned = { ...item };
                    fieldsToRemove.forEach(field => delete cleaned[field]);
                    return cleaned;
                });
            };
            
            return res.status(200).json({
                seasons: seasons || [],
                bosses: cleanData(bosses),
                members: cleanData(members),
                memberSchedules: cleanData(memberSchedules),
                mockBattles: cleanData(mockBattles),
                raidBattles: cleanData(raidBattles),
                timestamp: new Date().toISOString()
            });
        } else {
            // 변경분만 조회
            const [
                { data: updatedSeasons },
                { data: updatedBosses },
                { data: updatedMembers },
                { data: updatedSchedules },
                { data: updatedMockBattles },
                { data: updatedRaidBattles },
                { data: deletedMembers },
                { data: deletedSchedules },
                { data: deletedMockBattles },
                { data: deletedRaidBattles }
            ] = await Promise.all([
                // updated 조회
                supabase.from('seasons')
                    .select('*')
                    .eq('union_id', unionId)
                    .gt('updated_at', lastSync),
                
                supabase.from('bosses')
                    .select(`
                        *,
                        seasons!inner(union_id)
                    `)
                    .eq('seasons.union_id', unionId)
                    .gt('updated_at', lastSync),
                
                supabase.from('members')
                    .select(`
                        *,
                        seasons!inner(union_id)
                    `)
                    .eq('seasons.union_id', unionId)
                    .gt('updated_at', lastSync)
                    .is('deleted_at', null),
                
                supabase.from('member_schedules')
                    .select(`
                        *,
                        seasons!inner(union_id)
                    `)
                    .eq('seasons.union_id', unionId)
                    .gt('updated_at', lastSync)
                    .is('deleted_at', null),
                
                supabase.from('mock_battles')
                    .select(`
                        *,
                        seasons!inner(union_id)
                    `)
                    .eq('seasons.union_id', unionId)
                    .gt('updated_at', lastSync)
                    .is('deleted_at', null),
                
                supabase.from('raid_battles')
                    .select(`
                        *,
                        seasons!inner(union_id)
                    `)
                    .eq('seasons.union_id', unionId)
                    .gt('updated_at', lastSync)
                    .is('deleted_at', null),
                
                // deleted 조회
                supabase.from('members')
                    .select(`
                        id,
                        seasons!inner(union_id)
                    `)
                    .eq('seasons.union_id', unionId)
                    .not('deleted_at', 'is', null)
                    .gt('deleted_at', lastSync),
                
                supabase.from('member_schedules')
                    .select(`
                        id,
                        seasons!inner(union_id)
                    `)
                    .eq('seasons.union_id', unionId)
                    .not('deleted_at', 'is', null)
                    .gt('deleted_at', lastSync),
                
                supabase.from('mock_battles')
                    .select(`
                        id,
                        seasons!inner(union_id)
                    `)
                    .eq('seasons.union_id', unionId)
                    .not('deleted_at', 'is', null)
                    .gt('deleted_at', lastSync),
                
                supabase.from('raid_battles')
                    .select(`
                        id,
                        seasons!inner(union_id)
                    `)
                    .eq('seasons.union_id', unionId)
                    .not('deleted_at', 'is', null)
                    .gt('deleted_at', lastSync)
            ]);
            
            // seasons 필드 제거
            const cleanData = (data, fieldsToRemove = ['seasons']) => {
                if (!data) return [];
                return data.map(item => {
                    const cleaned = { ...item };
                    fieldsToRemove.forEach(field => delete cleaned[field]);
                    return cleaned;
                });
            };
            
            return res.status(200).json({
                changes: {
                    seasons: { updated: updatedSeasons || [] },
                    bosses: { updated: cleanData(updatedBosses) },
                    members: { 
                        updated: cleanData(updatedMembers), 
                        deleted: deletedMembers ? deletedMembers.map(d => d.id) : []
                    },
                    memberSchedules: {
                        updated: cleanData(updatedSchedules),
                        deleted: deletedSchedules ? deletedSchedules.map(d => d.id) : []
                    },
                    mockBattles: { 
                        updated: cleanData(updatedMockBattles), 
                        deleted: deletedMockBattles ? deletedMockBattles.map(d => d.id) : []
                    },
                    raidBattles: { 
                        updated: cleanData(updatedRaidBattles), 
                        deleted: deletedRaidBattles ? deletedRaidBattles.map(d => d.id) : []
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