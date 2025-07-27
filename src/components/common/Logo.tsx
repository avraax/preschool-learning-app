import React from 'react';
import { Box, SxProps, Theme } from '@mui/material';

interface LogoProps {
  size?: number | string;
  sx?: SxProps<Theme>;
  onClick?: () => void;
  alt?: string;
}

/**
 * App Logo Component
 * 
 * Displays the Børnelæring app logo with beautiful balloon design.
 * Can be used in headers, splash screens, loading screens, etc.
 * 
 * @param size - Size of the logo (default: 120px)
 * @param sx - MUI sx props for styling
 * @param onClick - Optional click handler
 * @param alt - Alt text for accessibility
 */
export const Logo: React.FC<LogoProps> = ({
  size = 120,
  sx = {},
  onClick,
  alt = "Børnelæring - Danish Learning App Logo"
}) => {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.2s ease-in-out',
        '&:hover': onClick ? {
          transform: 'scale(1.05)',
        } : {},
        ...sx
      }}
      onClick={onClick}
    >
      <Box
        component="img"
        src="/icon-512x512.png"
        alt={alt}
        sx={{
          width: size,
          height: size,
          objectFit: 'contain',
          filter: 'drop-shadow(0 4px 8px rgba(139, 92, 246, 0.3))',
          borderRadius: '16px',
        }}
      />
    </Box>
  );
};

/**
 * Small Logo variant for headers and navigation
 */
export const LogoSmall: React.FC<Omit<LogoProps, 'size'>> = (props) => (
  <Logo size={48} {...props} />
);

/**
 * Large Logo variant for splash screens and home page
 */
export const LogoLarge: React.FC<Omit<LogoProps, 'size'>> = (props) => (
  <Logo size={200} {...props} />
);

/**
 * SVG Logo Component for cases where vector graphics are preferred
 * (e.g., when scaling to very large sizes or when transparency is needed)
 */
export const LogoSVG: React.FC<LogoProps> = ({
  size = 120,
  sx = {},
  onClick,
  alt = "Børnelæring - Danish Learning App Logo"
}) => {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.2s ease-in-out',
        '&:hover': onClick ? {
          transform: 'scale(1.05)',
        } : {},
        ...sx
      }}
      onClick={onClick}
    >
      <Box
        component="img"
        src="/icon-source.svg"
        alt={alt}
        sx={{
          width: size,
          height: size,
          objectFit: 'contain',
          filter: 'drop-shadow(0 4px 8px rgba(139, 92, 246, 0.3))',
        }}
      />
    </Box>
  );
};

export default Logo;