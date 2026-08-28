import { RoomState, Player, GameId } from '../types';

export class LocalRoomEngine {
  public static createLocalRoom(selectedGame: GameId = 'serpent-arena', botCount: number = 3): RoomState {
    const code = 'LOCAL';
    const localHostPlayer: Player = {
      id: 'p_host_local',
      socketId: 'local_host',
      name: 'Player 1 (Host)',
      avatar: 'ship',
      color: '#00F5A0',
      skin: 'synth',
      isHost: true,
      isBot: false,
      isReady: true,
      score: 0,
      ping: 0,
      connected: true,
      lastActive: Date.now(),
    };

    const players: Record<string, Player> = {
      [localHostPlayer.id]: localHostPlayer,
    };

    return {
      code,
      hostSocketId: 'local_host',
      selectedGame,
      state: 'lobby',
      players,
      botCount,
      config: {
        roundDuration: 90,
        difficulty: 'normal',
        powerupsEnabled: true,
      },
      createdAt: Date.now(),
    };
  }

  public static generateBots(count: number, existingPlayers: Record<string, Player>, defaultDifficulty: 'easy' | 'medium' | 'hard' = 'medium'): Record<string, Player> {
    const BOT_NAMES = ['ViperBot', 'CyberGhost', 'NeonGlider', 'TitanUnit', 'VoidStalker', 'ArcadeReaper', 'ShadowPulse'];
    const BOT_AVATARS = ['robot', 'skull', 'alien', 'flame', 'spark', 'diamond', 'crown'];
    const BOT_COLORS = ['#FF3366', '#FFB224', '#00E5FF', '#9D4EDD', '#00F5A0', '#FF7700', '#3A86FF'];
    const BOT_ARCHETYPES: Array<'aggressive' | 'defensive' | 'collector' | 'ambusher' | 'chaotic'> = [
      'aggressive', 'defensive', 'collector', 'ambusher', 'chaotic'
    ];

    const result: Record<string, Player> = { ...existingPlayers };

    // Remove old bots
    for (const key in result) {
      if (result[key].isBot) {
        delete result[key];
      }
    }

    for (let i = 0; i < count; i++) {
      const botId = `bot_${i + 1}`;
      const name = BOT_NAMES[i % BOT_NAMES.length];
      const avatar = BOT_AVATARS[i % BOT_AVATARS.length];
      const color = BOT_COLORS[i % BOT_COLORS.length];
      const archetype = BOT_ARCHETYPES[i % BOT_ARCHETYPES.length];

      result[botId] = {
        id: botId,
        socketId: `socket_${botId}`,
        name: `[AI] ${name}`,
        avatar,
        color,
        skin: 'synth',
        isHost: false,
        isBot: true,
        botArchetype: archetype,
        difficulty: defaultDifficulty,
        isReady: true,
        score: 0,
        ping: 0,
        connected: true,
        lastActive: Date.now(),
      };
    }

    return result;
  }
}
