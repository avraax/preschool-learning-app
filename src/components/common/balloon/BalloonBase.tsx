import React from 'react';
import { motion } from 'framer-motion';

export interface BalloonProps {
  id: string;
  x: number;
  y: number;
  size: number;
  color: string;
  content?: string;
  shape?: 'round' | 'heart' | 'star' | 'animal';
  isPopped?: boolean;
  onClick: (id: string, x: number, y: number) => void;
  floatDuration?: number;
  children?: React.ReactNode;
  movementAngle?: number; // Optional movement angle for direction
}

interface BalloonBaseProps extends BalloonProps {
  customShape?: React.ReactNode;
  popAnimation?: any;
}

export const BalloonBase: React.FC<BalloonBaseProps> = ({
  id,
  x,
  y,
  size,
  color,
  content,
  shape = 'round',
  isPopped = false,
  onClick,
  floatDuration = 10,
  children,
  customShape,
  popAnimation,
  movementAngle
}) => {
  const getGradientId = (balloonId: string) => `balloon-gradient-${balloonId}`;
  
  const getLighterColor = (baseColor: string) => {
    // Simple color lightening - in production, use a proper color library
    const colors: { [key: string]: string } = {
      '#EF4444': '#FCA5A5', // Red
      '#3B82F6': '#93BBFC', // Blue
      '#10B981': '#6EE7B7', // Green
      '#FDE047': '#FEF3C7', // Yellow
      '#8B5CF6': '#C4B5FD', // Purple
      '#F97316': '#FDBA74', // Orange
      '#EC4899': '#F9A8D4', // Pink
    };
    return colors[baseColor] || baseColor;
  };

  const getDarkerColor = (baseColor: string) => {
    const colors: { [key: string]: string } = {
      '#EF4444': '#DC2626', // Red
      '#3B82F6': '#1D4ED8', // Blue
      '#10B981': '#059669', // Green
      '#FDE047': '#EAB308', // Yellow
      '#8B5CF6': '#6B46C1', // Purple
      '#F97316': '#EA580C', // Orange
      '#EC4899': '#BE185D', // Pink
    };
    return colors[baseColor] || baseColor;
  };

  // Use provided movement angle or fallback to ID-based calculation
  const seedFromId = parseInt(id.split('-').pop() || '0');
  const angle = movementAngle !== undefined ? movementAngle : (seedFromId * Math.PI * 2) / 10;
  const outwardDistance = 250;
  const outwardX = x + Math.cos(angle) * outwardDistance;
  const outwardY = y + Math.sin(angle) * outwardDistance;

  // Different animations based on balloon state
  const getAnimation = () => {
    if (isPopped) {
      // Quick pop animation
      return popAnimation || {
        scale: [1, 0],
        opacity: [1, 0], 
        rotate: [0, 0],
        x: 0,
        y: 0
      };
    } else {
      // Normal floating animation that naturally exits viewport at top
      return {
        y: [0, outwardY - y, (outwardY - y) - 1000], // Float far upward until out of view
        x: [0, outwardX - x, (outwardX - x) + Math.sin(seedFromId * 0.1) * 20], // Slight horizontal drift
        rotate: [0, 0, 0], // No rotation - balloons stay upright
        opacity: [0, 1, 1, 1, 1], // Fade in, stay visible throughout
        scale: [0.1, 1.2, 1, 1, 1] // Grow, settle, stay normal size
      };
    }
  };

  const renderBalloonShape = () => {
    if (customShape) {
      return customShape;
    }

    const gradientId = getGradientId(id);
    
    switch (shape) {
      case 'round':
        return (
          <svg width={size} height={size * 1.2} viewBox="0 0 100 120">
            <defs>
              <radialGradient id={gradientId} cx="40%" cy="30%">
                <stop offset="0%" stopColor={getLighterColor(color)} />
                <stop offset="100%" stopColor={color} />
              </radialGradient>
            </defs>
            {/* Balloon body */}
            <ellipse
              cx="50"
              cy="45"
              rx="35"
              ry="40"
              fill={`url(#${gradientId})`}
              stroke={getDarkerColor(color)}
              strokeWidth="2"
            />
            {/* Highlight */}
            <ellipse
              cx="35"
              cy="30"
              rx="12"
              ry="18"
              fill="rgba(255, 255, 255, 0.4)"
            />
            {/* String */}
            <line
              x1="50"
              y1="85"
              x2="50"
              y2="115"
              stroke={getDarkerColor(color)}
              strokeWidth="2"
              strokeLinecap="round"
            />
            {/* Content text */}
            {content && (
              <text
                x="50"
                y="50"
                textAnchor="middle"
                fontSize="20"
                fontWeight="bold"
                fill="white"
                stroke={getDarkerColor(color)}
                strokeWidth="1"
              >
                {content}
              </text>
            )}
          </svg>
        );
      
      case 'heart':
        return (
          <svg width={size} height={size * 1.2} viewBox="0 0 100 120">
            <defs>
              <radialGradient id={gradientId} cx="40%" cy="30%">
                <stop offset="0%" stopColor={getLighterColor(color)} />
                <stop offset="100%" stopColor={color} />
              </radialGradient>
            </defs>
            <path
              d="M50 75 C30 55, 10 40, 10 25 C10 15, 20 10, 30 15 C40 10, 50 15, 50 25 C50 15, 60 10, 70 15 C80 10, 90 15, 90 25 C90 40, 70 55, 50 75 Z"
              fill={`url(#${gradientId})`}
              stroke={getDarkerColor(color)}
              strokeWidth="2"
            />
            <line
              x1="50"
              y1="85"
              x2="50"
              y2="115"
              stroke={getDarkerColor(color)}
              strokeWidth="2"
              strokeLinecap="round"
            />
            {content && (
              <text
                x="50"
                y="45"
                textAnchor="middle"
                fontSize="16"
                fontWeight="bold"
                fill="white"
                stroke={getDarkerColor(color)}
                strokeWidth="1"
              >
                {content}
              </text>
            )}
          </svg>
        );
      
      default:
        return renderBalloonShape(); // Fallback to round
    }
  };

  return (
    <motion.div
      key={id}
      initial={{ 
        y: 0, // Start at CSS position
        x: 0, // Start at CSS position
        scale: 0.1, // Start very small
        opacity: 0,
        rotate: 0
      }}
      animate={getAnimation()}
      exit={{
        scale: 0,
        opacity: 0
      }}
      transition={{
        duration: isPopped ? 0.05 : floatDuration, // Pop: 0.05s, Float: full duration
        ease: isPopped ? "linear" : ["easeOut", "linear", "linear", "easeIn"], // Different easing per state
        times: isPopped ? undefined : [0, 0.05, 0.475, 0.49, 1], // Keep spawn speed, but start upward movement at half the original wait time
        repeat: 0, // No repeat
        repeatType: "loop"
      }}
      style={{
        position: 'fixed',
        left: x, // Explicitly set left position
        top: y,  // Explicitly set top position
        cursor: isPopped ? 'default' : 'pointer',
        zIndex: 100,
        pointerEvents: isPopped ? 'none' : 'auto'
      }}
      // No animation callbacks for performance
      onClick={(e) => {
        e.preventDefault();
        if (!isPopped) {
          const rect = e.currentTarget.getBoundingClientRect();
          const clickX = rect.left + rect.width / 2;
          const clickY = rect.top + rect.height / 2;
          onClick(id, clickX, clickY);
        }
      }}
      // Keyboard accessibility
      onKeyDown={(e) => {
        if ((e.key === ' ' || e.key === 'Enter') && !isPopped) {
          const rect = e.currentTarget.getBoundingClientRect();
          onClick(id, rect.left + rect.width / 2, rect.top + rect.height / 2);
        }
      }}
      tabIndex={isPopped ? -1 : 0}
      role="button"
      aria-label={`Pop balloon ${content || id}`}
    >
      {renderBalloonShape()}
      {children}
    </motion.div>
  );
};

export default BalloonBase;