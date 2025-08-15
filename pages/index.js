// pages/index.js - Realtime 적용 버전
// 메인 구조: import, state, effects, handlers

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';

import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
    useSortable,
} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';

// 속성 정의
const ATTRIBUTES = ['풍압', '철갑', '수냉', '작열', '전격'];

export default function Home() {
    // 로그인 상태
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [unionInfo, setUnionInfo] = useState(null);
    const [loginForm, setLoginForm] = useState({ unionName: '', password: '' });
    const [loginError, setLoginError] = useState('');

    const [activeTab, setActiveTab] = useState('dashboard');
    const [activeSettingTab, setActiveSettingTab] = useState('season');
    const [currentSeason, setCurrentSeason] = useState(null);
    const [seasons, setSeasons] = useState([]);
    const [bosses, setBosses] = useState([]);
    const [members, setMembers] = useState([]);
    const [mockBattles, setMockBattles] = useState([]);
    const [raidBattles, setRaidBattles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [messages, setMessages] = useState([]);
    const [memberSchedules, setMemberSchedules] = useState([]);
    
    // Realtime 채널 ref
    const channelRef = useRef(null);
    
    // 로그인 체크
    useEffect(() => {
        const savedAuth = localStorage.getItem('unionAuth');
        if (savedAuth) {
            const auth = JSON.parse(savedAuth);
            setUnionInfo(auth);
            setIsLoggedIn(true);
            loadInitialData(auth.unionId).finally(() => {
                setLoading(false);
            });
        } else {
            setLoading(false);
        }
    }, []);

    // Realtime 구독 설정
    useEffect(() => {
        if (!unionInfo?.unionId) return;

        // 기존 채널 정리
        if (channelRef.current) {
            channelRef.current.unsubscribe();
        }

        // 새 채널 구독
        const channel = supabase
            .channel(`union-${unionInfo.unionId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'seasons',
                filter: `union_id=eq.${unionInfo.unionId}`
            }, (payload) => {
                handleRealtimeUpdate('seasons', payload);
            })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'members'
            }, (payload) => {
                // 클라이언트 필터링
                handleRealtimeUpdate('members', payload);
            })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'member_schedules'
            }, (payload) => {
                const schedule = payload.new || payload.old;
                if (schedule && currentSeason && schedule.season_id === currentSeason.id) {
                    handleRealtimeUpdate('member_schedules', payload);
                }
            })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'bosses'
            }, (payload) => {
                const boss = payload.new || payload.old;
                if (boss && currentSeason && boss.season_id === currentSeason.id) {
                    handleRealtimeUpdate('bosses', payload);
                }
            })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'mock_battles'
            }, (payload) => {
                const battle = payload.new || payload.old;
                if (battle && currentSeason && battle.season_id === currentSeason.id) {
                    handleRealtimeUpdate('mock_battles', payload);
                }
            })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'raid_battles'
            }, (payload) => {
                const battle = payload.new || payload.old;
                if (battle && currentSeason && battle.season_id === currentSeason.id) {
                    handleRealtimeUpdate('raid_battles', payload);
                }
            })
            .subscribe();

        channelRef.current = channel;

        return () => {
            if (channelRef.current) {
                channelRef.current.unsubscribe();
            }
        };
    }, [unionInfo?.unionId, currentSeason?.id]);

    // Realtime 이벤트 핸들러
    const handleRealtimeUpdate = (table, payload) => {
        const { eventType, new: newRecord, old: oldRecord } = payload;

        switch (table) {
            case 'seasons':
                if (eventType === 'INSERT') {
                    setSeasons(prev => [newRecord, ...prev]);
                } else if (eventType === 'UPDATE') {
                    setSeasons(prev => prev.map(s => s.id === newRecord.id ? newRecord : s));
                } else if (eventType === 'DELETE') {
                    setSeasons(prev => prev.filter(s => s.id !== oldRecord.id));
                    if (currentSeason?.id === oldRecord.id) {
                        setCurrentSeason(null);
                        localStorage.removeItem('current-season-id');
                    }
                }
                break;

            case 'members':
                if (eventType === 'INSERT') {
                    setMembers(prev => [...prev, newRecord]);
                } else if (eventType === 'UPDATE') {
                    if (newRecord.deleted_at) {
                        // Soft delete
                        setMembers(prev => prev.filter(m => m.id !== newRecord.id));
                    } else {
                        setMembers(prev => prev.map(m => m.id === newRecord.id ? newRecord : m));
                    }
                } else if (eventType === 'DELETE') {
                    setMembers(prev => prev.filter(m => m.id !== oldRecord.id));
                }
                break;

            case 'member_schedules':
                if (eventType === 'INSERT') {
                    setMemberSchedules(prev => [...prev, newRecord]);
                } else if (eventType === 'UPDATE') {
                    if (newRecord.deleted_at) {
                        setMemberSchedules(prev => prev.filter(s => s.id !== newRecord.id));
                    } else {
                        setMemberSchedules(prev => prev.map(s => s.id === newRecord.id ? newRecord : s));
                    }
                } else if (eventType === 'DELETE') {
                    setMemberSchedules(prev => prev.filter(s => s.id !== oldRecord.id));
                }
                break;

            case 'bosses':
                if (eventType === 'INSERT') {
                    setBosses(prev => [...prev, newRecord]);
                } else if (eventType === 'UPDATE') {
                    setBosses(prev => prev.map(b => b.id === newRecord.id ? newRecord : b));
                } else if (eventType === 'DELETE') {
                    setBosses(prev => prev.filter(b => b.id !== oldRecord.id));
                }
                break;

            case 'mock_battles':
                if (eventType === 'INSERT') {
                    setMockBattles(prev => [newRecord, ...prev]);
                } else if (eventType === 'UPDATE') {
                    if (newRecord.deleted_at) {
                        setMockBattles(prev => prev.filter(b => b.id !== newRecord.id));
                    } else {
                        setMockBattles(prev => prev.map(b => b.id === newRecord.id ? newRecord : b));
                    }
                } else if (eventType === 'DELETE') {
                    setMockBattles(prev => prev.filter(b => b.id !== oldRecord.id));
                }
                break;

            case 'raid_battles':
                if (eventType === 'INSERT') {
                    setRaidBattles(prev => [newRecord, ...prev]);
                } else if (eventType === 'UPDATE') {
                    if (newRecord.deleted_at) {
                        setRaidBattles(prev => prev.filter(b => b.id !== newRecord.id));
                    } else {
                        setRaidBattles(prev => prev.map(b => b.id === newRecord.id ? newRecord : b));
                    }
                } else if (eventType === 'DELETE') {
                    setRaidBattles(prev => prev.filter(b => b.id !== oldRecord.id));
                }
                break;
        }
    };

    // 로그인 처리
    const handleLogin = async (e) => {
        e.preventDefault();
        setLoginError('');
        
        try {
            const res = await fetch('/api/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(loginForm)
            });
            
            const data = await res.json();
            
            if (res.ok && data.success) {
                const authInfo = {
                    unionId: data.unionId,
                    unionName: data.unionName,
                    isAdmin: data.isAdmin
                };
                
                localStorage.setItem('unionAuth', JSON.stringify(authInfo));
                setUnionInfo(authInfo);
                setIsLoggedIn(true);
                setLoading(true);
                
                loadInitialData(data.unionId).finally(() => {
                    setLoading(false);
                });
            } else {
                setLoginError(data.error || '로그인 실패');
            }
        } catch (error) {
            setLoginError('로그인 처리 중 오류가 발생했습니다.');
        }
    };
    
    // 로그아웃
    const handleLogout = () => {
        localStorage.removeItem('unionAuth');
        localStorage.removeItem('current-season-id');
        setIsLoggedIn(false);
        setUnionInfo(null);
        setSeasons([]);
        setBosses([]);
        setMembers([]);
        setMemberSchedules([]);
        setMockBattles([]);
        setRaidBattles([]);
        setCurrentSeason(null);
        if (channelRef.current) {
            channelRef.current.unsubscribe();
            channelRef.current = null;
        }
    };

    // 초기 데이터 로드 (한 번만)
    const loadInitialData = async (unionId) => {
        try {
            // 시즌 목록 조회
            const res = await fetch(`/api/data?unionId=${unionId}`);
            const data = await res.json();
            
            setSeasons(data.seasons || []);
            
            // 저장된 시즌 또는 최신 시즌 선택
            const savedSeasonId = localStorage.getItem('current-season-id');
            let selectedSeason = null;
            
            if (savedSeasonId) {
                selectedSeason = (data.seasons || []).find(s => s.id === parseInt(savedSeasonId));
            }
            
            if (!selectedSeason && data.seasons?.length > 0) {
                selectedSeason = data.seasons.sort((a, b) => 
                    new Date(b.date) - new Date(a.date)
                )[0];
                localStorage.setItem('current-season-id', selectedSeason.id);
            }
            
            if (selectedSeason) {
                setCurrentSeason(selectedSeason);
                await loadSeasonData(selectedSeason.id);
            }
        } catch (error) {
            console.error('데이터 로드 실패:', error);
        }
    };

    // 시즌 데이터 로드 (초기 로드용)
    const loadSeasonData = async (seasonId) => {
        try {
            const res = await fetch(`/api/data?seasonId=${seasonId}`);
            const data = await res.json();
            
            setBosses(data.bosses || []);
            setMembers(data.members || []);
            setMemberSchedules(data.memberSchedules || []);
            setMockBattles(data.mockBattles || []);
            setRaidBattles(data.raidBattles || []);
        } catch (error) {
            console.error('시즌 데이터 로드 실패:', error);
        }
    };

    const formatNumberInput = (e) => {
        const value = e.target.value.replace(/[^0-9]/g, '');
        if (value !== '') {
            e.target.value = parseInt(value).toLocaleString();
        }
    };
    
    const saveData = async (endpoint, data, method = 'POST') => {
        try {
            const url = `/api/${endpoint}`;

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            if (res.ok) {
                showMessage('데이터가 저장되었습니다.', 'success');
            }
        } catch (error) {
            showMessage('저장 실패: ' + error.message, 'error');
        }
    };

    const deleteData = async (endpoint, id) => {
        try {
            let options = { method: 'DELETE' };
            
            if (endpoint === 'seasons') {
                options.headers = { 'Content-Type': 'application/json' };
                options.body = JSON.stringify({ unionId: unionInfo.unionId });
            }
            
            const res = await fetch(`/api/${endpoint}?id=${id}`, options);
            
            if (res.ok) {
                showMessage('삭제되었습니다.', 'success');
                // 시즌 삭제 시 수동으로 state 업데이트
                if (endpoint === 'seasons') {
                    // 1. 시즌 목록에서 제거
                    setSeasons(prev => prev.filter(s => s.id !== id));
                    
                    // 2. 삭제한 시즌이 현재 보고 있는 시즌이면
                    if (currentSeason?.id === id) {
                        setCurrentSeason(null);
                        localStorage.removeItem('current-season-id');
                        
                        // 3. 관련 데이터 모두 초기화
                        setBosses([]);
                        setMembers([]);
                        setMemberSchedules([]);
                        setMockBattles([]);
                        setRaidBattles([]);
                    }
                }
            }
        } catch (error) {
            showMessage('삭제 실패: ' + error.message, 'error');
        }
    };
    
    const showMessage = (text, type = 'info') => {
        const id = Date.now();
        setMessages(prev => [...prev, { id, text, type }]);
        
        setTimeout(() => {
            setMessages(prev => prev.filter(msg => msg.id !== id));
        }, 1000);
    };

    // 대시보드 컴포넌트
    const Dashboard = () => {
        const [filterStatus, setFilterStatus] = useState('all');
        const [expandedMember, setExpandedMember] = useState(null);
        
        const stats = useMemo(() => {
            if (!currentSeason) return null;
            
            const seasonBattles = raidBattles.filter(b => b.season_id === currentSeason.id);
            const seasonMembers = members.filter(m => m.season_id === currentSeason.id);
            
            const totalDamage = seasonBattles.reduce((sum, b) => sum + (parseInt(b.damage) || 0), 0);

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
                totalDamage,
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
                        <h3>누적 딜량</h3>
                        <div className="stat-value">
                            {(stats?.totalDamage || 0).toLocaleString()}
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
        const [expandedBossId, setExpandedBossId] = useState(null);
        
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
                        b.season_id === currentSeason.id
                    );
                    const totalDamage = bossBattles.reduce((sum, b) => sum + (parseInt(b.damage) || 0), 0);
                    return totalDamage >= boss.hp;
                });
                
                if (!allBossesDefeated) return level;
            }
            
            return 999;
        }, [currentSeason, bosses, raidBattles]);
        
        const toggleBossDetails = (bossId) => {
            setExpandedBossId(expandedBossId === bossId ? null : bossId);
        };
        
        const levelBosses = bosses.filter(b => 
            b.season_id === currentSeason?.id && b.level === currentLevel
                )
            .sort((a, b) => (a.order || 0) - (b.order || 0));
        
        return (
            <div>
                <h4 style={{marginBottom: '10px', color: '#666'}}>
                    현재 레벨: {currentLevel === 999 ? '무한대' : `레벨 ${currentLevel}`}
                </h4>
                {levelBosses.map(boss => {
                    const bossBattles = raidBattles.filter(b => 
                        b.boss_id === boss.id && 
                        b.season_id === currentSeason.id
                    );
                    const totalDamage = bossBattles.reduce((sum, b) => sum + (parseInt(b.damage) || 0), 0);
                    
                    if (currentLevel === 999) {
                        return (
                            <React.Fragment key={boss.id}>
                                <div 
                                    className="boss-card"
                                    onClick={() => toggleBossDetails(boss.id)}
                                    style={{cursor: 'pointer'}}
                                >
                                    <div className="boss-header">
                                        <span className="boss-name">{boss.name}</span>
                                        <span className={`boss-attribute attribute-${boss.attribute}`}>
                                            {boss.attribute}
                                        </span>
                                    </div>
                                    <div>
                                        누적 대미지: {totalDamage.toLocaleString()}
                                    </div>
                                </div>
                                {expandedBossId === boss.id && (
                                    <div style={{
                                        background: '#f8f9fa',
                                        padding: '15px',
                                        marginTop: '-2px',
                                        marginBottom: '15px',
                                        borderRadius: '0 0 10px 10px',
                                        border: '2px solid #e0e0e0',
                                        borderTop: 'none'
                                    }}>
                                        {boss.mechanic && (
                                            <div style={{marginBottom: '10px'}}>
                                                <strong>기믹:</strong>
                                                <div style={{marginTop: '5px', fontSize: '13px', color: '#666'}}>
                                                    {boss.mechanic}
                                                </div>
                                            </div>
                                        )}
                                        <strong>참여 멤버 ({bossBattles.length}명):</strong>
                                        {bossBattles.length > 0 ? (
                                            bossBattles.map(battle => (
                                                <div key={battle.id} style={{marginTop: '5px', fontSize: '13px'}}>
                                                    • {battle.member_name}: {parseInt(battle.damage).toLocaleString()} 
                                                    <span style={{color: '#666'}}> - {battle.deck_composition}</span>
                                                </div>
                                            ))
                                        ) : (
                                            <div style={{marginTop: '5px', fontSize: '13px', color: '#666'}}>
                                                아직 참여한 멤버가 없습니다.
                                            </div>
                                        )}
                                    </div>
                                )}
                            </React.Fragment>
                        );
                    } else {
                        const remainingHp = Math.max(0, boss.hp - totalDamage);
                        const hpPercent = (remainingHp / boss.hp) * 100;
                        
                        return (
                            <React.Fragment key={boss.id}>
                                <div 
                                    className="boss-card"
                                    onClick={() => toggleBossDetails(boss.id)}
                                    style={{cursor: 'pointer'}}
                                >
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
                                </div>
                                {expandedBossId === boss.id && (
                                    <div style={{
                                        background: '#f8f9fa',
                                        padding: '15px',
                                        marginTop: '-2px',
                                        marginBottom: '15px',
                                        borderRadius: '0 0 10px 10px',
                                        border: '2px solid #e0e0e0',
                                        borderTop: 'none'
                                    }}>
                                        {boss.mechanic && (
                                            <div style={{marginBottom: '10px'}}>
                                                <strong>기믹:</strong>
                                                <div style={{marginTop: '5px', fontSize: '13px', color: '#666'}}>
                                                    {boss.mechanic}
                                                </div>
                                            </div>
                                        )}
                                        <strong>참여 멤버 ({bossBattles.length}명):</strong>
                                        {bossBattles.length > 0 ? (
                                            bossBattles.map(battle => (
                                                <div key={battle.id} style={{marginTop: '5px', fontSize: '13px'}}>
                                                    • {battle.member_name}: {parseInt(battle.damage).toLocaleString()} 
                                                    <span style={{color: '#666'}}> - {battle.deck_composition}</span>
                                                </div>
                                            ))
                                        ) : (
                                            <div style={{marginTop: '5px', fontSize: '13px', color: '#666'}}>
                                                아직 참여한 멤버가 없습니다.
                                            </div>
                                        )}
                                    </div>
                                )}
                            </React.Fragment>
                        );
                    }
                })}
            </div>
        );
    };

    // 모의전 입력 컴포넌트
    const MockBattle = () => {
        const memberNameRef = useRef();
        const bossIdRef = useRef();
        const deckRef = useRef();
        const damageRef = useRef();
        
        const [searchBoss, setSearchBoss] = useState('');
        const [searchDamage, setSearchDamage] = useState('');
        const [memberSuggestions, setMemberSuggestions] = useState([]);
        const [showSuggestions, setShowSuggestions] = useState(false);
        const [selectedIndex, setSelectedIndex] = useState(-1);

        const seasonMembers = useMemo(() => {
            return members.filter(m => m.season_id === currentSeason?.id);
        }, [members, currentSeason]);

        const handleMemberInput = () => {
            const value = memberNameRef.current.value;
            setSelectedIndex(-1);
            
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

        const handleMemberKeyDown = (e) => {
            if (e.key === 'ArrowDown' && showSuggestions) {
                e.preventDefault();
                setSelectedIndex(prev => 
                    prev < memberSuggestions.length - 1 ? prev + 1 : 0
                );
            } else if (e.key === 'ArrowUp' && showSuggestions) {
                e.preventDefault();
                setSelectedIndex(prev => prev > 0 ? prev - 1 : memberSuggestions.length - 1);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                
                if (showSuggestions && selectedIndex >= 0) {
                    // 리스트에서 선택
                    selectMember(memberSuggestions[selectedIndex].name);
                    setSelectedIndex(-1);
                } else {
                    // 직접 입력 완료
                    const value = memberNameRef.current.value;
                    if (seasonMembers.some(m => m.name === value)) {
                        setShowSuggestions(false);
                        bossIdRef.current?.focus();
                    }
                }
            } else if (e.key === 'Escape') {
                setShowSuggestions(false);
                setSelectedIndex(-1);
            }
        };

        const selectMember = (memberName) => {
            memberNameRef.current.value = memberName;
            setShowSuggestions(false);
            setSelectedIndex(-1);
            bossIdRef.current?.focus();
        };
        
        const handleSubmit = async (e) => {
            e.preventDefault();
            
            const memberName = memberNameRef.current.value;
            const bossId = bossIdRef.current.value;
            const deck = deckRef.current.value;
            const damage = damageRef.current.value.replace(/,/g, '');

            if (!seasonMembers.some(m => m.name === memberName)) {
                showMessage('등록되지 않은 멤버입니다.', 'error');
                return;
            }

            if (!damage || isNaN(damage) || parseInt(damage) <= 0) {
                showMessage('대미지는 양의 숫자여야 합니다.', 'error');
                return;
            }

            if (!memberName || !bossId || !deck || !damage) {
                showMessage('모든 필드를 입력해주세요.', 'error');
                return;
            }
            
            memberNameRef.current.value = '';
            bossIdRef.current.value = '';
            deckRef.current.value = '';
            damageRef.current.value = '';

            await saveData('mock-battles', {
                seasonId: currentSeason.id,
                memberName: memberName,
                bossId: bossId,
                deckComposition: deck,
                damage: parseInt(damage)
            });
        };
        
        const seasonBosses = bosses
            .filter(b => b.season_id === currentSeason?.id && b.level === 1)
            .sort((a, b) => (a.order || 0) - (b.order || 0));
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
                        <div className="form-group" style={{position: 'relative'}}>
                            <label>멤버 이름</label>
                            <input
                                ref={memberNameRef}
                                type="text"
                                className="form-control"
                                onInput={handleMemberInput}
                                onKeyDown={handleMemberKeyDown}
                                onFocus={() => {
                                    // handleMemberInput() 호출하지 말고 직접 처리
                                    if (memberNameRef.current.value.length > 0) {
                                        setShowSuggestions(true);
                                    }
                                }}
                                onBlur={() => {
                                    // 클릭 이벤트가 먼저 실행되도록 딜레이
                                    setTimeout(() => setShowSuggestions(false), 200);
                                }}
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
                                    {memberSuggestions.map((member, index) => (
                                        <div
                                            key={member.id}
                                            onClick={() => selectMember(member.name)}
                                            style={{
                                                padding: '10px',
                                                cursor: 'pointer',
                                                borderBottom: '1px solid #f0f0f0',
                                                background: index === selectedIndex ? '#667eea' : 'white',
                                                color: index === selectedIndex ? 'white' : 'black'
                                            }}
                                            onMouseEnter={() => setSelectedIndex(index)}
                                        >
                                            {member.name}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        
                        <div className="form-group">
                            <label>보스 선택 (레벨 1)</label>
                            <select
                                ref={bossIdRef}
                                className="form-control"
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
                                ref={deckRef}
                                type="text"
                                className="form-control"
                                placeholder="예: 크라운, 세이렌, 라피, 레드후드, 나가"
                            />
                        </div>
                        
                        <div className="form-group">
                            <label>대미지</label>
                            <input
                                ref={damageRef}
                                type="text"
                                className="form-control"
                                onBlur={formatNumberInput} 
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
        const memberNameRef = useRef();
        const levelRef = useRef();
        const bossIdRef = useRef();
        const deckRef = useRef();
        const damageRef = useRef();
        
        const [memberSuggestions, setMemberSuggestions] = useState([]);
        const [showSuggestions, setShowSuggestions] = useState(false);

        const [selectedIndex, setSelectedIndex] = useState(-1);
        
        const seasonMembers = useMemo(() => {
            return members.filter(m => m.season_id === currentSeason?.id);
        }, [members, currentSeason]);
        
        const handleMemberInput = () => {
            const value = memberNameRef.current.value;
            setSelectedIndex(-1);
            
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
        
        const handleMemberKeyDown = (e) => {
            if (e.key === 'ArrowDown') {
                if (showSuggestions && memberSuggestions.length > 0) {
                    e.preventDefault();
                    e.stopPropagation();
                    setSelectedIndex(prev => {
                        const newIndex = prev < memberSuggestions.length - 1 ? prev + 1 : 0;
                        return newIndex;
                    });
                }
            } else if (e.key === 'ArrowUp') {
                if (showSuggestions && memberSuggestions.length > 0) {
                    e.preventDefault();
                    setSelectedIndex(prev => 
                        prev > 0 ? prev - 1 : memberSuggestions.length - 1
                    );
                }
            } else if (e.key === 'Enter') {
                e.preventDefault();
                
                if (showSuggestions && selectedIndex >= 0 && memberSuggestions[selectedIndex]) {
                    // 리스트에서 선택
                    selectMember(memberSuggestions[selectedIndex].name);
                } else {
                    // 직접 입력 완료
                    const value = memberNameRef.current.value;
                    if (seasonMembers.some(m => m.name === value)) {
                        setShowSuggestions(false);
                        setSelectedIndex(-1);
                        bossIdRef.current?.focus();
                    }
                }
            } else if (e.key === 'Escape') {
                setShowSuggestions(false);
                setSelectedIndex(-1);
            }
        };

        const selectMember = (memberName) => {
            memberNameRef.current.value = memberName;
            setShowSuggestions(false);
            setSelectedIndex(-1);
            bossIdRef.current?.focus();
        };
        
        const handleSubmit = async (e) => {
            e.preventDefault();
            
            const memberName = memberNameRef.current.value;
            const level = levelRef.current.value;
            const bossId = bossIdRef.current.value;
            const deck = deckRef.current.value;
            const damage = damageRef.current.value.replace(/,/g, '');

            console.log('=== 실전 입력 디버깅 ===');
            console.log('선택한 bossId:', bossId);
            console.log('레벨:', level);

            if (!seasonMembers.some(m => m.name === memberName)) {
                showMessage('등록되지 않은 멤버입니다.', 'error');
                return;
            }

            if (!damage || isNaN(damage) || parseInt(damage) <= 0) {
                showMessage('대미지는 양의 숫자여야 합니다.', 'error');
                return;
            }

            if (!memberName || !bossId || !deck || !damage) {
                showMessage('모든 필드를 입력해주세요.', 'error');
                return;
            }
            
            const memberBattles = raidBattles.filter(b => 
                b.season_id === currentSeason.id && b.member_name === memberNameRef.current.value
            );
            
            if (memberBattles.length >= 3) {
                showMessage('이미 3개 덱을 모두 사용했습니다.', 'error');
                return;
            }

            const selectedBoss = bosses.find(b => b.id === parseInt(bossId));
            console.log('selectedBoss:', selectedBoss);
            const bossOrder = ATTRIBUTES.indexOf(selectedBoss.attribute);
            console.log('bossOrder (ATTRIBUTES.indexOf):', bossOrder);
            console.log('selectedBoss.order:', selectedBoss?.order);
            const levelOffset = level === '999' ? 3 : parseInt(level) - 1;
            const actualBossId = (currentSeason.id - 1) * 20 + (bossOrder * 4) + levelOffset + 1;
            console.log('계산된 actualBossId:', actualBossId);
            memberNameRef.current.value = '';
            bossIdRef.current.value = '';
            deckRef.current.value = '';
            damageRef.current.value = '';
            setShowSuggestions(false);

            await saveData('raid-battles', {
                seasonId: currentSeason.id,
                memberName: memberName,
                level: parseInt(level),
                bossId: selectedBoss.id,
                deckComposition: deck,
                damage: parseInt(damage)
            });
        };
        
        const levelBosses = bosses.filter(b => 
            b.season_id === currentSeason?.id && 
            b.level === (levelRef.current ? parseInt(levelRef.current.value) : 1)
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
                                ref={memberNameRef}
                                type="text"
                                className="form-control"
                                onInput={handleMemberInput}
                                onKeyDown={handleMemberKeyDown}
                                onFocus={() => {
                                    // handleMemberInput() 호출하지 말고 직접 처리
                                    if (memberNameRef.current.value.length > 0) {
                                        setShowSuggestions(true);
                                    }
                                }}
                                onBlur={() => {
                                    // 클릭 이벤트가 먼저 실행되도록 딜레이
                                    setTimeout(() => setShowSuggestions(false), 200);
                                }}
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
                                    {memberSuggestions.map((member, index) => (
                                        <div
                                            key={member.id}
                                            onClick={() => selectMember(member.name)}
                                            style={{
                                                padding: '10px',
                                                cursor: 'pointer',
                                                borderBottom: '1px solid #f0f0f0',
                                                background: index === selectedIndex ? '#667eea' : 'white',  // 추가
                                                color: index === selectedIndex ? 'white' : 'black'         // 추가
                                            }}
                                            onMouseEnter={() => setSelectedIndex(index)}
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
                                ref={levelRef}
                                className="form-control"
                                defaultValue={1}
                                onChange={() => {
                                    if (bossIdRef.current) {
                                        bossIdRef.current.value = '';
                                    }
                                }}
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
                                ref={bossIdRef}
                                className="form-control"
                            >
                                <option value="">보스 선택</option>
                                {bosses.filter(b => 
                                    b.season_id === currentSeason?.id && 
                                    b.level === (levelRef.current ? parseInt(levelRef.current.value) : 1)
                                )
                                .sort((a, b) => (a.order || 0) - (b.order || 0))
                                .map(boss => (
                                    <option key={boss.id} value={boss.id}>
                                        {boss.name} ({boss.attribute})
                                    </option>
                                ))}
                            </select>
                        </div>
                        
                        <div className="form-group">
                            <label>대미지</label>
                            <input
                                ref={damageRef}
                                type="text"
                                className="form-control"
                                onBlur={formatNumberInput}
                                placeholder="대미지 입력"
                            />
                        </div>
                    </div>
                    
                    <div className="form-group">
                        <label>덱 조합</label>
                        <input
                            ref={deckRef}
                            type="text"
                            className="form-control"
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

    // 스케줄 컴포넌트
    const Schedule = () => {
        const [hoveredTimeRange, setHoveredTimeRange] = useState(null);
        const [currentTime, setCurrentTime] = useState(new Date());
        
        useEffect(() => {
            const timer = setInterval(() => {
                setCurrentTime(new Date());
            }, 60000);
            return () => clearInterval(timer);
        }, []);
        
        const getCurrentHour = () => {
            const hour = currentTime.getHours();
            return hour < 5 ? hour + 24 : hour;
        };
        
        const getCurrentTimeRange = () => {
            const hour = getCurrentHour();
            if (hour >= 5 && hour <= 29) {
                return `${String(hour >= 24 ? hour - 24 : hour).padStart(2, '0')}시`;
            }
            return '';
        };
        
        const seasonMembers = useMemo(() => {
            if (!currentSeason?.id) return [];
            return members.filter(m => m.season_id === currentSeason.id);
        }, [members, currentSeason?.id]);
        
        const memberSchedulesMap = useMemo(() => {
            const map = {};
            memberSchedules.forEach(schedule => {
                if (schedule.season_id === currentSeason?.id) {
                    map[schedule.member_id] = schedule;
                }
            });
            return map;
        }, [memberSchedules, currentSeason?.id]);
        
        const hourlyRanges = [];
        for (let h = 5; h <= 29; h++) {
            const displayHour = h >= 24 ? h - 24 : h;
            hourlyRanges.push({
                start: h,
                end: h + 1,
                label: `${String(displayHour).padStart(2, '0')}시`
            });
        }
        
        const hourlyAvailability = useMemo(() => {
            const availability = {};
            
            hourlyRanges.forEach(range => {
                availability[range.label] = [];
                
                seasonMembers.forEach(member => {
                    const schedule = memberSchedulesMap[member.id];
                    if (schedule?.time_slots) {
                        const ranges = schedule.time_slots.split(',');
                        let isAvailable = false;
                        
                        ranges.forEach(timeSlot => {
                            const [startStr, endStr] = timeSlot.split('-');
                            if (startStr && endStr) {
                                const startHour = parseInt(startStr.split(':')[0]);
                                const endHour = parseInt(endStr.split(':')[0]);
                                
                                if (startHour <= range.start && endHour > range.start) {
                                    isAvailable = true;
                                }
                            }
                        });
                        
                        if (isAvailable) {
                            const battles = raidBattles.filter(b => 
                                b.season_id === currentSeason?.id && b.member_name === member.name
                            );
                            availability[range.label].push({
                                name: member.name,
                                completed: battles.length === 3
                            });
                        }
                    }
                });
            });
            
            return availability;
        }, [seasonMembers, memberSchedulesMap, raidBattles, currentSeason, hourlyRanges]);
        
        const maxMembers = Math.max(...Object.values(hourlyAvailability).map(members => members.length), 1);
        
        const activeMembers = useMemo(() => {
            const thirtyMinutesAgo = new Date(currentTime.getTime() - 30 * 60000);
            const recentBattles = raidBattles.filter(b => 
                b.season_id === currentSeason?.id && 
                new Date(b.timestamp) >= thirtyMinutesAgo
            );
            const uniqueMembers = [...new Set(recentBattles.map(b => b.member_name))];
            return uniqueMembers.length;
        }, [raidBattles, currentSeason, currentTime]);
        
        const currentTimeRangeMembers = hourlyAvailability[getCurrentTimeRange()]?.length || 0;
        
        const memberStats = useMemo(() => {
            return seasonMembers.map(member => {
                const schedule = memberSchedulesMap[member.id];
                const memberBattles = raidBattles.filter(b => 
                    b.season_id === currentSeason?.id && b.member_name === member.name
                );
                
                const sortedBattles = [...memberBattles].sort((a, b) => 
                    new Date(a.timestamp) - new Date(b.timestamp)
                );
                const firstBattle = sortedBattles[0];
                const lastBattle = sortedBattles[sortedBattles.length - 1];
                
                let status = '🔴';
                let timeCompliance = '-';
                
                if (memberBattles.length > 0) {
                    if (memberBattles.length === 3) {
                        status = '🟢';
                    } else {
                        status = '🟠';
                    }
                    
                    if (schedule?.time_slots && firstBattle) {
                        const firstBattleTime = new Date(firstBattle.timestamp);
                        const battleHour = firstBattleTime.getHours();
                        const adjustedHour = battleHour < 5 ? battleHour + 24 : battleHour;
                        
                        let isInSchedule = false;
                        const ranges = schedule.time_slots.split(',');
                        ranges.forEach(range => {
                            const [startStr, endStr] = range.split('-');
                            if (startStr && endStr) {
                                const startHour = parseInt(startStr.split(':')[0]);
                                const endHour = parseInt(endStr.split(':')[0]);
                                if (adjustedHour >= startHour && adjustedHour < endHour) {
                                    isInSchedule = true;
                                }
                            }
                        });
                        
                        if (isInSchedule) {
                            timeCompliance = '✅';
                        } else {
                            timeCompliance = '⚠️';
                            if (memberBattles.length === 3) {
                                status = '🟡';
                            }
                        }
                    }
                } else if (schedule?.time_slots) {
                    const currentHour = getCurrentHour();
                    let hasUpcomingSchedule = false;
                    
                    const ranges = schedule.time_slots.split(',');
                    ranges.forEach(range => {
                        const [, endStr] = range.split('-');
                        if (endStr) {
                            const endHour = parseInt(endStr.split(':')[0]);
                            if (endHour > currentHour) {
                                hasUpcomingSchedule = true;
                            }
                        }
                    });
                    
                    if (hasUpcomingSchedule) {
                        status = '🔵';
                    }
                }
                
                return {
                    name: member.name,
                    schedule: schedule?.time_slots || '미설정',
                    status,
                    firstBattle: firstBattle ? new Date(firstBattle.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-',
                    lastBattle: lastBattle ? new Date(lastBattle.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-',
                    deckUsed: memberBattles.length,
                    timeCompliance
                };
            });
        }, [seasonMembers, memberSchedulesMap, raidBattles, currentSeason]);
        
        const completedCount = memberStats.filter(m => m.status === '🟢' || m.status === '🟡').length;
        const notParticipatedCount = memberStats.filter(m => m.status === '🔴').length;
        
        if (!currentSeason) {
            return (
                <div className="error-message">
                    현재 활성화된 시즌이 없습니다. 설정에서 시즌을 생성해주세요.
                </div>
            );
        }
        
        const firstColumnRanges = hourlyRanges.slice(0, 12);
        const secondColumnRanges = hourlyRanges.slice(12, 24);
        
        return (
            <div>
                <h2>스케줄 관리</h2>
                
                <div style={{
                    background: '#f8f9fa',
                    borderRadius: '10px',
                    padding: '20px',
                    marginTop: '20px',
                    marginBottom: '30px'
                }}>
                    <div style={{
                        borderBottom: '3px solid #333',
                        marginBottom: '30px',
                        paddingBottom: '40px',
                        position: 'relative'
                    }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            marginBottom: '10px',
                            fontSize: '12px',
                            fontWeight: '500'
                        }}>
                            {[5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,0,1,2,3,4,5].map((hour, idx) => (
                                <span key={idx} style={{fontSize: '11px'}}>
                                    {String(hour).padStart(2, '0')}
                                </span>
                            ))}
                        </div>
                        
                        {getCurrentHour() >= 5 && getCurrentHour() <= 29 && (
                            <div style={{
                                position: 'absolute',
                                left: `${((getCurrentHour() - 5) / 24) * 100}%`,
                                top: '20px',
                                transform: 'translateX(-50%)',
                                zIndex: 10
                            }}>
                                <div style={{
                                    fontSize: '14px', 
                                    marginBottom: '3px',
                                    textAlign: 'center',
                                    lineHeight: '1'
                                }}>
                                    ▼
                                </div>
                                <div style={{
                                    width: '2px',
                                    height: '15px',
                                    background: '#ff6b6b',
                                    margin: '0 auto'
                                }} />
                                <div style={{
                                    background: '#ff6b6b',
                                    color: 'white',
                                    padding: '3px 10px',
                                    borderRadius: '12px',
                                    fontSize: '11px',
                                    whiteSpace: 'nowrap',
                                    marginTop: '5px',
                                    transform: 'translateX(-50%)',
                                    position: 'relative',
                                    left: '50%'
                                }}>
                                    현재 시간 ({currentTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })})
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <h4 style={{marginBottom: '20px', fontSize: '16px'}}>참여 가능 인원 분포</h4>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '30px',
                        position: 'relative',
                        marginBottom: '30px'
                    }}>
                        <div>
                            {firstColumnRanges.map((range, idx) => {
                                const members = hourlyAvailability[range.label] || [];
                                const barWidth = (members.length / maxMembers) * 90;
                                const isCurrentRange = getCurrentTimeRange() === range.label;
                                
                                return (
                                    <div 
                                        key={idx}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            marginBottom: '8px',
                                            position: 'relative'
                                        }}
                                        onMouseEnter={() => setHoveredTimeRange(range.label)}
                                        onMouseLeave={() => setHoveredTimeRange(null)}
                                    >
                                        <div style={{
                                            width: '45px',
                                            fontSize: '13px',
                                            fontWeight: isCurrentRange ? 'bold' : 'normal',
                                            color: isCurrentRange ? '#667eea' : '#333'
                                        }}>
                                            {range.label}:
                                        </div>
                                        
                                        <div style={{
                                            flex: 1,
                                            marginRight: '10px'
                                        }}>
                                            <div style={{
                                                display: 'inline-block',
                                                width: `${barWidth}%`,
                                                minWidth: members.length > 0 ? '15px' : '0',
                                                height: '20px',
                                                background: isCurrentRange ? '#667eea' : '#90cdf4',
                                                borderRadius: '3px',
                                                transition: 'all 0.3s',
                                                cursor: 'pointer'
                                            }} />
                                        </div>
                                        
                                        <div style={{
                                            width: '35px',
                                            fontSize: '13px',
                                            fontWeight: isCurrentRange ? 'bold' : 'normal',
                                            textAlign: 'right'
                                        }}>
                                            {members.length}명
                                        </div>
                                        
                                        {isCurrentRange && (
                                            <span style={{
                                                marginLeft: '5px',
                                                fontSize: '14px',
                                                color: '#667eea'
                                            }}>
                                                ←
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        
                        <div>
                            {secondColumnRanges.map((range, idx) => {
                                const members = hourlyAvailability[range.label] || [];
                                const barWidth = (members.length / maxMembers) * 90;
                                const isCurrentRange = getCurrentTimeRange() === range.label;
                                
                                return (
                                    <div 
                                        key={idx}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            marginBottom: '8px',
                                            position: 'relative'
                                        }}
                                        onMouseEnter={() => setHoveredTimeRange(range.label)}
                                        onMouseLeave={() => setHoveredTimeRange(null)}
                                    >
                                        <div style={{
                                            width: '45px',
                                            fontSize: '13px',
                                            fontWeight: isCurrentRange ? 'bold' : 'normal',
                                            color: isCurrentRange ? '#667eea' : '#333'
                                        }}>
                                            {range.label}:
                                        </div>
                                        
                                        <div style={{
                                            flex: 1,
                                            marginRight: '10px'
                                        }}>
                                            <div style={{
                                                display: 'inline-block',
                                                width: `${barWidth}%`,
                                                minWidth: members.length > 0 ? '15px' : '0',
                                                height: '20px',
                                                background: isCurrentRange ? '#667eea' : '#90cdf4',
                                                borderRadius: '3px',
                                                transition: 'all 0.3s',
                                                cursor: 'pointer'
                                            }} />
                                        </div>
                                        
                                        <div style={{
                                            width: '35px',
                                            fontSize: '13px',
                                            fontWeight: isCurrentRange ? 'bold' : 'normal',
                                            textAlign: 'right'
                                        }}>
                                            {members.length}명
                                        </div>
                                        
                                        {isCurrentRange && (
                                            <span style={{
                                                marginLeft: '5px',
                                                fontSize: '14px',
                                                color: '#667eea'
                                            }}>
                                                ←
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        
                        {hoveredTimeRange && hourlyAvailability[hoveredTimeRange]?.length > 0 && (
                            <div style={{
                                position: 'absolute',
                                left: '50%',
                                top: '50%',
                                transform: 'translate(-50%, -50%)',
                                background: 'white',
                                border: '2px solid #667eea',
                                borderRadius: '8px',
                                padding: '15px',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                zIndex: 100,
                                minWidth: '200px'
                            }}>
                                <strong style={{fontSize: '14px'}}>{hoveredTimeRange}</strong>
                                <div style={{marginTop: '10px'}}>
                                    {hourlyAvailability[hoveredTimeRange].map((member, idx) => (
                                        <div key={idx} style={{fontSize: '12px', marginTop: '3px'}}>
                                            • {member.name} {member.completed && '(완료)'}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <h4 style={{marginBottom: '15px', fontSize: '16px'}}>실시간 참여 현황</h4>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, 1fr)',
                        gap: '15px',
                        padding: '15px',
                        background: 'white',
                        borderRadius: '8px'
                    }}>
                        <div>
                            <span style={{fontSize: '12px', color: '#666'}}>● 현재 활동중:</span>
                            <span style={{fontSize: '14px', fontWeight: 'bold', marginLeft: '5px'}}>
                                {activeMembers}명
                            </span>
                            <div style={{fontSize: '10px', color: '#999', paddingLeft: '8px'}}>(최근 30분 내 기록)</div>
                        </div>
                        <div>
                            <span style={{fontSize: '12px', color: '#666'}}>● 대기중:</span>
                            <span style={{fontSize: '14px', fontWeight: 'bold', marginLeft: '5px'}}>
                                {currentTimeRangeMembers}명
                            </span>
                            <div style={{fontSize: '10px', color: '#999', paddingLeft: '8px'}}>(현재 시간대 참여 가능)</div>
                        </div>
                        <div>
                            <span style={{fontSize: '12px', color: '#666'}}>● 완료:</span>
                            <span style={{fontSize: '14px', fontWeight: 'bold', marginLeft: '5px'}}>
                                {completedCount}명
                            </span>
                            <div style={{fontSize: '10px', color: '#999', paddingLeft: '8px'}}>(3덱 모두 사용)</div>
                        </div>
                        <div>
                            <span style={{fontSize: '12px', color: '#666'}}>● 미참여:</span>
                            <span style={{fontSize: '14px', fontWeight: 'bold', marginLeft: '5px'}}>
                                {notParticipatedCount}명
                            </span>
                        </div>
                    </div>
                </div>
                
                <h3 style={{marginBottom: '15px'}}>멤버별 참여 현황</h3>
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>멤버</th>
                                <th>참여가능시간</th>
                                <th>상태</th>
                                <th>첫 기록</th>
                                <th>마지막</th>
                                <th>덱사용</th>
                                <th>시간준수</th>
                            </tr>
                        </thead>
                        <tbody>
                            {memberStats.map((stat, idx) => (
                                <tr key={idx}>
                                    <td>{stat.name}</td>
                                    <td style={{fontSize: '12px'}}>{stat.schedule}</td>
                                    <td style={{
                                        fontSize: '18px', 
                                        textAlign: 'center',
                                        cursor: 'help'
                                    }} title={
                                        stat.status === '🟢' ? '완료 (시간 내)' :
                                        stat.status === '🟡' ? '완료 (시간 외)' :
                                        stat.status === '🟠' ? '진행중' :
                                        stat.status === '🔵' ? '대기중' :
                                        '미참여'
                                    }>
                                        {stat.status}
                                    </td>
                                    <td>{stat.firstBattle}</td>
                                    <td>{stat.lastBattle}</td>
                                    <td>
                                        <span style={{
                                            fontWeight: stat.deckUsed === 3 ? 'bold' : 'normal',
                                            color: stat.deckUsed === 3 ? '#4CAF50' : stat.deckUsed > 0 ? '#FFC107' : '#666'
                                        }}>
                                            {stat.deckUsed}/3
                                        </span>
                                    </td>
                                    <td style={{
                                        fontSize: '16px', 
                                        textAlign: 'center',
                                        cursor: 'help'
                                    }} title={
                                        stat.timeCompliance === '✅' ? '시간 내 참여' :
                                        stat.timeCompliance === '⚠️' ? '시간 외 참여' :
                                        '미참여'
                                    }>
                                        {stat.timeCompliance}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const Settings = () => {
        if (!unionInfo?.isAdmin) {
            return (
                <div style={{
                    textAlign: 'center',
                    padding: '40px',
                    background: '#f8f9fa',
                    borderRadius: '10px'
                }}>
                    <h3 style={{color: '#666'}}>관리자 권한이 필요합니다</h3>
                    <p style={{marginTop: '10px', color: '#999'}}>
                        설정 메뉴는 관리자만 사용할 수 있습니다.
                    </p>
                </div>
            );
        }
        
        return (
            <div>
                <h2>설정</h2>
                
                <div style={{
                    display: 'flex',
                    gap: '10px',
                    marginTop: '20px',
                    marginBottom: '30px',
                    borderBottom: '2px solid #e0e0e0',
                    paddingBottom: '10px'
                }}>
                    <button
                        className={`nav-tab ${activeSettingTab === 'season' ? 'active' : ''}`}
                        onClick={() => setActiveSettingTab('season')}
                        style={{
                            padding: '8px 16px',
                            background: activeSettingTab === 'season' ? '#667eea' : '#f0f0f0',
                            color: activeSettingTab === 'season' ? 'white' : '#333',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '14px'
                        }}
                    >
                        시즌 관리
                    </button>
                    <button
                        className={`nav-tab ${activeSettingTab === 'boss' ? 'active' : ''}`}
                        onClick={() => setActiveSettingTab('boss')}
                        style={{
                            padding: '8px 16px',
                            background: activeSettingTab === 'boss' ? '#667eea' : '#f0f0f0',
                            color: activeSettingTab === 'boss' ? 'white' : '#333',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '14px'
                        }}
                    >
                        보스 관리
                    </button>
                    <button
                        className={`nav-tab ${activeSettingTab === 'member' ? 'active' : ''}`}
                        onClick={() => setActiveSettingTab('member')}
                        style={{
                            padding: '8px 16px',
                            background: activeSettingTab === 'member' ? '#667eea' : '#f0f0f0',
                            color: activeSettingTab === 'member' ? 'white' : '#333',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '14px'
                        }}
                    >
                        멤버 관리
                    </button>
                </div>
                
                <div>
                    {activeSettingTab === 'season' && <SeasonSettings />}
                    {activeSettingTab === 'boss' && <BossSettings />}
                    {activeSettingTab === 'member' && <MemberSettings />}
                </div>
            </div>
        );
    };

    // 시즌 설정
    const SeasonSettings = () => {
        const nameRef = useRef();
        const dateRef = useRef();
        const copyRef = useRef();
        
        const handleSubmit = async (e) => {
            e.preventDefault();
            
            const seasonName = nameRef.current.value;
            const seasonDate = dateRef.current.value;
            const copyFromSeasonId = copyRef.current.value;

            nameRef.current.value = '';
            dateRef.current.value = '';
            copyRef.current.value = '';

            await saveData('seasons', {
                name: seasonName,
                date: seasonDate,
                copyFromSeason: copyFromSeasonId,
                unionId: unionInfo.unionId
            });
        };
        
        // 시즌 선택 (로컬 스토리지 사용)
        const selectSeason = (seasonId) => {
            const season = seasons.find(s => s.id === seasonId);
            if (season) {
                localStorage.setItem('current-season-id', seasonId);
                setCurrentSeason(season);
                loadSeasonData(seasonId);
            }
        };
        
        return (
            <div>
                <form onSubmit={handleSubmit}>
                    <div className="grid-2">
                        <div className="form-group">
                            <label>시즌 이름</label>
                            <input
                                ref={nameRef}
                                type="text"
                                className="form-control"
                                placeholder="예: 2025년 1월 시즌"
                                required
                            />
                        </div>
                        
                        <div className="form-group">
                            <label>레이드 날짜</label>
                            <input
                                ref={dateRef}
                                type="date"
                                className="form-control"
                                required
                            />
                        </div>
                    </div>
                    
                    <div className="form-group">
                        <label>이전 시즌 멤버 복사 (선택)</label>
                        <select
                            ref={copyRef}
                            className="form-control"
                        >
                            <option value="">멤버 복사 안함</option>
                            {seasons.map(season => {
                                const seasonMemberCount = season.member_count || 0;
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
                                const seasonMemberCount = season.member_count || 0;
                                const isCurrentSeason = currentSeason?.id === season.id;
                                return (
                                    <tr key={season.id}>
                                        <td>{season.name}</td>
                                        <td>{season.date}</td>
                                        <td>{seasonMemberCount}명</td>
                                        <td style={{textAlign: 'center'}}>
                                            {isCurrentSeason ? '🔵' : '⚪'}
                                        </td>
                                        <td>
                                            {!isCurrentSeason && (
                                                <button
                                                    className="btn btn-primary"
                                                    onClick={() => selectSeason(season.id)}
                                                    style={{marginRight: '5px'}}
                                                >
                                                    보기
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

    const SortableItem = ({id, children}) => {
        const {
            attributes,
            listeners,
            setNodeRef,
            transform,
            transition,
            isDragging,
        } = useSortable({id});

        const style = {
            transform: CSS.Transform.toString(transform),
            transition,
            opacity: isDragging ? 0.5 : 1,
        };

        return (
            <div ref={setNodeRef} style={style}>
                {/* 드래그 핸들 분리 */}
                <div {...attributes} {...listeners} style={{
                    cursor: 'move',
                    padding: '5px',
                    background: '#667eea',
                    color: 'white',
                    borderRadius: '5px 5px 0 0',
                    textAlign: 'center',
                    fontSize: '12px'
                }}>
                    ⋮⋮⋮⋮⋮⋮
                </div>
                {children}
            </div>
        );
    };

    const BossSettings = () => {
        const formRef = useRef();
        const [bossOrder, setBossOrder] = useState(ATTRIBUTES);
        
        // 드래그 센서 설정
        const sensors = useSensors(
            useSensor(PointerSensor),
            useSensor(KeyboardSensor, {
                coordinateGetter: sortableKeyboardCoordinates,
            })
        );
        
        // 드래그 종료 핸들러
        const handleDragEnd = (event) => {
            const {active, over} = event;
            
            if (active.id !== over.id) {
                setBossOrder((items) => {
                    const oldIndex = items.indexOf(active.id);
                    const newIndex = items.indexOf(over.id);
                    return arrayMove(items, oldIndex, newIndex);
                });
            }
        };

        useEffect(() => {
            if (currentSeason && formRef.current) {
                const seasonBosses = bosses.filter(b => b.season_id === currentSeason.id);
                if (seasonBosses.length > 0) {
                    // 보스 순서 복원 (order 필드가 있으면 사용)
                    const hasOrder = seasonBosses.some(b => b.order !== undefined);
                    if (hasOrder) {
                        const level1Bosses = seasonBosses
                            .filter(b => b.level === 1)
                            .sort((a, b) => (a.order || 0) - (b.order || 0));
                        setBossOrder(level1Bosses.map(b => b.attribute));
                    }

                    seasonBosses.forEach(boss => {
                        const idx = ATTRIBUTES.indexOf(boss.attribute);
                        if (idx !== -1) {
                            const nameInput = formRef.current[`boss-name-${idx}`];
                            const mechanicInput = formRef.current[`boss-mechanic-${idx}`];
                            
                            if (nameInput) nameInput.value = boss.name;
                            if (mechanicInput) mechanicInput.value = boss.mechanic || '';
                            
                            if (boss.level <= 3) {
                                const hpInput = formRef.current[`boss-hp-${boss.level}-${idx}`];
                                if (hpInput) hpInput.value = boss.hp.toString();
                            }
                        }
                    });
                }
            }
        }, [currentSeason, bosses]);
        
        const handleSubmit = async (e) => {
            e.preventDefault();
            
            if (!currentSeason) {
                showMessage('먼저 시즌을 활성화해주세요.', 'error');
                return;
            }
            
            const formData = new FormData(formRef.current);
            const newBosses = [];
            let hasError = false;
    
            for (let idx = 0; idx < ATTRIBUTES.length; idx++) {
                const attr = ATTRIBUTES[idx];
                const name = formData.get(`boss-name-${idx}`);
                
                if (!name || name.trim() === '') {
                    showMessage(`${attr} 보스 이름을 입력해주세요.`, 'error');
                    hasError = true;
                }
            }
            
            for (let idx = 0; idx < ATTRIBUTES.length; idx++) {
                const attr = ATTRIBUTES[idx];
                
                for (let level = 1; level <= 3; level++) {
                    const hpValue = formData.get(`boss-hp-${level}-${idx}`);
                    const hp = hpValue ? hpValue.replace(/,/g, '') : '';
                    
                    if (!hp || hp === '' || hp === '0') {
                        showMessage(`${attr} 레벨 ${level} HP를 입력해주세요.`, 'error');
                        hasError = true;
                    } else if (isNaN(hp) || parseInt(hp) <= 0) {
                        showMessage(`${attr} 레벨 ${level} HP는 양수여야 합니다.`, 'error');
                        hasError = true;
                    }
                }
            }
            
            if (hasError) {
                return;
            }
            
            bossOrder.forEach((attr, orderIndex) => {  // bossOrder 순서 사용
                const idx = ATTRIBUTES.indexOf(attr);  // 원래 인덱스로 input 찾기
                const name = formData.get(`boss-name-${idx}`);
                const mechanic = formData.get(`boss-mechanic-${idx}`);
                
                if (!name) return;
                
                [1, 2, 3].forEach(level => {
                    const hpValue = formData.get(`boss-hp-${level}-${idx}`);
                    const hp = hpValue ? hpValue.replace(/,/g, '') : '';

                    if (hp && hp !== '0') {
                        if (isNaN(hp)) {
                            showMessage(`${attr} 레벨 ${level} HP는 숫자여야 합니다.`, 'error');
                            return;
                        }
                        
                        if (parseInt(hp) <= 0) {
                            showMessage(`${attr} 레벨 ${level} HP는 0보다 커야 합니다.`, 'error');
                            return;
                        }
                        newBosses.push({
                            name,
                            attribute: attr,
                            level: level,
                            hp: parseInt(hp),
                            mechanic,
                            order: orderIndex
                        });
                    }
                });
                
                newBosses.push({
                    name,
                    attribute: attr,
                    level: 999,
                    hp: 0,
                    mechanic,
                    order: orderIndex
                });
            });
            
            if (newBosses.length !== 20) {
                showMessage(`보스 개수 오류: ${newBosses.length}개 (20개여야 함)`, 'error');
                return;
            }

            await saveData('bosses', {
                seasonId: currentSeason.id,
                bosses: newBosses
            });
        };
        
        return (
            <div>
                {!currentSeason ? (
                    <div className="error-message">
                        먼저 시즌을 선택해주세요.
                    </div>
                ) : (
                    <form ref={formRef} onSubmit={handleSubmit}>
                        <h3 style={{marginBottom: '15px'}}>보스 설정</h3>
                        <DndContext 
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <SortableContext 
                                items={bossOrder}
                                strategy={verticalListSortingStrategy}
                            >
                                <div style={{display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '15px'}}>
                                    {bossOrder.map((attr) => {
                                        const idx = ATTRIBUTES.indexOf(attr);
                                        return (
                                            <SortableItem key={attr} id={attr}>
                                                <div style={{
                                                    background: '#f8f9fa', 
                                                    padding: '15px', 
                                                    borderRadius: '10px',
                                                    cursor: 'move',
                                                    border: '2px solid #e0e0e0',
                                                    transition: 'all 0.3s'
                                                }}>
                                                    <h4 className={`attribute-${attr}`} style={{
                                                        padding: '8px', 
                                                        borderRadius: '5px', 
                                                        textAlign: 'center', 
                                                        marginBottom: '15px',
                                                        fontWeight: 'bold'
                                                    }}>
                                                        {attr}
                                                    </h4>
                                                    
                                                    <div style={{marginBottom: '10px'}}>
                                                        <label style={{fontSize: '12px', marginBottom: '5px', display: 'block'}}>
                                                            보스 이름
                                                        </label>
                                                        <input
                                                            name={`boss-name-${idx}`}
                                                            type="text"
                                                            className="form-control"
                                                            placeholder="보스 이름 입력"
                                                        />
                                                    </div>
                                                    
                                                    <div style={{marginBottom: '10px'}}>
                                                        <label style={{fontSize: '12px', marginBottom: '5px', display: 'block'}}>
                                                            레벨 1 HP
                                                        </label>
                                                        <input
                                                            name={`boss-hp-1-${idx}`}
                                                            type="text"
                                                            className="form-control"
                                                            onBlur={formatNumberInput}
                                                            placeholder="HP 입력"
                                                        />
                                                    </div>
                                                    
                                                    <div style={{marginBottom: '10px'}}>
                                                        <label style={{fontSize: '12px', marginBottom: '5px', display: 'block'}}>
                                                            레벨 2 HP
                                                        </label>
                                                        <input
                                                            name={`boss-hp-2-${idx}`}
                                                            type="text"
                                                            className="form-control"
                                                            onBlur={formatNumberInput}
                                                            placeholder="HP 입력"
                                                        />
                                                    </div>
                                                    
                                                    <div style={{marginBottom: '10px'}}>
                                                        <label style={{fontSize: '12px', marginBottom: '5px', display: 'block'}}>
                                                            레벨 3 HP
                                                        </label>
                                                        <input
                                                            name={`boss-hp-3-${idx}`}
                                                            type="text"
                                                            className="form-control"
                                                            onBlur={formatNumberInput}
                                                            placeholder="HP 입력"
                                                        />
                                                    </div>
                                                    
                                                    <div>
                                                        <label style={{fontSize: '12px', marginBottom: '5px', display: 'block'}}>
                                                            보스 기믹
                                                        </label>
                                                        <textarea
                                                            name={`boss-mechanic-${idx}`}
                                                            className="form-control"
                                                            rows="3"
                                                            placeholder="기믹 설명 (선택)"
                                                            style={{fontSize: '12px'}}
                                                        />
                                                    </div>
                                                </div>
                                            </SortableItem>
                                        );
                                    })}
                                </div>
                            </SortableContext>
                        </DndContext>
                        
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
                                    return (a.order || 0) - (b.order || 0);
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
        const memberNameRef = useRef();
        const [editingSchedule, setEditingSchedule] = useState(null);
        const [selectedTimeSlots, setSelectedTimeSlots] = useState([]);

        const hourSlots = [
            5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,
            24,25,26,27,28,29
        ];
        
        const seasonMembers = useMemo(() => {
            if (!currentSeason?.id) return [];
            return members.filter(m => m.season_id === currentSeason.id);
        }, [members, currentSeason?.id]);
        
        const memberSchedulesMap = useMemo(() => {
            const map = {};
            memberSchedules.forEach(schedule => {
                if (schedule.season_id === currentSeason?.id) {
                    map[schedule.member_id] = schedule;
                }
            });
            return map;
        }, [memberSchedules, currentSeason?.id]);
        
        const handleSubmit = async (e) => {
            e.preventDefault();
            
            if (!currentSeason) {
                showMessage('먼저 시즌을 선택해주세요.', 'error');
                return;
            }
            
            const memberName = memberNameRef.current.value;
            
            if (seasonMembers.some(m => m.name === memberName)) {
                showMessage('이미 존재하는 멤버입니다.', 'error');
                return;
            }
            
            memberNameRef.current.value = '';

            await saveData('members', {
                seasonId: currentSeason.id,
                name: memberName
            });
        };
        
        const toggleTimeSlot = (hour) => {
            setSelectedTimeSlots(prev => {
                if (prev.includes(hour)) {
                    return prev.filter(h => h !== hour);
                } else {
                    return [...prev, hour].sort((a, b) => a - b);
                }
            });
        };
        
        const timeSlotsToString = (slots) => {
            if (!slots || slots.length === 0) return '';
            
            const ranges = [];
            let start = slots[0];
            let end = slots[0];
            
            for (let i = 1; i <= slots.length; i++) {
                if (i === slots.length || slots[i] !== end + 1) {
                    const startStr = `${String(start).padStart(2, '0')}:00`;
                    const endStr = `${String(end + 1).padStart(2, '0')}:00`;
                    ranges.push(`${startStr}-${endStr}`);
                    
                    if (i < slots.length) {
                        start = slots[i];
                        end = slots[i];
                    }
                } else {
                    end = slots[i];
                }
            }
            
            return ranges.join(',');
        };
        
        const stringToTimeSlots = (str) => {
            if (!str) return [];
            
            const slots = [];
            const ranges = str.split(',');
            
            ranges.forEach(range => {
                const [startStr, endStr] = range.split('-');
                if (startStr && endStr) {
                    const startHour = parseInt(startStr.split(':')[0]);
                    const endHour = parseInt(endStr.split(':')[0]);
                    
                    for (let h = startHour; h < endHour; h++) {
                        slots.push(h);
                    }
                }
            });
            
            return slots;
        };
        
        const openScheduleModal = (member) => {
            setEditingSchedule(member);
            const schedule = memberSchedulesMap[member.id];
            setSelectedTimeSlots(schedule ? stringToTimeSlots(schedule.time_slots) : []);
        };
        
        const saveSchedule = async () => {
            if (!editingSchedule) return;
            
            const timeSlotString = timeSlotsToString(selectedTimeSlots);
            
            await saveData('member-schedules', {
                memberId: editingSchedule.id,
                seasonId: currentSeason.id,
                timeSlots: timeSlotString
            }, 'PUT');
            
            setEditingSchedule(null);
            setSelectedTimeSlots([]);
        };
        
        const getHourDisplay = (hour) => {
            if (hour >= 24) {
                return `익일 ${hour - 24}시`;
            }
            return `${hour}시`;
        };
        
        return (
            <div>
                {!currentSeason ? (
                    <div className="error-message">
                        먼저 시즌을 선택해주세요.
                    </div>
                ) : (
                    <>
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label>멤버 이름</label>
                                <input
                                    ref={memberNameRef}
                                    type="text"
                                    className="form-control"
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
                                        <th>참여 가능 시간</th>
                                        <th>액션</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[...seasonMembers].reverse().map(member => {
                                        const schedule = memberSchedulesMap[member.id];
                                        return (
                                            <tr key={member.id}>
                                                <td>{member.name}</td>
                                                <td>{schedule?.time_slots || '미설정'}</td>
                                                <td>
                                                    <button
                                                        className="btn btn-primary"
                                                        onClick={() => openScheduleModal(member)}
                                                        style={{marginRight: '5px'}}
                                                    >
                                                        {schedule ? '시간 수정' : '시간 설정'}
                                                    </button>
                                                    <button
                                                        className="btn btn-danger"
                                                        onClick={() => deleteData('members', member.id)}
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
                        
                        {editingSchedule && (
                            <div style={{
                                position: 'fixed',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                background: 'rgba(0,0,0,0.5)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                zIndex: 1000
                            }}>
                                <div style={{
                                    background: 'white',
                                    borderRadius: '15px',
                                    padding: '30px',
                                    maxWidth: '800px',
                                    width: '90%',
                                    maxHeight: '80vh',
                                    overflow: 'auto'
                                }}>
                                    <h3>{editingSchedule.name} - 참여 가능 시간 설정</h3>
                                    <p style={{color: '#666', marginBottom: '20px'}}>
                                        참여 가능한 시간을 클릭하여 선택하세요 (1시간 단위)
                                    </p>
                                    
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(6, 1fr)',
                                        gap: '10px',
                                        marginBottom: '20px'
                                    }}>
                                        {hourSlots.map(hour => (
                                            <button
                                                key={hour}
                                                onClick={() => toggleTimeSlot(hour)}
                                                style={{
                                                    padding: '10px',
                                                    border: '2px solid #e0e0e0',
                                                    borderRadius: '8px',
                                                    background: selectedTimeSlots.includes(hour) ? '#667eea' : 'white',
                                                    color: selectedTimeSlots.includes(hour) ? 'white' : 'black',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.3s'
                                                }}
                                            >
                                                {getHourDisplay(hour)}
                                            </button>
                                        ))}
                                    </div>
                                    
                                    <div style={{marginBottom: '20px'}}>
                                        <strong>선택된 시간:</strong> {timeSlotsToString(selectedTimeSlots) || '없음'}
                                    </div>
                                    
                                    <div style={{display: 'flex', gap: '10px', justifyContent: 'flex-end'}}>
                                        <button 
                                            className="btn btn-secondary"
                                            onClick={() => {
                                                setEditingSchedule(null);
                                                setSelectedTimeSlots([]);
                                            }}
                                        >
                                            취소
                                        </button>
                                        <button 
                                            className="btn btn-primary"
                                            onClick={saveSchedule}
                                        >
                                            저장
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        );
    };
    // 메인 렌더링 - 로그인 체크
    if (!isLoggedIn) {
        return (
            <div style={{
                minHeight: '100vh',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px'
            }}>
                <div style={{
                    background: 'white',
                    padding: '40px',
                    borderRadius: '15px',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
                    width: '100%',
                    maxWidth: '400px'
                }}>
                    <h2 style={{textAlign: 'center', marginBottom: '30px'}}>
                        니케 유니온 레이드 관제 시스템
                    </h2>
                    <form onSubmit={handleLogin}>
                        <div style={{marginBottom: '20px'}}>
                            <label style={{display: 'block', marginBottom: '5px', color: '#555'}}>
                                유니온명
                            </label>
                            <input
                                type="text"
                                value={loginForm.unionName}
                                onChange={(e) => setLoginForm({...loginForm, unionName: e.target.value})}
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
                        <div style={{marginBottom: '20px'}}>
                            <label style={{display: 'block', marginBottom: '5px', color: '#555'}}>
                                비밀번호
                            </label>
                            <input
                                type="password"
                                value={loginForm.password}
                                onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
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
                        {loginError && (
                            <div style={{
                                marginBottom: '20px',
                                padding: '10px',
                                background: '#ffe0e0',
                                color: '#d00',
                                borderRadius: '8px',
                                fontSize: '14px'
                            }}>
                                {loginError}
                            </div>
                        )}
                        <button
                            type="submit"
                            style={{
                                width: '100%',
                                padding: '12px',
                                background: 'linear-gradient(135deg, #667eea, #764ba2)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '16px',
                                cursor: 'pointer',
                                transition: 'all 0.3s'
                            }}
                        >
                            로그인
                        </button>
                    </form>
                    <div style={{
                        marginTop: '20px',
                        textAlign: 'center',
                        fontSize: '12px',
                        color: '#999'
                    }}>
                        관리자에게 유니온명과 비밀번호를 문의하세요
                    </div>
                </div>
            </div>
        );
    }

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
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px'}}>
                    <h1>니케 유니온 레이드 관제 시스템 - {unionInfo?.unionName}</h1>
                    <button 
                        className="btn btn-danger"
                        onClick={handleLogout}
                    >
                        로그아웃
                    </button>
                </div>
                <div className="nav-tabs">
                    <button 
                        className={`nav-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
                        onClick={() => setActiveTab('dashboard')}
                    >
                        대시보드
                    </button>
                    <button 
                        className={`nav-tab ${activeTab === 'schedule' ? 'active' : ''}`}
                        onClick={() => setActiveTab('schedule')}
                    >
                        스케줄
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
            
            {messages && messages.length > 0 && messages.map((msg, index) => (
                <div 
                    key={msg.id}
                    className={msg.type === 'error' ? 'error-message' : 'success-message'}
                >
                    {msg.text}
                </div>
            ))}
            
            <div className="content-area">
                {loading && <div className="loading">로딩중...</div>}
                {!loading && (
                    <>
                        {activeTab === 'dashboard' && <Dashboard />}
                        {activeTab === 'schedule' && <Schedule />}
                        {activeTab === 'mock' && <MockBattle />}
                        {activeTab === 'raid' && <RaidBattle />}
                        {activeTab === 'settings' && <Settings />}
                    </>
                )}
            </div>
        </div>
    );
}