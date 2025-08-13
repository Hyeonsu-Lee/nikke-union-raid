// pages/api/auth.js
import { supabase } from '../../lib/supabase'

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { unionName, password } = req.body;
    
    try {
        // 유니온 조회
        const { data: union, error } = await supabase
            .from('unions')
            .select('*')
            .eq('name', unionName)
            .eq('is_active', true)
            .single();
        
        if (error || !union) {
            return res.status(401).json({ error: '유니온을 찾을 수 없습니다.' });
        }
        
        // 비밀번호 확인
        let isAdmin = false;
        let isValid = false;
        
        if (password === union.admin_password) {
            isAdmin = true;
            isValid = true;
        } else if (password === union.user_password) {
            isAdmin = false;
            isValid = true;
        }
        
        if (!isValid) {
            return res.status(401).json({ error: '비밀번호가 올바르지 않습니다.' });
        }
        
        // 성공
        res.status(200).json({
            success: true,
            unionId: union.id,
            unionName: union.name,
            isAdmin
        });
        
    } catch (error) {
        console.error('Auth error:', error);
        res.status(500).json({ error: '인증 처리 중 오류가 발생했습니다.' });
    }
}