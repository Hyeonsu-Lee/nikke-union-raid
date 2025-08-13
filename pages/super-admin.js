// pages/super-admin.js
import React, { useState, useEffect } from 'react';

export default function SuperAdmin() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [unions, setUnions] = useState([]);
    const [newUnion, setNewUnion] = useState({ name: '', userPassword: '', adminPassword: '' });
    const [editingUnion, setEditingUnion] = useState(null);
    const [showPasswords, setShowPasswords] = useState({});
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    
    // 로그인 체크
    useEffect(() => {
        const savedAuth = localStorage.getItem('superAdminAuth');
        if (savedAuth) {
            setIsAuthenticated(true);
            setPassword(savedAuth);
            loadUnions(savedAuth);
        }
    }, []);
    
    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        
        try {
            // 슈퍼 관리자 인증 확인
            const res = await fetch('/api/unions', {
                headers: {
                    'Authorization': `Bearer ${password}`
                }
            });
            
            if (res.ok) {
                setIsAuthenticated(true);
                localStorage.setItem('superAdminAuth', password);
                loadUnions(password);
            } else {
                showMessage('비밀번호가 올바르지 않습니다.', 'error');
            }
        } catch (error) {
            showMessage('로그인 실패: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    };
    
    const loadUnions = async (authPassword) => {
        try {
            const res = await fetch('/api/unions', {
                headers: {
                    'Authorization': `Bearer ${authPassword || password}`
                }
            });
            const data = await res.json();
            setUnions(data);
        } catch (error) {
            showMessage('데이터 로드 실패: ' + error.message, 'error');
        }
    };
    
    const handleAddUnion = async (e) => {
        e.preventDefault();
        
        if (!newUnion.name || !newUnion.userPassword || !newUnion.adminPassword) {
            showMessage('모든 필드를 입력해주세요.', 'error');
            return;
        }
        
        try {
            const res = await fetch('/api/unions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${password}`
                },
                body: JSON.stringify(newUnion)
            });
            
            if (res.ok) {
                showMessage('유니온이 추가되었습니다.', 'success');
                setNewUnion({ name: '', userPassword: '', adminPassword: '' });
                loadUnions();
            } else {
                const error = await res.json();
                showMessage('추가 실패: ' + error.error, 'error');
            }
        } catch (error) {
            showMessage('추가 실패: ' + error.message, 'error');
        }
    };
    
    const handleUpdateUnion = async (union) => {
        try {
            const res = await fetch('/api/unions', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${password}`
                },
                body: JSON.stringify(union)
            });
            
            if (res.ok) {
                showMessage('수정되었습니다.', 'success');
                setEditingUnion(null);
                loadUnions();
            }
        } catch (error) {
            showMessage('수정 실패: ' + error.message, 'error');
        }
    };
    
    const handleDeleteUnion = async (id, name) => {
        if (!confirm(`정말 "${name}" 유니온을 삭제하시겠습니까?\n모든 관련 데이터가 삭제됩니다.`)) {
            return;
        }
        
        try {
            const res = await fetch(`/api/unions?id=${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${password}`
                }
            });
            
            if (res.ok) {
                showMessage('삭제되었습니다.', 'success');
                loadUnions();
            }
        } catch (error) {
            showMessage('삭제 실패: ' + error.message, 'error');
        }
    };
    
    const showMessage = (text, type = 'info') => {
        setMessage({ text, type });
        setTimeout(() => setMessage(''), 3000);
    };
    
    const togglePasswordVisibility = (unionId) => {
        setShowPasswords(prev => ({
            ...prev,
            [unionId]: !prev[unionId]
        }));
    };
    
    const handleLogout = () => {
        localStorage.removeItem('superAdminAuth');
        setIsAuthenticated(false);
        setPassword('');
        setUnions([]);
    };
    
    if (!isAuthenticated) {
        return (
            <div style={{
                minHeight: '100vh',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                <div style={{
                    background: 'white',
                    padding: '40px',
                    borderRadius: '15px',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
                    width: '100%',
                    maxWidth: '400px'
                }}>
                    <h2 style={{textAlign: 'center', marginBottom: '30px'}}>슈퍼 관리자 로그인</h2>
                    <form onSubmit={handleLogin}>
                        <div style={{marginBottom: '20px'}}>
                            <label style={{display: 'block', marginBottom: '5px'}}>비밀번호</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    border: '2px solid #e0e0e0',
                                    borderRadius: '8px',
                                    fontSize: '14px'
                                }}
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                width: '100%',
                                padding: '12px',
                                background: loading ? '#ccc' : 'linear-gradient(135deg, #667eea, #764ba2)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '16px',
                                cursor: loading ? 'not-allowed' : 'pointer'
                            }}
                        >
                            {loading ? '로그인 중...' : '로그인'}
                        </button>
                    </form>
                </div>
                
                {message && (
                    <div style={{
                        position: 'fixed',
                        bottom: '20px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        padding: '15px 30px',
                        borderRadius: '8px',
                        background: message.type === 'error' ? '#ff6b6b' : '#51cf66',
                        color: 'white',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                    }}>
                        {message.text}
                    </div>
                )}
            </div>
        );
    }
    
    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            padding: '20px'
        }}>
            <div style={{
                maxWidth: '1200px',
                margin: '0 auto'
            }}>
                <div style={{
                    background: 'rgba(255, 255, 255, 0.95)',
                    borderRadius: '15px',
                    padding: '20px',
                    marginBottom: '20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <h1>슈퍼 관리자 - 유니온 관리</h1>
                    <button
                        onClick={handleLogout}
                        style={{
                            padding: '10px 20px',
                            background: '#ff6b6b',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer'
                        }}
                    >
                        로그아웃
                    </button>
                </div>
                
                <div style={{
                    background: 'rgba(255, 255, 255, 0.95)',
                    borderRadius: '15px',
                    padding: '20px'
                }}>
                    {/* 유니온 추가 폼 */}
                    <div style={{marginBottom: '30px'}}>
                        <h3>유니온 추가</h3>
                        <form onSubmit={handleAddUnion}>
                            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 120px', gap: '10px'}}>
                                <input
                                    type="text"
                                    placeholder="유니온명"
                                    value={newUnion.name}
                                    onChange={(e) => setNewUnion({...newUnion, name: e.target.value})}
                                    style={{
                                        padding: '10px',
                                        border: '2px solid #e0e0e0',
                                        borderRadius: '8px'
                                    }}
                                />
                                <input
                                    type="text"
                                    placeholder="유저 비밀번호"
                                    value={newUnion.userPassword}
                                    onChange={(e) => setNewUnion({...newUnion, userPassword: e.target.value})}
                                    style={{
                                        padding: '10px',
                                        border: '2px solid #e0e0e0',
                                        borderRadius: '8px'
                                    }}
                                />
                                <input
                                    type="text"
                                    placeholder="관리자 비밀번호"
                                    value={newUnion.adminPassword}
                                    onChange={(e) => setNewUnion({...newUnion, adminPassword: e.target.value})}
                                    style={{
                                        padding: '10px',
                                        border: '2px solid #e0e0e0',
                                        borderRadius: '8px'
                                    }}
                                />
                                <button
                                    type="submit"
                                    style={{
                                        padding: '10px 20px',
                                        background: 'linear-gradient(135deg, #667eea, #764ba2)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    추가
                                </button>
                            </div>
                        </form>
                    </div>
                    
                    {/* 유니온 목록 */}
                    <div>
                        <h3>유니온 목록 ({unions.length}개)</h3>
                        <div style={{overflowX: 'auto'}}>
                            <table style={{width: '100%', borderCollapse: 'collapse'}}>
                                <thead>
                                    <tr style={{background: '#f8f9fa'}}>
                                        <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6'}}>ID</th>
                                        <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6'}}>유니온명</th>
                                        <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6'}}>유저 비밀번호</th>
                                        <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6'}}>관리자 비밀번호</th>
                                        <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6'}}>상태</th>
                                        <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6'}}>생성일</th>
                                        <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6'}}>액션</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {unions.map(union => (
                                        <tr key={union.id} style={{borderBottom: '1px solid #dee2e6'}}>
                                            <td style={{padding: '12px'}}>{union.id}</td>
                                            <td style={{padding: '12px'}}>
                                                {editingUnion?.id === union.id ? (
                                                    <input
                                                        type="text"
                                                        value={editingUnion.name}
                                                        onChange={(e) => setEditingUnion({...editingUnion, name: e.target.value})}
                                                        style={{padding: '5px', border: '1px solid #ccc', borderRadius: '4px'}}
                                                    />
                                                ) : (
                                                    union.name
                                                )}
                                            </td>
                                            <td style={{padding: '12px'}}>
                                                {editingUnion?.id === union.id ? (
                                                    <input
                                                        type="text"
                                                        value={editingUnion.userPassword || ''}
                                                        onChange={(e) => setEditingUnion({...editingUnion, userPassword: e.target.value})}
                                                        style={{padding: '5px', border: '1px solid #ccc', borderRadius: '4px'}}
                                                    />
                                                ) : (
                                                    <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                                                        <span>{showPasswords[union.id] ? union.user_password : '••••••••'}</span>
                                                        <button
                                                            onClick={() => togglePasswordVisibility(union.id)}
                                                            style={{
                                                                padding: '2px 8px',
                                                                background: '#f0f0f0',
                                                                border: '1px solid #ccc',
                                                                borderRadius: '4px',
                                                                cursor: 'pointer',
                                                                fontSize: '12px'
                                                            }}
                                                        >
                                                            {showPasswords[union.id] ? '숨기기' : '보기'}
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{padding: '12px'}}>
                                                {editingUnion?.id === union.id ? (
                                                    <input
                                                        type="text"
                                                        value={editingUnion.adminPassword || ''}
                                                        onChange={(e) => setEditingUnion({...editingUnion, adminPassword: e.target.value})}
                                                        style={{padding: '5px', border: '1px solid #ccc', borderRadius: '4px'}}
                                                    />
                                                ) : (
                                                    <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                                                        <span>{showPasswords[union.id] ? union.admin_password : '••••••••'}</span>
                                                        <button
                                                            onClick={() => togglePasswordVisibility(union.id)}
                                                            style={{
                                                                padding: '2px 8px',
                                                                background: '#f0f0f0',
                                                                border: '1px solid #ccc',
                                                                borderRadius: '4px',
                                                                cursor: 'pointer',
                                                                fontSize: '12px'
                                                            }}
                                                        >
                                                            {showPasswords[union.id] ? '숨기기' : '보기'}
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{padding: '12px'}}>
                                                <span style={{
                                                    padding: '4px 8px',
                                                    borderRadius: '4px',
                                                    background: union.is_active ? '#d4edda' : '#f8d7da',
                                                    color: union.is_active ? '#155724' : '#721c24',
                                                    fontSize: '12px'
                                                }}>
                                                    {union.is_active ? '활성' : '비활성'}
                                                </span>
                                            </td>
                                            <td style={{padding: '12px', fontSize: '14px'}}>
                                                {new Date(union.created_at).toLocaleDateString('ko-KR')}
                                            </td>
                                            <td style={{padding: '12px'}}>
                                                {editingUnion?.id === union.id ? (
                                                    <div style={{display: 'flex', gap: '5px'}}>
                                                        <button
                                                            onClick={() => handleUpdateUnion(editingUnion)}
                                                            style={{
                                                                padding: '5px 10px',
                                                                background: '#51cf66',
                                                                color: 'white',
                                                                border: 'none',
                                                                borderRadius: '4px',
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            저장
                                                        </button>
                                                        <button
                                                            onClick={() => setEditingUnion(null)}
                                                            style={{
                                                                padding: '5px 10px',
                                                                background: '#868e96',
                                                                color: 'white',
                                                                border: 'none',
                                                                borderRadius: '4px',
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            취소
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div style={{display: 'flex', gap: '5px'}}>
                                                        <button
                                                            onClick={() => setEditingUnion({
                                                                id: union.id,
                                                                name: union.name,
                                                                userPassword: '',
                                                                adminPassword: ''
                                                            })}
                                                            style={{
                                                                padding: '5px 10px',
                                                                background: '#339af0',
                                                                color: 'white',
                                                                border: 'none',
                                                                borderRadius: '4px',
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            수정
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteUnion(union.id, union.name)}
                                                            style={{
                                                                padding: '5px 10px',
                                                                background: '#ff6b6b',
                                                                color: 'white',
                                                                border: 'none',
                                                                borderRadius: '4px',
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            삭제
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
            
            {message && (
                <div style={{
                    position: 'fixed',
                    bottom: '20px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    padding: '15px 30px',
                    borderRadius: '8px',
                    background: message.type === 'error' ? '#ff6b6b' : '#51cf66',
                    color: 'white',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    zIndex: 1000
                }}>
                    {message.text}
                </div>
            )}
        </div>
    );
}