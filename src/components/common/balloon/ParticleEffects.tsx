import React from 'react';
import { motion } from 'framer-motion';
import { Box } from '@mui/material';

export interface Particle {
  id: string;
  x: number;
  y: number;
  color: string;
  size: number;
  type: 'circle' | 'confetti' | 'star' | 'droplet' | 'spark';
}

interface ParticleEffectsProps {
  particles: Particle[];
  onParticleComplete: (id: string) => void;
}

const ParticleShape: React.FC<{ particle: Particle; onComplete: () => void }> = ({ 
  particle, 
  onComplete 
}) => {
  const baseAnimation = {
    initial: { 
      scale: 0,
      opacity: 1,
      rotate: 0
    },
    animate: {
      scale: [0, 1.2, 1],
      opacity: [1, 1, 0],
      y: particle.y + Math.random() * 200 + 100,
      x: particle.x + (Math.random() - 0.5) * 300,
      rotate: Math.random() * 720
    },
    exit: {
      opacity: 0,
      scale: 0
    }
  };

  const getParticleContent = () => {
    switch (particle.type) {
      case 'circle':
        return (
          <Box
            sx={{
              width: particle.size,
              height: particle.size,
              borderRadius: '50%',
              backgroundColor: particle.color,
            }}
          />
        );
      
      case 'confetti':
        return (
          <Box
            sx={{
              width: particle.size,
              height: particle.size * 0.6,
              backgroundColor: particle.color,
              borderRadius: '2px',
            }}
          />
        );
      
      case 'star':
        return (
          <Box
            sx={{
              width: particle.size,
              height: particle.size,
              color: particle.color,
              fontSize: particle.size,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ⭐
          </Box>
        );
      
      case 'droplet':
        return (
          <Box
            sx={{
              width: particle.size,
              height: particle.size * 1.2,
              backgroundColor: particle.color,
              borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
              opacity: 0.7,
            }}
          />
        );
      
      case 'spark':
        return (
          <Box
            sx={{
              width: particle.size * 0.3,
              height: particle.size,
              backgroundColor: particle.color,
              borderRadius: '1px',
            }}
          />
        );
      
      default:
        return null;
    }
  };

  return (
    <motion.div
      key={particle.id}
      initial={baseAnimation.initial}
      animate={baseAnimation.animate}
      exit={baseAnimation.exit}
      transition={{
        duration: particle.type === 'confetti' ? 3 : 2,
        ease: 'easeOut'
      }}
      onAnimationComplete={onComplete}
      style={{
        position: 'absolute',
        left: particle.x,
        top: particle.y,
        zIndex: 1000,
        pointerEvents: 'none'
      }}
    >
      {getParticleContent()}
    </motion.div>
  );
};

export const ParticleEffects: React.FC<ParticleEffectsProps> = ({ 
  particles, 
  onParticleComplete 
}) => {
  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 999,
      }}
    >
      {particles.map((particle) => (
        <ParticleShape
          key={particle.id}
          particle={particle}
          onComplete={() => onParticleComplete(particle.id)}
        />
      ))}
    </Box>
  );
};

// Utility functions for creating particles
export const createPopParticles = (x: number, y: number, color: string): Particle[] => {
  const particles: Particle[] = [];
  const particleCount = 8;
  
  for (let i = 0; i < particleCount; i++) {
    particles.push({
      id: `pop-${Date.now()}-${i}`,
      x: x + (Math.random() - 0.5) * 20,
      y: y + (Math.random() - 0.5) * 20,
      color,
      size: Math.random() * 8 + 4,
      type: 'circle'
    });
  }
  
  return particles;
};

export const createConfettiParticles = (x: number, y: number): Particle[] => {
  const particles: Particle[] = [];
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];
  const particleCount = 20;
  
  for (let i = 0; i < particleCount; i++) {
    particles.push({
      id: `confetti-${Date.now()}-${i}`,
      x: x + (Math.random() - 0.5) * 40,
      y: y + (Math.random() - 0.5) * 40,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 6 + 3,
      type: 'confetti'
    });
  }
  
  return particles;
};

export const createStarParticles = (x: number, y: number): Particle[] => {
  const particles: Particle[] = [];
  const colors = ['#FFD700', '#FFA500', '#FF69B4', '#00CED1'];
  const particleCount = 5;
  
  for (let i = 0; i < particleCount; i++) {
    particles.push({
      id: `star-${Date.now()}-${i}`,
      x: x + (Math.random() - 0.5) * 30,
      y: y + (Math.random() - 0.5) * 30,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 16 + 12,
      type: 'star'
    });
  }
  
  return particles;
};

export const createDropletParticles = (x: number, y: number): Particle[] => {
  const particles: Particle[] = [];
  const particleCount = 6;
  
  for (let i = 0; i < particleCount; i++) {
    particles.push({
      id: `droplet-${Date.now()}-${i}`,
      x: x + (Math.random() - 0.5) * 25,
      y: y + (Math.random() - 0.5) * 25,
      color: 'rgba(100, 200, 255, 0.7)',
      size: Math.random() * 6 + 4,
      type: 'droplet'
    });
  }
  
  return particles;
};

export const createFireworkParticles = (x: number, y: number, color: string): Particle[] => {
  const particles: Particle[] = [];
  const particleCount = 15;
  
  for (let i = 0; i < particleCount; i++) {
    particles.push({
      id: `firework-${Date.now()}-${i}`,
      x: x + (Math.random() - 0.5) * 10,
      y: y + (Math.random() - 0.5) * 10,
      color,
      size: Math.random() * 4 + 2,
      type: 'spark'
    });
  }
  
  return particles;
};