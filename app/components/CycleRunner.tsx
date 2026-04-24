'use client';

import { useEffect, useRef, useState } from 'react';

type GameState = 'START' | 'PLAYING' | 'GAME_OVER';

interface Entity {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface Player extends Entity {
    vy: number;
    isJumping: boolean;
}

interface Obstacle extends Entity {
    passed: boolean;
}

export default function CycleRunner() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [gameState, setGameState] = useState<GameState>('START');
    const [score, setScore] = useState(0);

    // Game Constants
    const GRAVITY = 0.6;
    const JUMP_STRENGTH = -12;
    const GAME_SPEED = 6;
    const GROUND_HEIGHT = 50;

    // Refs for game loop state (to avoid closure staleness in loop)
    const playerRef = useRef<Player>({
        x: 50,
        y: 0, // Will be set in init
        width: 40,
        height: 40,
        vy: 0,
        isJumping: false,
    });

    const obstaclesRef = useRef<Obstacle[]>([]);
    const frameRef = useRef<number>(0);
    const requestIdRef = useRef<number>(0);
    const scoreRef = useRef<number>(0);

    const initGame = (canvas: HTMLCanvasElement) => {
        const groundY = canvas.height - GROUND_HEIGHT;
        playerRef.current = {
            x: 50,
            y: groundY - 40,
            width: 40,
            height: 40,
            vy: 0,
            isJumping: false,
        };
        obstaclesRef.current = [];
        scoreRef.current = 0;
        frameRef.current = 0;
        setScore(0);
    };

    const jump = () => {
        if (gameState !== 'PLAYING') return;

        // Allow jump only if on ground (simple check)
        if (!playerRef.current.isJumping) {
            playerRef.current.vy = JUMP_STRENGTH;
            playerRef.current.isJumping = true;
        }
    };

    const handleInput = () => {
        if (gameState === 'START' || gameState === 'GAME_OVER') {
            const canvas = canvasRef.current;
            if (canvas) {
                initGame(canvas);
                setGameState('PLAYING');
            }
        } else {
            jump();
        }
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set canvas size
        const resizeCanvas = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            // Re-adjust player Y if resizing happens during waiting state
            if (gameState === 'START') {
                initGame(canvas);
            }
        };

        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();
        initGame(canvas);

        const checkCollision = (p: Player, o: Obstacle) => {
            return (
                p.x < o.x + o.width &&
                p.x + p.width > o.x &&
                p.y < o.y + o.height &&
                p.y + p.height > o.y
            );
        };

        const loop = () => {
            if (!ctx || !canvas) return;

            if (gameState === 'PLAYING') {
                frameRef.current++;
                scoreRef.current += 0.1; // Distance based score
                setScore(Math.floor(scoreRef.current));

                const groundY = canvas.height - GROUND_HEIGHT;

                // --- UPDATE ---

                // Player Physics
                const p = playerRef.current;
                p.vy += GRAVITY;
                p.y += p.vy;

                // Ground Collision
                if (p.y + p.height >= groundY) {
                    p.y = groundY - p.height;
                    p.vy = 0;
                    p.isJumping = false;
                }

                // Spawn Obstacles
                // Randomly spawn between 100-200 frames
                if (frameRef.current % 120 === 0 && Math.random() > 0.3) {
                    obstaclesRef.current.push({
                        x: canvas.width,
                        y: groundY - 40 + (Math.random() > 0.8 ? -50 : 0), // Occasional flying obstacle or ground size variation
                        width: 30,
                        height: 40 + (Math.random() * 20),
                        passed: false,
                    });
                }

                // Update Obstacles
                for (let i = obstaclesRef.current.length - 1; i >= 0; i--) {
                    const obs = obstaclesRef.current[i];
                    obs.x -= GAME_SPEED;

                    if (checkCollision(p, obs)) {
                        setGameState('GAME_OVER');
                        return; // Stop loop
                    }

                    if (obs.x + obs.width < 0) {
                        obstaclesRef.current.splice(i, 1);
                    }
                }
            }

            // --- DRAW ---
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Sky
            ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--sky-day').trim() || '#87CEEB';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Ground
            ctx.fillStyle = '#654321';
            ctx.fillRect(0, canvas.height - GROUND_HEIGHT, canvas.width, GROUND_HEIGHT);
            // Grass top
            ctx.fillStyle = '#228B22';
            ctx.fillRect(0, canvas.height - GROUND_HEIGHT, canvas.width, 10);

            // Player
            const p = playerRef.current;
            ctx.fillStyle = 'blue';
            ctx.fillRect(p.x, p.y, p.width, p.height);

            // Obstacles
            ctx.fillStyle = 'red';
            obstaclesRef.current.forEach(obs => {
                ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
            });

            // UI Text
            ctx.fillStyle = 'white';
            ctx.font = '24px Arial';
            ctx.fillText(`Distance: ${Math.floor(scoreRef.current)}m`, 20, 40);

            if (gameState === 'START') {
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = 'white';
                ctx.font = '40px Arial';
                ctx.textAlign = 'center';
                ctx.fillText("Cycle Story", canvas.width / 2, canvas.height / 2 - 40);
                ctx.font = '20px Arial';
                ctx.fillText("Tap or Press Space to Start", canvas.width / 2, canvas.height / 2 + 10);
            }

            if (gameState === 'GAME_OVER') {
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = 'white';
                ctx.font = '40px Arial';
                ctx.textAlign = 'center';
                ctx.fillText("Game Over", canvas.width / 2, canvas.height / 2 - 40);
                ctx.font = '20px Arial';
                ctx.fillText(`Final Distance: ${Math.floor(scoreRef.current)}m`, canvas.width / 2, canvas.height / 2 + 10);
                ctx.fillText("Tap to Restart", canvas.width / 2, canvas.height / 2 + 50);
            }

            requestIdRef.current = requestAnimationFrame(loop);
        };

        requestIdRef.current = requestAnimationFrame(loop);

        return () => {
            window.removeEventListener('resize', resizeCanvas);
            cancelAnimationFrame(requestIdRef.current);
        };
    }, [gameState]);

    // Input Listeners
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space' || e.code === 'ArrowUp') {
                handleInput();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [gameState]); // Re-bind when state changes to capture correct 'handleInput' context if needed, though handles mostly internally

    return (
        <div className="w-full h-screen overflow-hidden bg-black touch-none relative">
            <canvas
                ref={canvasRef}
                className="block w-full h-full"
                onClick={handleInput}
            />
            <div className="absolute top-4 left-4 font-bold text-xl rainbow-text drop-shadow-[2px_2px_0_rgba(0,0,0,1)] font-mono">
                {Math.floor(score)}m
            </div>
        </div>
    );
}
