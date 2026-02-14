'use client';

import NextImage from 'next/image';
import { useEffect, useRef, useState } from 'react';

type GameState = 'DIALOGUE' | 'PLAYING' | 'KANDIVALI_DIALOGUE' | 'DEAD';

interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface Platform extends Rect {
    type: 'ground' | 'platform' | 'hazard';
}

interface DialogueLine {
    speaker: string;
    text: string;
}

interface LevelData {
    spawn: { x: number; y: number };
    platforms: Platform[];
    dialogue: DialogueLine[];
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

type LandmarkKind = 'moviemax' | 'rcity' | 'betterhome' | 'kandivali';

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
const OBSTACLE_VERTICAL_OFFSET = 8;
const DAY_NIGHT_DISTANCE = 24_000;
const SCORE_PER_PIXEL = 0.05;
const TREEHOUSE_HEIGHT = 450;
const TREEHOUSE_X = 50;
const TYPEWRITER_MS = 24;

const LANDMARK_HEIGHTS: Record<LandmarkKind, number> = {
    moviemax: 280,
    rcity: 220,
    betterhome: 300,
    kandivali: 190,
};

const LANDMARK_SCORES_IN_ORDER: Array<{ kind: LandmarkKind; score: number }> = [
    { kind: 'moviemax', score: 450 },
    { kind: 'rcity', score: 900 },
    { kind: 'betterhome', score: 1300 },
    { kind: 'kandivali', score: 1750 }, // Kandivali appears after 1700
];

const KANDIVALI_MONOLOGUE: DialogueLine[] = [
    {
        speaker: 'JKG Moki',
        text: 'Bhondu... all this way, through storms and fear, I was trying to be brave for you. But the truth is, every second beside you made my heart louder than the whole city.'
    },
    {
        speaker: 'JKG Moki',
        text: 'I-I... I kept rehearsing this in my head a thousand times, and still I am stuttering now. I sex you.'
    },
    {
        speaker: 'JKG Moki',
        text: 'We have reached "ghar"... but on this journey I realized the real ghar was always you. So, ghar... let\'s go on this infinite journey together?'
    },
];

const SKY_KEYFRAMES = [
    { at: 0, top: '#87CEEB', bottom: '#BEE9FF' },      // Day
    { at: 0.38, top: '#5FA8E8', bottom: '#F7C17A' },   // Afternoon
    { at: 0.72, top: '#3D4F9A', bottom: '#D9785A' },   // Evening
    { at: 1, top: '#0A1640', bottom: '#13265C' }       // Night
];

const SPEAKER_SPRITES: Record<string, string> = {
    'Evil King Nopal Naha': '/nopalnaha.png',
    'Princess Bhondu': '/princessbhondu.png',
    'JKG Moki': '/jkgmoki.png'
};

const METEOR_STRIKES = [
    { top: 2, left: 95, duration: 1.6, delay: 0.0, size: 170 },
    { top: 8, left: 120, duration: 1.9, delay: 0.2, size: 200 },
    { top: 14, left: 105, duration: 1.5, delay: 0.45, size: 160 },
    { top: 20, left: 130, duration: 2.2, delay: 0.1, size: 240 },
    { top: 28, left: 112, duration: 1.7, delay: 0.65, size: 185 },
    { top: 36, left: 125, duration: 2.0, delay: 0.35, size: 210 },
    { top: 44, left: 100, duration: 1.45, delay: 0.75, size: 155 },
    { top: 54, left: 118, duration: 1.85, delay: 0.55, size: 190 },
    { top: 62, left: 133, duration: 2.1, delay: 0.25, size: 225 },
    { top: 70, left: 107, duration: 1.65, delay: 0.85, size: 175 }
];

// Level 1 Data
const LEVEL_1: LevelData = {
    spawn: { x: 50, y: 400 },
    dialogue: [
        { speaker: 'Evil King Nopal Naha', text: 'Princess Bhondu, hear my decree. The gates of Radhasoami Residency are sealed, the watchtowers are lit, and every road beyond these walls answers only to my shadow.' },
        { speaker: 'Princess Bhondu', text: 'You can lock the gates, Nopal Naha, but you cannot lock my heart. I was not born to fade behind your throne room curtains while the night swallows my name.' },
        { speaker: 'JKG Moki', text: 'Princess, I crossed silent courtyards and sleeping guards to reach you. I brought a bike, a route, and the last spark of hope before dawn. If you trust me, I will get you out.' },
        { speaker: 'Evil King Nopal Naha', text: 'Then run. Let the road judge you. Crates, spikes, and stone will tear your courage apart before sunrise. No one escapes my residency and keeps breathing.' },
        { speaker: 'Princess Bhondu', text: 'My hands are shaking, but not from fear of leaving. They shake because this is the moment my life changes forever. One choice... and there is no way back.' },
        { speaker: 'JKG Moki', text: 'Then choose me, Princess Bhondu. Choose freedom, choose us, and before we race into the dark... will you accept my help and be my Valentine?' }
    ],
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

function hexToRgb(hex: string) {
    const clean = hex.replace('#', '');
    return {
        r: Number.parseInt(clean.slice(0, 2), 16),
        g: Number.parseInt(clean.slice(2, 4), 16),
        b: Number.parseInt(clean.slice(4, 6), 16),
    };
}

function lerpColor(a: string, b: string, t: number) {
    const ca = hexToRgb(a);
    const cb = hexToRgb(b);
    const r = Math.round(ca.r + (cb.r - ca.r) * t);
    const g = Math.round(ca.g + (cb.g - ca.g) * t);
    const bVal = Math.round(ca.b + (cb.b - ca.b) * t);
    return `rgb(${r}, ${g}, ${bVal})`;
}

function getSkyGradient(ctx: CanvasRenderingContext2D, height: number, progress: number) {
    const clamped = Math.max(0, Math.min(1, progress));
    const rightIndex = SKY_KEYFRAMES.findIndex((k) => clamped <= k.at);

    if (rightIndex <= 0) {
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, SKY_KEYFRAMES[0].top);
        gradient.addColorStop(1, SKY_KEYFRAMES[0].bottom);
        return gradient;
    }

    const right = SKY_KEYFRAMES[rightIndex];
    const left = SKY_KEYFRAMES[rightIndex - 1];
    const span = Math.max(0.0001, right.at - left.at);
    const localT = (clamped - left.at) / span;

    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, lerpColor(left.top, right.top, localT));
    gradient.addColorStop(1, lerpColor(left.bottom, right.bottom, localT));
    return gradient;
}

