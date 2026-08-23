import React from 'react';

export default function AnimatedCollapse({ isOpen, children, style }) {
  return (
    <div 
      style={{ 
        display: 'grid',
        gridTemplateRows: isOpen ? '1fr' : '0fr',
        transition: 'grid-template-rows 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease',
        opacity: isOpen ? 1 : 0,
        ...style
      }}
    >
      <div style={{ overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
}
