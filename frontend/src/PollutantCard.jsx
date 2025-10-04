import React from 'react';

function PollutantCard({ name, value, unit, status }) {
  
  const getColor = () => {
    if (status === 'Good') return '#10b981';
    if (status === 'Moderate') return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div style={{
      border: '1px solid #ddd',
      borderRadius: '10px',
      padding: '20px',
      backgroundColor: '#f9f9f9',
      margin: '10px'
    }}>
      <h3 style={{ margin: '0 0 10px 0' }}>{name}</h3>
      <div style={{ fontSize: '32px', fontWeight: 'bold' }}>
        {value} <span style={{ fontSize: '16px' }}>{unit}</span>
      </div>
      <div style={{
        display: 'inline-block',
        padding: '5px 10px',
        borderRadius: '5px',
        backgroundColor: getColor(),
        color: 'white',
        fontSize: '14px',
        marginTop: '10px'
      }}>
        {status}
      </div>
    </div>
  );
}

export default PollutantCard;