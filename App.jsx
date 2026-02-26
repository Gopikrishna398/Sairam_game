import React, { useEffect, useRef, useState } from "react";

const BIRD_SIZE = 84;
const BIRD_X = 90;

const GRAVITY = 1799;
const JUMP_FORCE = -520;

const OBSTACLE_WIDTH = 78;
const GAP_SIZE = 220;
const OBSTACLE_SPEED = 190;
const SPAWN_INTERVAL = 1.45;
const INITIAL_SPAWN_PROGRESS = 1.05;
const OBSTACLE_SPAWN_OFFSET = 10;

const BG_SCROLL_SPEED = 42;
const HIGH_SCORE_KEY = "flappy_high_score_v1";

const getViewportSize = () => ({
  width: window.innerWidth,
  height: window.innerHeight,
});

const makeInitialGameState = (gameHeight, gameWidth) => ({
  started: false,
  running: false,
  gameOver: false,
  birdY: gameHeight * 0.45,
  birdVY: 0,
  obstacles: [],
  spawnTimer: INITIAL_SPAWN_PROGRESS,
  score: 0,
  bgOffset: 0,
  gameWidth,
  gameHeight,
});

const randomGapY = (gameHeight) => {
  const padding = 130;
  return padding + Math.random() * (gameHeight - padding * 2);
};

