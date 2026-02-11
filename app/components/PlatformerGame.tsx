'use client';

import { useEffect, useRef, useState } from 'react';

type GameState = 'DIALOGUE' | 'PLAYING';

interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface Platform extends Rect {
    type: 'ground' | 'platform' | 'hazard';
}

interface LevelData {
    spawn: { x: number; y: number };
    platforms: Platform[];
    dialogue: string;
}

interface Cloud {
    x: number;
    y: number;
    speed: number;
    scale: number;
}

interface Obstacle extends Rect {
    kind: 'rock' | 'crate' | 'spike';
}

const PLAYER_SIZE = 80;
const GROUND_HEIGHT = 50;
const GRAVITY = 0.6;
const JUMP_FORCE = -14;
const BASE_RUN_SPEED = 6;
const ROAD_TILE_WIDTH = 370;
const ROAD_TILE_OVERLAP = 0;
const OBSTACLE_MIN_GAP = 300;
const OBSTACLE_MAX_GAP = 600;
const OBSTACLE_MIN_HEIGHT = 24;
const OBSTACLE_MAX_HEIGHT = 55;
const OBSTACLE_MIN_WIDTH = 20;
const OBSTACLE_MAX_WIDTH = 50;
const SCORE_PER_PIXEL = 0.05;

// Level 1 Data
const LEVEL_1: LevelData = {
    spawn: { x: 50, y: 400 },
    dialogue: "Adventure begins! Press Space to start riding (and jump)!",
    platforms: [
        // Ground - Infinite-ish Road (rendered as visible tiles only)
        { x: 0, y: 0, width: 1_000_000_000, height: GROUND_HEIGHT, type: 'ground' },
    ]
};

function resolvePlatformsForCanvas(level: LevelData, canvasHeight: number): Platform[] {
    return level.platforms.map((plat) => {
        if (plat.type !== 'ground') return plat;
        return {
            ...plat,
            y: canvasHeight - plat.height,
        };
    });
}

