import React from 'react';
import Card from './Card';

interface AnimatedCardProps extends React.ComponentProps<typeof Card> {
  delay?: number;
  animation?: 'fadeIn' | 'slideUp' | 'scaleIn';
}

export default function AnimatedCard({ 
  delay = 0, 
  animation = 'fadeIn',
  className = '',
  children,
  ...props 
}: AnimatedCardProps) {
  const animationClasses = {
    fadeIn: 'animate-fadeIn',
    slideUp: 'animate-slideUp',
    scaleIn: 'animate-scaleIn'
  };

  return (
    <Card 
      className={`${animationClasses[animation]} ${className}`}
      style={{ animationDelay: `${delay}ms` }}
      {...props}
    >
      {children}
    </Card>
  );
}