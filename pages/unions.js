// pages/api/unions.js
import { supabase } from '../../lib/supabase'

export default async function handler(req, res) {
    const { method } = req;
    
    // 슈퍼 관리자 인증 체크
    const { authorization } = req.headers;
    if (authorization) {
        const password = authorization.replace('Bearer ', '');
        const { data: admin } = await supabase
            .from('super_admin')
            .select('*')
            .eq('password', password)
            .single();
        
        if (!admin) {
            return res.status(401).json({ error: '인증 실패' });
        }
    } else if (method !== 'GET') {
        return res.status(401).json({ error: '인증 필요' });
    }
    
    switch (method) {
        case 'GET':
            try {
                const { data, error } = await supabase
                    .from('unions')
                    .select('*')
                    .order('created_at', { ascending: false });
                
                if (error) throw error;
                res.status(200).json(data || []);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
            break;
            
        case 'POST':
            const { name, userPassword, adminPassword } = req.body;
            
            try {
                const { data, error } = await supabase
                    .from('unions')
                    .insert([{
                        name,
                        user_password: userPassword,
                        admin_password: adminPassword
                    }])
                    .select()
                    .single();
                
                if (error) throw error;
                res.status(200).json(data);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
            break;
            
        case 'PUT':
            const { id, ...updateData } = req.body;
            
            try {
                const updateFields = {};
                if (updateData.name) updateFields.name = updateData.name;
                if (updateData.userPassword) updateFields.user_password = updateData.userPassword;
                if (updateData.adminPassword) updateFields.admin_password = updateData.adminPassword;
                if (updateData.isActive !== undefined) updateFields.is_active = updateData.isActive;
                
                const { error } = await supabase
                    .from('unions')
                    .update(updateFields)
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
                    .from('unions')
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