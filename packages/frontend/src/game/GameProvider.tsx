import React, { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import Phaser from 'phaser';

type GameContextValue = {
  gameRef: React.MutableRefObject<Phaser.Game | null>;
  containerRef: React.MutableRefObject<HTMLDivElement | null>;
};

const GameContext = createContext<GameContextValue | null>(null);

export function useGameContext(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGameContext must be used within GameProvider');
  return ctx;
}

export type GameProviderProps = {
  config: Phaser.Types.Core.GameConfig;
  children?: React.ReactNode;
};

export function GameProvider({ config, children }: GameProviderProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  // Memoize config but always ensure parent is current container
  const resolvedConfig = useMemo(
    () => ({
      ...config,
      parent: containerRef.current ?? undefined,
    }),
    [config],
  );

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;
    // Skip real game init in Vitest/jsdom
    const isJsdom = typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent || '');
    if (isJsdom) return;
    const game = new Phaser.Game({ ...resolvedConfig, parent: containerRef.current });
    gameRef.current = game;
    // Expose for smoke/E2E checks and log engine version once
    try {
      (window as any)._phaserGame = game;
      console.info('[phaser] version', (Phaser as any)?.VERSION ?? 'unknown');
    } catch (e) {
      void e;
    }
    return () => {
      game.destroy(true);
      gameRef.current = null;
    };
  }, [resolvedConfig]);

  const value = useMemo(() => ({ gameRef, containerRef }), []);

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function GameCanvas(props: React.HTMLAttributes<HTMLDivElement>) {
  const { containerRef } = useGameContext();
  return <div ref={containerRef} {...props} />;
}
