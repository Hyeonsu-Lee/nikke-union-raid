// pages/api/data.js
import { supabase } from '../../lib/supabase'

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { lastSync } = req.query;
    
    try {
        if (!lastSync) {
            // 첫 로드 - 전체 데이터
            const [
                { data: seasons, error: seasonsError },
                { data: bosses, error: bossesError },
                { data: members, error: membersError },
                { data: memberSchedules, error: schedulesError }, // 추가
                { data: mockBattles, error: mockError },
                { data: raidBattles, error: raidError }
            ] = await Promise.all([
                supabase.from('seasons').select('*').order('created_at', { ascending: false }),
                supabase.from('bosses').select('*'),
                supabase.from('members').select('*').is('deleted_at', null),
                supabase.from('member_schedules').select('*').is('deleted_at', null), // 추가
                supabase.from('mock_battles').select('*').is('deleted_at', null),
                supabase.from('raid_battles').select('*').is('deleted_at', null).order('timestamp', { ascending: false })
            ]);
            
            if (seasonsError || bossesError || membersError || schedulesError || mockError || raidError) {
                throw new Error('Database query failed');
            }
            
            return res.status(200).json({
                seasons: seasons || [],
                bosses: bosses || [],
                members: members || [],
                memberSchedules: memberSchedules || [], // 추가
                mockBattles: mockBattles || [],
                raidBattles: raidBattles || [],
                timestamp: new Date().toISOString()
            });
        } else {
            // 변경분만 조회
            const [
                { data: updatedSeasons },
                { data: updatedBosses },
                { data: updatedMembers },
                { data: updatedSchedules }, // 추가
                { data: updatedMockBattles },
                { data: updatedRaidBattles },
                { data: deletedMembers },
                { data: deletedSchedules }, // 추가
                { data: deletedMockBattles },
                { data: deletedRaidBattles }
            ] = await Promise.all([
                supabase.from('seasons').select('*').gt('updated_at', lastSync),
                supabase.from('bosses').select('*').gt('updated_at', lastSync),
                supabase.from('members').select('*').gt('updated_at', lastSync).is('deleted_at', null),
                supabase.from('member_schedules').select('*').gt('updated_at', lastSync).is('deleted_at', null), // 추가
                supabase.from('mock_battles').select('*').gt('updated_at', lastSync).is('deleted_at', null),
                supabase.from('raid_battles').select('*').gt('updated_at', lastSync).is('deleted_at', null),
                supabase.from('members').select('id').not('deleted_at', 'is', null).gt('deleted_at', lastSync),
                supabase.from('member_schedules').select('id').not('deleted_at', 'is', null).gt('deleted_at', lastSync), // 추가
                supabase.from('mock_battles').select('id').not('deleted_at', 'is', null).gt('deleted_at', lastSync),
                supabase.from('raid_battles').select('id').not('deleted_at', 'is', null).gt('deleted_at', lastSync)
            ]);
            
            return res.status(200).json({
                changes: {
                    seasons: { updated: updatedSeasons || [] },
                    bosses: { updated: updatedBosses || [] },
                    members: { 
                        updated: updatedMembers || [], 
                        deleted: deletedMembers ? deletedMembers.map(d => d.id) : []
                    },
                    memberSchedules: { // 추가
                        updated: updatedSchedules || [],
                        deleted: deletedSchedules ? deletedSchedules.map(d => d.id) : []
                    },
                    mockBattles: { 
                        updated: updatedMockBattles || [], 
                        deleted: deletedMockBattles ? deletedMockBattles.map(d => d.id) : []
                    },
                    raidBattles: { 
                        updated: updatedRaidBattles || [], 
                        deleted: deletedRaidBattles ? deletedRaidBattles.map(d => d.id) : []
                    }
                },
                timestamp: new Date().toISOString()
            });
        }
    } catch (error) {
        console.error('Database error:', error);
        res.status(500).json({ error: 'Database error' });
    }
}