function scoreToWorldX(levelSpawnX: number, score: number) {
    return levelSpawnX + score / SCORE_PER_PIXEL;
}

export default function PlatformerGame() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Game State
    const [gameState, setGameState] = useState<GameState>('DIALOGUE');
    const currentLevel = LEVEL_1;
    const [score, setScore] = useState(0);
    const [maxScore, setMaxScore] = useState(0);
    const [dialogueIndex, setDialogueIndex] = useState(0);
    const [kandivaliDialogueIndex, setKandivaliDialogueIndex] = useState(0);
    const [kandivaliNoPressed, setKandivaliNoPressed] = useState(false);
    const [declinedValentine, setDeclinedValentine] = useState(false);
    const [noButtonExploding, setNoButtonExploding] = useState(false);
    const [noButtonBlasted, setNoButtonBlasted] = useState(false);
    const [blastWaveActive, setBlastWaveActive] = useState(false);
    const [typedChars, setTypedChars] = useState(0);

    const hasShownKandivaliDialogueRef = useRef(false);

    const isInitialDialogue = gameState === 'DIALOGUE';
    const isKandivaliDialogue = gameState === 'KANDIVALI_DIALOGUE';
    const activeDialogueLines = isKandivaliDialogue ? KANDIVALI_MONOLOGUE : currentLevel.dialogue;
    const activeDialogueIndex = isKandivaliDialogue ? kandivaliDialogueIndex : dialogueIndex;

    const currentDialogueLine = activeDialogueLines[Math.min(activeDialogueIndex, activeDialogueLines.length - 1)];
    const isLastDialogueLine = activeDialogueIndex >= activeDialogueLines.length - 1;
    const valentinePromptIndex = currentLevel.dialogue.findIndex(
        (line) => line.speaker === 'JKG Moki' && line.text.includes('be my Valentine?')
    );
    const isValentinePrompt = isInitialDialogue && dialogueIndex === valentinePromptIndex;
    const isKandivaliPrompt = isKandivaliDialogue && isLastDialogueLine;
    const dialogueText = currentDialogueLine.text;
    const isTyping = typedChars < dialogueText.length;
    const visibleDialogueText = dialogueText.slice(0, typedChars);
    const showValentineChoiceButtons = isValentinePrompt && !isTyping;
    const showKandivaliChoiceButtons = isKandivaliPrompt && !isTyping;
    const displayedSpeakerName = showValentineChoiceButtons ? 'Princess Bhondu' : currentDialogueLine.speaker;
    const currentSpeakerSprite = SPEAKER_SPRITES[displayedSpeakerName] ?? '/jkgmoki.png';

    const startPlaying = () => {
        stopTypingSound();
        if (bgMusic.current && bgMusic.current.paused) {
            bgMusic.current.play().catch(() => {
                // Ignore if audio fails to play
            });
        }
        setGameState('PLAYING');
    };

    const playButtonSelectSound = () => {
        if (!buttonSelectSound.current) return;
        const clickSound = buttonSelectSound.current.cloneNode(true) as HTMLAudioElement;
        clickSound.volume = 0.75;
        clickSound.play().catch(() => {
            // Ignore if sound fails to play
        });
    };

    const startTypingSound = () => {
        if (!typingSound.current) return;
        const audio = typingSound.current;
        audio.loop = false;
        audio.volume = 0.2;
        audio.playbackRate = 1;
        if (!audio.paused) return;
        audio.currentTime = 0;
        audio.play().catch(() => {
            // Ignore if sound fails to play
        });
    };

    const stopTypingSound = () => {
        if (!typingSound.current) return;
        typingSound.current.pause();
        typingSound.current.currentTime = 0;
    };

    const handleNoChoice = () => {
        if (noButtonExploding || noButtonBlasted) return;
        playButtonSelectSound();
        setDeclinedValentine(true);
        setBlastWaveActive(true);
        setNoButtonExploding(true);
        window.setTimeout(() => {
            setNoButtonExploding(false);
            setNoButtonBlasted(true);
        }, 520);
        window.setTimeout(() => {
            setBlastWaveActive(false);
        }, 620);
    };

    const handleKandivaliYes = () => {
        playButtonSelectSound();
        stopTypingSound();
        setKandivaliNoPressed(false);
        setGameState('PLAYING');
    };

    const handleKandivaliNo = () => {
        playButtonSelectSound();
        setKandivaliNoPressed(true);
    };

    const advanceDialogue = () => {
        if (isValentinePrompt || isKandivaliPrompt) {
            return;
        }

        if (isTyping) {
            setTypedChars(dialogueText.length);
            return;
        }

        if (isKandivaliDialogue) {
            if (!isLastDialogueLine) {
                setKandivaliDialogueIndex((prev) => prev + 1);
            }
            return;
        }

        if (!isLastDialogueLine) {
            setDeclinedValentine(false);
            setNoButtonExploding(false);
            setNoButtonBlasted(false);
            setBlastWaveActive(false);
            setDialogueIndex((prev) => prev + 1);
            return;
        }
        startPlaying();
    };

    const resetRunToStart = () => {
        const level = LEVEL_1;
        const p = playerRef.current;
        p.x = level.spawn.x;
        p.y = level.spawn.y;
        p.vx = 0;
        p.vy = 0;
        p.isGrounded = false;

        hasStartedRef.current = false;
        jumpRequestedRef.current = false;
        obstaclesRef.current = [];
        nextObstacleXRef.current = 0;
        lastPlayerXRef.current = p.x;
        scoreAccumRef.current = 0;
        scoreRef.current = 0;
        setScore(0);

        deathCheckpointRef.current = {
            x: level.spawn.x,
            y: level.spawn.y,
            scoreAccum: 0,
            score: 0,
        };

        hasShownKandivaliDialogueRef.current = false;
        setGameState('PLAYING');
    };

    const respawnFromCheckpoint = () => {
        const level = LEVEL_1;
        const p = playerRef.current;
        const checkpoint = deathCheckpointRef.current;

        p.x = checkpoint.x;
        p.y = checkpoint.y;
        p.vx = 0;
        p.vy = 0;
        p.isGrounded = false;

        hasStartedRef.current = true;
        jumpRequestedRef.current = false;
        lastPlayerXRef.current = p.x;
        scoreAccumRef.current = checkpoint.scoreAccum;
        scoreRef.current = checkpoint.score;
        setScore(checkpoint.score);
        nextObstacleXRef.current = Math.max(nextObstacleXRef.current, p.x + 700);
        obstaclesRef.current = obstaclesRef.current.filter((obs) => obs.x > p.x + 120);
        hasShownKandivaliDialogueRef.current = p.x > scoreToWorldX(level.spawn.x, 1750);

        setGameState('PLAYING');
    };

    useEffect(() => {
        setTypedChars(0);
    }, [dialogueIndex, kandivaliDialogueIndex, gameState]);

    useEffect(() => {
        if (gameState === 'PLAYING') return;
        if (typedChars >= dialogueText.length) return;

        const timer = window.setTimeout(() => {
            setTypedChars((prev) => Math.min(prev + 1, dialogueText.length));
        }, TYPEWRITER_MS);

        return () => window.clearTimeout(timer);
    }, [dialogueText.length, gameState, typedChars]);

    useEffect(() => {
        if (gameState !== 'PLAYING' && isTyping) {
            startTypingSound();
        } else {
            stopTypingSound();
        }

        return () => {
            stopTypingSound();
        };
    }, [dialogueIndex, gameState, isTyping]);

    // Assets
    const cloudImg = useRef<HTMLImageElement | null>(null);
    const roadImg = useRef<HTMLImageElement | null>(null); // New Asset
    const playerImg = useRef<HTMLImageElement | null>(null);
    const treehouseImg = useRef<HTMLImageElement | null>(null);
    const obstacleImgs = useRef<Record<Obstacle['kind'], HTMLImageElement | null>>({
        rock: null,
        crate: null,
        spike: null,
    });
    const landmarkImgs = useRef<Record<LandmarkKind, HTMLImageElement | null>>({
        moviemax: null,
        rcity: null,
        betterhome: null,
        kandivali: null,
    });
    const jumpSound = useRef<HTMLAudioElement | null>(null);
    const buttonSelectSound = useRef<HTMLAudioElement | null>(null);
    const typingSound = useRef<HTMLAudioElement | null>(null);
    const bgMusic = useRef<HTMLAudioElement | null>(null);

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
    const deathCheckpointRef = useRef({
        x: LEVEL_1.spawn.x,
        y: LEVEL_1.spawn.y,
        scoreAccum: 0,
        score: 0,
    });

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

        const tImg = new Image();
        tImg.src = '/treehouse.png';
        treehouseImg.current = tImg;

        const rockImg = new Image();
        rockImg.src = '/rock.png';
        const crateImg = new Image();
        crateImg.src = '/crate.png';
        const spikeImg = new Image();
        spikeImg.src = '/spike.png';
        obstacleImgs.current = {
            rock: rockImg,
            crate: crateImg,
            spike: spikeImg,
        };

        const movieMaxImg = new Image();
        movieMaxImg.src = '/moviemax.png';
        const rCityImg = new Image();
        rCityImg.src = '/rcity.png';
        const betterHomeImg = new Image();
        betterHomeImg.src = '/betterhome.png';
        const kandivaliImg = new Image();
        kandivaliImg.src = '/kandivali.png';
        landmarkImgs.current = {
            moviemax: movieMaxImg,
            rcity: rCityImg,
            betterhome: betterHomeImg,
            kandivali: kandivaliImg,
        };

        // Load jump sound
        const audio = new Audio('/sound/jump.wav');
        jumpSound.current = audio;

        // Load button select sound
        const buttonAudio = new Audio('/sound/buttonselect.mp3');
        buttonSelectSound.current = buttonAudio;

        // Load typing sound
        const typingAudio = new Audio('/sound/typing.mp3');
        typingSound.current = typingAudio;

        // Load background music (will start on first user interaction)
        const bgAudio = new Audio('/sound/main_bg.mp3');
        bgAudio.loop = true;
        bgAudio.volume = 0.5;
        bgMusic.current = bgAudio;

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
        deathCheckpointRef.current = {
            x: level.spawn.x,
            y: level.spawn.y,
            scoreAccum: 0,
            score: 0,
        };
        setDialogueIndex(0);
        setKandivaliDialogueIndex(0);
        setKandivaliNoPressed(false);
        setDeclinedValentine(false);
        setNoButtonExploding(false);
        setNoButtonBlasted(false);
        setBlastWaveActive(false);
        setTypedChars(0);
        hasShownKandivaliDialogueRef.current = false;
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
        const handlePrimaryAction = () => {
            if (gameState === 'DEAD') {
                respawnFromCheckpoint();
                return;
            }

            if (gameState !== 'PLAYING') {
                if (isValentinePrompt || isKandivaliPrompt) {
                    return;
                }
                advanceDialogue();
                return;
            }

            hasStartedRef.current = true;
            jumpRequestedRef.current = true;

            if (bgMusic.current && bgMusic.current.paused) {
                bgMusic.current.play().catch(() => {
                    // Ignore if audio fails to play
                });
            }
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            keysRef.current[e.code] = true;

            if (e.code === 'Space') {
                e.preventDefault();
                handlePrimaryAction();
            }
        };
        const handleKeyUp = (e: KeyboardEvent) => { keysRef.current[e.code] = false; };
        const handlePointerDown = (e: PointerEvent) => {
            e.preventDefault();
            handlePrimaryAction();
        };
        const handleTouchStart = (e: TouchEvent) => {
            e.preventDefault();
            handlePrimaryAction();
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        const canvas = canvasRef.current;
        if (canvas) {
            canvas.addEventListener('pointerdown', handlePointerDown);
            canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
        }
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            if (canvas) {
                canvas.removeEventListener('pointerdown', handlePointerDown);
                canvas.removeEventListener('touchstart', handleTouchStart);
            }
        };
    }, [advanceDialogue, gameState, isKandivaliPrompt, isValentinePrompt]);

    // Stop background music on unmount only
    useEffect(() => {
        return () => {
            if (bgMusic.current) {
                bgMusic.current.pause();
                bgMusic.current.currentTime = 0;
            }
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

                    deathCheckpointRef.current = {
                        x: Math.max(level.spawn.x, p.x - 140),
                        y: level.spawn.y,
                        scoreAccum: scoreAccumRef.current,
                        score: scoreRef.current,
                    };
                }
                lastPlayerXRef.current = p.x;

                // Trigger Kandivali monologue once player crosses the Kandivali landmark
                if (!hasShownKandivaliDialogueRef.current) {
                    const kandivaliImg = landmarkImgs.current.kandivali;
                    const kandivaliHeight = LANDMARK_HEIGHTS.kandivali;
                    const kandivaliWidth = kandivaliImg && kandivaliImg.naturalHeight > 0
                        ? (kandivaliImg.naturalWidth / kandivaliImg.naturalHeight) * kandivaliHeight
                        : 320;
                    const kandivaliX = scoreToWorldX(level.spawn.x, 1750) + canvas.width * 0.35;

                    if (p.x > kandivaliX + kandivaliWidth) {
                        hasShownKandivaliDialogueRef.current = true;
                        setKandivaliDialogueIndex(0);
                        setKandivaliNoPressed(false);
                        setGameState('KANDIVALI_DIALOGUE');
                        return;
                    }
                }

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
                        const obsY = groundY - obs.height + OBSTACLE_VERTICAL_OFFSET;
                        if (
                            p.x < obs.x + obs.width &&
                            p.x + PLAYER_SIZE > obs.x &&
                            p.y < obsY + obs.height &&
                            p.y + PLAYER_SIZE > obsY
                        ) {
                            // Enter death state and offer checkpoint respawn.
                            p.x = Math.max(level.spawn.x, p.x - 40);
                            p.y = level.spawn.y;
                            p.vx = 0;
                            p.vy = 0;
                            p.isGrounded = false;
                            hasStartedRef.current = false;
                            jumpRequestedRef.current = false;
                            setGameState('DEAD');
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

            // Sky (slow day -> afternoon -> evening -> night transition)
            const skyProgress = Math.min(1, Math.max(0, (p.x - level.spawn.x) / DAY_NIGHT_DISTANCE));
            ctx.fillStyle = getSkyGradient(ctx, canvas.height, skyProgress);
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

            // Treehouse at the start of the road on land
            const ground = platforms.find(plat => plat.type === 'ground');
            if (ground) {
                const roadAspect = roadImg.current ? roadImg.current.height / roadImg.current.width : 0;
                const roadHeight = roadImg.current ? ROAD_TILE_WIDTH * roadAspect : 0;
                const roadTopY = roadImg.current ? ground.y + ground.height - roadHeight : ground.y;

                if (treehouseImg.current && treehouseImg.current.complete && treehouseImg.current.naturalHeight > 0) {
                    const treehouseWidth = (treehouseImg.current.width / treehouseImg.current.height) * TREEHOUSE_HEIGHT;
                    const treehouseY = roadTopY - TREEHOUSE_HEIGHT;
                    ctx.drawImage(treehouseImg.current, TREEHOUSE_X, treehouseY, treehouseWidth, TREEHOUSE_HEIGHT);
                }

                // Story landmarks in sequence: MovieMax -> R City -> Better Home -> Kandivali
                // They are placed in world space from the start (no spawn pop-in).
                // Kandivali is naturally far enough to be reached after ~1700+ score.
                LANDMARK_SCORES_IN_ORDER.forEach((landmark) => {
                    const img = landmarkImgs.current[landmark.kind];
                    if (!img || !img.complete || img.naturalHeight <= 0) return;

                    const baseX = scoreToWorldX(level.spawn.x, landmark.score) + canvas.width * 0.35;
                    const baseHeight = LANDMARK_HEIGHTS[landmark.kind];
                    const baseWidth = (img.naturalWidth / img.naturalHeight) * baseHeight;

                    const viewLeft = -cameraX;
                    const viewRight = viewLeft + canvas.width;
                    if (baseX + baseWidth < viewLeft - 300 || baseX > viewRight + 300) return;

                    const y = roadTopY - baseHeight;
                    ctx.drawImage(img, baseX, y, baseWidth, baseHeight);
                });
            }

            // Obstacles
            if (ground) {
                const groundY = ground.y;
                const viewLeft = -cameraX;
                const viewRight = viewLeft + canvas.width;
                obstaclesRef.current = obstaclesRef.current.filter(obs => obs.x + obs.width > viewLeft - 400);
                obstaclesRef.current.forEach(obs => {
                    if (obs.x > viewRight + 400) return;
                    const obsY = groundY - obs.height + OBSTACLE_VERTICAL_OFFSET;
                    const obsImg = obstacleImgs.current[obs.kind];

                    if (obsImg && obsImg.complete && obsImg.naturalHeight > 0) {
                        const aspect = obsImg.naturalWidth / obsImg.naturalHeight;
                        const drawHeight = obs.height;
                        const drawWidth = Math.max(obs.width, drawHeight * aspect);
                        ctx.drawImage(obsImg, obs.x, obsY, drawWidth, drawHeight);
                    } else {
                        ctx.fillStyle = obs.kind === 'spike' ? '#B91C1C' : obs.kind === 'crate' ? '#8B5A2B' : '#4B5563';
                        ctx.fillRect(obs.x, obsY, obs.width, obs.height);
                    }
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
        <div className="relative w-full h-screen bg-black touch-none">
            <canvas ref={canvasRef} className="block w-full h-full touch-none" />

            {declinedValentine && gameState === 'DIALOGUE' && (
                <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
                    {METEOR_STRIKES.map((meteor, index) => (
                        <div
                            key={`${meteor.top}-${meteor.left}-${index}`}
                            className="meteor-strike"
                            style={{
                                top: `${meteor.top}%`,
                                left: `${meteor.left}%`,
                                width: `${meteor.size}px`,
                                animationDuration: `${meteor.duration}s`,
                                animationDelay: `${meteor.delay}s`
                            }}
                        />
                    ))}
                </div>
            )}

            {/* UI Overlays */}

            {(gameState === 'DIALOGUE' || gameState === 'KANDIVALI_DIALOGUE') && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-8 z-10 transition-opacity duration-500">
                    <div className={`bg-white p-6 rounded-lg max-w-2xl w-full shadow-xl border-4 border-blue-500 relative overflow-hidden ${blastWaveActive ? 'animate-blast-shake' : ''}`} style={{ fontFamily: 'var(--font-pixel), monospace' }}>
                        {blastWaveActive && <div className="blast-flash-overlay" />}
                        <h2 className="text-lg md:text-xl mb-5 text-black leading-relaxed">{isKandivaliDialogue ? 'KANDIVALI' : 'MISSION BRIEF'}</h2>
                        <div className="flex items-start gap-4 md:gap-6 mb-6">
                            <div className="shrink-0 rounded border-4 border-black bg-slate-100 p-1">
                                <NextImage
                                    src={currentSpeakerSprite}
                                    alt={displayedSpeakerName}
                                    width={96}
                                    height={96}
                                    className="w-20 h-20 md:w-24 md:h-24 pixelated"
                                    priority
                                />
                            </div>
                            <div className="flex-1 text-left">
                                <p className="text-[11px] md:text-xs uppercase tracking-wider text-blue-700 mb-3 leading-relaxed">{displayedSpeakerName}</p>
                                <p className="text-[12px] md:text-sm text-gray-800 min-h-24 leading-7 wrap-break-word">{visibleDialogueText}{isTyping ? '▋' : ''}</p>
                            </div>
                        </div>

                        {showValentineChoiceButtons ? (
                            <div className="flex flex-col items-center justify-center gap-3">
                                <div className="flex items-center justify-center gap-3">
                                    <button
                                        onClick={() => {
                                            playButtonSelectSound();
                                            startPlaying();
                                        }}
                                        className="px-6 py-3 bg-emerald-600 text-white rounded hover:bg-emerald-700 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase text-xs"
                                    >
                                        Yes
                                    </button>
                                    {!noButtonBlasted ? (
                                        <button
                                            onClick={handleNoChoice}
                                            className={`px-6 py-3 bg-rose-600 text-white rounded shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase text-xs ${noButtonExploding ? 'animate-no-blast-strong pointer-events-none' : 'hover:bg-rose-700'}`}
                                        >
                                            No
                                        </button>
                                    ) : (
                                        <div className="px-4 py-3 rounded border-2 border-amber-300 text-amber-900 bg-linear-to-r from-amber-100 via-orange-100 to-rose-100 uppercase text-[10px] blast-boom-badge">
                                            💥 KING STRIKE 💥
                                        </div>
                                    )}
                                </div>
                                {declinedValentine && (
                                    <p className="text-[10px] text-rose-700 mt-1 leading-relaxed text-center max-w-xl animate-danger-flash">
                                        ⚠ NOPAL NAHA ATTACKS! The sky is burning, the gates are collapsing, and there is only one choice left now: YES.
                                    </p>
                                )}
                            </div>
                        ) : showKandivaliChoiceButtons ? (
                            <div className="flex flex-col items-center justify-center gap-3">
                                <div className="flex items-center justify-center gap-3">
                                    <button
                                        onClick={handleKandivaliYes}
                                        className="px-6 py-3 bg-emerald-600 text-white rounded hover:bg-emerald-700 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase text-xs"
                                    >
                                        Yes
                                    </button>
                                    <button
                                        onClick={handleKandivaliNo}
                                        className="px-6 py-3 bg-rose-600 text-white rounded hover:bg-rose-700 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase text-xs"
                                    >
                                        No
                                    </button>
                                </div>
                                {kandivaliNoPressed && (
                                    <p className="text-[10px] text-rose-700 mt-1 leading-relaxed text-center max-w-xl">
                                        mujhe please hurt mat karo mein  chalak nahi hoon
                                    </p>
                                )}
                            </div>
                        ) : (
                            <button
                                onClick={() => {
                                    playButtonSelectSound();
                                    advanceDialogue();
                                }}
                                className="px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase text-xs"
                            >
                                {isTyping ? 'Continue' : isInitialDialogue && isLastDialogueLine ? 'Start Ride' : 'Next'}
                            </button>
                        )}
                    </div>
                </div>
            )}

            {gameState === 'DEAD' && (
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-6 z-10">
                    <div className="bg-white p-6 rounded-lg max-w-md w-full shadow-xl border-4 border-red-600 text-center" style={{ fontFamily: 'var(--font-pixel), monospace' }}>
                        <h2 className="text-xl text-black mb-3">You Crashed!</h2>
                        <p className="text-sm text-gray-700 mb-5">Respawn from this point?</p>
                        <div className="flex items-center justify-center gap-3">
                            <button
                                onClick={() => {
                                    playButtonSelectSound();
                                    respawnFromCheckpoint();
                                }}
                                className="px-5 py-3 bg-emerald-600 text-white rounded hover:bg-emerald-700 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase text-xs"
                            >
                                Respawn Here
                            </button>
                            <button
                                onClick={() => {
                                    playButtonSelectSound();
                                    resetRunToStart();
                                }}
                                className="px-5 py-3 bg-slate-700 text-white rounded hover:bg-slate-800 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase text-xs"
                            >
                                Restart
                            </button>
                        </div>
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
