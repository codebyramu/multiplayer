import { GameId, MatchResults, Player, TournamentMode, TournamentRoundHistory, TournamentStanding, TournamentState } from '../types';

export type { TournamentMode, TournamentRoundHistory, TournamentStanding, TournamentState };

export const ALL_GAMES: GameId[] = [
  'neon-relay',
  'void-tag',
  'relic-rush',
  'last-platform',
  'serpent-arena',
];

export const TOURNAMENT_POINTS_TABLE: Record<number, number> = {
  1: 10,
  2: 7,
  3: 5,
  4: 3,
};

export class TournamentEngine {
  private state: TournamentState;

  constructor() {
    this.state = this.createDefaultState('single');
  }

  private createDefaultState(mode: TournamentMode = 'single'): TournamentState {
    return {
      mode,
      currentRound: 1,
      totalRounds: 1,
      gameSequence: ['serpent-arena'],
      isActive: false,
      isComplete: false,
      standings: [],
      roundHistory: [],
      grandChampion: null,
    };
  }

  /**
   * Calculate tournament points awarded based on match finish rank
   * 1st = 10 pts, 2nd = 7 pts, 3rd = 5 pts, 4th = 3 pts, 5th+ = 1 pt
   */
  public static getPointsForRank(rank: number): number {
    if (rank <= 0) return 0;
    if (rank in TOURNAMENT_POINTS_TABLE) {
      return TOURNAMENT_POINTS_TABLE[rank];
    }
    return 1; // 5th place and below gets 1 pt
  }

  /**
   * Randomly pick a game from the 5 Hypercade arenas
   */
  public static pickRandomGame(exclude?: GameId | GameId[]): GameId {
    const excludes = Array.isArray(exclude) ? exclude : exclude ? [exclude] : [];
    const pool = ALL_GAMES.filter((g) => !excludes.includes(g));
    const finalPool = pool.length > 0 ? pool : ALL_GAMES;
    return finalPool[Math.floor(Math.random() * finalPool.length)];
  }

  /**
   * Generate an arena playlist sequence for a tournament mode
   */
  public static generateSequence(
    mode: TournamentMode,
    customCount?: number,
    initialGame?: GameId
  ): GameId[] {
    const shuffle = <T>(array: T[]): T[] => {
      const copy = [...array];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    };

    switch (mode) {
      case 'single':
        return [initialGame || 'serpent-arena'];

      case 'best_of_3': {
        const shuffled = shuffle(ALL_GAMES);
        if (initialGame) {
          const others = shuffled.filter((g) => g !== initialGame);
          return [initialGame, ...others.slice(0, 2)];
        }
        return shuffled.slice(0, 3);
      }

      case 'best_of_5': {
        if (initialGame) {
          const others = ALL_GAMES.filter((g) => g !== initialGame);
          return [initialGame, ...shuffle(others)];
        }
        return shuffle(ALL_GAMES);
      }

      case 'all_5':
        return [...ALL_GAMES];

      case 'mystery': {
        const count = customCount || 3;
        const seq: GameId[] = [];
        for (let i = 0; i < count; i++) {
          const prev = seq[i - 1];
          seq.push(TournamentEngine.pickRandomGame(prev));
        }
        return seq;
      }

      case 'custom':
      default:
        return initialGame ? [initialGame] : ['serpent-arena'];
    }
  }

  /**
   * Initialize a new Tournament with players and game playlist
   */
  public initTournament(
    mode: TournamentMode,
    players: Record<string, Player>,
    customSequence?: GameId[]
  ): TournamentState {
    const sequence =
      customSequence && customSequence.length > 0
        ? [...customSequence]
        : TournamentEngine.generateSequence(mode);

    const standings: TournamentStanding[] = Object.values(players).map((p) => ({
      playerId: p.id,
      name: p.name,
      avatar: p.avatar || 'ship',
      color: p.color || '#00F5A0',
      isBot: p.isBot,
      botArchetype: p.botArchetype,
      totalPoints: 0,
      pointsGainedLastRound: 0,
      roundPlacements: [],
      roundScores: [],
      wins: 0,
      podiums: 0,
      rank: 1,
    }));

    this.state = {
      mode,
      currentRound: 1,
      totalRounds: sequence.length,
      gameSequence: sequence,
      isActive: mode !== 'single' && sequence.length > 1,
      isComplete: false,
      standings,
      roundHistory: [],
      grandChampion: null,
    };

    return this.getState();
  }

  /**
   * Sync active room players with tournament standings (e.g. if bots/players joined or left)
   */
  public syncPlayers(players: Record<string, Player>): void {
    const existingMap = new Map(this.state.standings.map((s) => [s.playerId, s]));
    const updatedStandings: TournamentStanding[] = [];

    // Keep existing standings, update names/avatars/colors
    for (const pid in players) {
      const p = players[pid];
      if (existingMap.has(pid)) {
        const existing = existingMap.get(pid)!;
        updatedStandings.push({
          ...existing,
          name: p.name,
          avatar: p.avatar,
          color: p.color,
          isBot: p.isBot,
          botArchetype: p.botArchetype,
        });
        existingMap.delete(pid);
      } else {
        // New player joined during tournament
        updatedStandings.push({
          playerId: p.id,
          name: p.name,
          avatar: p.avatar || 'ship',
          color: p.color || '#00F5A0',
          isBot: p.isBot,
          botArchetype: p.botArchetype,
          totalPoints: 0,
          pointsGainedLastRound: 0,
          roundPlacements: [],
          roundScores: [],
          wins: 0,
          podiums: 0,
          rank: updatedStandings.length + 1,
        });
      }
    }

    // Keep disconnected players in history with their earned points
    existingMap.forEach((disconnectedStanding) => {
      updatedStandings.push(disconnectedStanding);
    });

    this.state.standings = this.sortStandings(updatedStandings);
  }

