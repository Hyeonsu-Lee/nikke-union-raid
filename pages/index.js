// pages/index.js
import { useState, useEffect, useCallback, useMemo } from 'react';
import { sql } from '@vercel/postgres';

// 속성 정의
const ATTRIBUTES = ['풍압', '철갑', '수냉', '작열', '전격'];

export default function Home() {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [activeSettingTab, setActiveSettingTab] = useState('season');
    const [currentSeason, setCurrentSeason] = useState(null);
    const [seasons, setSeasons] = useState([]);
    const [bosses, setBosses] = useState([]);
    const [members, setMembers] = useState([]);
    const [mockBattles, setMockBattles] = useState([]);
    const [raidBattles, setRaidBattles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);
    
    // 초기 데이터 로드
    useEffect(() => {
        loadData();
        // 5초마다 데이터 새로고침 (실시간 동기화 대체)
        const interval = setInterval(loadData, 5000);
        return () => clearInterval(interval);
    }, []);
    
    const loadData = async () => {
        try {
            // API 호출로 데이터 로드
            const res = await fetch('/api/data');
            const data = await res.json();
            
            setSeasons(data.seasons || []);
            setBosses(data.bosses || []);
            setMembers(data.members || []);
            setMockBattles(data.mockBattles || []);
            setRaidBattles(data.raidBattles || []);
            
            // 현재 시즌 설정
            const activeSeason = data.seasons?.find(s => s.is_active);
            if (activeSeason) {
                setCurrentSeason(activeSeason);
            }
        } catch (error) {
            console.error('데이터 로드 실패:', error);
        }
    };
    
    const saveData = async (table, data, method = 'POST') => {
        try {
            const res = await fetch(`/api/${table}`, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            if (res.ok) {
                showMessage('데이터가 저장되었습니다.', 'success');
                
                // 특정 데이터만 업데이트
                if (table === 'members') {
                    const updated = await res.json();
                    setMembers(updated);
                } else if (table === 'bosses') {
                    const updated = await res.json();
                    setBosses(updated);
                } else {
                    await loadData();
                }
            }
        } catch (error) {
            showMessage('저장 실패: ' + error.message, 'error');
        }
    };
    
    const deleteData = async (table, id) => {
        try {
            const res = await fetch(`/api/${table}?id=${id}`, {
                method: 'DELETE'
            });
            
            if (res.ok) {
                showMessage('삭제되었습니다.', 'success');
                await loadData();
            }
        } catch (error) {
            showMessage('삭제 실패: ' + error.message, 'error');
        }
    };
    
    const showMessage = (text, type = 'info') => {
        setMessage({ text, type });
        setTimeout(() => setMessage(null), 3000);
    };
    
    // 컴포넌트들은 기존과 동일하게 유지
    // ... (기존 Dashboard, MockBattle, RaidBattle, Settings 컴포넌트 코드)
    
    return (
        <div className="app-container">
            <style jsx global>{`
                /* 기존 스타일 그대로 유지 */
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh;
                }
                
                .app-container {
                    max-width: 1400px;
                    margin: 0 auto;
                    padding: 20px;
                }
                
                /* 나머지 스타일도 동일 */
            `}</style>
            
            <div className="header">
                <h1>니케 유니온 레이드 관제 시스템</h1>
                <div className="nav-tabs">
                    <button 
                        className={`nav-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
                        onClick={() => setActiveTab('dashboard')}
                    >
                        대시보드
                    </button>
                    <button 
                        className={`nav-tab ${activeTab === 'mock' ? 'active' : ''}`}
                        onClick={() => setActiveTab('mock')}
                    >
                        모의전
                    </button>
                    <button 
                        className={`nav-tab ${activeTab === 'raid' ? 'active' : ''}`}
                        onClick={() => setActiveTab('raid')}
                    >
                        실전
                    </button>
                    <button 
                        className={`nav-tab ${activeTab === 'settings' ? 'active' : ''}`}
                        onClick={() => setActiveTab('settings')}
                    >
                        설정
                    </button>
                </div>
            </div>
            
            {message && (
                <div className={message.type === 'error' ? 'error-message' : 'success-message'}>
                    {message.text}
                </div>
            )}
            
            <div className="content-area">
                {loading && <div className="loading">로딩중...</div>}
                {!loading && (
                    <>
                        {activeTab === 'dashboard' && <Dashboard />}
                        {activeTab === 'mock' && <MockBattle />}
                        {activeTab === 'raid' && <RaidBattle />}
                        {activeTab === 'settings' && <Settings />}
                    </>
                )}
            </div>
        </div>
    );
}