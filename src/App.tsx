import React, { useState, useEffect, useRef } from 'react';
import { GameId, RoomState, Player, ControllerInput, MatchResults, PlayerClientHUDState, TournamentMode, TournamentState } from './types';
import { socketClient } from './multiplayer/SocketClient';
import { p2pClient } from './multiplayer/P2PClient';
import { p2pHostServer } from './multiplayer/P2PHostServer';
import { LocalRoomEngine } from './multiplayer/LocalRoomEngine';
import { WebRTCManager } from './multiplayer/WebRTCManager';
import { soundManager } from './audio/SoundManager';
import { tournamentEngine } from './multiplayer/TournamentEngine';
import { Navbar } from './components/ui/Navbar';
import { CRTOverlay } from './components/ui/CRTOverlay';
import { CountdownOverlay } from './components/ui/CountdownOverlay';
import { PodiumModal } from './components/ui/PodiumModal';
import { TournamentLeaderboardModal } from './components/ui/TournamentLeaderboardModal';
import { HubView } from './views/HubView';
import { HostLobbyView } from './views/HostLobbyView';
import { HostGameView } from './views/HostGameView';
import { ControllerView } from './views/ControllerView';
import { LeaderboardsView } from './views/LeaderboardsView';
import { ProfileView } from './views/ProfileView';
import { LandingIntroAd } from './components/ui/LandingIntroAd';

