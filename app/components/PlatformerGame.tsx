'use client';

import { useEffect, useRef, useState } from 'react';

type GameState = 'DIALOGUE' | 'PLAYING' | 'LEVEL_COMPLETE' | 'CODE_INPUT' | 'GAME_OVER' | 'VICTORY';

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
    goal: { x: number; y: number };
    platforms: Platform[];
    dialogue: string;
}

interface Cloud {
    x: number;
    y: number;
    speed: number;
    scale: number;
}

const PLAYER_SIZE = 80;
const GROUND_HEIGHT = 50;
const GRAVITY = 0.6;
const JUMP_FORCE = -14;
const MOVE_SPEED = 5;
const FRICTION = 0.8;
const WORLD_2_CODE = "MARIO";

// Level 1 Data
const LEVEL_1: LevelData = {
    spawn: { x: 50, y: 400 },
    goal: { x: 2000, y: 450 },
    dialogue: "Adventure begins! Use Arrow Keys to move and Space to Jump!",
    platforms: [
        // Ground - Straight Road
        { x: 0, y: 0, width: 2500, height: GROUND_HEIGHT, type: 'ground' },
    ]
};

// Level 2 Data
const LEVEL_2: LevelData = {
    spawn: { x: 50, y: 400 },
    goal: { x: 2500, y: 350 },
    dialogue: "World 2! It's much simpler here, but watch your step.",
    platforms: [
        // Ground - Straight Road
        { x: 0, y: 0, width: 3000, height: GROUND_HEIGHT, type: 'ground' },
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
    const [currentWorld, setCurrentWorld] = useState(1);
    const [gameState, setGameState] = useState<GameState>('DIALOGUE');
    const [codeInput, setCodeInput] = useState('');
    const [codeError, setCodeError] = useState(false);

    const currentLevel = currentWorld === 1 ? LEVEL_1 : LEVEL_2;

    // Assets
    const cloudImg = useRef<HTMLImageElement | null>(null);
    const roadImg = useRef<HTMLImageElement | null>(null); // New Asset
    const shahadImg = useRef<HTMLImageElement | null>(null);
    const playerImg = useRef<HTMLImageElement | null>(null);

    // Physics Refs
    const playerRef = useRef({ x: 0, y: 0, vx: 0, vy: 0, isGrounded: false });
    const keysRef = useRef<{ [key: string]: boolean }>({});
    const requestIdRef = useRef<number>(0);

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

        const sImg = new Image();
        sImg.src = '/shahad.png';
        shahadImg.current = sImg;

        const pImg = new Image();
        pImg.src = '/bhondu.png';
        playerImg.current = pImg;

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
        const level = currentWorld === 1 ? LEVEL_1 : LEVEL_2;
        playerRef.current = {
            x: level.spawn.x,
            y: level.spawn.y,
            vx: 0,
            vy: 0,
            isGrounded: false
        };
    }, [currentWorld]);

    // Input Handlers
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => { keysRef.current[e.code] = true; };
        const handleKeyUp = (e: KeyboardEvent) => { keysRef.current[e.code] = false; };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

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

            const level = currentWorld === 1 ? LEVEL_1 : LEVEL_2;
            const platforms = resolvePlatformsForCanvas(level, canvas.height);

            // --- UPDATE ---

            // Move Clouds (World 1 only)
            if (currentWorld === 1) {
                cloudsRef.current.forEach(cloud => {
                    cloud.x -= cloud.speed;
                    if (cloud.x + 200 < 0) cloud.x = canvas.width + Math.random() * 200;
                });
            }

            // Update Physics ONLY if Playing
            if (gameState === 'PLAYING') {
                const p = playerRef.current;

                // Horizontal Movement
                if (keysRef.current['ArrowRight']) p.vx += 3.0;
                if (keysRef.current['ArrowLeft']) p.vx -= 3.0;

                // Friction & Cap
                p.vx *= FRICTION;
                p.x += p.vx;

                // Gravity
                p.vy += GRAVITY;
                p.y += p.vy;

                // Jump
                if (keysRef.current['Space'] && p.isGrounded) {
                    p.vy = JUMP_FORCE;
                    p.isGrounded = false;
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

                // Fall off world
                if (p.y > canvas.height + 100) {
                    // Respawn
                    p.x = level.spawn.x;
                    p.y = level.spawn.y;
                    p.vx = 0;
                    p.vy = 0;
                }

                // Win Condition
                if (p.x >= level.goal.x) {
                    if (currentWorld === 1) {
                        setGameState('LEVEL_COMPLETE');
                    } else {
                        setGameState('VICTORY');
                    }
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
            if (currentWorld === 1 && cloudImg.current) {
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
                if (currentWorld === 1 && plat.type === 'ground' && roadImg.current) {
                    // Tile the road image with overlap to hide borders
                    const tileSize = GROUND_HEIGHT;
                    const overlap = 2; // Overlap to hide seams/borders
                    // Calculate number of tiles needed based on effective width (tileSize - overlap)
                    const effectiveWidth = tileSize - overlap;
                    const numTiles = Math.ceil(plat.width / effectiveWidth);

                    for (let i = 0; i < numTiles; i++) {
                        // Draw tiles slightly closer together
                        ctx.drawImage(roadImg.current, plat.x + (i * effectiveWidth), plat.y, tileSize, plat.height);
                    }
                } else {
                    ctx.fillStyle = '#654321';
                    ctx.fillRect(plat.x, plat.y, plat.width, plat.height);
                }
            });

            // World 1 Start Sign
            if (currentWorld === 1 && shahadImg.current) {
                const ground = platforms.find(plat => plat.type === 'ground');
                if (ground) {
                    const signHeight = 120;
                    const signWidth = (shahadImg.current.width / shahadImg.current.height) * signHeight;
                    const signX = 120;
                    const signY = ground.y - signHeight + 10;
                    ctx.drawImage(shahadImg.current, signX, signY, signWidth, signHeight);
                }
            }

            // Goal
            ctx.fillStyle = 'gold';
            ctx.fillRect(level.goal.x, level.goal.y - 50, 50, 50);

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
    }, [gameState, currentWorld]);

    // Code Submit
    const handleCodeSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (codeInput.toUpperCase() === WORLD_2_CODE) {
            setCurrentWorld(2);
            setCodeInput('');
            setGameState('DIALOGUE'); // Will trigger level 2 dialogue
        } else {
            setCodeError(true);
        }
    };

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

            {gameState === 'LEVEL_COMPLETE' && (
                <div className="absolute inset-0 bg-green-900/90 flex items-center justify-center p-8 z-10">
                    <div className="bg-white p-8 rounded-lg max-w-md text-center shadow-xl border-4 border-green-600">
                        <h2 className="text-2xl font-bold mb-4 text-black font-mono">CHECKPOINT REACHED</h2>
                        <p className="text-gray-700 mb-4">Enter the secret code to unlock World 2.</p>
                        <p className="text-sm text-gray-500 mb-4">(Hint: It&apos;s the name of the most famous plumber)</p>

                        <form onSubmit={handleCodeSubmit} className="flex flex-col gap-4">
                            <input
                                type="text"
                                value={codeInput}
                                onChange={(e) => { setCodeInput(e.target.value); setCodeError(false); }}
                                className="border-2 border-gray-300 p-2 text-xl text-center text-black uppercase rounded font-mono"
                                placeholder="ENTER CODE"
                                autoFocus
                            />
                            {codeError && <p className="text-red-600 font-bold">Incorrect Code! Try again.</p>}
                            <button type="submit" className="px-6 py-3 bg-green-600 text-white font-bold rounded hover:bg-green-700 font-mono shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                UNLOCK WORLD 2
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {gameState === 'VICTORY' && (
                <div className="absolute inset-0 bg-yellow-900/90 flex items-center justify-center z-10">
                    <div className="text-center text-white">
                        <h1 className="text-6xl font-bold mb-4 font-mono text-yellow-300 drop-shadow-[5px_5px_0_rgba(0,0,0,1)]">YOU WIN!</h1>
                        <p className="text-2xl mb-8">You have conquered both worlds.</p>
                        <button
                            onClick={() => { setCurrentWorld(1); setGameState('DIALOGUE'); }}
                            className="px-8 py-4 bg-white text-yellow-900 font-bold rounded text-xl font-mono shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-y-1 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
                        >
                            PLAY AGAIN
                        </button>
                    </div>
                </div>
            )}

            {/* HUD */}
            <div className="absolute top-4 left-4 text-white font-bold text-xl drop-shadow-[2px_2px_0_rgba(0,0,0,1)] font-mono">
                WORLD {currentWorld}
            </div>
        </div>
    );
}
