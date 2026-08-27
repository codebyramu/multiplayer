import React, { useState, useEffect } from 'react';
import { GameId, RoomState, Player, ControllerInput, MatchResults, PlayerClientHUDState, TournamentMode, TournamentState } from './types';
import { socketClient } from './multiplayer/SocketClient';
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
  // Landing Intro State
  const [showLandingIntro, setShowLandingIntro] = useState<boolean>(() => {
    try {
      return !sessionStorage.getItem('hypercade_visited');
    } catch {
      return true;
    }
  });

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
  const [remoteInputs, setRemoteInputs] = useState<Record<string, ControllerInput>>({});

  // WebRTC Peer-to-Peer Direct DataChannel Managers
  const hostWebRTCRef = React.useRef<WebRTCManager | null>(null);
  const clientWebRTCRef = React.useRef<WebRTCManager | null>(null);

  // Setup Host WebRTC on Host view
  useEffect(() => {
    if (currentTab === 'host') {
      hostWebRTCRef.current = new WebRTCManager(true, (pid, input) => {
        setRemoteInputs((prev) => ({ ...prev, [pid]: input }));
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
      setRemoteInputs((prev) => ({
        ...prev,
        [data.playerId]: data.input,
      }));
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
      unbindSyncGameState();
      unbindGameEnded();
      unbindReturnedLobby();
      unbindMapVoted();
    };
  }, [playerId]);

  // --- ACTIONS --- //

  // 1. HOST: Create Room
  const handleHostCreateParty = async (selectedGame?: string) => {
    soundManager.playClick(900);
    const validGame = (selectedGame as GameId) || 'serpent-arena';
    // Create room on socket server
    const res = await socketClient.createRoom(validGame);
    if (res.success && res.room) {
      const roomWithBots = {
        ...res.room,
        localIp: res.localIp,
        selectedGame: validGame,
        players: LocalRoomEngine.generateBots(res.room.botCount || 3, res.room.players),
      };
      setRoom(roomWithBots);
      setMatchState('lobby');
      setCurrentTab('host');
    } else {
      // Offline fallback: Use Local Room Engine
      const localRoom = LocalRoomEngine.createLocalRoom(validGame, 3);
      const roomWithBots = {
        ...localRoom,
        players: LocalRoomEngine.generateBots(3, localRoom.players),
      };
      setRoom(roomWithBots);
      setMatchState('lobby');
      setCurrentTab('host');
    }
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
    const updatedPlayers = LocalRoomEngine.generateBots(count, room.players);
    setRoom((prev) => (prev ? { ...prev, botCount: count, players: updatedPlayers } : prev));
    tournamentEngine.syncPlayers(updatedPlayers);
  };

  // 5b. HOST: Update Bot Difficulty
  const handleUpdateDifficulty = (difficulty: 'easy' | 'normal' | 'hard' | 'extreme') => {
    if (!room) return;
    socketClient.updateSettings(room.botCount, { difficulty });
    setRoom((prev) => (prev ? { ...prev, config: { ...prev.config, difficulty } } : prev));
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
    setMatchResults(null);
    setMatchState('countdown');
    socketClient.startCountdown();
  };

  // 13. RETURN TO LOBBY
  const handleReturnToLobby = () => {
    setMatchResults(null);
    setShowTournamentLeaderboard(false);
    setTournamentState(null);
    tournamentEngine.reset();
    setMatchState('lobby');
    socketClient.returnToLobby();
  };

  // 14. LEAVE / BACK TO HUB
  const handleLeaveToHub = () => {
    setRoom(null);
    setMatchState('idle');
    setMatchResults(null);
    setShowTournamentLeaderboard(false);
    setTournamentState(null);
    tournamentEngine.reset();
    setCurrentTab('hub');
  };

  // 15. PLAYER CONTROLLER: Join Room via Phone
  const handleJoinParty = async (data: {
    code: string;
    name: string;
    avatar: string;
    color: string;
    skin: string;
  }): Promise<{ success: boolean; error?: string }> => {
    const res = await socketClient.joinRoom(data);
    if (res.success && res.room) {
      setRoom(res.room);
      setPlayerId(res.playerId || `p_${Date.now()}`);
      soundManager.playVictoryFanfare();

      // Establish direct peer-to-peer WebRTC DataChannel
      try {
        const clientRTC = new WebRTCManager(false);
        clientWebRTCRef.current = clientRTC;
        clientRTC.connectAsClient();
      } catch {}

      return { success: true };
    }
    return { success: false, error: res.error || 'Unable to connect to room. Verify code and network.' };
  };

  // 16. PLAYER CONTROLLER: Send Input (WebRTC DataChannel with WebSocket fallback)
  const handleSendInput = (input: ControllerInput) => {
    const sentViaRTC = clientWebRTCRef.current?.sendInputDirect(input);
    if (!sentViaRTC) {
      socketClient.sendInput(input);
    }
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
                remoteInputs={remoteInputs}
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