export default function PlatformerGame() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Game State
    const [gameState, setGameState] = useState<GameState>('DIALOGUE');
    const currentLevel = LEVEL_1;
    const [score, setScore] = useState(0);
    const [maxScore, setMaxScore] = useState(0);

    // Assets
    const cloudImg = useRef<HTMLImageElement | null>(null);
    const roadImg = useRef<HTMLImageElement | null>(null); // New Asset
    const playerImg = useRef<HTMLImageElement | null>(null);
    const jumpSound = useRef<HTMLAudioElement | null>(null);

    // Physics Refs
    const playerRef = useRef({ x: 0, y: 0, vx: 0, vy: 0, isGrounded: false });
    const keysRef = useRef<{ [key: string]: boolean }>({});
    const requestIdRef = useRef<number>(0);
    const hasStartedRef = useRef(false);
    const jumpRequestedRef = useRef(false);
    const obstaclesRef = useRef<Obstacle[]>([]);
    const nextObstacleXRef = useRef(600);
    const lastPlayerXRef = useRef(0);
    const scoreAccumRef = useRef(0);
    const scoreRef = useRef(0);

    // Ambient
    const cloudsRef = useRef<Cloud[]>([]);

    // Init Assets
    useEffect(() => {
        const img = new Image();
        img.src = '/cloud_pixel.png';
        cloudImg.current = img;

        const rImg = new Image();
        rImg.src = '/world1_road.png';
        roadImg.current = rImg;

        const pImg = new Image();
        pImg.src = '/bhondu.png';
        playerImg.current = pImg;

        // Load jump sound
        const audio = new Audio('/sound/jump.wav');
        jumpSound.current = audio;

        // Init Clouds
        cloudsRef.current = Array.from({ length: 8 }).map(() => ({
            x: Math.random() * window.innerWidth,
            y: Math.random() * 200, // Top part of screen
            speed: 0.2 + Math.random() * 0.5,
            scale: 0.5 + Math.random() * 1
        }));
    }, []);

    // Init Level
    useEffect(() => {
        const level = LEVEL_1;
        playerRef.current = {
            x: level.spawn.x,
            y: level.spawn.y,
            vx: 0,
            vy: 0,
            isGrounded: false
        };
        hasStartedRef.current = false;
        jumpRequestedRef.current = false;
        obstaclesRef.current = [];
        nextObstacleXRef.current = 0;
        lastPlayerXRef.current = level.spawn.x;
        scoreAccumRef.current = 0;
        setScore(0);
        scoreRef.current = 0;
    }, []);

    // Load max score
    useEffect(() => {
        const stored = typeof window !== 'undefined' ? window.localStorage.getItem('platformer.maxScore') : null;
        if (stored) {
            const value = Number.parseInt(stored, 10);
            if (!Number.isNaN(value)) setMaxScore(value);
        }
    }, []);

    // Persist max score
    useEffect(() => {
        if (score > maxScore) {
            setMaxScore(score);
            if (typeof window !== 'undefined') {
                window.localStorage.setItem('platformer.maxScore', String(score));
            }
        }
    }, [score, maxScore]);

    // Input Handlers
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            keysRef.current[e.code] = true;

            if (e.code === 'Space') {
                // Space starts the forward movement.
                hasStartedRef.current = true;
                jumpRequestedRef.current = true;

                // Also allow Space to dismiss the dialogue overlay.
                if (gameState === 'DIALOGUE') setGameState('PLAYING');
            }
        };
        const handleKeyUp = (e: KeyboardEvent) => { keysRef.current[e.code] = false; };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [gameState]);

    // Main Game Loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', resize);
        resize();


        const loop = () => {
            if (!canvas || !ctx) return;

            const level = LEVEL_1;
            const platforms = resolvePlatformsForCanvas(level, canvas.height);

            // --- UPDATE ---

            // Move Clouds
            cloudsRef.current.forEach(cloud => {
                cloud.x -= cloud.speed;
                if (cloud.x + 200 < 0) cloud.x = canvas.width + Math.random() * 200;
            });

            // Update Physics ONLY if Playing
            if (gameState === 'PLAYING') {
                const p = playerRef.current;

                // Auto-run forward (starts after first Space press)
                if (hasStartedRef.current) {
                    p.vx = BASE_RUN_SPEED;
                    p.x += p.vx;
                } else {
                    p.vx = 0;
                }

                // Score based on distance traveled (Dino-like)
                if (hasStartedRef.current) {
                    const dx = Math.max(0, p.x - lastPlayerXRef.current);
                    if (dx > 0) {
                        scoreAccumRef.current += dx * SCORE_PER_PIXEL;
                        const nextScore = Math.floor(scoreAccumRef.current);
                        if (nextScore !== scoreRef.current) {
                            scoreRef.current = nextScore;
                            setScore(nextScore);
                        }
                    }
                }
                lastPlayerXRef.current = p.x;

                // Gravity
                p.vy += GRAVITY;
                p.y += p.vy;

                // Jump (edge-triggered via keydown)
                if (jumpRequestedRef.current && p.isGrounded) {
                    p.vy = JUMP_FORCE;
                    p.isGrounded = false;
                    jumpRequestedRef.current = false;
                    
                    // Play jump sound
                    if (jumpSound.current) {
                        jumpSound.current.currentTime = 0;
                        jumpSound.current.play().catch(() => {
                            // Ignore if sound fails to play
                        });
                    }
                }

                // If Space was pressed mid-air, clear the request so it doesn't auto-jump on landing.
                if (jumpRequestedRef.current && !p.isGrounded && !keysRef.current['Space']) {
                    jumpRequestedRef.current = false;
                }

                // Platform Collisions
                p.isGrounded = false;

                for (const plat of platforms) {
                    // Check vertical landing
                    if (
                        p.x + PLAYER_SIZE > plat.x &&
                        p.x < plat.x + plat.width &&
                        p.y + PLAYER_SIZE >= plat.y &&
                        p.y + PLAYER_SIZE <= plat.y + 20 && // Landing threshold
                        p.vy >= 0
                    ) {
                        p.y = plat.y - PLAYER_SIZE;
                        p.vy = 0;
                        p.isGrounded = true;
                    }
                }

                // Spawn obstacles ahead as player progresses (off-screen to the right)
                if (hasStartedRef.current) {
                    const spawnStart = p.x + canvas.width + 200;
                    if (nextObstacleXRef.current < spawnStart) {
                        nextObstacleXRef.current = spawnStart;
                    }
                    while (nextObstacleXRef.current < p.x + canvas.width * 2) {
                        const width = OBSTACLE_MIN_WIDTH + Math.random() * (OBSTACLE_MAX_WIDTH - OBSTACLE_MIN_WIDTH);
                        const height = OBSTACLE_MIN_HEIGHT + Math.random() * (OBSTACLE_MAX_HEIGHT - OBSTACLE_MIN_HEIGHT);
                        obstaclesRef.current.push({
                            x: nextObstacleXRef.current,
                            y: 0, // will be placed on ground in render
                            width,
                            height,
                            kind: Math.random() < 0.5 ? 'rock' : Math.random() < 0.5 ? 'crate' : 'spike'
                        });
                        const gap = OBSTACLE_MIN_GAP + Math.random() * (OBSTACLE_MAX_GAP - OBSTACLE_MIN_GAP);
                        nextObstacleXRef.current += gap;
                    }
                }

                // Collision with obstacles
                const ground = platforms.find(plat => plat.type === 'ground');
                if (ground) {
                    const groundY = ground.y;
                    for (const obs of obstaclesRef.current) {
                        const obsY = groundY - obs.height;
                        if (
                            p.x < obs.x + obs.width &&
                            p.x + PLAYER_SIZE > obs.x &&
                            p.y < obsY + obs.height &&
                            p.y + PLAYER_SIZE > obsY
                        ) {
                            // Reset on hit
                            p.x = level.spawn.x;
                            p.y = level.spawn.y;
                            p.vx = 0;
                            p.vy = 0;
                            hasStartedRef.current = false;
                            obstaclesRef.current = [];
                            nextObstacleXRef.current = 0;
                            lastPlayerXRef.current = p.x;
                            scoreAccumRef.current = 0;
                            scoreRef.current = 0;
                            setScore(0);
                            break;
                        }
                    }
                }

                // Fall off world
                if (p.y > canvas.height + 100) {
                    // Respawn
                    p.x = level.spawn.x;
                    p.y = level.spawn.y;
                    p.vx = 0;
                    p.vy = 0;
                }
            }

            // --- RENDER ---
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Camera Transform
            const p = playerRef.current;
            // Keep the world origin anchored to the left edge at the start.
            // (Don’t allow positive cameraX, which would push the level right and show empty space on the left.)
            const cameraX = Math.min(0, -p.x + canvas.width / 5); // offset player to left, clamped

            // Sky
            ctx.fillStyle = '#87CEEB';
            ctx.fillRect(0, 0, canvas.width, canvas.height); // Fixed background

            // Clouds (World 1 Only)
            if (cloudImg.current) {
                cloudsRef.current.forEach(cloud => {
                    const w = 100 * cloud.scale;
                    const h = 60 * cloud.scale; // Aspect ratio approx
                    ctx.drawImage(cloudImg.current!, cloud.x, cloud.y, w, h);
                });
            }

            ctx.save();
            ctx.translate(cameraX, 0);

            // Draw Level (World Space)

            // Platforms
            platforms.forEach(plat => {
                if (plat.type === 'ground' && roadImg.current) {
                    // Tile only the visible road range (keeps World 1 effectively infinite and fast)
                    const tileWidth = ROAD_TILE_WIDTH;
                    const overlap = ROAD_TILE_OVERLAP;
                    const effectiveWidth = tileWidth - overlap;
                    const aspect = roadImg.current.height / roadImg.current.width;
                    const roadHeight = tileWidth * aspect;
                    const roadY = plat.y + plat.height - roadHeight; // anchor to ground bottom

                    const viewLeft = -cameraX;
                    const viewRight = viewLeft + canvas.width;
                    const drawLeft = Math.max(plat.x, viewLeft - tileWidth * 2);
                    const drawRight = Math.min(plat.x + plat.width, viewRight + tileWidth * 2);

                    const startI = Math.floor((drawLeft - plat.x) / effectiveWidth);
                    const endI = Math.ceil((drawRight - plat.x) / effectiveWidth);

                    for (let i = startI; i <= endI; i++) {
                        const x = plat.x + i * effectiveWidth;
                        if (x + tileWidth < drawLeft || x > drawRight) continue;
                        ctx.drawImage(roadImg.current, x, roadY, tileWidth, roadHeight);
                    }
                } else {
                    const viewLeft = -cameraX;
                    const viewRight = viewLeft + canvas.width;
                    const x = Math.max(plat.x, viewLeft);
                    const w = Math.min(plat.x + plat.width, viewRight) - x;
                    if (w <= 0) return;
                    ctx.fillStyle = '#654321';
                    ctx.fillRect(x, plat.y, w, plat.height);
                }
            });

            // Obstacles
            const ground = platforms.find(plat => plat.type === 'ground');
            if (ground) {
                const groundY = ground.y;
                const viewLeft = -cameraX;
                const viewRight = viewLeft + canvas.width;
                obstaclesRef.current = obstaclesRef.current.filter(obs => obs.x + obs.width > viewLeft - 400);
                obstaclesRef.current.forEach(obs => {
                    if (obs.x > viewRight + 400) return;
                    const obsY = groundY - obs.height;
                    ctx.fillStyle = obs.kind === 'spike' ? '#B91C1C' : obs.kind === 'crate' ? '#8B5A2B' : '#4B5563';
                    ctx.fillRect(obs.x, obsY, obs.width, obs.height);
                });
            }

            // Player (Bike)
            if (playerImg.current) {
                const playerHeight = PLAYER_SIZE;
                const playerWidth = (playerImg.current.width / playerImg.current.height) * playerHeight;
                const playerYOffset = -10;
                ctx.drawImage(playerImg.current, p.x, p.y - playerYOffset, playerWidth, playerHeight);
            } else {
                ctx.fillStyle = 'red';
                ctx.fillRect(p.x, p.y, PLAYER_SIZE, PLAYER_SIZE);
            }

            ctx.restore();

            requestIdRef.current = requestAnimationFrame(loop);
        };

        requestIdRef.current = requestAnimationFrame(loop);
        return () => {
            window.removeEventListener('resize', resize);
            cancelAnimationFrame(requestIdRef.current);
        };
    }, [gameState]);

    return (
        <div className="relative w-full h-screen bg-black">
            <canvas ref={canvasRef} className="block w-full h-full" />

            {/* UI Overlays */}

            {gameState === 'DIALOGUE' && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-8 z-10 transition-opacity duration-500">
                    <div className="bg-white p-8 rounded-lg max-w-lg text-center shadow-xl border-4 border-blue-500">
                        <h2 className="text-2xl font-bold mb-4 text-black font-mono">MISSION BRIEF</h2>
                        <p className="text-lg text-gray-800 mb-6 font-sans">{currentLevel.dialogue}</p>
                        <button
                            onClick={() => setGameState('PLAYING')}
                            className="px-6 py-3 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 font-mono shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase"
                        >
                            Start Ride
                        </button>
                    </div>
                </div>
            )}

            {/* HUD */}
            <div className="absolute top-4 left-4 text-white font-bold text-xl drop-shadow-[2px_2px_0_rgba(0,0,0,1)] font-mono">
                WORLD 1
            </div>
            <div className="absolute top-4 right-4 text-white font-bold text-xl drop-shadow-[2px_2px_0_rgba(0,0,0,1)] font-mono">
                SCORE {score} · MAX {maxScore}
            </div>
        </div>
    );
}