  /**
   * Record match results for the current round and compute cumulative standings
   */
  public recordRoundResults(results: MatchResults): {
    state: TournamentState;
    pointsAwarded: Record<string, number>;
    isComplete: boolean;
    grandChampion: TournamentStanding | null;
  } {
    const pointsAwarded: Record<string, number> = {};
    const standingsMap = new Map(this.state.standings.map((s) => [s.playerId, { ...s }]));

    // Distribute points according to finish rank in match
    results.rankings.forEach((r, idx) => {
      const placement = r.rank || idx + 1;
      const pts = TournamentEngine.getPointsForRank(placement);
      pointsAwarded[r.id] = pts;

      let standing = standingsMap.get(r.id);
      if (!standing) {
        // Register player if missing
        standing = {
          playerId: r.id,
          name: r.name,
          avatar: r.avatar || 'ship',
          color: r.color || '#00F5A0',
          isBot: r.isBot,
          totalPoints: 0,
          pointsGainedLastRound: 0,
          roundPlacements: [],
          roundScores: [],
          wins: 0,
          podiums: 0,
          rank: 1,
        };
        standingsMap.set(r.id, standing);
      }

      standing.pointsGainedLastRound = pts;
      standing.totalPoints += pts;
      standing.roundPlacements.push(placement);
      standing.roundScores.push(r.score || 0);

      if (placement === 1) standing.wins += 1;
      if (placement <= 3) standing.podiums += 1;
    });

    // For any player who didn't play in this round, mark 0 points gained
    standingsMap.forEach((s, pid) => {
      if (!(pid in pointsAwarded)) {
        s.pointsGainedLastRound = 0;
        pointsAwarded[pid] = 0;
      }
    });

    // Sort and calculate updated ranks
    const sortedStandings = this.sortStandings(Array.from(standingsMap.values()));

    // Record round in history
    const roundHistoryItem: TournamentRoundHistory = {
      roundNumber: this.state.currentRound,
      gameId: results.gameId,
      results,
      pointsAwarded,
    };

    const isComplete = this.state.currentRound >= this.state.totalRounds;
    const grandChampion = isComplete && sortedStandings.length > 0 ? sortedStandings[0] : null;

    this.state = {
      ...this.state,
      standings: sortedStandings,
      roundHistory: [...this.state.roundHistory, roundHistoryItem],
      isComplete,
      grandChampion,
    };

    return {
      state: this.getState(),
      pointsAwarded,
      isComplete,
      grandChampion,
    };
  }

  /**
   * Advance to next round in sequence
   */
  public advanceToNextRound(): {
    nextGame: GameId;
    currentRound: number;
    totalRounds: number;
  } | null {
    if (this.state.currentRound >= this.state.totalRounds) {
      this.state.isComplete = true;
      return null;
    }

    this.state.currentRound += 1;
    const nextGame = this.getCurrentGame();

    return {
      nextGame,
      currentRound: this.state.currentRound,
      totalRounds: this.state.totalRounds,
    };
  }

  /**
   * Get current game in tournament sequence
   */
  public getCurrentGame(): GameId {
    const idx = Math.max(0, this.state.currentRound - 1);
    return this.state.gameSequence[idx] || 'serpent-arena';
  }

  /**
   * Get next game in sequence (if available)
   */
  public getNextGame(): GameId | null {
    const nextIdx = this.state.currentRound;
    if (nextIdx >= this.state.gameSequence.length) {
      return null;
    }
    return this.state.gameSequence[nextIdx];
  }

  /**
   * Sort standings by:
   * 1. Total Tournament Points (desc)
   * 2. Total Wins (desc)
   * 3. Total Podiums (desc)
   * 4. Total Raw Match Scores (desc)
   */
  public static getSortedStandings(standings: TournamentStanding[]): TournamentStanding[] {
    const sorted = [...(standings || [])].sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) {
        return b.totalPoints - a.totalPoints;
      }
      if (b.wins !== a.wins) {
        return b.wins - a.wins;
      }
      if (b.podiums !== a.podiums) {
        return b.podiums - a.podiums;
      }
      const rawA = (a.roundScores || []).reduce((sum, s) => sum + s, 0);
      const rawB = (b.roundScores || []).reduce((sum, s) => sum + s, 0);
      return rawB - rawA;
    });

    return sorted.map((s, idx) => ({
      ...s,
      rank: idx + 1,
    }));
  }

  private sortStandings(standings: TournamentStanding[]): TournamentStanding[] {
    return TournamentEngine.getSortedStandings(standings);
  }

  public getState(): TournamentState {
    return {
      ...this.state,
      standings: this.state.standings.map((s) => ({ ...s })),
      roundHistory: [...this.state.roundHistory],
      gameSequence: [...this.state.gameSequence],
    };
  }

  public getStandings(): TournamentStanding[] {
    return this.state.standings.map((s) => ({ ...s }));
  }

  public getGrandChampion(): TournamentStanding | null {
    return this.state.grandChampion ? { ...this.state.grandChampion } : null;
  }

  public isTournamentActive(): boolean {
    return this.state.isActive && !this.state.isComplete;
  }

  public isTournamentComplete(): boolean {
    return this.state.isComplete;
  }

  public reset(): void {
    this.state = this.createDefaultState('single');
  }
}

export const tournamentEngine = new TournamentEngine();
