import React, { useEffect, useState } from 'react';
import './Scorecard.css'; // Create this CSS file for styling
import { Doughnut } from 'react-chartjs-2'; // Import Chart.js's Doughnut chart
import { apiUrl } from './LoginSignup';
import { getBookingRevenueForUser } from '../utils/bookingRevenue';

const Scorecard = () => {
  const [totalReceivedAmount, setTotalReceivedAmount] = useState(0); // Store total received amount (Revenue)
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userSession = JSON.parse(localStorage.getItem('userSession'));
    if (userSession && userSession.user_id) {
      fetchTotalReceivedAmount(userSession); // Fetch the total received amount based on user role and ID
    } else {
      console.error('User session not found.');
      setLoading(false);
    }
  }, []);

  // Fetch bookings and calculate total received amount (Revenue)
  const fetchTotalReceivedAmount = (userSession) => {
    setLoading(true);
    const adminRoles = ['admin', 'dev', 'senior admin', 'super admin', 'director', 'srdev', 'sr dev'];
    const isAdmin = adminRoles.includes((userSession.user_role || '').toLowerCase());

    // Construct the correct API endpoint based on user role
    const url = isAdmin
      ? `${apiUrl}/booking/all`
      : `${apiUrl}/user/bookings/${userSession.user_id}`;

    fetch(url, { headers: { authorization: userSession.token || '' } })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then((data) => {
        const bookingsData = data.Allbookings || data;
        const totalReceived = bookingsData.reduce((acc, booking) => {
          return acc + getBookingRevenueForUser(booking, userSession.user_id, isAdmin, () => true);
        }, 0);

        setTotalReceivedAmount(totalReceived); // Set total received amount (revenue) in state
        setLoading(false);
      })
      .catch((error) => {
        console.error('Error fetching total received amount:', error);
        setLoading(false);
      });
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  const netAmount = totalReceivedAmount;
  const target = 200000; // Set the target to 2 lakh (200,000 INR)
  const progressPercentage = ((netAmount / target) * 100).toFixed(2); // Progress towards target

  // Donut chart data
  const chartData = {
    datasets: [
      {
        data: [netAmount, target - netAmount], // Net amount is filled portion, rest is the remaining target
        backgroundColor: ['#ff3b1f', '#e5e7eb'],
        hoverBackgroundColor: ['#e03118', '#d1d5db'],
      },
    ],
  };

  const chartOptions = {
    cutout: '70%', // Hollow center for the donut
    plugins: {
      tooltip: {
        enabled: false, // Disable tooltip
      },
    },
  };

  return (
    <div className="scorecard-container">
      {/* Left Side: Table with Stats */}
      <div className="scorecard-stats">
        <table>
          <thead>
            <tr>
              <th>Field</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Target :-</td>
              <td>{target.toLocaleString()} INR</td>
            </tr>
            <tr>
              <td>Total Received Amount :-</td>
              <td>{totalReceivedAmount.toLocaleString()} INR</td>
            </tr>
            <tr>
              <td>Net Revenue (ScoreCard):-</td>
              <td>{netAmount.toFixed(2)} INR</td>
            </tr>
            {/* You can add more fields here if needed */}
          </tbody>
        </table>
      </div>

      {/* Right Side: Donut Chart */}
      <div className="scorecard-chart">
        <Doughnut data={chartData} options={chartOptions} />
        <div className="chart-percentage">
          <h3>{progressPercentage}%</h3>
          <p>of Target</p>
        </div>
      </div>
    </div>
  );
};

export default Scorecard;
