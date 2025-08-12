// pages/index.js - 전체 코드 (너무 길어서 2개로 나눔)
// 이 파일을 pages/index.js에 복사하세요

import React, { useState, useEffect, useMemo, Fragment } from 'react'; // ← React 추가!

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
    const [message, setMessage] = useState([]);
    
    // 초기 데이터 로드
    useEffect(() => {
    const interval = setInterval(() => {
        loadData();
    }, 5 * 60 * 1000);  // 5분
    
    return () => clearInterval(interval);
}, []);
    
    const loadData = async () => {
        try {
            const res = await fetch('/api/data');
            const data = await res.json();
            
            setSeasons(data.seasons || []);
            setBosses(data.bosses || []);
            setMembers(data.members || []);
            setMockBattles(data.mockBattles || []);
            setRaidBattles(data.raidBattles || []);
            
            const activeSeason = data.seasons?.find(s => s.is_active);
            if (activeSeason) {
                setCurrentSeason(activeSeason);
            }
        } catch (error) {
            console.error('데이터 로드 실패:', error);
        }
    };
    
    const saveData = async (endpoint, data, method = 'POST') => {
        try {
            const res = await fetch(`/api/${endpoint}`, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            if (res.ok) {
                showMessage('데이터가 저장되었습니다.', 'success');
                await loadData();
            }
        } catch (error) {
            showMessage('저장 실패: ' + error.message, 'error');
        }
    };
    
    const deleteData = async (endpoint, id) => {
        try {
            const res = await fetch(`/api/${endpoint}?id=${id}`, {
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
        const id = Date.now();
        const newMessage = { id, text, type };
        
        setMessages(prev => [...prev, newMessage]);
        
        setTimeout(() => {
            setMessages(prev => prev.filter(msg => msg.id !== id));
        }, 3000);
    };
    
    // 대시보드 컴포넌트
    const Dashboard = () => {
        const [filterStatus, setFilterStatus] = useState('all');
        const [expandedMember, setExpandedMember] = useState(null);
        
        const stats = useMemo(() => {
            if (!currentSeason) return null;
            
            const seasonBattles = raidBattles.filter(b => b.season_id === currentSeason.id);
            const seasonMembers = members.filter(m => m.season_id === currentSeason.id);
            
            const memberStats = seasonMembers.map(member => {
                const memberBattles = seasonBattles.filter(b => b.member_name === member.name);
                return {
                    name: member.name,
                    usedDecks: memberBattles.length,
                    remainingDecks: 3 - memberBattles.length,
                    totalDamage: memberBattles.reduce((sum, b) => sum + (parseInt(b.damage) || 0), 0),
                    battles: memberBattles
                };
            });
            
            let filteredMembers = memberStats;
            if (filterStatus === 'incomplete') {
                filteredMembers = memberStats.filter(m => m.usedDecks < 3);
            } else if (filterStatus === 'complete') {
                filteredMembers = memberStats.filter(m => m.usedDecks === 3);
            }
            
            const totalUsedDecks = memberStats.reduce((sum, m) => sum + m.usedDecks, 0);
            const totalRemainingDecks = memberStats.reduce((sum, m) => sum + m.remainingDecks, 0);
            const completedMembers = memberStats.filter(m => m.usedDecks === 3).length;
            
            return {
                totalUsedDecks,
                totalRemainingDecks,
                completedMembers,
                totalMembers: seasonMembers.length,
                memberStats: filteredMembers,
                allMemberStats: memberStats
            };
        }, [currentSeason, raidBattles, members, filterStatus]);
        
        const toggleMemberDetails = (memberName) => {
            setExpandedMember(expandedMember === memberName ? null : memberName);
        };
        
        if (!currentSeason) {
            return (
                <div className="error-message">
                    현재 활성화된 시즌이 없습니다. 설정에서 시즌을 생성해주세요.
                </div>
            );
        }
        
        return (
            <div>
                <h2 style={{marginBottom: '20px'}}>
                    {currentSeason.name} - 대시보드
                </h2>
                
                <div className="dashboard-grid">
                    <div className="stat-card">
                        <h3>사용된 총 덱 수</h3>
                        <div className="stat-value">
                            {stats?.totalUsedDecks || 0} / {(stats?.totalMembers || 0) * 3}
                        </div>
                    </div>
                    
                    <div className="stat-card">
                        <h3>남은 총 덱 수</h3>
                        <div className="stat-value">
                            {stats?.totalRemainingDecks || 0}
                        </div>
                    </div>
                    
                    <div className="stat-card">
                        <h3>완료 인원</h3>
                        <div className="stat-value">
                            {stats?.completedMembers || 0} / {stats?.totalMembers || 0}
                        </div>
                    </div>
                </div>
                
                <h3 style={{marginTop: '30px', marginBottom: '15px'}}>현재 레벨 보스 현황</h3>
                <CurrentLevelBosses />
                
                <h3 style={{marginTop: '30px', marginBottom: '15px'}}>멤버별 현황</h3>
                
                <div className="filter-section">
                    <button 
                        className={`filter-btn ${filterStatus === 'all' ? 'active' : ''}`}
                        onClick={() => setFilterStatus('all')}
                    >
                        전체 ({stats?.allMemberStats.length || 0})
                    </button>
                    <button 
                        className={`filter-btn ${filterStatus === 'incomplete' ? 'active' : ''}`}
                        onClick={() => setFilterStatus('incomplete')}
                    >
                        덱 남음 ({stats?.allMemberStats.filter(m => m.usedDecks < 3).length || 0})
                    </button>
                    <button 
                        className={`filter-btn ${filterStatus === 'complete' ? 'active' : ''}`}
                        onClick={() => setFilterStatus('complete')}
                    >
                        완료 ({stats?.allMemberStats.filter(m => m.usedDecks === 3).length || 0})
                    </button>
                </div>
                
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>멤버</th>
                                <th>사용 덱</th>
                                <th>남은 덱</th>
                                <th>총 대미지</th>
                                <th>상태</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats?.memberStats.map(member => (
                                <React.Fragment key={member.name}>
                                    <tr 
                                        className={`member-row ${member.battles.length > 0 ? 'expandable' : ''}`}
                                        onClick={() => member.battles.length > 0 && toggleMemberDetails(member.name)}
                                    >
                                        <td>{member.name}</td>
                                        <td>{member.usedDecks}/3</td>
                                        <td>{member.remainingDecks}</td>
                                        <td>{member.totalDamage.toLocaleString()}</td>
                                        <td>
                                            <span className={`member-status ${member.usedDecks === 3 ? 'status-complete' : 'status-incomplete'}`}>
                                                {member.usedDecks === 3 ? '완료' : '진행중'}
                                            </span>
                                        </td>
                                    </tr>
                                    {expandedMember === member.name && member.battles.length > 0 && (
                                        <tr>
                                            <td colSpan="5" style={{padding: 0}}>
                                                <div className="member-details">
                                                    <h4 style={{marginBottom: '10px'}}>전투 상세 기록</h4>
                                                    {member.battles.map((battle, idx) => {
                                                        const boss = bosses.find(b => b.id === battle.boss_id);
                                                        return (
                                                            <div key={battle.id} className="detail-item">
                                                                <strong>덱 {idx + 1}:</strong> Lv.{battle.level === 999 ? '∞' : battle.level} - 
                                                                {boss?.name} ({boss?.attribute}) - 
                                                                대미지: {parseInt(battle.damage).toLocaleString()}
                                                                <br/>
                                                                <small style={{color: '#666'}}>구성: {battle.deck_composition}</small>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };
    
    // 현재 레벨 보스 현황
    const CurrentLevelBosses = () => {
        const currentLevel = useMemo(() => {
            if (!currentSeason) return 1;
            
            for (let level = 1; level <= 3; level++) {
                const levelBosses = bosses.filter(b => 
                    b.season_id === currentSeason.id && b.level === level
                );
                
                if (levelBosses.length === 0) continue;
                
                const allBossesDefeated = levelBosses.every(boss => {
                    const bossBattles = raidBattles.filter(b => 
                        b.boss_id === boss.id && 
                        b.season_id === currentSeason.id &&
                        b.level === level
                    );
                    const totalDamage = bossBattles.reduce((sum, b) => sum + (parseInt(b.damage) || 0), 0);
                    return totalDamage >= boss.hp;
                });
                
                if (!allBossesDefeated) return level;
            }
            
            return 999;
        }, [currentSeason, bosses, raidBattles]);
        
        const levelBosses = bosses.filter(b => 
            b.season_id === currentSeason?.id && b.level === currentLevel
        );
        
        return (
            <div>
                <h4 style={{marginBottom: '10px', color: '#666'}}>
                    현재 레벨: {currentLevel === 999 ? '무한대' : `레벨 ${currentLevel}`}
                </h4>
                {levelBosses.map(boss => {
                    const bossBattles = raidBattles.filter(b => 
                        b.boss_id === boss.id && 
                        b.season_id === currentSeason.id &&
                        (currentLevel === 999 || b.level === currentLevel)
                    );
                    const totalDamage = bossBattles.reduce((sum, b) => sum + (parseInt(b.damage) || 0), 0);
                    
                    if (currentLevel === 999) {
                        return (
                            <div key={boss.id} className="boss-card">
                                <div className="boss-header">
                                    <span className="boss-name">{boss.name}</span>
                                    <span className={`boss-attribute attribute-${boss.attribute}`}>
                                        {boss.attribute}
                                    </span>
                                </div>
                                <div>
                                    누적 대미지: {totalDamage.toLocaleString()}
                                </div>
                                {boss.mechanic && (
                                    <div style={{marginTop: '10px', fontSize: '12px', color: '#666'}}>
                                        기믹: {boss.mechanic}
                                    </div>
                                )}
                            </div>
                        );
                    } else {
                        const remainingHp = Math.max(0, boss.hp - totalDamage);
                        const hpPercent = (remainingHp / boss.hp) * 100;
                        
                        return (
                            <div key={boss.id} className="boss-card">
                                <div className="boss-header">
                                    <span className="boss-name">{boss.name}</span>
                                    <span className={`boss-attribute attribute-${boss.attribute}`}>
                                        {boss.attribute}
                                    </span>
                                </div>
                                <div>
                                    HP: {remainingHp.toLocaleString()} / {boss.hp.toLocaleString()}
                                </div>
                                <div className="hp-bar">
                                    <div className="hp-fill" style={{width: `${hpPercent}%`}}></div>
                                </div>
                                {boss.mechanic && (
                                    <div style={{marginTop: '10px', fontSize: '12px', color: '#666'}}>
                                        기믹: {boss.mechanic}
                                    </div>
                                )}
                            </div>
                        );
                    }
                })}
            </div>
        );
    };

    // 모의전 입력 컴포넌트
    const MockBattle = () => {
        const [formData, setFormData] = useState({
            memberName: '',
            bossId: '',
            deckComposition: '',
            damage: ''
        });
        const [searchBoss, setSearchBoss] = useState('');
        const [searchDamage, setSearchDamage] = useState('');
        
        const handleSubmit = async (e) => {
            e.preventDefault();
            
            if (!formData.memberName || !formData.bossId || !formData.deckComposition || !formData.damage) {
                showMessage('모든 필드를 입력해주세요.', 'error');
                return;
            }
            
            await saveData('mock-battles', {
                seasonId: currentSeason.id,
                memberName: formData.memberName,
                bossId: formData.bossId,
                deckComposition: formData.deckComposition,
                damage: parseInt(formData.damage)
            });
            
            setFormData({
                memberName: '',
                bossId: '',
                deckComposition: '',
                damage: ''
            });
        };
        
        const seasonBosses = bosses.filter(b => b.season_id === currentSeason?.id && b.level === 1);
        const seasonMockBattles = mockBattles.filter(b => b.season_id === currentSeason?.id);
        
        const filteredMockBattles = useMemo(() => {
            if (!searchBoss || !searchDamage) return [];
            
            const targetDamage = parseInt(searchDamage);
            if (isNaN(targetDamage)) return [];
            
            return seasonMockBattles
                .filter(battle => battle.boss_id === parseInt(searchBoss))
                .map(battle => ({
                    ...battle,
                    difference: Math.abs(parseInt(battle.damage) - targetDamage)
                }))
                .sort((a, b) => a.difference - b.difference);
        }, [searchBoss, searchDamage, seasonMockBattles]);
        
        return (
            <div>
                <h2>모의전 딜량 입력</h2>
                
                <form onSubmit={handleSubmit} style={{marginTop: '20px'}}>
                    <div className="grid-2">
                        <div className="form-group">
                            <label>멤버 이름</label>
                            <input
                                type="text"
                                className="form-control"
                                value={formData.memberName}
                                onChange={(e) => setFormData({...formData, memberName: e.target.value})}
                                placeholder="닉네임 입력"
                            />
                        </div>
                        
                        <div className="form-group">
                            <label>보스 선택 (레벨 1)</label>
                            <select
                                className="form-control"
                                value={formData.bossId}
                                onChange={(e) => setFormData({...formData, bossId: e.target.value})}
                            >
                                <option value="">보스 선택</option>
                                {seasonBosses.map(boss => (
                                    <option key={boss.id} value={boss.id}>
                                        {boss.name} ({boss.attribute})
                                    </option>
                                ))}
                            </select>
                        </div>
                        
                        <div className="form-group">
                            <label>덱 조합</label>
                            <input
                                type="text"
                                className="form-control"
                                value={formData.deckComposition}
                                onChange={(e) => setFormData({...formData, deckComposition: e.target.value})}
                                placeholder="예: 크라운, 세이렌, 라피, 레드후드, 나가"
                            />
                        </div>
                        
                        <div className="form-group">
                            <label>대미지</label>
                            <input
                                type="number"
                                className="form-control"
                                value={formData.damage}
                                onChange={(e) => setFormData({...formData, damage: e.target.value})}
                                placeholder="대미지 입력"
                            />
                        </div>
                    </div>
                    
                    <button type="submit" className="btn btn-primary">
                        모의전 기록 추가
                    </button>
                </form>
                
                <h3 style={{marginTop: '30px', marginBottom: '15px'}}>대미지 근사값 검색</h3>
                <div style={{background: '#f8f9fa', padding: '20px', borderRadius: '10px', marginBottom: '20px'}}>
                    <div className="grid-2">
                        <div className="form-group">
                            <label>보스 선택</label>
                            <select
                                className="form-control"
                                value={searchBoss}
                                onChange={(e) => setSearchBoss(e.target.value)}
                            >
                                <option value="">보스 선택</option>
                                {seasonBosses.map(boss => (
                                    <option key={boss.id} value={boss.id}>
                                        {boss.name} ({boss.attribute})
                                    </option>
                                ))}
                            </select>
                        </div>
                        
                        <div className="form-group">
                            <label>목표 대미지</label>
                            <input
                                type="number"
                                className="form-control"
                                value={searchDamage}
                                onChange={(e) => setSearchDamage(e.target.value)}
                                placeholder="검색할 대미지 입력"
                            />
                        </div>
                    </div>
                    
                    {filteredMockBattles.length > 0 && (
                        <div style={{marginTop: '15px'}}>
                            <h4 style={{fontSize: '14px', marginBottom: '10px'}}>
                                근사값 순 정렬 결과 (상위 10개)
                            </h4>
                            <div className="table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>순위</th>
                                            <th>멤버</th>
                                            <th>덱 조합</th>
                                            <th>대미지</th>
                                            <th>차이</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredMockBattles.slice(0, 10).map((battle, idx) => (
                                            <tr key={battle.id}>
                                                <td>{idx + 1}</td>
                                                <td>{battle.member_name}</td>
                                                <td>{battle.deck_composition}</td>
                                                <td>{parseInt(battle.damage).toLocaleString()}</td>
                                                <td style={{color: battle.difference === 0 ? 'green' : '#666'}}>
                                                    {battle.difference === 0 ? '일치' : `±${battle.difference.toLocaleString()}`}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
                
                <h3 style={{marginTop: '30px', marginBottom: '15px'}}>모의전 기록</h3>
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>멤버</th>
                                <th>보스</th>
                                <th>덱 조합</th>
                                <th>대미지</th>
                                <th>액션</th>
                            </tr>
                        </thead>
                        <tbody>
                            {seasonMockBattles.map(battle => {
                                const boss = bosses.find(b => b.id === battle.boss_id);
                                return (
                                    <tr key={battle.id}>
                                        <td>{battle.member_name}</td>
                                        <td>{boss?.name} ({boss?.attribute})</td>
                                        <td>{battle.deck_composition}</td>
                                        <td>{parseInt(battle.damage).toLocaleString()}</td>
                                        <td>
                                            <button
                                                className="btn btn-danger"
                                                onClick={() => deleteData('mock-battles', battle.id)}
                                            >
                                                삭제
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };
    
    // 실전 입력 컴포넌트
    const RaidBattle = () => {
        const [formData, setFormData] = useState({
            memberName: '',
            level: 1,
            bossId: '',
            deckComposition: '',
            damage: ''
        });
        const [memberSuggestions, setMemberSuggestions] = useState([]);
        const [showSuggestions, setShowSuggestions] = useState(false);
        
        const seasonMembers = useMemo(() => {
            return members.filter(m => m.season_id === currentSeason?.id);
        }, [members, currentSeason]);
        
        const handleMemberInput = (value) => {
            setFormData({...formData, memberName: value});
            
            if (value.length > 0) {
                const filtered = seasonMembers.filter(m => 
                    m.name.toLowerCase().includes(value.toLowerCase())
                );
                setMemberSuggestions(filtered);
                setShowSuggestions(true);
            } else {
                setShowSuggestions(false);
            }
        };
        
        const selectMember = (memberName) => {
            setFormData({...formData, memberName});
            setShowSuggestions(false);
        };
        
        const handleSubmit = async (e) => {
            e.preventDefault();
            
            if (!formData.memberName || !formData.bossId || !formData.deckComposition || !formData.damage) {
                showMessage('모든 필드를 입력해주세요.', 'error');
                return;
            }
            
            const memberBattles = raidBattles.filter(b => 
                b.season_id === currentSeason.id && b.member_name === formData.memberName
            );
            
            if (memberBattles.length >= 3) {
                showMessage('이미 3개 덱을 모두 사용했습니다.', 'error');
                return;
            }
            
            await saveData('raid-battles', {
                seasonId: currentSeason.id,
                memberName: formData.memberName,
                level: formData.level,
                bossId: formData.bossId,
                deckComposition: formData.deckComposition,
                damage: parseInt(formData.damage)
            });
            
            setFormData({
                memberName: '',
                level: formData.level,
                bossId: '',
                deckComposition: '',
                damage: ''
            });
            setShowSuggestions(false);
        };
        
        const levelBosses = bosses.filter(b => 
            b.season_id === currentSeason?.id && b.level === formData.level
        );
        const seasonRaidBattles = raidBattles.filter(b => b.season_id === currentSeason?.id);
        
        return (
            <div>
                <h2>실전 기록 입력</h2>
                
                <form onSubmit={handleSubmit} style={{marginTop: '20px'}}>
                    <div className="grid-2">
                        <div className="form-group" style={{position: 'relative'}}>
                            <label>멤버 이름</label>
                            <input
                                type="text"
                                className="form-control"
                                value={formData.memberName}
                                onChange={(e) => handleMemberInput(e.target.value)}
                                onFocus={() => formData.memberName && setShowSuggestions(true)}
                                placeholder="닉네임 입력 또는 선택"
                            />
                            {showSuggestions && memberSuggestions.length > 0 && (
                                <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    right: 0,
                                    background: 'white',
                                    border: '2px solid #e0e0e0',
                                    borderTop: 'none',
                                    borderRadius: '0 0 8px 8px',
                                    maxHeight: '150px',
                                    overflowY: 'auto',
                                    zIndex: 100,
                                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                                }}>
                                    {memberSuggestions.map(member => (
                                        <div
                                            key={member.id}
                                            onClick={() => selectMember(member.name)}
                                            style={{
                                                padding: '10px',
                                                cursor: 'pointer',
                                                borderBottom: '1px solid #f0f0f0'
                                            }}
                                            onMouseEnter={(e) => e.target.style.background = '#f8f9fa'}
                                            onMouseLeave={(e) => e.target.style.background = 'white'}
                                        >
                                            {member.name}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        
                        <div className="form-group">
                            <label>레벨</label>
                            <select
                                className="form-control"
                                value={formData.level}
                                onChange={(e) => setFormData({...formData, level: parseInt(e.target.value), bossId: ''})}
                            >
                                <option value={1}>레벨 1</option>
                                <option value={2}>레벨 2</option>
                                <option value={3}>레벨 3</option>
                                <option value={999}>무한대</option>
                            </select>
                        </div>
                        
                        <div className="form-group">
                            <label>보스 선택</label>
                            <select
                                className="form-control"
                                value={formData.bossId}
                                onChange={(e) => setFormData({...formData, bossId: e.target.value})}
                            >
                                <option value="">보스 선택</option>
                                {levelBosses.map(boss => (
                                    <option key={boss.id} value={boss.id}>
                                        {boss.name} ({boss.attribute})
                                    </option>
                                ))}
                            </select>
                        </div>
                        
                        <div className="form-group">
                            <label>대미지</label>
                            <input
                                type="number"
                                className="form-control"
                                value={formData.damage}
                                onChange={(e) => setFormData({...formData, damage: e.target.value})}
                                placeholder="대미지 입력"
                            />
                        </div>
                    </div>
                    
                    <div className="form-group">
                        <label>덱 조합</label>
                        <input
                            type="text"
                            className="form-control"
                            value={formData.deckComposition}
                            onChange={(e) => setFormData({...formData, deckComposition: e.target.value})}
                            placeholder="예: 크라운, 세이렌, 라피, 레드후드, 나가"
                        />
                    </div>
                    
                    <button type="submit" className="btn btn-primary">
                        실전 기록 추가
                    </button>
                </form>
                
                <h3 style={{marginTop: '30px', marginBottom: '15px'}}>실전 기록</h3>
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>멤버</th>
                                <th>레벨</th>
                                <th>보스</th>
                                <th>덱 조합</th>
                                <th>대미지</th>
                                <th>시간</th>
                                <th>액션</th>
                            </tr>
                        </thead>
                        <tbody>
                            {seasonRaidBattles.map(battle => {
                                const boss = bosses.find(b => b.id === battle.boss_id);
                                return (
                                    <tr key={battle.id}>
                                        <td>{battle.member_name}</td>
                                        <td>Lv.{battle.level === 999 ? '∞' : battle.level}</td>
                                        <td>{boss?.name} ({boss?.attribute})</td>
                                        <td>{battle.deck_composition}</td>
                                        <td>{parseInt(battle.damage).toLocaleString()}</td>
                                        <td>{new Date(battle.timestamp).toLocaleString()}</td>
                                        <td>
                                            <button
                                                className="btn btn-danger"
                                                onClick={() => deleteData('raid-battles', battle.id)}
                                            >
                                                삭제
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };
    
    // 설정 컴포넌트
    const Settings = () => {
        return (
            <div>
                <h2>설정</h2>
                
                <div className="nav-tabs" style={{marginTop: '20px'}}>
                    <button 
                        className={`nav-tab ${activeSettingTab === 'season' ? 'active' : ''}`}
                        onClick={() => setActiveSettingTab('season')}
                    >
                        시즌 관리
                    </button>
                    <button 
                        className={`nav-tab ${activeSettingTab === 'boss' ? 'active' : ''}`}
                        onClick={() => setActiveSettingTab('boss')}
                    >
                        보스 관리
                    </button>
                    <button 
                        className={`nav-tab ${activeSettingTab === 'member' ? 'active' : ''}`}
                        onClick={() => setActiveSettingTab('member')}
                    >
                        멤버 관리
                    </button>
                </div>
                
                <div style={{marginTop: '20px'}}>
                    {activeSettingTab === 'season' && <SeasonSettings />}
                    {activeSettingTab === 'boss' && <BossSettings />}
                    {activeSettingTab === 'member' && <MemberSettings />}
                </div>
            </div>
        );
    };
    
    // pages/index.js의 Settings 부분을 이 코드로 교체하세요

    // 시즌 설정
    const SeasonSettings = () => {
        const [seasonForm, setSeasonForm] = useState({
            name: '',
            date: '',
            copyFromSeason: ''
        });
        
        const handleSubmit = async (e) => {
            e.preventDefault();
            
            await saveData('seasons', {
                name: seasonForm.name,
                date: seasonForm.date,
                copyFromSeason: seasonForm.copyFromSeason
            });
            
            setSeasonForm({
                name: '',
                date: '',
                copyFromSeason: ''
            });
        };
        
        const activateSeason = async (seasonId) => {
            await saveData('seasons', {
                id: seasonId,
                isActive: true
            }, 'PUT');
        };
        
        return (
            <div>
                <form onSubmit={handleSubmit}>
                    <div className="grid-2">
                        <div className="form-group">
                            <label>시즌 이름</label>
                            <input
                                type="text"
                                className="form-control"
                                value={seasonForm.name}
                                onChange={(e) => setSeasonForm({...seasonForm, name: e.target.value})}
                                placeholder="예: 2025년 1월 시즌"
                                required
                            />
                        </div>
                        
                        <div className="form-group">
                            <label>레이드 날짜</label>
                            <input
                                type="date"
                                className="form-control"
                                value={seasonForm.date}
                                onChange={(e) => setSeasonForm({...seasonForm, date: e.target.value})}
                                required
                            />
                        </div>
                    </div>
                    
                    <div className="form-group">
                        <label>이전 시즌 멤버 복사 (선택)</label>
                        <select
                            className="form-control"
                            value={seasonForm.copyFromSeason}
                            onChange={(e) => setSeasonForm({...seasonForm, copyFromSeason: e.target.value})}
                        >
                            <option value="">멤버 복사 안함</option>
                            {seasons.map(season => {
                                const seasonMemberCount = members.filter(m => m.season_id === season.id).length;
                                return (
                                    <option key={season.id} value={season.id}>
                                        {season.name} ({seasonMemberCount}명)
                                    </option>
                                );
                            })}
                        </select>
                        <small style={{color: '#666', display: 'block', marginTop: '5px'}}>
                            선택한 시즌의 멤버 목록을 새 시즌으로 복사합니다.
                        </small>
                    </div>
                    
                    <button type="submit" className="btn btn-primary">
                        시즌 추가
                    </button>
                </form>
                
                <h3 style={{marginTop: '30px', marginBottom: '15px'}}>시즌 목록</h3>
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>시즌명</th>
                                <th>레이드 날짜</th>
                                <th>멤버 수</th>
                                <th>상태</th>
                                <th>액션</th>
                            </tr>
                        </thead>
                        <tbody>
                            {seasons.map(season => {
                                const seasonMemberCount = members.filter(m => m.season_id === season.id).length;
                                return (
                                    <tr key={season.id}>
                                        <td>{season.name}</td>
                                        <td>{season.date}</td>
                                        <td>{seasonMemberCount}명</td>
                                        <td>
                                            {season.is_active ? 
                                                <span className="member-status status-complete">활성</span> : 
                                                <span className="member-status status-incomplete">비활성</span>
                                            }
                                        </td>
                                        <td>
                                            {!season.is_active && (
                                                <button
                                                    className="btn btn-primary"
                                                    onClick={() => activateSeason(season.id)}
                                                    style={{marginRight: '5px'}}
                                                >
                                                    활성화
                                                </button>
                                            )}
                                            <button
                                                className="btn btn-danger"
                                                onClick={() => deleteData('seasons', season.id)}
                                            >
                                                삭제
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };
    
    // 보스 설정
    const BossSettings = () => {
        const [bossNames, setBossNames] = useState(['', '', '', '', '']);
        const [bossMechanics, setBossMechanics] = useState(['', '', '', '', '']);
        const [levelHPs, setLevelHPs] = useState({
            1: ['', '', '', '', ''],
            2: ['', '', '', '', ''],
            3: ['', '', '', '', '']
        });
        
        useEffect(() => {
            if (currentSeason) {
                const seasonBosses = bosses.filter(b => b.season_id === currentSeason.id);
                if (seasonBosses.length > 0) {
                    const names = Array(5).fill('');
                    const mechanics = Array(5).fill('');
                    const hps = {1: Array(5).fill(''), 2: Array(5).fill(''), 3: Array(5).fill('')};
                    
                    seasonBosses.forEach(boss => {
                        const idx = ATTRIBUTES.indexOf(boss.attribute);
                        if (idx !== -1) {
                            names[idx] = boss.name;
                            mechanics[idx] = boss.mechanic || '';
                            if (boss.level <= 3) {
                                hps[boss.level][idx] = boss.hp.toString();
                            }
                        }
                    });
                    
                    setBossNames(names);
                    setBossMechanics(mechanics);
                    setLevelHPs(hps);
                }
            }
        }, [currentSeason, bosses]);
        
        const handleSubmit = async (e) => {
            e.preventDefault();
            
            if (!currentSeason) {
                showMessage('먼저 시즌을 활성화해주세요.', 'error');
                return;
            }
            
            const newBosses = [];
            
            ATTRIBUTES.forEach((attr, idx) => {
                if (!bossNames[idx]) return;
                
                [1, 2, 3].forEach(level => {
                    if (levelHPs[level][idx]) {
                        newBosses.push({
                            name: bossNames[idx],
                            attribute: attr,
                            level: level,
                            hp: parseInt(levelHPs[level][idx]),
                            mechanic: bossMechanics[idx]
                        });
                    }
                });
                
                newBosses.push({
                    name: bossNames[idx],
                    attribute: attr,
                    level: 999,
                    hp: 0,
                    mechanic: bossMechanics[idx]
                });
            });
            
            await saveData('bosses', {
                seasonId: currentSeason.id,
                bosses: newBosses
            });
        };
        
        return (
            <div>
                {!currentSeason ? (
                    <div className="error-message">
                        먼저 시즌을 활성화해주세요.
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <h3 style={{marginBottom: '15px'}}>보스 이름 설정</h3>
                        <div className="boss-input-grid" style={{display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px'}}>
                            {ATTRIBUTES.map((attr, idx) => (
                                <div key={attr} className="boss-input-card" style={{background: '#f8f9fa', padding: '15px', borderRadius: '8px'}}>
                                    <h4 className={`attribute-${attr}`} style={{padding: '5px', borderRadius: '5px', textAlign: 'center', marginBottom: '10px'}}>
                                        {attr}
                                    </h4>
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="보스 이름"
                                        value={bossNames[idx]}
                                        onChange={(e) => {
                                            const newNames = [...bossNames];
                                            newNames[idx] = e.target.value;
                                            setBossNames(newNames);
                                        }}
                                    />
                                </div>
                            ))}
                        </div>
                        
                        <h3 style={{marginTop: '30px', marginBottom: '15px'}}>레벨별 HP 설정</h3>
                        {[1, 2, 3].map(level => (
                            <div key={level} style={{marginBottom: '20px'}}>
                                <h4 style={{marginBottom: '10px', color: '#666'}}>레벨 {level}</h4>
                                <div style={{display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px'}}>
                                    {ATTRIBUTES.map((attr, idx) => (
                                        <div key={attr}>
                                            <label style={{fontSize: '12px', marginBottom: '5px', display: 'block'}}>
                                                {attr} HP
                                            </label>
                                            <input
                                                type="number"
                                                className="form-control"
                                                placeholder="HP 입력"
                                                value={levelHPs[level][idx]}
                                                onChange={(e) => {
                                                    const newHPs = {...levelHPs};
                                                    newHPs[level][idx] = e.target.value;
                                                    setLevelHPs(newHPs);
                                                }}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                        
                        <h3 style={{marginTop: '30px', marginBottom: '15px'}}>보스 기믹 (선택)</h3>
                        <div style={{display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px'}}>
                            {ATTRIBUTES.map((attr, idx) => (
                                <div key={attr}>
                                    <label style={{fontSize: '12px', marginBottom: '5px', display: 'block'}}>
                                        {attr} 기믹
                                    </label>
                                    <textarea
                                        className="form-control"
                                        rows="3"
                                        placeholder="기믹 설명"
                                        value={bossMechanics[idx]}
                                        onChange={(e) => {
                                            const newMechanics = [...bossMechanics];
                                            newMechanics[idx] = e.target.value;
                                            setBossMechanics(newMechanics);
                                        }}
                                    />
                                </div>
                            ))}
                        </div>
                        
                        <button type="submit" className="btn btn-primary" style={{marginTop: '20px'}}>
                            보스 정보 일괄 저장
                        </button>
                    </form>
                )}
                
                <h3 style={{marginTop: '30px', marginBottom: '15px'}}>현재 시즌 보스 목록</h3>
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>레벨</th>
                                <th>이름</th>
                                <th>속성</th>
                                <th>HP</th>
                                <th>기믹</th>
                            </tr>
                        </thead>
                        <tbody>
                            {bosses
                                .filter(b => b.season_id === currentSeason?.id)
                                .sort((a, b) => {
                                    if (a.level !== b.level) return a.level - b.level;
                                    return ATTRIBUTES.indexOf(a.attribute) - ATTRIBUTES.indexOf(b.attribute);
                                })
                                .map(boss => (
                                    <tr key={boss.id}>
                                        <td>Lv.{boss.level === 999 ? '∞' : boss.level}</td>
                                        <td>{boss.name}</td>
                                        <td>
                                            <span className={`boss-attribute attribute-${boss.attribute}`}>
                                                {boss.attribute}
                                            </span>
                                        </td>
                                        <td>{boss.level === 999 ? '무한' : boss.hp.toLocaleString()}</td>
                                        <td>{boss.mechanic || '-'}</td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };
    
    // 멤버 설정
    const MemberSettings = () => {
        const [memberName, setMemberName] = useState('');
        
        const handleSubmit = async (e) => {
            e.preventDefault();
            
            if (!currentSeason) {
                showMessage('먼저 시즌을 활성화해주세요.', 'error');
                return;
            }
            
            const seasonMembers = members.filter(m => m.season_id === currentSeason.id);
            if (seasonMembers.some(m => m.name === memberName)) {
                showMessage('이미 존재하는 멤버입니다.', 'error');
                return;
            }
            
            await saveData('members', {
                seasonId: currentSeason.id,
                name: memberName
            });
            
            setMemberName('');
        };
        
        const seasonMembers = members.filter(m => m.season_id === currentSeason?.id);
        
        return (
            <div>
                {!currentSeason ? (
                    <div className="error-message">
                        먼저 시즌을 활성화해주세요.
                    </div>
                ) : (
                    <>
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label>멤버 이름</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    value={memberName}
                                    onChange={(e) => setMemberName(e.target.value)}
                                    placeholder="멤버 닉네임 입력"
                                    required
                                />
                            </div>
                            
                            <button type="submit" className="btn btn-primary">
                                멤버 추가
                            </button>
                        </form>
                        
                        <h3 style={{marginTop: '30px', marginBottom: '15px'}}>
                            {currentSeason.name} 멤버 목록 ({seasonMembers.length}명)
                        </h3>
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>멤버 이름</th>
                                        <th>액션</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {seasonMembers.map(member => (
                                        <tr key={member.id}>
                                            <td>{member.name}</td>
                                            <td>
                                                <button
                                                    className="btn btn-danger"
                                                    onClick={() => deleteData('members', member.id)}
                                                >
                                                    삭제
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>
        );
    };
// 메인 렌더링
    return (
        <div className="app-container">
            <style jsx global>{`
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
                
                .header {
                    background: rgba(255, 255, 255, 0.95);
                    border-radius: 15px;
                    padding: 20px;
                    margin-bottom: 20px;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                }
                
                .header h1 {
                    color: #333;
                    font-size: 28px;
                    margin-bottom: 10px;
                }
                
                .nav-tabs {
                    display: flex;
                    gap: 10px;
                    flex-wrap: wrap;
                }
                
                .nav-tab {
                    padding: 10px 20px;
                    background: #f0f0f0;
                    border: none;
                    border-radius: 10px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                    transition: all 0.3s;
                }
                
                .nav-tab.active {
                    background: linear-gradient(135deg, #667eea, #764ba2);
                    color: white;
                }
                
                .content-area {
                    background: rgba(255, 255, 255, 0.95);
                    border-radius: 15px;
                    padding: 20px;
                    min-height: 500px;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                }
                
                .dashboard-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 20px;
                    margin-bottom: 30px;
                }
                
                .stat-card {
                    background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
                    padding: 20px;
                    border-radius: 10px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.05);
                }
                
                .stat-card h3 {
                    color: #555;
                    font-size: 14px;
                    margin-bottom: 10px;
                }
                
                .stat-value {
                    font-size: 32px;
                    font-weight: bold;
                    color: #333;
                }
                
                .form-group {
                    margin-bottom: 20px;
                }
                
                .form-group label {
                    display: block;
                    margin-bottom: 5px;
                    color: #555;
                    font-weight: 500;
                }
                
                .form-control {
                    width: 100%;
                    padding: 10px;
                    border: 2px solid #e0e0e0;
                    border-radius: 8px;
                    font-size: 14px;
                    transition: border-color 0.3s;
                }
                
                .form-control:focus {
                    outline: none;
                    border-color: #667eea;
                }
                
                .btn {
                    padding: 10px 20px;
                    border: none;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.3s;
                }
                
                .btn-primary {
                    background: linear-gradient(135deg, #667eea, #764ba2);
                    color: white;
                }
                
                .btn-primary:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
                }
                
                .btn-secondary {
                    background: #f0f0f0;
                    color: #333;
                }
                
                .btn-danger {
                    background: #ff6b6b;
                    color: white;
                }
                
                .table-container {
                    overflow-x: auto;
                    margin-top: 20px;
                }
                
                table {
                    width: 100%;
                    border-collapse: collapse;
                }
                
                th, td {
                    padding: 12px;
                    text-align: left;
                    border-bottom: 1px solid #e0e0e0;
                }
                
                th {
                    background: #f8f9fa;
                    font-weight: 600;
                    color: #555;
                }
                
                tr:hover {
                    background: #f8f9fa;
                }
                
                .member-status {
                    display: inline-block;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                    font-weight: 500;
                }
                
                .status-complete {
                    background: #d4edda;
                    color: #155724;
                }
                
                .status-incomplete {
                    background: #fff3cd;
                    color: #856404;
                }
                
                .boss-card {
                    background: white;
                    border: 2px solid #e0e0e0;
                    border-radius: 10px;
                    padding: 15px;
                    margin-bottom: 15px;
                }
                
                .boss-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 10px;
                }
                
                .boss-name {
                    font-size: 18px;
                    font-weight: 600;
                }
                
                .boss-attribute {
                    padding: 4px 10px;
                    border-radius: 20px;
                    font-size: 12px;
                    background: #e0e0e0;
                }
                
                .attribute-풍압 { background: #a8e6cf; color: #2e7d32; }
                .attribute-철갑 { background: #fff9c4; color: #f57f17; }
                .attribute-수냉 { background: #b3e5fc; color: #01579b; }
                .attribute-작열 { background: #ffccbc; color: #bf360c; }
                .attribute-전격 { background: #e1bee7; color: #6a1b9a; }
                
                .hp-bar {
                    width: 100%;
                    height: 20px;
                    background: #e0e0e0;
                    border-radius: 10px;
                    overflow: hidden;
                    margin-top: 10px;
                }
                
                .hp-fill {
                    height: 100%;
                    background: linear-gradient(90deg, #ff6b6b, #ffd93d);
                    transition: width 0.3s;
                }
                
                .filter-section {
                    display: flex;
                    gap: 10px;
                    margin-bottom: 15px;
                    align-items: center;
                }
                
                .filter-btn {
                    padding: 8px 15px;
                    border: 1px solid #e0e0e0;
                    border-radius: 20px;
                    background: white;
                    cursor: pointer;
                    font-size: 13px;
                    transition: all 0.3s;
                }
                
                .filter-btn.active {
                    background: #667eea;
                    color: white;
                    border-color: #667eea;
                }
                
                .member-row {
                    cursor: pointer;
                    transition: all 0.3s;
                }
                
                .member-row.expandable:hover {
                    background: #f0f7ff;
                }
                
                .member-details {
                    background: #f8f9fa;
                    border-left: 3px solid #667eea;
                    margin: 10px 0;
                    padding: 15px;
                    border-radius: 5px;
                    animation: slideDown 0.3s ease-out;
                }
                @keyframes slideUp {
                    from {
                        bottom: -100px;
                        opacity: 0;
                    }
                    to {
                        bottom: 20px;
                        opacity: 1;
                    }
                }
                @keyframes slideDown {
                    from {
                        opacity: 0;
                        transform: translateY(-10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                @keyframes slideInOut {
                    0% { 
                        opacity: 0; 
                        transform: translateX(-50%) translateY(100px);
                    }
                    10% { 
                        opacity: 1; 
                        transform: translateX(-50%) translateY(0);
                    }
                    90% { 
                        opacity: 1; 
                        transform: translateX(-50%) translateY(0);
                    }
                    100% { 
                        opacity: 0; 
                        transform: translateX(-50%) translateY(100px);
                    }
                }
                
                .detail-item {
                    padding: 8px 0;
                    border-bottom: 1px solid #e0e0e0;
                }
                
                .detail-item:last-child {
                    border-bottom: none;
                }
                
                .grid-2 {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 15px;
                }

                .error-message, .success-message {
                    position: fixed;
                    bottom: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    padding: 15px 30px;
                    border-radius: 8px;
                    z-index: 1000;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                    animation: slideUp 0.3s ease-out;
                    animation: slideInOut 3s ease-in-out forwards;
                    transition: all 0.3s ease;
                }
                .error-message {
                    background: #fff2f2;
                    color: #d32f2f;
                }

                .success-message {
                    background: #e8f5e9;
                    color: #2e7d32;
                }
                
                .loading {
                    text-align: center;
                    padding: 40px;
                    color: #666;
                }
                
                @media (max-width: 768px) {
                    .app-container {
                        padding: 10px;
                    }
                    
                    .grid-2 {
                        grid-template-columns: 1fr;
                    }
                    
                    .dashboard-grid {
                        grid-template-columns: 1fr;
                    }
                    
                    .nav-tabs {
                        flex-direction: column;
                    }
                    
                    .nav-tab {
                        width: 100%;
                    }
                }
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
            
            {messages.map((msg, index) => (
                <div 
                    key={msg.id}
                    className={msg.type === 'error' ? 'error-message' : 'success-message'}
                    style={{
                        position: 'fixed',
                        bottom: `${20 + (index * 60)}px`,  // index 사용
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 1000 + index  // index 사용
                    }}
                >
                    {msg.text}
                </div>
            ))}

            
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