export const App: React.FC = () => {
  // Always show the full landing page presentation on reload
  const [showLandingIntro, setShowLandingIntro] = useState<boolean>(true);

  // Navigation
  const [currentTab, setCurrentTab] = useState<'hub' | 'host' | 'join' | 'leaderboards' | 'profile'>('hub');
  const [urlJoinCode, setUrlJoinCode] = useState<string>('');

  // Host & Party State
  const [room, setRoom] = useState<RoomState | null>(null);
  const [matchState, setMatchState] = useState<'idle' | 'lobby' | 'countdown' | 'playing' | 'results'>('idle');
  const [matchResults, setMatchResults] = useState<MatchResults | null>(null);

  // Tournament / Playlist State
  const [tournamentMode, setTournamentMode] = useState<TournamentMode>('single');
  const [playlistSequence, setPlaylistSequence] = useState<GameId[]>(['serpent-arena']);
  const [tournamentState, setTournamentState] = useState<TournamentState | null>(null);
  const [showTournamentLeaderboard, setShowTournamentLeaderboard] = useState<boolean>(false);

  // Player / Controller State (For Mobile Phones)
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [hudState, setHudState] = useState<PlayerClientHUDState | null>(null);
  const [allHudStates, setAllHudStates] = useState<Record<string, PlayerClientHUDState>>({});
  
  // Mutable remote inputs ref to completely prevent React re-renders on high-frequency controller input packets (60-240Hz)
  const remoteInputsRef = useRef<Record<string, ControllerInput>>({});

  // WebRTC Peer-to-Peer Direct DataChannel Managers
  const hostWebRTCRef = useRef<WebRTCManager | null>(null);
  const clientWebRTCRef = useRef<WebRTCManager | null>(null);

  // Setup Host WebRTC on Host view
  useEffect(() => {
    if (currentTab === 'host') {
      hostWebRTCRef.current = new WebRTCManager(true, (pid, input) => {
        remoteInputsRef.current[pid] = input;
      });
    } else {
      hostWebRTCRef.current?.closeAll();
      hostWebRTCRef.current = null;
    }
  }, [currentTab]);

  // Parse URL Parameters (e.g. ?join=HYP42)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const joinParam = params.get('join') || params.get('code');
      if (joinParam) {
        setUrlJoinCode(joinParam.toUpperCase());
        setCurrentTab('join');
      }
    } catch {}
  }, []);

  // Connect to Socket.IO Server
  useEffect(() => {
    socketClient.connect().then((connected) => {
      if (connected) {
        // console.log('[Hypercade]: Realtime socket connected.');
      }
    });

    // Listen for room updates
    const unbindRoomCreated = socketClient.on('room-created', (data: { code: string; localIp: string; room: RoomState }) => {
      setRoom({ ...data.room, localIp: data.localIp });
      setMatchState('lobby');
    });

    const unbindPlayerJoined = socketClient.on('player-joined', (data: { player: Player; room: RoomState }) => {
      setRoom((prev) => {
        if (!prev) return data.room;
        const nextPlayers = { ...prev.players, [data.player.id]: data.player };
        return { ...prev, players: nextPlayers };
      });
      soundManager.playPickup(750);
    });

    const unbindPlayerLeft = socketClient.on('player-left', (data: { playerId: string; room: RoomState }) => {
      setRoom((prev) => {
        if (!prev) return data.room;
        const nextPlayers = { ...prev.players };
        delete nextPlayers[data.playerId];
        return { ...prev, players: nextPlayers };
      });
    });

    const unbindPlayerReady = socketClient.on('player-ready-updated', (data: { playerId: string; isReady: boolean; room: RoomState }) => {
      setRoom((prev) => {
        if (!prev) return data.room;
        const player = prev.players[data.playerId];
        if (!player) return prev;
        return {
          ...prev,
          players: {
            ...prev.players,
            [data.playerId]: { ...player, isReady: data.isReady },
          },
        };
      });
    });

    const unbindGameSelected = socketClient.on('game-selected', (data: { gameId: GameId }) => {
      setRoom((prev) => (prev ? { ...prev, selectedGame: data.gameId } : prev));
    });

    const unbindCountdown = socketClient.on('countdown-started', () => {
      setMatchState('countdown');
    });

    const unbindGameStarted = socketClient.on('game-started', (_data: any) => {
      setMatchState('playing');
    });

    const unbindClientInput = socketClient.on('client-input', (data: { playerId: string; input: ControllerInput }) => {
      remoteInputsRef.current[data.playerId] = data.input;
    });

    const unbindP2PInput = p2pHostServer.on('client-input', (data: { playerId: string; input: ControllerInput }) => {
      remoteInputsRef.current[data.playerId] = data.input;
    });

    const unbindP2PPlayerJoined = p2pHostServer.on('player-joined', (data: { player: Player; room: RoomState }) => {
      setRoom((prev) => {
        if (!prev) return data.room;
        const nextPlayers = { ...prev.players, [data.player.id]: data.player };
        return { ...prev, players: nextPlayers };
      });
      soundManager.playPickup(750);
    });

    const unbindP2PPlayerLeft = p2pHostServer.on('player-left', (data: { playerId: string; room: RoomState }) => {
      setRoom((prev) => {
        if (!prev) return data.room;
        const nextPlayers = { ...prev.players };
        delete nextPlayers[data.playerId];
        return { ...prev, players: nextPlayers };
      });
    });

    const unbindP2PPlayerReady = p2pHostServer.on('player-ready-updated', (data: { playerId: string; isReady: boolean; room: RoomState }) => {
      setRoom((prev) => {
        if (!prev) return data.room;
        const player = prev.players[data.playerId];
        if (!player) return prev;
        return {
          ...prev,
          players: {
            ...prev.players,
            [data.playerId]: { ...player, isReady: data.isReady },
          },
        };
      });
    });

    const unbindSyncGameState = socketClient.on('sync-game-state', (data: any) => {
      // Sync lightweight HUD data for controller (own HUD or all HUDs for spectator mode)
      if (data?.hud) {
        setAllHudStates((prev) => ({ ...prev, ...data.hud }));
        if (playerId && data.hud[playerId]) {
          setHudState(data.hud[playerId]);
        }
      }
    });

    const unbindGameEnded = socketClient.on('game-ended', (results: MatchResults) => {
      setMatchResults(results);
      setMatchState('results');
    });

    const unbindReturnedLobby = socketClient.on('returned-to-lobby', () => {
      setMatchResults(null);
      setShowTournamentLeaderboard(false);
      setMatchState('lobby');
    });

    const unbindMapVoted = socketClient.on('map-voted', (data: { mapId: string; playerId: string }) => {
      setRoom((prev) => {
        if (!prev) return prev;
        const playerVotes = { ...(prev.playerMapVotes || {}), [data.playerId]: data.mapId };
        const counts: Record<string, number> = { backrooms: 0, dungeon: 0, 'cyber-vault': 0 };
        for (const pid in playerVotes) {
          const mid = playerVotes[pid];
          counts[mid] = (counts[mid] || 0) + 1;
        }
        let winningMap: any = 'backrooms';
        let maxVotes = -1;
        for (const mid of ['backrooms', 'dungeon', 'cyber-vault']) {
          if ((counts[mid] || 0) > maxVotes) {
            maxVotes = counts[mid] || 0;
            winningMap = mid;
          }
        }
        return {
          ...prev,
          playerMapVotes: playerVotes,
          mapVoting: counts,
          selectedMap: winningMap,
          config: {
            ...prev.config,
            selectedMap: winningMap,
          },
        };
      });
    });

    return () => {
      unbindRoomCreated();
      unbindPlayerJoined();
      unbindPlayerLeft();
      unbindPlayerReady();
      unbindGameSelected();
      unbindCountdown();
      unbindGameStarted();
      unbindClientInput();
      unbindP2PInput();
      unbindSyncGameState();
      unbindGameEnded();
      unbindReturnedLobby();
      unbindMapVoted();
    };
  }, [playerId]);

  // --- ACTIONS --- //

  // 1. HOST: Create Room (Instant 0ms Local Authoritative + Background P2PHostServer)
  const handleHostCreateParty = (selectedGame?: string) => {
    soundManager.playClick(900);
    const validGame = (selectedGame as GameId) || 'serpent-arena';
    const code = `HYP${Math.floor(10 + Math.random() * 89)}`;

    // 1. Instant 0ms transition into Host Lobby
    const localRoom = LocalRoomEngine.createLocalRoom(validGame, 3);
    const roomWithBots: RoomState = {
      ...localRoom,
      code,
      selectedGame: validGame,
      players: LocalRoomEngine.generateBots(3, localRoom.players),
    };
    setRoom(roomWithBots);
    setMatchState('lobby');
    setCurrentTab('host');

    // 2. Asynchronously spin up WebRTC Host Server & Socket relay in background (non-blocking)
    p2pHostServer.startHost(code, validGame, 3).then((p2pRoom) => {
      setRoom((prev) => (prev ? { ...prev, ...p2pRoom, code } : p2pRoom));
    }).catch(() => {});

    socketClient.createRoom(validGame).then((res) => {
      if (res.success && res.room) {
        setRoom((prev) => (prev ? { ...prev, localIp: res.localIp } : prev));
      }
    }).catch(() => {});
  };

  // 2. QUICK PLAY (Direct Launch into Game with Bots)
  const handleQuickPlay = (gameId: string) => {
    soundManager.playClick(950);
    const selected = (gameId as GameId) || 'serpent-arena';
    const localRoom = LocalRoomEngine.createLocalRoom(selected, 3);
    const roomWithBots = {
      ...localRoom,
      players: LocalRoomEngine.generateBots(3, localRoom.players),
    };
    setRoom(roomWithBots);
    setTournamentMode('single');
    setPlaylistSequence([selected]);
    setTournamentState(null);
    setShowTournamentLeaderboard(false);
    setMatchState('countdown');
    setCurrentTab('host');
  };

  // 3. HOST: Select Tournament Mode & Playlist Sequence
  const handleSelectTournamentMode = (mode: TournamentMode, customSequence?: GameId[]) => {
    setTournamentMode(mode);
    if (customSequence && customSequence.length > 0) {
      setPlaylistSequence(customSequence);
      if (room && customSequence[0] !== room.selectedGame) {
        handleSelectGame(customSequence[0]);
      }
    }
  };

  // 4. HOST: Select Game
  const handleSelectGame = (gameId: GameId) => {
    if (!room) return;
    socketClient.selectGame(gameId);
    setRoom((prev) => (prev ? { ...prev, selectedGame: gameId } : prev));
  };

  // 5. HOST: Update Bots
  const handleUpdateBots = (count: number) => {
    if (!room) return;
    socketClient.updateSettings(count);
    const diff = room.config?.difficulty === 'easy' ? 'easy' : room.config?.difficulty === 'hard' ? 'hard' : 'medium';
    const updatedPlayers = LocalRoomEngine.generateBots(count, room.players, diff);
    setRoom((prev) => (prev ? { ...prev, botCount: count, players: updatedPlayers } : prev));
    tournamentEngine.syncPlayers(updatedPlayers);
  };

  // 5b. HOST: Update Bot Difficulty
  const handleUpdateDifficulty = (difficulty: 'easy' | 'normal' | 'hard' | 'extreme') => {
    if (!room) return;
    socketClient.updateSettings(room.botCount, { difficulty });
    const targetDiff: 'easy' | 'medium' | 'hard' = difficulty === 'easy' ? 'easy' : difficulty === 'hard' ? 'hard' : 'medium';
    
    setRoom((prev) => {
      if (!prev) return prev;
      const updatedPlayers = { ...prev.players };
      for (const pid in updatedPlayers) {
        if (updatedPlayers[pid].isBot) {
          updatedPlayers[pid] = { ...updatedPlayers[pid], difficulty: targetDiff };
        }
      }
      return {
        ...prev,
        config: { ...prev.config, difficulty },
        players: updatedPlayers,
      };
    });
  };

  // 6. HOST: Start Match (Countdown -> Game)
  const handleStartMatch = () => {
    if (room && tournamentMode !== 'single' && playlistSequence.length > 1) {
      // Initialize or reset tournament if fresh
      if (!tournamentState || tournamentState.isComplete) {
        const state = tournamentEngine.initTournament(tournamentMode, room.players, playlistSequence);
        setTournamentState(state);
        const firstGame = state.gameSequence[0];
        setRoom((prev) => (prev ? { ...prev, selectedGame: firstGame } : prev));
        socketClient.selectGame(firstGame);
      }
    }
    socketClient.startCountdown();
    setMatchState('countdown');
  };

  // 7. COUNTDOWN COMPLETED
  const handleCountdownComplete = () => {
    socketClient.startGame();
    setMatchState('playing');
  };

  // 8. MATCH ENDED (PODIUM / TOURNAMENT SCORING)
  const handleMatchEnd = (results: MatchResults) => {
    setMatchResults(results);
    socketClient.endGame(results);

    // If active tournament, compute cumulative tournament standings
    if (tournamentMode !== 'single' && playlistSequence.length > 1) {
      const tourneyRes = tournamentEngine.recordRoundResults(results);
      setTournamentState(tourneyRes.state);
      setMatchState('results');
    } else {
      setMatchState('results');
    }
  };

  // 9. ADVANCE FROM PODIUM TO TOURNAMENT STANDINGS
  const handleContinueTournament = () => {
    setShowTournamentLeaderboard(true);
  };

  // 10. ADVANCE TO NEXT TOURNAMENT ROUND
  const handleTournamentNextRound = () => {
    soundManager.stopAllSounds();
    const next = tournamentEngine.advanceToNextRound();
    if (next && room) {
      const nextGame = next.nextGame;
      setTournamentState(tournamentEngine.getState());
      setRoom((prev) => (prev ? { ...prev, selectedGame: nextGame } : prev));
      socketClient.selectGame(nextGame);
      setShowTournamentLeaderboard(false);
      setMatchResults(null);
      setMatchState('countdown');
      socketClient.startCountdown();
    }
  };

  // 11. RESTART TOURNAMENT
  const handleRestartTournament = () => {
    soundManager.stopAllSounds();
    if (!room) return;
    const newState = tournamentEngine.initTournament(tournamentMode, room.players, playlistSequence);
    setTournamentState(newState);
    const firstGame = newState.gameSequence[0];
    setRoom((prev) => (prev ? { ...prev, selectedGame: firstGame } : prev));
    socketClient.selectGame(firstGame);
    setShowTournamentLeaderboard(false);
    setMatchResults(null);
    setMatchState('countdown');
    socketClient.startCountdown();
  };

  // 12. PLAY AGAIN (SINGLE MATCH)
  const handlePlayAgain = () => {
    soundManager.stopAllSounds();
    setMatchResults(null);
    setMatchState('countdown');
    socketClient.startCountdown();
  };

  // 13. RETURN TO LOBBY
  const handleReturnToLobby = () => {
    soundManager.stopAllSounds();
    setMatchResults(null);
    setShowTournamentLeaderboard(false);
    setTournamentState(null);
    tournamentEngine.reset();
    setMatchState('lobby');
    socketClient.returnToLobby();
  };

  // 14. LEAVE / BACK TO HUB
  const handleLeaveToHub = () => {
    soundManager.stopAllSounds();
    setRoom(null);
    setMatchState('idle');
    setMatchResults(null);
    setShowTournamentLeaderboard(false);
    setTournamentState(null);
    tournamentEngine.reset();
    setCurrentTab('hub');
  };

  // 15. PLAYER CONTROLLER: Join Room via Phone (WebRTC P2P to TV + Socket fallback)
  const handleJoinParty = async (data: {
    code: string;
    name: string;
    avatar: string;
    color: string;
    skin: string;
  }): Promise<{ success: boolean; error?: string }> => {
    // 1. Try Socket Server first
    try {
      const res = await socketClient.joinRoom(data);
      if (res.success && res.room) {
        setRoom(res.room);
        setPlayerId(res.playerId || `p_${Date.now()}`);
        soundManager.playVictoryFanfare();
        return { success: true };
      }
    } catch {}

    // 2. Connect directly to TV/Host Browser via Serverless WebRTC P2P
    try {
      const { p2pClient } = await import('./multiplayer/P2PClient');
      const p2pRes = await p2pClient.connectToHost(data.code, data);
      if (p2pRes.success && p2pRes.room) {
        setRoom(p2pRes.room);
        setPlayerId(p2pRes.playerId || `p_${Date.now()}`);
        soundManager.playVictoryFanfare();

        // Listen for host P2P broadcasts
        p2pClient.on('game-selected', ({ gameId, room }) => setRoom(room));
        p2pClient.on('countdown-started', () => setMatchState('countdown'));
        p2pClient.on('game-started', ({ room }) => {
          setRoom(room);
          setMatchState('playing');
        });
        p2pClient.on('game-ended', ({ results }) => {
          setMatchResults(results);
          setMatchState('results');
        });
        p2pClient.on('returned-to-lobby', ({ room }) => {
          setRoom(room);
          setMatchResults(null);
          setMatchState('lobby');
        });

        return { success: true };
      }
      return { success: false, error: p2pRes.error || 'Party code not found on host screen.' };
    } catch (e: any) {
      return { success: false, error: 'Could not connect to Host TV. Verify party code.' };
    }
  };

  // 16. PLAYER CONTROLLER: Send Input (P2P Direct WebRTC with Socket fallback)
  const handleSendInput = (input: ControllerInput) => {
    // Direct P2P send to TV host
    if (p2pClient.isConnected) {
      p2pClient.sendInput(input);
      return;
    }
    socketClient.sendInput(input);
  };

  return (
    <div className="min-h-screen bg-arcade-bg text-arcade-cream relative overflow-x-hidden flex flex-col justify-between">
      {/* Subtle CRT Overlay Scanlines */}
      <CRTOverlay />

      {/* 0. SUPER CINEMATIC PRODUCT INTRO AD & 3-SEC VOICEOVER */}
      {showLandingIntro && (
        <LandingIntroAd
          onEnter={() => {
            try { sessionStorage.setItem('hypercade_visited', 'true'); } catch {}
            setShowLandingIntro(false);
          }}
        />
      )}

      {/* Top Navbar */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          if (matchState !== 'playing') {
            setCurrentTab(tab);
          }
        }}
        inGame={matchState === 'playing'}
        room={room}
      />

      {/* Main Viewport Router */}
      <main className="flex-1 relative z-10">
        {/* TAB 1: HUB (ARCADE LAUNCHER) */}
        {currentTab === 'hub' && (
          <HubView
            onPlayGame={handleQuickPlay}
            onHostGame={handleHostCreateParty}
            onJoinParty={() => setCurrentTab('join')}
            onViewLeaderboards={() => setCurrentTab('leaderboards')}
            onReplayIntro={() => setShowLandingIntro(true)}
          />
        )}

        {/* TAB 2: HOST (TV / BIG SCREEN) */}
        {currentTab === 'host' && room && (
          <>
            {matchState === 'lobby' && (
              <HostLobbyView
                room={room}
                tournamentMode={tournamentMode}
                playlistSequence={playlistSequence}
                onSelectTournamentMode={handleSelectTournamentMode}
                onSelectGame={handleSelectGame}
                onUpdateBots={handleUpdateBots}
                onUpdateDifficulty={handleUpdateDifficulty}
                onStartMatch={handleStartMatch}
                onKickPlayer={(pid) => socketClient.kickPlayer(pid)}
                onLeaveLobby={handleLeaveToHub}
              />
            )}

            {matchState === 'playing' && (
              <HostGameView
                room={room}
                remoteInputsRef={remoteInputsRef}
                remoteInputs={remoteInputsRef.current}
                onBroadcastHUDState={(hud) => socketClient.broadcastGameState({ hud: { [hud.playerId]: hud } })}
                onGameEvent={(evt) => socketClient.sendGameEvent(evt)}
                onMatchEnd={handleMatchEnd}
                onReturnToLobby={handleReturnToLobby}
              />
            )}
          </>
        )}

        {/* TAB 3: CONTROLLER (PHONE / MOBILE BROWSER) */}
        {currentTab === 'join' && (
          <ControllerView
            initialCode={urlJoinCode}
            room={room}
            playerId={playerId}
            inGame={matchState === 'playing'}
            gameId={room?.selectedGame || 'serpent-arena'}
            hudState={hudState}
            allHudStates={allHudStates}
            onJoin={handleJoinParty}
            onSendInput={handleSendInput}
            onLeave={() => {
              setPlayerId(null);
              setRoom(null);
              setCurrentTab('hub');
            }}
          />
        )}

        {/* TAB 4: LEADERBOARDS */}
        {currentTab === 'leaderboards' && <LeaderboardsView />}

        {/* TAB 5: PILOT PROFILE & ACHIEVEMENTS */}
        {currentTab === 'profile' && <ProfileView />}
      </main>

      {/* COUNTDOWN OVERLAY */}
      {matchState === 'countdown' && (
        <CountdownOverlay onComplete={handleCountdownComplete} />
      )}

      {/* PODIUM RESULTS MODAL */}
      {matchState === 'results' && matchResults && !showTournamentLeaderboard && (
        <PodiumModal
          results={matchResults}
          isHost={currentTab === 'host' || !playerId}
          tournament={tournamentState}
          onPlayAgain={handlePlayAgain}
          onContinueTournament={handleContinueTournament}
          onReturnToLobby={handleReturnToLobby}
        />
      )}

      {/* TOURNAMENT LEADERBOARD / GRAND CHAMPIONSHIP MODAL */}
      {showTournamentLeaderboard && tournamentState && (
        <TournamentLeaderboardModal
          state={tournamentState}
          isHost={currentTab === 'host' || !playerId}
          onNextRound={handleTournamentNextRound}
          onRestartTournament={handleRestartTournament}
          onReturnToLobby={handleReturnToLobby}
        />
      )}

      {/* Minimal Footer */}
      {currentTab !== 'join' && matchState !== 'playing' && (
        <footer className="w-full border-t border-white/5 py-4 px-6 text-center text-xs font-mono text-arcade-cream-muted/70 flex flex-col sm:flex-row items-center justify-between gap-2 max-w-7xl mx-auto">
          <span>🕹️ HYPERCADE PARTY ENGINE &bull; 60 FPS AUTHORITATIVE REALTIME SIMULATION</span>
          <span>5 ORIGINAL MULTIPLAYER MODES &bull; ZERO DOWNLOADS NEEDED</span>
        </footer>
      )}
    </div>
  );
};

export default App;
