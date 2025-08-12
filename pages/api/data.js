// pages/api/data.js
import { supabase } from '../../lib/supabase'

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        const [
            { data: seasons, error: seasonsError },
            { data: bosses, error: bossesError },
            { data: members, error: membersError },
            { data: mockBattles, error: mockError },
            { data: raidBattles, error: raidError }
        ] = await Promise.all([
            supabase.from('seasons').select('*').order('created_at', { ascending: false }),
            supabase.from('bosses').select('*'),
            supabase.from('members').select('*'),
            supabase.from('mock_battles').select('*'),
            supabase.from('raid_battles').select('*').order('timestamp', { ascending: false })
        ]);
        
        if (seasonsError || bossesError || membersError || mockError || raidError) {
            throw new Error('Database query failed');
        }
        
        res.status(200).json({
            seasons: seasons || [],
            bosses: bosses || [],
            members: members || [],
            mockBattles: mockBattles || [],
            raidBattles: raidBattles || []
        });
    } catch (error) {
        console.error('Database error:', error);
        res.status(500).json({ error: 'Database error' });
    }
}