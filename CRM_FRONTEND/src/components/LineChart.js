import React, { useEffect, useRef } from 'react';
import { Chart } from 'chart.js/auto';

const LineChart = () => {
  const chartRef = useRef(null); // Reference for the canvas element
  const chartInstanceRef = useRef(null); // Reference for the chart instance

  useEffect(() => {
    const ctx = chartRef.current.getContext('2d'); // Get the 2D context from the canvas

    // Clean up the existing chart instance if it exists before creating a new one
    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    // Create the chart instance
    chartInstanceRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['January', 'February', 'March', 'April', 'May', 'June', 'July'],
        datasets: [{
          label: 'Sessions',
          data: [65, 59, 80, 81, 56, 55, 40],
          borderColor: '#1d9bf0',
          backgroundColor: 'rgba(29, 155, 240, 0.2)',
          fill: true,
        }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            display: false, // Hide the legend
          },
        },
        scales: {
          x: {
            display: true,
          },
          y: {
            display: true,
            beginAtZero: true, // Start the Y-axis at 0
          },
        },
      },
    });

    // Cleanup function to destroy the chart when the component unmounts
    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }
    };
  }, []);

  return (
    <canvas ref={chartRef} id="lineChart"></canvas> // Attach the canvas to the ref
  );
};

export default LineChart;