const intersects = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export default function App({
  birdImage,
  obstacleImage,
  obstacleTopImage,
  obstacleBottomImage,
  collisionSound,
}) {
  const [game, setGame] = useState(() => {
    const { width, height } = getViewportSize();
    return makeInitialGameState(height, width);
  });
  const gameRef = useRef(game);

  const [highScore, setHighScore] = useState(() => {
    const saved = Number(localStorage.getItem(HIGH_SCORE_KEY) || 0);
    return Number.isFinite(saved) ? saved : 0;
  });

  const rafRef = useRef(0);
  const lastTimeRef = useRef(0);
  const obstacleIdRef = useRef(1);

  const collisionAudioRef = useRef(null);
  const collisionPlayedRef = useRef(false);

  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  useEffect(() => {
    if (!collisionSound) {
      collisionAudioRef.current = null;
      return;
    }
    const audio = new Audio(collisionSound);
    audio.preload = "auto";
    audio.load();
    collisionAudioRef.current = audio;
  }, [collisionSound]);

  useEffect(() => {
    localStorage.setItem(HIGH_SCORE_KEY, String(highScore));
  }, [highScore]);

  useEffect(() => {
    const onResize = () => {
      const { width, height } = getViewportSize();
      safeSetGame((prev) => ({
        ...prev,
        gameWidth: width,
        gameHeight: height,
      }));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const safeSetGame = (updater) => {
    setGame((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      gameRef.current = next;
      return next;
    });
  };

  const playCollisionOnce = () => {
    if (collisionPlayedRef.current) return;
    collisionPlayedRef.current = true;
    const audio = collisionAudioRef.current;
    if (!audio) return;
    audio.volume = 1;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  };

  const startFromIdle = (withJump = true) => {
    collisionPlayedRef.current = false;
    const { width, height } = getViewportSize();
    safeSetGame(() => {
      const next = {
        ...makeInitialGameState(height, width),
        started: true,
        running: true,
        gameOver: false,
        birdVY: withJump ? JUMP_FORCE : 0,
      };
      obstacleIdRef.current = 1;
      return next;
    });
  };

  const restartGame = () => {
    collisionPlayedRef.current = false;
    obstacleIdRef.current = 1;
    const { width, height } = getViewportSize();
    safeSetGame({
      ...makeInitialGameState(height, width),
      started: true,
      running: true,
      gameOver: false,
      birdVY: 0,
    });
  };

  const jump = () => {
    const g = gameRef.current;
    if (!g.started) {
      startFromIdle(true);
      return;
    }
    if (!g.running) return;
    safeSetGame((prev) => ({ ...prev, birdVY: JUMP_FORCE }));
  };

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code === "Space") {
        e.preventDefault();
        jump();
      } else if (e.code === "KeyR") {
        e.preventDefault();
        restartGame();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const frame = (time) => {
      if (!lastTimeRef.current) lastTimeRef.current = time;
      const dt = Math.min((time - lastTimeRef.current) / 1000, 0.033);
      lastTimeRef.current = time;

      const g = gameRef.current;
      let next = g;

      if (g.running) {
        const gameWidth = g.gameWidth;
        const gameHeight = g.gameHeight;
        const birdVY = g.birdVY + GRAVITY * dt;
        const birdYRaw = g.birdY + birdVY * dt;
        const birdY = Math.max(0, Math.min(gameHeight - BIRD_SIZE, birdYRaw));

        let spawnTimer = g.spawnTimer + dt;
        let obstacles = g.obstacles.map((o) => ({ ...o, x: o.x - OBSTACLE_SPEED * dt }));

        if (spawnTimer >= SPAWN_INTERVAL) {
          spawnTimer = 0;
          obstacles.push({
            id: obstacleIdRef.current++,
            x: gameWidth + OBSTACLE_SPAWN_OFFSET,
            gapY: randomGapY(gameHeight),
            passed: false,
          });
        }

        obstacles = obstacles.filter((o) => o.x + OBSTACLE_WIDTH > -20);

        let score = g.score;
        for (const o of obstacles) {
          if (!o.passed && o.x + OBSTACLE_WIDTH < BIRD_X) {
            o.passed = true;
            score += 1;
          }
        }

        const birdRect = { x: BIRD_X, y: birdY, w: BIRD_SIZE, h: BIRD_SIZE };
        let hit = false;

        for (const o of obstacles) {
          const topH = Math.max(0, o.gapY - GAP_SIZE / 2);
          const bottomY = o.gapY + GAP_SIZE / 2;
          const bottomH = Math.max(0, gameHeight - bottomY);

          const topRect = { x: o.x, y: 0, w: OBSTACLE_WIDTH, h: topH };
          const bottomRect = { x: o.x, y: bottomY, w: OBSTACLE_WIDTH, h: bottomH };

          if (intersects(birdRect, topRect) || intersects(birdRect, bottomRect)) {
            hit = true;
            break;
          }
        }

        let running = g.running;
        let gameOver = g.gameOver;

        if (hit) {
          running = false;
          gameOver = true;
          playCollisionOnce();
        }

        const bgOffset = g.bgOffset - BG_SCROLL_SPEED * dt;

        next = {
          ...g,
          birdY,
          birdVY,
          obstacles,
          spawnTimer,
          score,
          running,
          gameOver,
          bgOffset,
        };

        if (score > highScore) {
          setHighScore(score);
        }
      } else {
        next = { ...g, bgOffset: g.bgOffset - BG_SCROLL_SPEED * dt * 0.35 };
      }

      if (next !== g) {
        gameRef.current = next;
        setGame(next);
      }

      rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [highScore]);

  const birdTilt = Math.max(-25, Math.min(55, game.birdVY * 0.06));

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        body {
          margin: 0;
          font-family: "Trebuchet MS", "Segoe UI", sans-serif;
          background: radial-gradient(circle at 20% 20%, #dff4ff 0%, #a7d9ff 50%, #7db8ef 100%);
        }
        .game-shell {
          width: 100vw;
          height: 100vh;
          position: relative;
          overflow: hidden;
          user-select: none;
          touch-action: manipulation;
          cursor: pointer;
        }
        .sky {
          position: absolute;
          inset: 0;
          background-image:
            radial-gradient(circle at 20% 25%, rgba(255,255,255,0.9) 0 10%, transparent 12%),
            radial-gradient(circle at 70% 18%, rgba(255,255,255,0.85) 0 11%, transparent 13%),
            radial-gradient(circle at 45% 42%, rgba(255,255,255,0.75) 0 8%, transparent 10%),
            linear-gradient(180deg, #8dd7ff 0%, #75c9ff 50%, #5ab5f4 100%);
          background-size: 320px 220px, 360px 240px, 280px 180px, 100% 100%;
          background-repeat: repeat-x, repeat-x, repeat-x, no-repeat;
          will-change: background-position;
        }
        .score {
          position: absolute;
          top: 10px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 20;
          font-size: 34px;
          font-weight: 900;
          color: #ffffff;
          text-shadow: 0 2px 8px rgba(0,0,0,0.35);
          letter-spacing: 1px;
        }
        .high-score {
          position: absolute;
          top: 52px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 20;
          color: rgba(255,255,255,0.95);
          font-size: 14px;
          font-weight: 700;
          text-shadow: 0 1px 4px rgba(0,0,0,0.35);
        }
        .bird {
          position: absolute;
          width: ${BIRD_SIZE}px;
          height: ${BIRD_SIZE}px;
          object-fit: contain;
          z-index: 12;
          border: 2px solid rgba(255, 255, 255, 0.95);
          border-radius: 50%;
          filter: drop-shadow(0 4px 6px rgba(0,0,0,0.25));
          will-change: transform, top, left;
          pointer-events: none;
        }
        .obstacle {
          position: absolute;
          width: ${OBSTACLE_WIDTH}px;
          object-fit: cover;
          z-index: 10;
          pointer-events: none;
          border: 1px solid rgba(255, 255, 255, 0.9);
          border-radius: 4px;
          filter: drop-shadow(0 6px 4px rgba(0,0,0,0.15));
        }
        .obstacle-top {
          object-position: top center;
        }
        .obstacle-bottom {
          object-position: bottom center;
        }
        .overlay {
          position: absolute;
          inset: 0;
          z-index: 30;
          background: rgba(11, 41, 70, 0.45);
          backdrop-filter: blur(2px);
          display: grid;
          place-items: center;
          text-align: center;
          color: #fff;
          padding: 20px;
        }
        .panel {
          background: rgba(10, 36, 62, 0.78);
          border: 1px solid rgba(255,255,255,0.22);
          border-radius: 14px;
          padding: 20px 18px;
          width: min(320px, 86%);
          box-shadow: 0 14px 24px rgba(0,0,0,0.25);
        }
        .title {
          margin: 0 0 10px;
          font-size: 30px;
          font-weight: 900;
          letter-spacing: 1px;
        }
        .msg {
          margin: 5px 0;
          font-size: 15px;
          opacity: 0.95;
          line-height: 1.4;
        }
        .ground {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 18px;
          background:
            repeating-linear-gradient(
              90deg,
              #6bbb53 0 24px,
              #79c861 24px 48px
            );
          border-top: 2px solid rgba(255,255,255,0.45);
          z-index: 14;
        }
      `}</style>

      <div
        className="game-shell"
        onMouseDown={(e) => {
          e.preventDefault();
          jump();
        }}
        onTouchStart={(e) => {
          e.preventDefault();
          jump();
        }}
      >
        <div
          className="sky"
          style={{
            backgroundPositionX: `${game.bgOffset}px, ${game.bgOffset * 0.8}px, ${game.bgOffset * 1.2}px, 0px`,
          }}
        />

        <div className="score">{game.score}</div>
        <div className="high-score">High Score: {highScore}</div>

        {game.obstacles.map((o) => {
          const topHeight = Math.max(0, o.gapY - GAP_SIZE / 2);
          const bottomY = o.gapY + GAP_SIZE / 2;
          const bottomHeight = Math.max(0, game.gameHeight - bottomY);
          const topObstacleSrc = obstacleTopImage || obstacleImage;
          const bottomObstacleSrc = obstacleBottomImage || obstacleImage;
          const shouldFlipTop = !obstacleTopImage;

          return (
            <React.Fragment key={o.id}>
              <img
                className="obstacle obstacle-top"
                src={topObstacleSrc}
                alt="obstacle-top"
                draggable="false"
                style={{
                  left: o.x,
                  top: -2,
                  height: topHeight + 2,
                  transform: shouldFlipTop ? "scaleY(-1)" : "none",
                  transformOrigin: "center",
                }}
              />
              <img
                className="obstacle obstacle-bottom"
                src={bottomObstacleSrc}
                alt="obstacle-bottom"
                draggable="false"
                style={{
                  left: o.x,
                  top: bottomY,
                  height: bottomHeight + 2,
                }}
              />
            </React.Fragment>
          );
        })}

        <img
          className="bird"
          src={birdImage}
          alt="bird"
          draggable="false"
          style={{
            left: BIRD_X,
            top: game.birdY,
            transform: `rotate(${birdTilt}deg)`,
          }}
        />

        <div className="ground" />

        {!game.started && (
          <div className="overlay">
            <div className="panel">
              <h1 className="title">Flappy Sky</h1>
              <p className="msg">Tap / Click / Space to Start and Jump</p>
              <p className="msg">Press R to Restart Anytime</p>
            </div>
          </div>
        )}

        {game.gameOver && (
          <div className="overlay">
            <div className="panel">
              <h1 className="title">Game Over</h1>
              <p className="msg">Score: {game.score}</p>
              <p className="msg">High Score: {highScore}</p>
              <p className="msg">Press R to Restart</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
