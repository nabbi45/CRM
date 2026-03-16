import React, { useEffect } from 'react';
import { Chart } from 'chart.js/auto';

const DonutChart = ({ chartId }) => {
  useEffect(() => {
    const ctx = document.getElementById(chartId).getContext('2d');
    new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Red', 'Blue', 'Yellow'],
        datasets: [{
          label: 'Sessions',
          data: [300, 50, 100],
          backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56'],
        }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'top',
          },
        },
      },
    });
  }, [chartId]);

  return (
    <canvas id={chartId}></canvas>
  );
};

export default DonutChart;
