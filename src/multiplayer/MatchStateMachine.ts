import { MatchState } from '../types';

export type StateChangeCallback = (newState: MatchState, prevState: MatchState, payload?: any) => void;

export interface StateTransitionRecord {
  from: MatchState;
  to: MatchState;
  timestamp: number;
  reason?: string;
  isForcedDev?: boolean;
}

export class MatchStateMachine {
  private state: MatchState = 'idle';
  private transitionHistory: StateTransitionRecord[] = [];
  private listeners: Set<StateChangeCallback> = new Set();

  /**
   * Valid transition matrix enforcing strict game lifecycle flow:
   * LOBBY -> COUNTDOWN -> PLAYING -> FINAL_DUEL -> ENDING -> RESULTS -> (NEXT_ROUND/COUNTDOWN or LOBBY)
   */
  private static readonly ALLOWED_TRANSITIONS: Record<MatchState, MatchState[]> = {
    idle: ['lobby', 'countdown', 'playing'],
    lobby: ['countdown', 'playing', 'idle'],
    countdown: ['playing', 'lobby', 'idle'],
    playing: ['final_duel', 'ending', 'results', 'lobby', 'idle'],
    final_duel: ['ending', 'results', 'playing', 'lobby', 'idle'],
    ending: ['results', 'lobby', 'idle'],
    results: ['countdown', 'lobby', 'idle', 'playing'],
  };

  constructor(initialState: MatchState = 'idle') {
    this.state = initialState;
    this.recordTransition('idle', initialState, 'Initial state');
  }

  public getState(): MatchState {
    return this.state;
  }

  public canTransitionTo(targetState: MatchState): boolean {
    if (this.state === targetState) return true;
    const allowed = MatchStateMachine.ALLOWED_TRANSITIONS[this.state] || [];
    return allowed.includes(targetState);
  }

  /**
   * Performs an authoritative state transition with validation.
   * Returns true if transition succeeded, false if rejected.
   */
  public transitionTo(targetState: MatchState, reason?: string, payload?: any): boolean {
    if (this.state === targetState) {
      return true;
    }

    if (!this.canTransitionTo(targetState)) {
      console.warn(
        `[MatchStateMachine]: Illegal transition from '${this.state}' to '${targetState}' blocked. Allowed: [${(
          MatchStateMachine.ALLOWED_TRANSITIONS[this.state] || []
        ).join(', ')}]`
      );
      return false;
    }

    const prevState = this.state;
    this.state = targetState;
    this.recordTransition(prevState, targetState, reason, false);
    this.notifyListeners(targetState, prevState, payload);
    return true;
  }

  /**
   * Developer / QA override to force transition even if outside normal lifecycle.
   */
  public forceTransition(targetState: MatchState, reason: string = 'DEV_QA_OVERRIDE', payload?: any): void {
    const prevState = this.state;
    this.state = targetState;
    this.recordTransition(prevState, targetState, reason, true);
    this.notifyListeners(targetState, prevState, payload);
  }

  public onStateChange(callback: StateChangeCallback): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  public getHistory(): StateTransitionRecord[] {
    return [...this.transitionHistory];
  }

  public reset(state: MatchState = 'idle'): void {
    const prev = this.state;
    this.state = state;
    this.transitionHistory = [];
    this.recordTransition(prev, state, 'Reset');
    this.notifyListeners(state, prev);
  }

  // Quick State Queries
  public get isIdle(): boolean { return this.state === 'idle'; }
  public get isLobby(): boolean { return this.state === 'lobby'; }
  public get isCountdown(): boolean { return this.state === 'countdown'; }
  public get isPlaying(): boolean { return this.state === 'playing'; }
  public get isFinalDuel(): boolean { return this.state === 'final_duel'; }
  public get isEnding(): boolean { return this.state === 'ending'; }
  public get isResults(): boolean { return this.state === 'results'; }
  public get isInGame(): boolean { return this.state === 'playing' || this.state === 'final_duel' || this.state === 'ending'; }

  private recordTransition(from: MatchState, to: MatchState, reason?: string, isForcedDev?: boolean): void {
    this.transitionHistory.push({
      from,
      to,
      timestamp: Date.now(),
      reason,
      isForcedDev,
    });
    if (this.transitionHistory.length > 50) {
      this.transitionHistory.shift();
    }
  }

  private notifyListeners(newState: MatchState, prevState: MatchState, payload?: any): void {
    this.listeners.forEach((cb) => {
      try {
        cb(newState, prevState, payload);
      } catch (err) {
        console.error('[MatchStateMachine]: Error in state change listener', err);
      }
    });
  }
}
